import { BlindTestQuestion, HangedManQuestion, Question, QuoteQuestion, GameState, QuestionWinners, ImagesQuestion, parseQuestions, QuestionSet, GooseBoard, parseGooseBoard, Slot } from '@gaelgc/ani-grenoble-games-format'
import { BrowserWindow, ipcMain, IpcMainEvent, ProtocolResponse, session } from 'electron'
import { debug } from './debug'
import { IpcMainInvokeEvent } from 'electron/main'
import { readFileSync } from 'fs'
import { dirname } from 'path'

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

        this.sendAddPlayer = (_, name, id) => {
            let rgb = ''

            if (id === 'team-div-0') {
                rgb = 'EC1F1F'
            } else if (id === 'team-div-1') {
                rgb = '6064DE'
            } else if (id === 'team-div-2') {
                rgb = '2FC215'
            } else if (id === 'team-div-3') {
                rgb = 'D0E613'
            } else if (id === 'team-div-4') {
                rgb = '01FDF5'
            } else if (id === 'team-div-5') {
                rgb = '860EF1'
            } else if (id === 'team-div-6') {
                rgb = 'FDA101'
            } else if (id === 'team-div-7') {
                rgb = 'F32BCF'
            } else {
                rgb = colorOf(name + name)
            }

            this.state.players.push({
                name: name,
                score: 0,
                color: rgb
            })

            this.userWindow.webContents.send('player_add', name, id, rgb)
        }
        ipcMain.on('add_player', this.sendAddPlayer)

        this.sendDeletePlayer = (_, name, id) => {
            this.state.players = this.state.players.filter(x => x.name !== name)
            this.userWindow.webContents.send('player_delete', name, id)
        }
        ipcMain.on('del_player', this.sendDeletePlayer)

        for (const partitionName of ['user', 'admin']) {
            const partition = `persist:${partitionName}`
            const selectedSession = session.fromPartition(partition)
            selectedSession.protocol.registerFileProtocol('question', (request, callback) => {
                console.log(request.url)
                console.log(this.packPath)
                const url = request.url.replace('question://', '')
                let response: ProtocolResponse = { path: url }
                if (url.length === 0 || url[0] !== '/') {
                    response = { path: this.packPath + url }
                }
                console.log(response)
                callback(response)
            })
        }
    }

    async setupTeams () {
        for (const window of [this.userWindow, this.adminWindow]) {
            const url = 'file:///html/index.html'
            await window.loadURL(url)
        }
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
                await this.debug()
            } else if (page === 'random') {
                await this.randomGame()
            } else if (page === 'game-of-the-goose') {
                await this.gooseGame()
            } else {
                throw Error(`Invalid main page ${page} requested`)
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
        questions.questions.splice(questions.questions.indexOf(compatible[idx]), 1)
        return compatible[idx]
    }

    async gooseGame () {
        this.userWindow.webContents.send('game-select')
        const pack = this.waitForPackSelection()
        const boardPromise = this.waitForGooseBoardSelection()
        const initUri = 'file:///html/game_of_the_goose_init.html'
        this.adminWindow.loadURL(initUri)
        const questions = await pack
        const board = await boardPromise
        const rollQueue = new Queue<void>('roll-dice')
        const startQueue = new Queue<void>('start-question')
        const rollAnimationDoneQueue = new Queue<void>('roll-animation-done')

        while (true) {
            const gameUri = 'file:///html/game_of_the_goose.html'
            this.adminWindow.loadURL(gameUri)
            this.userWindow.loadURL(gameUri)
            await rollQueue.get()
            const roll = Math.ceil(Math.random() * 6)
            this.userWindow.webContents.send('roll', roll)
            await rollAnimationDoneQueue.get()
            this.adminWindow.webContents.send('roll-ack')
            const question = this.getGooseQuestion(questions, board.slots[0])
            await startQueue.get()
            await this.startGenericQuestion(question)
        }
    }

    async randomGame () {
        this.userWindow.webContents.send('game-select')
        const pack = this.waitForPackSelection()
        const initUri = 'file:///html/random.html'
        this.adminWindow.loadURL(initUri)
        const questions = await pack
        while (questions.questions.length !== 0) {
            const questionIdx = Math.floor(Math.random() * questions.questions.length)
            console.log(questionIdx)
            const question = questions.questions[questionIdx]
            console.log(question)
            questions.questions.splice(questionIdx, 1)
            const winners = await this.startGenericQuestion(question)
            for (const winner of winners.players) {
                this.state.players.find(x => x.name === winner)!.score += winners.points
            }
        }

        const winUri = 'file:///html/random_game_winners.html'
        await this.userWindow.loadURL(winUri)
        Array.from(this.state.players).sort((x, y) => y.score - x.score).forEach(player => {
            this.userWindow.webContents.send('player_add', player)
        })
    }

    async debug () {
        this.userWindow.webContents.send('game-select')
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
        ipcMain.removeListener('add_player', this.sendAddPlayer)
        ipcMain.removeListener('del_player', this.sendDeletePlayer)
    }

    async startQuestion (q: Question, htmlPath: string, onStart?: () => Promise<unknown>): Promise<QuestionWinners> {
        const answerCallback = (_: IpcMainEvent) => {
            this.userWindow.webContents.send('answer', q.answer)
        }
        ipcMain.on('reveal-answer', answerCallback)

        const updateWinnersCallback = (_: IpcMainEvent, winners: QuestionWinners) => {
            this.userWindow.webContents.send('update-winners', winners)
        }
        ipcMain.on('admin-update-winners', updateWinnersCallback)

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
            ipcMain.removeListener('admin-update-winners', updateWinnersCallback)
            return winners
        })
    }

    async startGenericQuestion (q: Question): Promise<QuestionWinners> {
        type questionType = ((q: Question) => Promise<QuestionWinners>)
        // We cast the functions to accept all Questions. The reason why this
        // is safer than it looks like is that the type field could not be
        // different from the actual type of the question. Maybe mapped types
        // could help to have a cleaner thing here, need to take a look later.
        const map: Map<string, questionType> = new Map([
            ['BlindTestQuestion', this.startBlindtestQuestion.bind(this) as questionType],
            ['QuoteQuestion', this.startQuoteQuestion.bind(this) as questionType],
            ['HangedManQuestion', this.startHangedManQuestion.bind(this) as questionType],
            ['ImagesQuestion', this.starImagesQuestion.bind(this) as questionType]
        ])
        if (map.has(q.type)) {
            return map.get(q.type)!(q)
        } else {
            throw Error(`Uknown question type ${q.type}`)
        }
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
    sendAddPlayer: (event: any, name: string, id: string) => void;
    sendDeletePlayer: (event: any, name: string, id: string) => void;
    winnersQueue = new Queue<QuestionWinners>('admin-send-winners');
    mainPageChange = new Queue<string>('main-menu');
    packPath: string = ''
}

