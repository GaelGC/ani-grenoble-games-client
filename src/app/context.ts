import { Question, GameState, parseQuestions, QuestionSet, GooseBoard, parseGooseBoard, Slot, Player, GameConfiguration } from '@gaelgc/ani-grenoble-games-format'
import { BrowserWindow, ipcMain, ProtocolResponse, session } from 'electron'
import { debug } from './debug'
import { readFileSync } from 'fs'
import { dirname } from 'path'
import { Queue } from './utils'
import { waitForTeamsSelection } from './team-setup'
import { startGenericQuestion } from './question'

export enum CommandTarget {
    ADMIN = 1,
    USER = 2,
    BOTH = ADMIN | USER
}

export class Context {
    constructor (userWindow: BrowserWindow, adminWindow: BrowserWindow) {
        this.userWindow = userWindow
        this.adminWindow = adminWindow
        this.state = {
            players: []
        }
        this.giveHintListener = (_, hint) => {
            console.log(hint)
            this.userWindow.webContents.send('hint', hint)
        }
        ipcMain.on('give-hint', this.giveHintListener)

        for (const partitionName of ['user', 'admin']) {
            const partition = `persist:${partitionName}`
            const selectedSession = session.fromPartition(partition)
            selectedSession.protocol.registerFileProtocol('question', (request, callback) => {
                console.log(request.url)
                console.log(this.packPath)
                const url = decodeURI(request.url.replace('question://', ''))
                let response: ProtocolResponse = { path: url }
                if (url.length === 0 || url[0] !== '/') {
                    response = { path: this.packPath + url }
                }
                console.log(response)
                callback(response)
            })
        }
    }

    async loadPage (uri: string, target: CommandTarget) {
        const targets: [CommandTarget, BrowserWindow][] = [
            [CommandTarget.ADMIN, this.adminWindow],
            [CommandTarget.USER, this.userWindow]
        ]
        for (const [targetType, window] of targets) {
            if (target & targetType) {
                await window.loadURL(uri)
            }
        }
    }

    async setupTeams () {
        await this.loadPage('ui:///./html/index.html', CommandTarget.BOTH)
    }

    async run () {
        await this.setupTeams()
        await this.runMain()
    }

    async runMain () {
        const { players, mode } = await waitForTeamsSelection(this)
        this.state.players = players

        while (true) {
            if (mode === 'debug') {
                await this.debug()
            } else if (mode === 'random') {
                await this.randomGame()
            } else if (mode === 'game-of-the-goose') {
                await this.gooseGame()
            } else {
                throw Error(`Invalid main page ${mode} requested`)
            }
            for (const player of this.state.players) {
                player.score = 0
            }
        }
    }

    async waitForPackSelection (): Promise<QuestionSet> {
        const pickedFile = new Queue<string>('pack-file')
        const fileName = await pickedFile.get()
        const json = readFileSync(fileName).toString()
        const parsed = parseQuestions(json)
        if (parsed.err) {
            throw parsed.val
        }
        this.packPath = dirname(fileName) + '/'
        return parsed.val
    }

    async waitForConfiguration (init: GameConfiguration): Promise<GameConfiguration> {
        const configQueue = new Queue<GameConfiguration>('validate-config')
        await this.loadPage('ui:///./html/configure.html', CommandTarget.ADMIN)
        this.adminWindow.webContents.send('configuration', init)
        const config = await configQueue.get()
        configQueue.destroy()
        console.log(config.playlist, config.randomSample)
        return config
    }

    async waitForGooseBoardSelection (): Promise<GooseBoard> {
        const pickedFile = new Queue<string>('goose-board-file')
        const fileName = await pickedFile.get()
        const json = readFileSync(fileName).toString()
        const parsed = parseGooseBoard(json)
        if (parsed.err) {
            throw parsed.val
        }
        this.packPath = dirname(fileName) + '/'
        return parsed.val
    }

