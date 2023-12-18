import { Question, GameConfiguration, GameState, QuestionWinners, BlindTestQuestion, ImagesQuestion, QuoteQuestion, HangedManQuestion, FindTheWordQuestion } from '@gaelgc/ani-grenoble-games-format'
import { IpcMainEvent, IpcMainInvokeEvent, ipcMain } from 'electron'
import { Context } from './context'
import { Condition, Queue } from './utils'

async function startQuestion (ctx: Context, q: Question, htmlPath: string, config: GameConfiguration, state: GameState, onStart?: () => Promise<unknown>): Promise<QuestionWinners> {
    /* Callbacks registration */
    const answerCallback = () => {
        ctx.userWindow.webContents.send('answer', q.answer)
    }

    const updateWinnersCallback = (_: IpcMainEvent, winners: QuestionWinners) => {
        ctx.userWindow.webContents.send('update-winners', winners)
    }

    ipcMain.on('reveal-answer', answerCallback)
    ipcMain.on('admin-update-winners', updateWinnersCallback)
    const adminQuestionWaiter = new Condition('admin_question_ready')
    const winnersQueue = new Queue<QuestionWinners>('admin-send-winners')

    /* Question data broadcast */
    const uri = `ui:///./html/${htmlPath}`
    await ctx.loadPage(uri, true, true)
    ctx.adminWindow.webContents.send('question-configuration', config)
    ctx.userWindow.webContents.send('question-data', q)
    ctx.adminWindow.webContents.send('question-data', q)
    await adminQuestionWaiter.wait()
    ctx.userWindow.webContents.send('game-state-data', state)
    ctx.adminWindow.webContents.send('game-state-data', state)

    /* Question-specific handling */
    if (onStart !== undefined) {
        await onStart()
    }

    const winners = await winnersQueue.get()

    /* Cleanup */
    winnersQueue.destroy()
    adminQuestionWaiter.destroy()
    ipcMain.removeListener('reveal-answer', answerCallback)
    ipcMain.removeListener('admin-update-winners', updateWinnersCallback)

    return winners
}

async function startBlindtestQuestion (ctx: Context, q: BlindTestQuestion, config: GameConfiguration, state: GameState): Promise<QuestionWinners> {
    return startQuestion(ctx, q, 'blindtest.html', config, state)
}

async function startQuoteQuestion (ctx: Context, q: QuoteQuestion, config: GameConfiguration, state: GameState): Promise<QuestionWinners> {
    return startQuestion(ctx, q, 'quote.html', config, state)
}

async function starImagesQuestion (ctx: Context, q: ImagesQuestion, config: GameConfiguration, state: GameState): Promise<QuestionWinners> {
    const imgHandler = (_: IpcMainInvokeEvent, img: string) => {
        ctx.userWindow.webContents.send('show-image', img)
    }
    ipcMain.on('show-image', imgHandler)

    const winners = await startQuestion(ctx, q, 'images.html', config, state)

    ipcMain.removeListener('show-image', imgHandler)
    return winners
}

async function startHangedManQuestion (ctx: Context, q: HangedManQuestion, config: GameConfiguration, state: GameState): Promise<QuestionWinners> {
    let currentTeamIdx = 0
    const usedLetters: string[] = []
    let answerLetters = q.answer.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')

    const setTeam = (idx: number) => {
        for (const window of [ctx.adminWindow.webContents, ctx.userWindow.webContents]) {
            window.send('current-team', idx)
        }
    }

    /* Handlers */

    const letterHandler = (_: IpcMainInvokeEvent, letter: string) => {
        letter = letter.toLowerCase()
        if (usedLetters.includes(letter)) {
            return false
        }
        usedLetters.push(letter)
        ctx.userWindow.webContents.send('letter', letter)
        /* Either the player was right, or we give control to the next one. */
        if (answerLetters.includes(letter)) {
            const idx = answerLetters.indexOf(letter)
            answerLetters = answerLetters.substr(0, idx) + answerLetters.substr(idx + 1)
        } else {
            currentTeamIdx = (currentTeamIdx + 1) % state.players.length
            setTeam(currentTeamIdx)
        }
        return true
    }
    ipcMain.handle('hanged-man-letter', letterHandler)

    const onQuestionInit = () => {
        setTeam(currentTeamIdx)
        ctx.adminWindow.webContents.send('init')
        return Promise.resolve()
    }

    /* Main logic */

    const winner = await startQuestion(ctx, q, 'hanged_man.html', config, state, onQuestionInit)

    ipcMain.removeHandler('hanged-man-letter')
    return winner
}

