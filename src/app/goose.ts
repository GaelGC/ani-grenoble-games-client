import { Event, GameConfiguration, GameState, GooseBoard, MoveEvent, Player, Question, QuestionSet, Slot, SwapEvent, TagSelectorSlot, TypeSelectorSlot, parseGooseBoard } from '@gaelgc/ani-grenoble-games-format'
import { readFileSync, writeFileSync } from 'fs'
import { CommandTarget, Context } from './context'
import { startGenericQuestion } from './question'
import { Queue } from './utils'
import { assert } from 'console'

class GooseState {
    players: Player[]
    skips: Map<Player, number>
    currentTeam: number

    constructor (players: Player[]) {
        this.players = players
        this.skips = new Map()
        this.currentTeam = -1
    }

    async advanceTeam (onSkip?: (teamIdx: number) => Promise<void>): Promise<number> {
        if (this.currentTeam === -1) {
            this.currentTeam = 0
            return this.currentTeam
        }

        while (true) {
            this.currentTeam = (this.currentTeam + 1) % this.players.length
            const player = this.players[this.currentTeam]
            if (!this.skips.has(player)) {
                break
            }

            if (onSkip) {
                await onSkip(this.currentTeam)
            }
            const remainingSkips = this.skips.get(player)! - 1
            if (remainingSkips === 0) {
                this.skips.delete(player)
            } else {
                this.skips.set(player, remainingSkips)
            }
        }

        return this.currentTeam
    }

    registerTeamSkip (teamIdx: number, nbTurns: number) {
        assert(nbTurns > 0, 'Asked for a 0/negative number of turn skips')
        this.skips.set(this.players[teamIdx], nbTurns)
    }
}

class GooseContext {
    ctx: Context
    state: GooseState
    config!: GameConfiguration
    board!: GooseBoard
    questions!: QuestionSet
    rollQueue: Queue<void>
    startQueue: Queue<void>
    doEventQueue: Queue<void>
    rollAnimationDoneQueue: Queue<void>
    boardAckQueue: Queue<void>
    inBoardUI = false

    /* Setup */

    constructor (ctx: Context, state: GameState) {
        this.ctx = ctx
        this.state = new GooseState(state.players)

        this.rollQueue = new Queue<void>('roll-dice')
        this.startQueue = new Queue<void>('start-question')
        this.doEventQueue = new Queue<void>('do-event')
        this.rollAnimationDoneQueue = new Queue<void>('roll-animation-done')
        this.boardAckQueue = new Queue<void>('board-ack')
    }

    destructor () {
        this.rollQueue.destroy()
        this.startQueue.destroy()
        this.doEventQueue.destroy()
        this.rollAnimationDoneQueue.destroy()
        this.boardAckQueue.destroy()
    }

    async waitForGooseBoardSelection (): Promise<GooseBoard> {
        const pickedFile = new Queue<string>('goose-board-file')

        const fileName = await pickedFile.get()
        const json = readFileSync(fileName).toString()
        const parsed = parseGooseBoard(json)
        if (parsed.err) {
            throw parsed.val
        }

        const oldVersion = JSON.parse(json).version
        if (oldVersion !== parsed.val.version) {
            writeFileSync(`${fileName}_updated`, JSON.stringify(parsed.val, undefined, 4))
        }

        pickedFile.destroy()
        return parsed.val
    }

    async setup () {
        this.ctx.userWindow.webContents.send('game-select')
        const pack = this.ctx.waitForPackSelection()
        const boardPromise = this.waitForGooseBoardSelection()
        const initUri = 'ui:///./html/game_of_the_goose_init.html'
        await this.ctx.loadPage(initUri, CommandTarget.ADMIN)

        const questions = await pack
        this.board = await boardPromise
        this.config = questions.configuration
        this.questions = questions
    }

