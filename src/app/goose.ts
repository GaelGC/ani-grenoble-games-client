import { Event, GameConfiguration, GameState, GooseBoard, MoveEvent, Player, Question, QuestionSet, Slot, SwapEvent, TagSelectorSlot, TypeSelectorSlot, parseGooseBoard } from '@gaelgc/ani-grenoble-games-format'
import { readFileSync, writeFileSync } from 'fs'
import { CommandTarget, Context } from './context'
import { startGenericQuestion } from './question'
import { Queue, unreachable } from './utils'
import { assert } from 'console'

class TeamTurnManager {
    turnSkipListener?: (teamIdx: number) => Promise<void>

    private players: Player[]
    private skips: Map<Player, number>
    private currentTeam: number

    constructor (players: Player[]) {
        this.players = players
        this.skips = new Map()
        this.currentTeam = -1
    }

    async getNextTeam (): Promise<Player> {
        if (this.currentTeam === -1) {
            this.currentTeam = 0
            return this.players[this.currentTeam]
        }

        while (true) {
            this.currentTeam = (this.currentTeam + 1) % this.players.length
            const player = this.players[this.currentTeam]
            if (!this.skips.has(player)) {
                break
            }

            if (this.turnSkipListener) {
                await this.turnSkipListener(this.currentTeam)
            }

            const remainingSkips = this.skips.get(player)! - 1
            if (remainingSkips === 0) {
                this.skips.delete(player)
            } else {
                this.skips.set(player, remainingSkips)
            }
        }

        return this.players[this.currentTeam]
    }

    registerTeamSkip (player: Player, nbTurns: number) {
        assert(nbTurns > 0, 'Asked for a 0/negative number of turn skips')
        this.skips.set(player, nbTurns)
    }
}

class ScoreManager {
    private scores: Map<Player, number>
    private pendingScores: Map<Player, number>
    private winningScore: number
    private winner?: Player

    winListener?: (winner: Player) => Promise<void>
    pendingScoreCommitListener?: (player: Player, newScore: number) => Promise<void>
    pendingScoreDropListener?: (player: Player, droppedScore: number, currentScore: number) => Promise<void>
    pendingScoreChangeListener?: (player: Player, oldScore: number, newScore: number) => Promise<void>
    swapListener?: (player1: Player, player2: Player) => Promise<void>

    constructor (players: Player[], winningScore: number) {
        this.scores = new Map()
        this.pendingScores = new Map()
        this.winningScore = winningScore

        for (const player of players) {
            this.scores.set(player, 0)
        }
    }

    hasWinner (): boolean {
        return this.winner !== undefined
    }

    async setWinner (player: Player) {
        this.winner = player
        if (this.winListener) {
            await this.winListener(player)
        }
    }

    async commitPendingScore (player: Player) {
        const optionalNewScore = this.pendingScores.get(player)
        if (optionalNewScore !== undefined) {
            this.scores.set(player, optionalNewScore)
            this.pendingScores.delete(player)
            if (this.pendingScoreCommitListener) {
                await this.pendingScoreCommitListener(player, optionalNewScore)
            }
            if (optionalNewScore >= this.winningScore) {
                await this.setWinner(player)
            }
        }
    }

    async dropPendingScore (player: Player) {
        const pendingScore = this.pendingScores.get(player)
        if (pendingScore === undefined) {
            return
        }

        if (this.pendingScoreDropListener) {
            await this.pendingScoreDropListener(player, pendingScore, this.scores.get(player)!)
        }

        this.pendingScores.delete(player)
    }

    async setScore (player: Player, pending: 'immediate' | 'pending', kind: 'absolute' | 'relative', score: number): Promise<number> {
        const currentScore = this.pendingScores.get(player) ?? this.scores.get(player)!
        let newScore = currentScore

        if (kind === 'absolute') {
            newScore = score
        } else if (kind === 'relative') {
            newScore = currentScore + score
        } else {
            unreachable(kind)
        }

        if (newScore > this.winningScore) {
            newScore = this.winningScore
        }
        this.pendingScores.set(player, newScore)

        if (pending === 'pending') {
            if (this.pendingScoreChangeListener) {
                await this.pendingScoreChangeListener(player, currentScore, newScore)
            }
        } else if (pending === 'immediate') {
            await this.commitPendingScore(player)
        } else {
            unreachable(pending)
        }

        return newScore
    }

