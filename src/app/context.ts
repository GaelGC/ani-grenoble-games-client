import { BlindTestQuestion, HangedManQuestion, Question, QuoteQuestion, GameState, QuestionWinners, ImagesQuestion, parseQuestions, QuestionSet, GooseBoard, parseGooseBoard, Slot, Player, FindTheWordQuestion, GameConfiguration } from '@gaelgc/ani-grenoble-games-format'
import { BrowserWindow, ipcMain, IpcMainEvent, ProtocolResponse, session } from 'electron'
import { debug } from './debug'
import { IpcMainInvokeEvent } from 'electron/main'
import { readFileSync } from 'fs'
import { dirname } from 'path'
import { Queue, delay, Condition } from './utils'

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
                name,
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

    async loadPage (uri: string, admin: boolean, user: boolean) {
        if (admin) {
            await this.adminWindow.loadURL(uri)
        }
        if (user) {
            await this.userWindow.loadURL(uri)
        }
    }

    async setupTeams () {
        await this.loadPage('ui:///./html/index.html', true, true)
        await this.mainPageChange.waitForElem()
    }

    async run () {
        await this.setupTeams()
        await this.runMain()
    }

    async runMain () {
        const page = await this.mainPageChange.get()
        while (true) {
            if (page === 'debug') {
                await this.debug()
            } else if (page === 'random') {
                await this.randomGame()
            } else if (page === 'game-of-the-goose') {
                await this.gooseGame()
            } else {
                throw Error(`Invalid main page ${page} requested`)
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
        await this.loadPage('ui:///./html/configure.html', true, false)
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
        await this.loadPage(initUri, true, false)
        const questions = await pack
        const config = questions.configuration
        const board = await boardPromise
        const rollQueue = new Queue<void>('roll-dice')
        const startQueue = new Queue<void>('start-question')
        const rollAnimationDoneQueue = new Queue<void>('roll-animation-done')

        let teamIdx = 0
        while (true) {
            const gameUri = 'ui:///./html/game_of_the_goose.html'
            await this.loadPage(gameUri, true, true)
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
            const result = await this.startGenericQuestion(question, config, tempState)
            if (result.players.length > 0) {
                this.state.players[teamIdx].score += result.points
                if (this.state.players[teamIdx].score >= board.slots.length) {
                    const winUri = 'ui:///./html/random_game_winners.html'
                    await this.loadPage(winUri, false, true)
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
        await this.loadPage('ui:///./html/random.html', true, false)
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
            const winners = await this.startGenericQuestion(question, questions.configuration)
            for (const winner of winners.players) {
                this.state.players.find(x => x.name === winner)!.score += winners.points
            }
        }

        const winUri = 'ui:///./html/random_game_winners.html'
        await this.loadPage(winUri, false, true)
        Array.from(this.state.players).sort((x, y) => y.score - x.score).forEach(player => {
            this.userWindow.webContents.send('player_add', player)
        })
    }

    async debug () {
        this.userWindow.webContents.send('game-select')
        const uri = 'ui:///./html/debug.html'
        const debugPageQueue = new Queue<string>('debug-page-change')
        while (true) {
            await this.loadPage(uri, true, false)
            const page = await debugPageQueue.get()
            await debug(this, page)
        }
    }

    destroy () {
        ipcMain.removeListener('give-hint', this.giveHintListener)
        ipcMain.removeListener('add_player', this.sendAddPlayer)
        ipcMain.removeListener('del_player', this.sendDeletePlayer)
    }

    async startQuestion (q: Question, htmlPath: string, config: GameConfiguration, state ?: GameState, onStart?: () => Promise<unknown>): Promise<QuestionWinners> {
        const answerCallback = (_: IpcMainEvent) => {
            this.userWindow.webContents.send('answer', q.answer)
        }
        ipcMain.on('reveal-answer', answerCallback)

        const updateWinnersCallback = (_: IpcMainEvent, winners: QuestionWinners) => {
            this.userWindow.webContents.send('update-winners', winners)
        }
        ipcMain.on('admin-update-winners', updateWinnersCallback)

        const uri = `ui:///./html/${htmlPath}`
        await this.loadPage(uri, true, true)
        this.adminWindow.webContents.send('question-configuration', config)
        this.userWindow.webContents.send('question-data', q)
        this.adminWindow.webContents.send('question-data', q)
        await this.adminQuestionWaiter.wait()
        const questionState = state === undefined ? this.state : state
        this.userWindow.webContents.send('game-state-data', questionState)
        this.adminWindow.webContents.send('game-state-data', questionState)
        if (onStart !== undefined) {
            onStart()
        }
        return this.winnersQueue.get().then(winners => {
            ipcMain.removeListener('reveal-answer', answerCallback)
            ipcMain.removeListener('admin-update-winners', updateWinnersCallback)
            return winners
        })
    }

    async startGenericQuestion (q: Question, config: GameConfiguration, state ?: GameState): Promise<QuestionWinners> {
        type questionType = ((q: Question, config: GameConfiguration, sstate ?: GameState) => Promise<QuestionWinners>)
        // We cast the functions to accept all Questions. The reason why this
        // is safer than it looks like is that the type field could not be
        // different from the actual type of the question. Maybe mapped types
        // could help to have a cleaner thing here, need to take a look later.
        const map: Map<string, questionType> = new Map([
            ['BlindTestQuestion', this.startBlindtestQuestion.bind(this) as questionType],
            ['QuoteQuestion', this.startQuoteQuestion.bind(this) as questionType],
            ['HangedManQuestion', this.startHangedManQuestion.bind(this) as questionType],
            ['ImagesQuestion', this.starImagesQuestion.bind(this) as questionType],
            ['FindTheWordQuestion', this.startFindTheWordQuestion.bind(this) as questionType]
        ])
        if (map.has(q.type)) {
            return map.get(q.type)!(q, config, state)
        } else {
            throw Error(`Uknown question type ${q.type}`)
        }
    }

    async startBlindtestQuestion (q: BlindTestQuestion, config: GameConfiguration, state ?: GameState): Promise<QuestionWinners> {
        return this.startQuestion(q, 'blindtest.html', config, state)
    }

    async startQuoteQuestion (q: QuoteQuestion, config: GameConfiguration, state ?: GameState): Promise<QuestionWinners> {
        return this.startQuestion(q, 'quote.html', config, state)
    }

    async starImagesQuestion (q: ImagesQuestion, config: GameConfiguration, state ?: GameState): Promise<QuestionWinners> {
        const imgHandler = (_: IpcMainInvokeEvent, img: string) => {
            this.userWindow.webContents.send('show-image', img)
        }
        ipcMain.on('show-image', imgHandler)
        return this.startQuestion(q, 'images.html', config, state).then(winners => {
            ipcMain.removeListener('show-image', imgHandler)
            return winners
        })
    }

    async startHangedManQuestion (q: HangedManQuestion, config: GameConfiguration, state ?: GameState): Promise<QuestionWinners> {
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

        const winners = this.startQuestion(q, 'hanged_man.html', config, state, () => {
            setTeam(currentTeamIdx)
            this.adminWindow.webContents.send('init')
            return delay(1)
        })
        return winners.then((winner) => {
            ipcMain.removeHandler('hanged-man-letter')
            return winner
        })
    }

    async startFindTheWordQuestion (q: FindTheWordQuestion, config: GameConfiguration, state ?: GameState): Promise<QuestionWinners> {
        let currentTeamIdx = 0
        let remainingTries = q.nbTries
        const uppercaseAnswer = q.answer.toUpperCase()

        const setTeam = (idx: number) => {
            for (const window of [this.adminWindow.webContents, this.userWindow.webContents]) {
                window.send('current-team', idx)
            }
        }

        const wordHandler = async (_: IpcMainInvokeEvent, word: string) => {
            remainingTries -= 1
            word = word.toUpperCase()

            const validity: number[] = []
            const nbExpected: Map<string, number> = new Map()
            // Count the number of each letter in the word.
            for (const letter of uppercaseAnswer) {
                if (!nbExpected.has(letter)) {
                    nbExpected.set(letter, 0)
                }
                nbExpected.set(letter, nbExpected.get(letter)! + 1)
            }

            // Check good letters, and count the number of remaining ones.
            for (let i = 0; i < word.length; i++) {
                const isRight = word[i] === uppercaseAnswer[i]
                validity.push(isRight ? 2 : 0)
                if (isRight) {
                    nbExpected.set(word[i], nbExpected.get(word[i])! - 1)
                }
            }

            // Mark misplaced letters.
            for (let i = 0; i < word.length; i++) {
                const letter = word[i]
                if (validity[i] === 0 && nbExpected.has(letter) && nbExpected.get(letter)! > 0) {
                    nbExpected.set(letter, nbExpected.get(letter)! - 1)
                    validity[i] = 1
                }
            }
            const waitForAnimation = new Condition('reveal-animation-done')
            this.userWindow.webContents.send('new-word', [word, validity, remainingTries])
            currentTeamIdx = (currentTeamIdx + 1) % this.state.players.length
            await waitForAnimation.wait()
            waitForAnimation.destroy()
            if (validity.includes(0) || validity.includes(1)) {
                setTeam(currentTeamIdx)
            }
            return remainingTries === 0
        }
        ipcMain.handle('new-word', wordHandler)

        const inputHandle = (_: IpcMainInvokeEvent, word: string) => {
            this.userWindow.webContents.send('find-the-word-temp-select', word)
        }
        ipcMain.handle('find-the-word-temp-select', inputHandle)

        const winners = this.startQuestion(q, 'find_the_word.html', config, state, () => {
            setTeam(currentTeamIdx)
            this.adminWindow.webContents.send('init')
            return delay(1)
        })
        return winners.then((winner) => {
            ipcMain.removeHandler('find-the-word-temp-select')
            ipcMain.removeHandler('new-word')
            return winner
        })
    }

    // Et les variables pour les evenements ici
    userWindow: BrowserWindow
    adminWindow: BrowserWindow
    state: GameState
    adminQuestionWaiter = new Condition('admin_question_ready')
    giveHintListener: (event: any, hint: string) => void
    sendAddPlayer: (event: any, name: string, id: string) => void
    sendDeletePlayer: (event: any, name: string, id: string) => void
    winnersQueue = new Queue<QuestionWinners>('admin-send-winners')
    mainPageChange = new Queue<string>('main-menu')
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