    async loadBoardPage (teamIdx: number) {
        if (!this.inBoardUI) {
            const gameUri = 'ui:///./html/game_of_the_goose.html'
            await this.ctx.loadPage(gameUri, CommandTarget.BOTH)
            this.ctx.userWindow.webContents.send('board', this.board)
            this.ctx.userWindow.webContents.send('players', this.state.players)
            this.inBoardUI = true
            await this.boardAckQueue.get()
        }

        this.ctx.userWindow.webContents.send('current-player', teamIdx)
    }

    /* Interactions */

    async rollPhase (teamIdx: number): Promise<number> {
        await this.loadBoardPage(teamIdx)
        this.ctx.adminWindow.webContents.send('enable-roll')
        await this.rollQueue.get()
        const roll = Math.ceil(Math.random() * 6)
        this.ctx.userWindow.webContents.send('roll', roll)
        await this.rollAnimationDoneQueue.get()
        this.ctx.adminWindow.webContents.send('enable-start-question')

        return roll
    }

    async movePawn (teamIdx: number, scoreDiff: number) {
        let score = this.state.players[teamIdx].score + scoreDiff
        score = Math.max(score, 0)
        score = Math.min(score, this.board.slots.length)
        this.state.players[teamIdx].score = score

        if (this.inBoardUI) {
            const moveDoneQueue = new Queue<void>('absmove-animation-done')
            this.ctx.userWindow.webContents.send('absmove', score)
            await moveDoneQueue.waitForElem()
            moveDoneQueue.destroy()
        }
    }

    swapPawns (team1Idx: number, team2Idx: number) {
        const team1 = this.state.players[team1Idx]
        const team2 = this.state.players[team2Idx]
        const tmp = team1.score
        team1.score = team2.score
        team2.score = tmp

        if (this.inBoardUI) {
            this.ctx.userWindow.webContents.send('swap-players', team1Idx, team2Idx)
        }
    }

    async winPhase (teamIdx: number) {
        const winAckQueue = new Queue<void>('winners-ack')
        const winUri = 'ui:///./html/winners.html'
        await this.ctx.loadPage(winUri, CommandTarget.BOTH)
        this.ctx.userWindow.webContents.send('player_add', this.state.players[teamIdx])
        await winAckQueue.get()
        winAckQueue.destroy()
    }

    async onSkippedPlayerTurn (teamIdx: number) {
        await this.loadBoardPage(teamIdx)

        const skipEvent: Event = {
            type: 'skip',
            nbTurns: 1,
            text: 'Tour sauté'
        }

        this.ctx.userWindow.webContents.send('show-event', skipEvent)
        this.ctx.adminWindow.webContents.send('enable-do-event')
        await this.doEventQueue.get()
    }

    /* Questions */

    getGooseQuestion (questions: QuestionSet, selector: TypeSelectorSlot | TagSelectorSlot): Question {
        const compatible = questions.questions.filter(x => {
            if (selector.selector === 'TagSelector') {
                return x.tags.filter(tag => selector.tags.includes(tag)).length === selector.tags.length
            } else if (selector.selector === 'TypeSelector') {
                return selector.types.includes(x.type)
            }
            return false
        })

        if (compatible.length === 0) {
            throw Error('Could not find compatible question')
        }
        const idx = Math.floor(Math.random() * compatible.length)
        if (compatible.length !== 1) {
            questions.questions.splice(questions.questions.indexOf(compatible[idx]), 1)
        }
        return compatible[idx]
    }

    async handleGooseGameSlot (questions: QuestionSet, slot: TagSelectorSlot | TypeSelectorSlot,
        teamIdx: number, roll: number, config: GameConfiguration) {
        const question = this.getGooseQuestion(questions, slot)
        question.points = roll

        const tempPlayer: Player = {
            name: this.state.players[teamIdx].name,
            score: 0,
            color: this.state.players[teamIdx].color
        }
        const tempState: GameState = {
            players: [tempPlayer]
        }
        tempState.players[0].score = 0

        this.inBoardUI = false
        const result = await startGenericQuestion(this.ctx, question, config, tempState)
        if (result.players.length > 0) {
            await this.movePawn(teamIdx, result.points)
        }
    }

