import { BlindTestQuestion, HangedManQuestion, Question, QuoteQuestion, GameState, QuestionWinners, ImagesQuestion } from '@gaelgc/ani-grenoble-games-format'
import { BrowserWindow, ipcMain, IpcMainEvent } from 'electron'
import { debug } from './debug'
import { IpcMainInvokeEvent } from 'electron/main'

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

        // J'ai ajout� les deux "on", dans le constructeur, sur le m�me shema que les hint.
        // J'ai du coup retir� ce qu'il y avait plus bas !
        // Et le "name" s'affiche bien dans le console... MAIS pas detect� dans main.ts de user
        this.sendAddPlayer = (_, name) => {
            this.state.players.push({
                name: name,
                score: 0
            })
            console.log(name)
            this.userWindow.webContents.send('player_add', name)
        }
        ipcMain.on('add_player', this.sendAddPlayer)

        this.sendDeletePlayer = (_, name) => {
            this.state.players = this.state.players.filter(x => x.name !== name)
            console.log(name)
            this.userWindow.webContents.send('player_delete', name)
        }
        ipcMain.on('del_player', this.sendDeletePlayer)
    }

    async setupTeams () {
        // Un peu plus vide ici, du coup...
        for (const window of [this.userWindow, this.adminWindow]) {
            const url = 'file:///html/index.html'
            await window.loadURL(url)
        }
        const url = 'file:///html/index.html'
        await this.userWindow.loadURL(url)
        await this.mainPageChange.waitForElem()
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
    // J'ai ajout� les remove ici
        ipcMain.removeListener('give-hint', this.giveHintListener)
        ipcMain.removeListener('add_player', this.sendAddPlayer)
        ipcMain.removeListener('del_player', this.sendDeletePlayer)
    }

    async startQuestion (q: Question, htmlPath: string, onStart?: () => Promise<unknown>): Promise<QuestionWinners> {
        const answerCallback = (_: IpcMainEvent) => {
            this.userWindow.webContents.send('answer', q.answer)
        }
        ipcMain.on('reveal-answer', answerCallback)

        // eslint-disable-next-line node/no-path-concat
        const uri = `file:///html/${htmlPath}`
        await this.userWindow.loadURL(uri)
        await this.adminWindow.loadURL(uri)
        this.userWindow.webContents.send('question-data', q)
        this.adminWindow.webContents.send('question-data', q)
        await this.adminQuestionWaiter.wait()
        this.userWindow.webContents.send('game-state-data', this.state)
        this.adminWindow.webContents.send('game-state-data', this.state)
        if (onStart !== undefined) {
            onStart()
        }
        return this.winnersQueue.get().then(winners => {
            ipcMain.removeListener('reveal-answer', answerCallback)
            return winners
        })
    }

    async startBlindtestQuestion (q: BlindTestQuestion): Promise<QuestionWinners> {
        return this.startQuestion(q, 'blindtest.html')
    }

    async startQuoteQuestion (q: QuoteQuestion): Promise<QuestionWinners> {
        return this.startQuestion(q, 'quote.html')
    }

    async starImagesQuestion (q: ImagesQuestion): Promise<QuestionWinners> {
        const imgHandler = (_: IpcMainInvokeEvent, img: string) => {
            this.userWindow.webContents.send('show-image', img)
        }
        ipcMain.on('show-image', imgHandler)
        return this.startQuestion(q, 'images.html').then(winners => {
            ipcMain.removeListener('show-image', imgHandler)
            return winners
        })
    }

    async startHangedManQuestion (q: HangedManQuestion): Promise<QuestionWinners> {
        let currentTeamIdx = 0
        const usedLetters: string[] = []
        let answerLetters = q.answer.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')

        const setTeam = (idx: number) => {
            for (const window of [this.adminWindow.webContents, this.userWindow.webContents]) {
                window.send('current-team', idx)
            }
        }

        const letterHandler = (_: IpcMainInvokeEvent, letter: string) => {
            letter = letter.toLowerCase()
            if (usedLetters.includes(letter)) {
                return false
            }
            usedLetters.push(letter)
            this.userWindow.webContents.send('letter', letter)
            if (answerLetters.includes(letter)) {
                const idx = answerLetters.indexOf(letter)
                answerLetters = answerLetters.substr(0, idx) + answerLetters.substr(idx + 1)
            } else {
                currentTeamIdx = (currentTeamIdx + 1) % this.state.players.length
                setTeam(currentTeamIdx)
            }
            return true
        }
        ipcMain.handle('hanged-man-letter', letterHandler)

        const winners = this.startQuestion(q, 'hanged_man.html', () => {
            setTeam(currentTeamIdx)
            this.adminWindow.webContents.send('init')
            return delay(1)
        })
        return winners.then((winner) => {
            ipcMain.removeHandler('hanged-man-letter')
            return winner
        })
    }

    // Et les variables pour les evenements ici
    userWindow: BrowserWindow;
    adminWindow: BrowserWindow;
    state: GameState;
    adminQuestionWaiter = new Semaphore('admin_question_ready');
    giveHintListener: (event: any, hint: string) => void;
    sendAddPlayer: (event: any, name: string) => void;
    sendDeletePlayer: (event: any, name: string) => void;
    winnersQueue = new Queue<QuestionWinners>('admin-send-winners');
    mainPageChange = new Queue<string>('main-menu');
}