// Cr�ation d'une couleur pour un string donn�
function colorOf (name: string) {
    const charArray = name.split('')
    let sizeOf = charArray.length
    while (sizeOf % 3 !== 0) {
        sizeOf -= 1
    }

    let firstInt: number = 0
    let secondInt: number = 0
    let thirdInt: number = 0

    for (let i = 0; i < sizeOf; i++) {
        if (i < (sizeOf / 3)) {
            firstInt += charArray[i].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
        } else if (i < (sizeOf / 3) * 2) {
            secondInt += charArray[i].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
        } else {
            thirdInt += charArray[i].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
        }
    }

    firstInt = firstInt % 16
    secondInt = secondInt % 16
    thirdInt = thirdInt % 16

    const firstHexa = hexaOfInt(firstInt)
    const secondHexa = hexaOfInt(secondInt)
    const thirdHexa = hexaOfInt(thirdInt)

    let avg = (firstInt + secondInt + thirdInt) / 3
    avg = avg % 16
    const avgHexa = hexaOfInt(avg)

    const rgb = firstHexa + avgHexa + secondHexa + avgHexa + thirdHexa + avgHexa

    return rgb.toString()
}

function hexaOfInt (int: number) {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    if (!numbers.includes(int)) {
        switch (int) {
        case 10: {
            return 'A'
        }
        case 11: {
            return 'B'
        }
        case 12: {
            return 'C'
        }
        case 13: {
            return 'D'
        }
        case 14: {
            return 'E'
        }
        case 15: {
            return 'F'
        }
        default: {
            return '0'
        }
        }
    } else {
        return int.toString()
    }
}