async function startFindTheWordQuestion (ctx: Context, q: FindTheWordQuestion, config: GameConfiguration, state: GameState): Promise<QuestionWinners> {
    let currentTeamIdx = 0
    let remainingTries = q.nbTries
    const uppercaseAnswer = q.answer.toUpperCase()

    enum ValidStates {
        BAD,
        MISPLACED,
        GOOD,
    }

    /* Helpers */

    const setTeam = (idx: number) => {
        for (const window of [ctx.adminWindow.webContents, ctx.userWindow.webContents]) {
            window.send('current-team', idx)
        }
    }

    const validateWord = (proposedWord: string) => {
        const validity: ValidStates[] = []
        const nbExpected: Map<string, number> = new Map()
        /* Count the number of each letter in the proposed word. */
        for (const letter of uppercaseAnswer) {
            if (!nbExpected.has(letter)) {
                nbExpected.set(letter, 0)
            }
            nbExpected.set(letter, nbExpected.get(letter)! + 1)
        }

        /* Check good letters, and count the number of remaining ones. */
        for (let i = 0; i < proposedWord.length; i++) {
            const isRight = proposedWord[i] === uppercaseAnswer[i]
            validity.push(isRight ? ValidStates.GOOD : ValidStates.BAD)
            if (isRight) {
                nbExpected.set(proposedWord[i], nbExpected.get(proposedWord[i])! - 1)
            }
        }

        /* Mark misplaced letters. */
        for (let i = 0; i < proposedWord.length; i++) {
            const letter = proposedWord[i]
            if (validity[i] === ValidStates.BAD && nbExpected.has(letter) && nbExpected.get(letter)! > 0) {
                nbExpected.set(letter, nbExpected.get(letter)! - 1)
                validity[i] = ValidStates.MISPLACED
            }
        }
        return validity
    }

    /* Handlers */

    const waitForAnimation = new Condition('reveal-animation-done')

    /* Called when the word is being written in the admin interface. */
    const inputHandle = (_: IpcMainInvokeEvent, word: string) => {
        ctx.userWindow.webContents.send('find-the-word-temp-select', word)
    }

    /* Called when the admin validates a proposed word. */
    const wordHandler = async (_: IpcMainInvokeEvent, word: string) => {
        remainingTries -= 1
        word = word.toUpperCase()
        const validity = validateWord(word)

        /* Forward to the user, then wait for the animation to finish. */
        ctx.userWindow.webContents.send('new-word', [word, validity, remainingTries])
        currentTeamIdx = (currentTeamIdx + 1) % state.players.length
        await waitForAnimation.wait()
        if (validity.includes(ValidStates.BAD) || validity.includes(ValidStates.MISPLACED)) {
            setTeam(currentTeamIdx)
        }
        return remainingTries === 0
    }

    ipcMain.handle('new-word', wordHandler)
    ipcMain.handle('find-the-word-temp-select', inputHandle)

    const onInitDone = () => {
        setTeam(currentTeamIdx)
        ctx.adminWindow.webContents.send('init')
        return Promise.resolve()
    }

    /* Main logic */

    const winner = await startQuestion(ctx, q, 'find_the_word.html', config, state, onInitDone)

    /* Teadown */

    ipcMain.removeHandler('find-the-word-temp-select')
    ipcMain.removeHandler('new-word')
    waitForAnimation.destroy()
    return winner
}

export async function startGenericQuestion (ctx: Context, q: Question, config: GameConfiguration, state: GameState): Promise<QuestionWinners> {
    type questionType = ((ctx: Context, q: Question, config: GameConfiguration, sstate: GameState) => Promise<QuestionWinners>)
    // We cast the functions to accept all Questions. The reason why this
    // is safer than it looks like is that the type field could not be
    // different from the actual type of the question. Maybe mapped types
    // could help to have a cleaner thing here, need to take a look later.
    const map: Map<string, questionType> = new Map([
        ['BlindTestQuestion', startBlindtestQuestion as questionType],
        ['QuoteQuestion', startQuoteQuestion as questionType],
        ['HangedManQuestion', startHangedManQuestion as questionType],
        ['ImagesQuestion', starImagesQuestion as questionType],
        ['FindTheWordQuestion', startFindTheWordQuestion as questionType]
    ])

    const f = map.get(q.type)
    if (f === undefined) {
        throw Error(`Uknown question type ${q.type}`)
    }
    return f(ctx, q, config, state)
}