    getGooseQuestion (questions: QuestionSet, selector: Slot): Question {
        const compatible = questions.questions.filter(x => {
            if (selector.type === 'TagSelector') {
                if (x.tags === undefined) {
                    return false
                }
                for (const tag of selector.tags) {
                    if (!x.tags.includes(tag)) {
                        return false
                    }
                }
                return true
            } else if (selector.type === 'TypeSelector') {
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

    async gooseGame () {
        this.userWindow.webContents.send('game-select')
        const pack = this.waitForPackSelection()
        const boardPromise = this.waitForGooseBoardSelection()
        const initUri = 'ui:///./html/game_of_the_goose_init.html'
        await this.loadPage(initUri, CommandTarget.ADMIN)
        const questions = await pack
        const config = questions.configuration
        const board = await boardPromise
        const rollQueue = new Queue<void>('roll-dice')
        const startQueue = new Queue<void>('start-question')
        const rollAnimationDoneQueue = new Queue<void>('roll-animation-done')

        let teamIdx = 0
        while (true) {
            const gameUri = 'ui:///./html/game_of_the_goose.html'
            await this.loadPage(gameUri, CommandTarget.BOTH)
            this.userWindow.webContents.send('board', board)
            this.userWindow.webContents.send('players', this.state.players, teamIdx)
            await rollQueue.get()
            const roll = Math.ceil(Math.random() * 6)
            this.userWindow.webContents.send('roll', roll)
            await rollAnimationDoneQueue.get()
            this.adminWindow.webContents.send('roll-ack')

            const slotIdx: number = Math.min(board.slots.length, roll + this.state.players[teamIdx].score)
            const slot : Slot = slotIdx === board.slots.length
                ? { type: 'TagSelector', tags: ['final'], coordinates: { x: 0, y: 0 } }
                : board.slots[slotIdx]
            const question = this.getGooseQuestion(questions, slot)
            question.points = roll

            await startQueue.get()
            const tempPlayer: Player = {
                name: this.state.players[teamIdx].name,
                score: 0,
                color: this.state.players[teamIdx].color
            }
            const tempState: GameState = {
                players: [tempPlayer]
            }
            tempState.players[0].score = 0
            const result = await startGenericQuestion(this, question, config, tempState)
            if (result.players.length > 0) {
                this.state.players[teamIdx].score += result.points
                if (this.state.players[teamIdx].score >= board.slots.length) {
                    const winUri = 'ui:///./html/random_game_winners.html'
                    await this.loadPage(winUri, CommandTarget.USER)
                    this.userWindow.webContents.send('player_add', this.state.players[teamIdx])
                    return
                }
            }
            teamIdx = (teamIdx + 1) % this.state.players.length
        }
    }

    async randomGame () {
        this.userWindow.webContents.send('game-select')
        const pack = this.waitForPackSelection()
        await this.loadPage('ui:///./html/random.html', CommandTarget.ADMIN)
        const questions = await pack
        questions.configuration = await this.waitForConfiguration(questions.configuration)

        while (questions.questions.length !== 0) {
            let questionIdx = 0
            if (questions.configuration.playlist === 'random') {
                questionIdx = Math.floor(Math.random() * questions.questions.length)
            }
            console.log(questionIdx)
            const question = questions.questions[questionIdx]
            console.log(question)
            questions.questions.splice(questionIdx, 1)
            const winners = await startGenericQuestion(this, question, questions.configuration, this.state)
            for (const winner of winners.players) {
                this.state.players.find(x => x.name === winner)!.score += winners.points
            }
        }

        const winUri = 'ui:///./html/random_game_winners.html'
        await this.loadPage(winUri, CommandTarget.USER)
        Array.from(this.state.players).sort((x, y) => y.score - x.score).forEach(player => {
            this.userWindow.webContents.send('player_add', player)
        })
    }

    async debug () {
        this.userWindow.webContents.send('game-select')
        const uri = 'ui:///./html/debug.html'
        const debugPageQueue = new Queue<string>('debug-page-change')
        while (true) {
            await this.loadPage(uri, CommandTarget.ADMIN)
            const page = await debugPageQueue.get()
            await debug(this, page)
        }
    }

    destroy () {
        ipcMain.removeListener('give-hint', this.giveHintListener)
    }

    // Et les variables pour les evenements ici
    userWindow: BrowserWindow
    adminWindow: BrowserWindow
    state: GameState
    giveHintListener: (event: any, hint: string) => void
    packPath: string = ''
}