    /* Events */

    async handleMoveEvent (event: MoveEvent, teamIdx: number) {
        let relMove = 0

        switch (event.movetype) {
        case 'absolute':
            relMove = event.nbPos - this.state.players[teamIdx].score
            break
        case 'relative':
            relMove = event.nbPos
            break
        default: {
            const exhaustiveCheck: never = event.movetype
            throw new Error(`Unhandled move type: ${exhaustiveCheck}`)
        }
        }

        await this.movePawn(teamIdx, relMove)
    }

    handleSwapEvent (event: SwapEvent, teamIdx: number) {
        let otherPlayerIdx = 0
        const players = this.state.players
        const scoreMap = players.map(x => x.score)

        const selectCompatible = (predicate: (player: Player) => Boolean) => {
            const compatible = players.filter(predicate)
            const choice = compatible[Math.floor(Math.random() * compatible.length)]
            return players.indexOf(choice)
        }

        if (event.swapType === 'best') {
            const max = scoreMap.reduce((x, y) => x >= y ? x : y)
            otherPlayerIdx = selectCompatible(player => player.score === max)
        } else if (event.swapType === 'worst') {
            const min = scoreMap.reduce((x, y) => x < y ? x : y)
            otherPlayerIdx = selectCompatible(player => player.score === min)
        } else if (event.swapType === 'random') {
            otherPlayerIdx = selectCompatible(() => true)
        } else {
            const exhaustiveCheck: never = event.swapType
            throw new Error(`Unhandled move type: ${exhaustiveCheck}`)
        }

        this.swapPawns(teamIdx, otherPlayerIdx)
    }

    async handleEvent (event: Event, teamIdx: number, roll: number) {
        await this.movePawn(teamIdx, roll)
        await this.loadBoardPage(teamIdx)

        this.ctx.userWindow.webContents.send('show-event', event)
        this.ctx.adminWindow.webContents.send('enable-do-event')
        await this.doEventQueue.get()

        if (event.type === 'move') {
            await this.handleMoveEvent(event, teamIdx)
        } else if (event.type === 'swap') {
            this.handleSwapEvent(event, teamIdx)
        } else if (event.type === 'skip') {
            this.state.registerTeamSkip(teamIdx, event.nbTurns)
        } else {
            const exhaustiveCheck: never = event
            throw new Error(`Unhandled event type: ${exhaustiveCheck}`)
        }
    }

    /* Main loop */

    async slotPhase (slot: Slot, teamIdx: number, roll: number) {
        switch (slot.type) {
        case 'EventSlot':
            await this.handleEvent(slot.event, teamIdx, roll)
            break
        case 'GameSlot':
            await this.handleGooseGameSlot(this.questions, slot, teamIdx, roll, this.config)
            break
        default: {
            const exhaustiveCheck: never = slot
            throw new Error(`Unhandled color case: ${exhaustiveCheck}`)
        }
        }
    }

    async run () {
        await (this.setup())

        while (true) {
            const teamIdx = await this.state.advanceTeam(this.onSkippedPlayerTurn.bind(this))

            const roll = await this.rollPhase(teamIdx)
            const slotIdx: number = Math.min(this.board.slots.length, roll + this.state.players[teamIdx].score)
            await this.startQueue.get()

            const slot : Slot = slotIdx === this.board.slots.length
                ? { type: 'GameSlot', selector: 'TagSelector', tags: ['final'], pos: { x: 0, y: 0 }, tile: 0 }
                : this.board.slots[slotIdx]
            await this.slotPhase(slot, teamIdx, roll)

            if (this.state.players[teamIdx].score >= this.board.slots.length) {
                await this.winPhase(teamIdx)
                return
            }
        }
    }
}

export async function runGoose (ctx: Context, state: GameState) {
    const gooseCtx = new GooseContext(ctx, state)
    await gooseCtx.run()
    gooseCtx.destructor()
}