    async swapPlayers (player1: Player, player2: Player) {
        await this.commitPendingScore(player1)
        await this.commitPendingScore(player2)
        const tmp = this.score(player1)
        this.scores.set(player1, this.score(player2))
        this.scores.set(player2, tmp)
        if (this.swapListener) {
            await this.swapListener(player1, player2)
        }
    }

    score (player: Player): number {
        return this.scores.get(player)!
    }
}

class GooseContext {
    ctx: Context
    turnManager: TeamTurnManager
    scoreManager: ScoreManager

    players: Player[]
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

    constructor (ctx: Context, state: GameState, board: GooseBoard, questions: QuestionSet) {
        this.ctx = ctx
        this.turnManager = new TeamTurnManager(state.players)
        this.turnManager.turnSkipListener = this.playerSkipHandler.bind(this)

        this.scoreManager = new ScoreManager(state.players, board.slots.length)
        this.scoreManager.winListener = this.winHandler.bind(this)
        this.scoreManager.pendingScoreChangeListener = this.pendingMoveHandler.bind(this)
        this.scoreManager.pendingScoreCommitListener = this.moveHandler.bind(this)
        this.scoreManager.swapListener = this.pawnSwapHandler.bind(this)

        this.players = state.players
        this.rollQueue = new Queue<void>('roll-dice')
        this.startQueue = new Queue<void>('start-question')
        this.doEventQueue = new Queue<void>('do-event')
        this.rollAnimationDoneQueue = new Queue<void>('roll-animation-done')
        this.boardAckQueue = new Queue<void>('board-ack')
        this.board = board
        this.config = questions.configuration
        this.questions = questions
    }

    destructor () {
        this.rollQueue.destroy()
        this.startQueue.destroy()
        this.doEventQueue.destroy()
        this.rollAnimationDoneQueue.destroy()
        this.boardAckQueue.destroy()
    }

    async loadBoardPage (teamIdx: number) {
        if (!this.inBoardUI) {
            const gameUri = 'ui:///./html/game_of_the_goose.html'
            await this.ctx.loadPage(gameUri, CommandTarget.BOTH)
            this.ctx.userWindow.webContents.send('board', this.board)
            this.ctx.userWindow.webContents.send('players', this.players.map(x => <Player>{ ...x, score: this.scoreManager.score(x) }))
            this.inBoardUI = true
            await this.boardAckQueue.get()
        }

        this.ctx.userWindow.webContents.send('current-player', teamIdx)
    }

    /* Interactions */

    async pawnSwapHandler (team1: Player, team2: Player) {
        if (this.inBoardUI) {
            this.ctx.userWindow.webContents.send('swap-players', this.players.indexOf(team1), this.players.indexOf(team2))
        }
    }

    async rollPhase (player: Player): Promise<number> {
        await this.loadBoardPage(this.players.indexOf(player))
        this.ctx.adminWindow.webContents.send('enable-roll')
        await this.rollQueue.get()
        const roll = Math.ceil(Math.random() * 6)
        this.ctx.userWindow.webContents.send('roll', roll)
        await this.rollAnimationDoneQueue.get()
        this.ctx.adminWindow.webContents.send('enable-start-question')

        return roll
    }

    async moveHandler (player: Player, score: number) {
        if (this.inBoardUI) {
            const moveDoneQueue = new Queue<void>('absmove-animation-done')
            this.ctx.userWindow.webContents.send('absmove', score)
            await moveDoneQueue.waitForElem()
            moveDoneQueue.destroy()
        }
    }

    pendingMoveHandler (player: Player, oldScore: number, score: number) {
        return this.moveHandler(player, score)
    }

    async swapPawns (team1: Player, team2: Player) {
        await this.scoreManager.swapPlayers(team1, team2)
    }

    async winHandler (winner: Player) {
        const winAckQueue = new Queue<void>('winners-ack')
        const winUri = 'ui:///./html/winners.html'
        await this.ctx.loadPage(winUri, CommandTarget.BOTH)
        this.ctx.userWindow.webContents.send('player_add', winner)
        await winAckQueue.get()
        winAckQueue.destroy()
    }

