import { GameConfiguration, GameState, GooseBoard, Player, Question, QuestionSet, Slot, TagSelectorSlot, TypeSelectorSlot, parseGooseBoard } from '@gaelgc/ani-grenoble-games-format'
import { readFileSync } from 'fs'
import { CommandTarget, Context } from './context'
import { startGenericQuestion } from './question'
import { Queue } from './utils'

class GooseContext {
    ctx: Context
    state: GameState
    config!: GameConfiguration
    board!: GooseBoard
    questions!: QuestionSet
    rollQueue: Queue<void>
    startQueue: Queue<void>
    rollAnimationDoneQueue: Queue<void>

    constructor (ctx: Context, state: GameState) {
        this.ctx = ctx
        this.state = state
        this.rollQueue = new Queue<void>('roll-dice')
        this.startQueue = new Queue<void>('start-question')
        this.rollAnimationDoneQueue = new Queue<void>('roll-animation-done')
    }

    destructor () {
        this.rollQueue.destroy()
        this.startQueue.destroy()
        this.rollAnimationDoneQueue.destroy()
    }

    async waitForGooseBoardSelection (): Promise<GooseBoard> {
        const pickedFile = new Queue<string>('goose-board-file')

        const fileName = await pickedFile.get()
        const json = readFileSync(fileName).toString()
        const parsed = parseGooseBoard(json)
        if (parsed.err) {
            throw parsed.val
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

    async rollPhase (teamIdx: number): Promise<number> {
        const gameUri = 'ui:///./html/game_of_the_goose.html'
        await this.ctx.loadPage(gameUri, CommandTarget.BOTH)
        this.ctx.userWindow.webContents.send('board', this.board)
        this.ctx.userWindow.webContents.send('players', this.state.players, teamIdx)
        await this.rollQueue.get()
        const roll = Math.ceil(Math.random() * 6)
        this.ctx.userWindow.webContents.send('roll', roll)
        await this.rollAnimationDoneQueue.get()
        this.ctx.adminWindow.webContents.send('roll-ack')

        return roll
    }

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

        const result = await startGenericQuestion(this.ctx, question, config, tempState)
        if (result.players.length > 0) {
            this.state.players[teamIdx].score += result.points
        }
    }

    async slotPhase (slot: Slot, teamIdx: number, roll: number) {
        switch (slot.type) {
        case 'EventSlot':
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

    async winPhase (teamIdx: number) {
        const winUri = 'ui:///./html/random_game_winners.html'
        await this.ctx.loadPage(winUri, CommandTarget.BOTH)
        this.ctx.userWindow.webContents.send('player_add', this.state.players[teamIdx])
    }

    async run () {
        await (this.setup())

        let teamIdx = 0
        while (true) {
            const roll = await this.rollPhase(teamIdx)
            const slotIdx: number = Math.min(this.board.slots.length, roll + this.state.players[teamIdx].score)
            await this.startQueue.get()

            const slot : Slot = slotIdx === this.board.slots.length
                ? { type: 'GameSlot', selector: 'TagSelector', tags: ['final'], pos: { x: 0, y: 0 } }
                : this.board.slots[slotIdx]
            await this.slotPhase(slot, teamIdx, roll)

            if (this.state.players[teamIdx].score >= this.board.slots.length) {
                await this.winPhase(teamIdx)
                return
            }

            teamIdx = (teamIdx + 1) % this.state.players.length
        }
    }
}

export async function runGoose (ctx: Context, state: GameState) {
    const gooseCtx = new GooseContext(ctx, state)
    await gooseCtx.run()
    gooseCtx.destructor()
}
