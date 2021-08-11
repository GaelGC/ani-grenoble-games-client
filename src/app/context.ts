import { BlindTestQuestion, Question } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { GameState, QuestionWinners } from 'ani-grenoble-games-format/dist/GameState'
import { BrowserWindow, ipcMain, IpcMainEvent } from 'electron'
import { debug } from './debug'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

class Queue<T> {
    handler: (_: IpcMainEvent, elem: T) => void;
    name: string;
    constructor (name: string) {
        this.name = name
        this.handler = (_, elem) => {
            this.elems.push(elem)
        }
        ipcMain.on(name, this.handler)
    }

    destroy () {
        ipcMain.removeListener(this.name, this.handler)
    }

    peek (): T {
        const elem = this.elems[0]
        return elem
    }

    async get (): Promise<T> {
        await this.waitForElem()
        const elem = this.peek()
        this.elems.splice(0, 1)
        return elem
    }

    async waitForElem (): Promise<void> {
        while (this.elems.length === 0) {
            await delay(1)
        }
    }

    elems: Array<T> = [];
};

class Semaphore extends Queue<void> {
    async wait () {
        return this.get()
    }
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
    }

    async setupTeams () {
        const addPlayerListener = (_: IpcMainEvent, name: string) => {
            this.state.players.push({
                name: name,
                score: 0
            })
        }

        const delPlayerListener = (_: IpcMainEvent, name: string) => {
            this.state.players = this.state.players.filter(x => x.name !== name)
        }

        ipcMain.on('add_player', addPlayerListener)
        ipcMain.on('del_player', delPlayerListener)

        for (const window of [this.userWindow, this.adminWindow]) {
            const url = 'file:///html/index.html'
            await window.loadURL(url)
        }

        ipcMain.removeListener('add_player', addPlayerListener)
        ipcMain.removeListener('del_player', delPlayerListener)
    }

    async run () {
        await this.setupTeams()
        await this.runMain()
    }

    async runMain () {
        while (true) {
            const page = await this.mainPageChange.get()
            if (page === 'debug') {
                this.debug()
            } else {
                throw Error(`Invalid main page ${page} requested`)
            }
        }
    }

    async debug () {
        const uri = 'file:///html/debug.html'
        const debugPageQueue = new Queue<string>('debug-page-change')
        while (true) {
            this.adminWindow.loadURL(uri)
            const page = await debugPageQueue.get()
            await debug(this, page)
        }
    }

    destroy () {
        ipcMain.removeListener('give-hint', this.giveHintListener)
    }

    async startQuestion (q: Question, htmlPath: string): Promise<QuestionWinners> {
        // eslint-disable-next-line node/no-path-concat
        const uri = `file:///html/${htmlPath}`
        await this.userWindow.loadURL(uri)
        await this.adminWindow.loadURL(uri)
        this.userWindow.webContents.send('question-data', q)
        this.adminWindow.webContents.send('question-data', q)
        await this.adminQuestionWaiter.wait()
        this.userWindow.webContents.send('game-state-data', this.state)
        this.adminWindow.webContents.send('game-state-data', this.state)
        return this.winnersQueue.get()
    }

    async startBlindtestQuestion (q: BlindTestQuestion): Promise<QuestionWinners> {
        return this.startQuestion(q, 'blindtest.html')
    }

    userWindow: BrowserWindow;
    adminWindow: BrowserWindow;
    state: GameState;
    adminQuestionWaiter = new Semaphore('admin_question_ready');
    giveHintListener: (event: any, hint: string) => void;
    winnersQueue = new Queue<QuestionWinners>('admin-send-winners');
    mainPageChange = new Queue<string>('main-menu');
}