    async playerSkipHandler (teamIdx: number) {
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
        player: Player, roll: number, config: GameConfiguration) {
        const question = this.getGooseQuestion(questions, slot)
        question.points = roll

        const tempPlayer: Player = {
            name: player.name,
            score: 0,
            color: player.color
        }
        const tempState: GameState = {
            players: [tempPlayer]
        }

        this.inBoardUI = false
        const result = await startGenericQuestion(this.ctx, question, config, tempState)
        if (result.players.length > 0) {
            await this.scoreManager.commitPendingScore(player)
            if (slot.onWin) {
                await this.handleEvent(slot.onWin, player)
            }
        } else {
            await this.scoreManager.dropPendingScore(player)
            if (slot.onLose) {
                await this.handleEvent(slot.onLose, player)
            }
        }
    }

    /* Events */

    async handleMoveEvent (event: MoveEvent, player: Player) {
        await this.scoreManager.setScore(player, 'immediate', event.movetype, event.nbPos)
    }

    async handleSwapEvent (event: SwapEvent, player: Player) {
        let otherPlayer: Player | undefined
        const scoreMap = this.players.map(x => this.scoreManager.score(x))

        const selectCompatible = (predicate: (player: Player) => Boolean) => {
            const compatible = this.players.filter(predicate)
            const choice = compatible[Math.floor(Math.random() * compatible.length)]
            return choice
        }

        if (event.swapType === 'best') {
            const max = scoreMap.reduce((x, y) => x >= y ? x : y)
            otherPlayer = selectCompatible(player => this.scoreManager.score(player) === max)
        } else if (event.swapType === 'worst') {
            const min = scoreMap.reduce((x, y) => x < y ? x : y)
            otherPlayer = selectCompatible(player => this.scoreManager.score(player) === min)
        } else if (event.swapType === 'random') {
            otherPlayer = selectCompatible(() => true)
        } else {
            const exhaustiveCheck: never = event.swapType
            throw new Error(`Unhandled move type: ${exhaustiveCheck}`)
        }

        await this.swapPawns(player, otherPlayer)
    }

    async handleEvent (event: Event, player: Player) {
        await this.loadBoardPage(this.players.indexOf(player))

        this.ctx.userWindow.webContents.send('show-event', event)
        this.ctx.adminWindow.webContents.send('enable-do-event')
        await this.doEventQueue.get()

        if (event.type === 'move') {
            await this.handleMoveEvent(event, player)
        } else if (event.type === 'swap') {
            await this.handleSwapEvent(event, player)
        } else if (event.type === 'skip') {
            this.turnManager.registerTeamSkip(player, event.nbTurns)
        } else {
            const exhaustiveCheck: never = event
            throw new Error(`Unhandled event type: ${exhaustiveCheck}`)
        }
    }

    /* Main loop */

    async slotPhase (slot: Slot, player: Player, roll: number) {
        switch (slot.type) {
        case 'EventSlot':
            await this.scoreManager.commitPendingScore(player)
            await this.handleEvent(slot.event, player)
            break
        case 'GameSlot':
            await this.handleGooseGameSlot(this.questions, slot, player, roll, this.config)
            break
        default: {
            const exhaustiveCheck: never = slot
            throw new Error(`Unhandled color case: ${exhaustiveCheck}`)
        }
        }
    }

    async run () {
        while (!this.scoreManager.hasWinner()) {
            const player = await this.turnManager.getNextTeam()

            const roll = await this.rollPhase(player)
            const slotIdx = await this.scoreManager.setScore(player, 'pending', 'relative', roll)
            await this.startQueue.get()

            const slot : Slot = slotIdx === this.board.slots.length
                ? { type: 'GameSlot', selector: 'TagSelector', tags: ['final'], pos: { x: 0, y: 0 }, tile: 0 }
                : this.board.slots[slotIdx]
            await this.slotPhase(slot, player, roll)
        }
    }
}

export async function runGoose (ctx: Context, state: GameState) {
    async function waitForGooseBoardSelection (): Promise<GooseBoard> {
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

    async function setup (): Promise<[QuestionSet, GooseBoard]> {
        ctx.userWindow.webContents.send('game-select')
        const pack = ctx.waitForPackSelection()
        const boardPromise = waitForGooseBoardSelection()
        const initUri = 'ui:///./html/game_of_the_goose_init.html'
        await ctx.loadPage(initUri, CommandTarget.ADMIN)

        const questions = await pack
        const board = await boardPromise

        return [questions, board]
    }

    const [questions, board] = await setup()
    const gooseCtx = new GooseContext(ctx, state, board, questions)
    await gooseCtx.run()
    gooseCtx.destructor()
}
