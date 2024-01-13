import { GameConfiguration, GameState, GooseBoard, Player, Question, QuestionSet, Slot, TagSelectorSlot, TypeSelectorSlot, parseGooseBoard } from '@gaelgc/ani-grenoble-games-format'
import { readFileSync } from 'fs'
import { dirname } from 'path'
import { CommandTarget, Context } from './context'
import { startGenericQuestion } from './question'
import { Queue } from './utils'

export class GooseContext {
    ctx: Context
    state: GameState
    constructor (ctx: Context, state: GameState) {
        this.ctx = ctx
        this.state = state
    }

    async waitForGooseBoardSelection (): Promise<GooseBoard> {
        const pickedFile = new Queue<string>('goose-board-file')
        const fileName = await pickedFile.get()
        const json = readFileSync(fileName).toString()
        const parsed = parseGooseBoard(json)
        if (parsed.err) {
            throw parsed.val
        }
        this.ctx.setPackPath(dirname(fileName) + '/')
        return parsed.val
    }

    getGooseQuestion (questions: QuestionSet, selector: TypeSelectorSlot | TagSelectorSlot): Question {
        const compatible = questions.questions.filter(x => {
            if (selector.selector === 'TagSelector') {
                if (x.tags === undefined) {
                    return false
                }
                for (const tag of selector.tags) {
                    if (!x.tags.includes(tag)) {
                        return false
                    }
                }
                return true
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

    async run () {
        this.ctx.userWindow.webContents.send('game-select')
        const pack = this.ctx.waitForPackSelection()
        const boardPromise = this.waitForGooseBoardSelection()
        const initUri = 'ui:///./html/game_of_the_goose_init.html'
        await this.ctx.loadPage(initUri, CommandTarget.ADMIN)
        const questions = await pack
        const config = questions.configuration
        const board = await boardPromise
        const rollQueue = new Queue<void>('roll-dice')
        const startQueue = new Queue<void>('start-question')
        const rollAnimationDoneQueue = new Queue<void>('roll-animation-done')

        let teamIdx = 0
        while (true) {
            const gameUri = 'ui:///./html/game_of_the_goose.html'
            await this.ctx.loadPage(gameUri, CommandTarget.BOTH)
            this.ctx.userWindow.webContents.send('board', board)
            this.ctx.userWindow.webContents.send('players', this.state.players, teamIdx)
            await rollQueue.get()
            const roll = Math.ceil(Math.random() * 6)
            this.ctx.userWindow.webContents.send('roll', roll)
            await rollAnimationDoneQueue.get()
            this.ctx.adminWindow.webContents.send('roll-ack')

            const slotIdx: number = Math.min(board.slots.length, roll + this.state.players[teamIdx].score)
            await startQueue.get()

            const slot : Slot = slotIdx === board.slots.length
                ? { type: 'GameSlot', selector: 'TagSelector', tags: ['final'], pos: { x: 0, y: 0 } }
                : board.slots[slotIdx]
            switch (slot.type) {
            case 'EventSlot':
                break
            case 'GameSlot':
                await this.handleGooseGameSlot(questions, slot, teamIdx, roll, config)
                break
            default: {
                const exhaustiveCheck: never = slot
                throw new Error(`Unhandled color case: ${exhaustiveCheck}`)
            }
            }

            if (this.state.players[teamIdx].score >= board.slots.length) {
                const winUri = 'ui:///./html/random_game_winners.html'
                await this.ctx.loadPage(winUri, CommandTarget.USER)
                this.ctx.userWindow.webContents.send('player_add', this.state.players[teamIdx])
                return
            }

            teamIdx = (teamIdx + 1) % this.state.players.length
        }
    }
}
