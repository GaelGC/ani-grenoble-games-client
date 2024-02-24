import { Event, GameConfiguration, GameSlot, GameState, GooseBoard, MoveEvent, Player, Question, QuestionSet, QuestionWinners, Slot, SwapEvent, TagSelectorSlot, TypeSelectorSlot, parseGooseBoard } from '@gaelgc/ani-grenoble-games-format'
import { readFileSync, writeFileSync } from 'fs'
import { CommandTarget, Context } from './context'
import { startGenericQuestion } from './question'
import { Queue, unreachable } from './utils'
import { assert } from 'console'

class TeamTurnManager {
    turnSkipListener?: (teamIdx: number) => Promise<void>

    displayCurrentTeamCallback?: (team: Player) => Promise<void>

    private players: Player[]
    private skips: Map<Player, number>
    private currentTeamIdx: number

    constructor (players: Player[]) {
        this.players = players
        this.skips = new Map()
        this.currentTeamIdx = -1
    }

    async getNextTeam (): Promise<Player> {
        if (this.currentTeamIdx === -1) {
            this.currentTeamIdx = 0
            return this.players[this.currentTeamIdx]
        }

        while (true) {
            this.currentTeamIdx = (this.currentTeamIdx + 1) % this.players.length
            const player = this.players[this.currentTeamIdx]
            if (!this.skips.has(player)) {
                break
            }

            if (this.turnSkipListener) {
                await this.turnSkipListener(this.currentTeamIdx)
            }

            const remainingSkips = this.skips.get(player)! - 1
            if (remainingSkips === 0) {
                this.skips.delete(player)
            } else {
                this.skips.set(player, remainingSkips)
            }
        }

        return this.players[this.currentTeamIdx]
    }

    registerTeamSkip (player: Player, nbTurns: number) {
        assert(nbTurns > 0, 'Asked for a 0/negative number of turn skips')
        this.skips.set(player, nbTurns)
    }

    async display () {
        if (!this.displayCurrentTeamCallback) {
            return
        }
        await this.displayCurrentTeamCallback(this.players[this.currentTeamIdx])
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

    displayCallback?: (players: Player[]) => Promise<void>

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

    async display () {
        if (this.displayCallback) {
            const players = Array.from(this.scores.keys()).map(x => <Player>{ ...x, score: this.score(x) })
            await this.displayCallback(players)
        }
    }
}

class BoardManager {
    rollListener?: (roll: number) => Promise<void>

    displayBoardCallback?: (board: GooseBoard) => Promise<void>

    private board: GooseBoard
    private scoreSetCallback: (player: Player, roll: number) => Promise<number>

    constructor (board: GooseBoard, scoreSetCallback: (player: Player, roll: number) => Promise<number>) {
        this.board = board
        this.scoreSetCallback = scoreSetCallback
    }

    private getSlot (slotIdx: number): Slot {
        if (slotIdx === this.board.slots.length) {
            return { type: 'GameSlot', selector: 'TagSelector', tags: ['final'], pos: { x: 0, y: 0 }, tile: 0 }
        }
        return this.board.slots[slotIdx]
    }

    async roll (player: Player): Promise<Slot> {
        const roll = Math.ceil(Math.random() * 6)
        if (this.rollListener) {
            await this.rollListener(roll)
        }

        const cellIdx = await this.scoreSetCallback(player, roll)

        return this.getSlot(cellIdx)
    }

    async display () {
        if (this.displayBoardCallback) {
            await this.displayBoardCallback(this.board)
        }
    }
}

class UIManager {
    private ctx: Context
    private inBoardUI = false
    private turnManager: TeamTurnManager
    private scoreManager: ScoreManager
    private boardManager: BoardManager

    private boardAckQueue = new Queue<void>('board-ack')
    private rollAnimationDoneQueue = new Queue<void>('roll-animation-done')
    private doEventQueue = new Queue<void>('do-event')

    private playerIdxResolver: (player: Player) => number

    constructor (ctx: Context, turnManager: TeamTurnManager, scoreManager: ScoreManager,
        boardManager: BoardManager, playerIdxResolver: ((player: Player) => number)) {
        this.ctx = ctx

        this.turnManager = turnManager
        this.turnManager.displayCurrentTeamCallback = this.currentTeamDisplayHandler.bind(this)

        this.scoreManager = scoreManager
        this.scoreManager.displayCallback = this.displayTeam.bind(this)
        this.scoreManager.swapListener = this.pawnSwapHandler.bind(this)
        this.scoreManager.pendingScoreCommitListener = this.movePawn.bind(this)
        this.scoreManager.pendingScoreChangeListener = this.tempMovePawn.bind(this)

        this.boardManager = boardManager
        this.boardManager.displayBoardCallback = this.displayBoard.bind(this)
        this.boardManager.rollListener = this.onRoll.bind(this)

        this.playerIdxResolver = playerIdxResolver
    }

    destroy () {
        this.boardAckQueue.destroy()
        this.rollAnimationDoneQueue.destroy()
        this.doEventQueue.destroy()
    }

    private async displayBoard (board: GooseBoard) {
        this.ctx.userWindow.webContents.send('board', board)
    }

    private async displayTeam (players: Player[]) {
        this.ctx.userWindow.webContents.send('players', players)
    }

    private async currentTeamDisplayHandler (player: Player) {
        this.ctx.userWindow.webContents.send('current-player', this.playerIdxResolver(player))
    }

    private async pawnSwapHandler (team1: Player, team2: Player) {
        if (this.inBoardUI) {
            this.ctx.userWindow.webContents.send('swap-players', this.playerIdxResolver(team1), this.playerIdxResolver(team2))
        }
    }

    private async movePawn (player: Player, score: number) {
        if (this.inBoardUI) {
            const moveDoneQueue = new Queue<void>('absmove-animation-done')
            this.ctx.userWindow.webContents.send('absmove', score)
            await moveDoneQueue.waitForElem()
            moveDoneQueue.destroy()
        }
    }

    private tempMovePawn (player: Player, oldScore: number, score: number) {
        return this.movePawn(player, score)
    }

    private async onRoll (roll: number) {
        this.ctx.userWindow.webContents.send('roll', roll)
        await this.rollAnimationDoneQueue.get()
    }

    async displayMainView () {
        if (!this.inBoardUI) {
            const gameUri = 'ui:///./html/game_of_the_goose.html'
            await this.ctx.loadPage(gameUri, CommandTarget.BOTH)
            this.inBoardUI = true

            await this.boardManager.display()
            await this.scoreManager.display()
            await this.boardAckQueue.get()
        }
        await this.turnManager.display()
    }

    hideBoard () {
        this.inBoardUI = false
    }

    async displayEvent (event: Event) {
        await this.displayMainView()

        this.ctx.userWindow.webContents.send('show-event', event)
        this.ctx.adminWindow.webContents.send('enable-do-event')
        await this.doEventQueue.get()
    }
}

class QuestionManager {
    onQuestionWin?: (player: Player) => void
    onQuestionLose?: (player: Player) => void
    eventCallback?: (event: Event, player: Player) => Promise<void>

    private config!: GameConfiguration
    private questions!: Question[]
    private runQuestionCallback: (question: Question, config: GameConfiguration, slot: GameSlot, player: Player) => Promise<QuestionWinners>

    constructor (questions: QuestionSet,
        runQuestionCallback: (question: Question, config: GameConfiguration, slot: GameSlot, player: Player) => Promise<QuestionWinners>) {
        this.config = questions.configuration
        /* Take a copy of the question set, not the orignal */
        this.questions = questions.questions.map(x => x)
        this.runQuestionCallback = runQuestionCallback
    }

    private getGooseQuestion (slot: TypeSelectorSlot | TagSelectorSlot): Question {
        const compatible = this.questions.filter(x => {
            if (slot.selector === 'TagSelector') {
                return x.tags.filter(tag => slot.tags.includes(tag)).length === slot.tags.length
            } else if (slot.selector === 'TypeSelector') {
                return slot.types.includes(x.type)
            }
            return false
        })

        if (compatible.length === 0) {
            throw Error('Could not find compatible question')
        }
        const idx = Math.floor(Math.random() * compatible.length)
        if (compatible.length !== 1) {
            this.questions.splice(this.questions.indexOf(compatible[idx]), 1)
        }
        return compatible[idx]
    }

    async handleGooseGameSlot (slot: TagSelectorSlot | TypeSelectorSlot, player: Player): Promise<void> {
        const question = this.getGooseQuestion(slot)

        const result = await this.runQuestionCallback(question, this.config, slot, player)

        const won = result.players.length > 0
        const evt = won ? slot.onWin : slot.onLose
        const resultCallback = won ? this.onQuestionWin : this.onQuestionLose
        if (resultCallback) {
            resultCallback(player)
        }
        if (evt && this.eventCallback) {
            this.eventCallback(evt, player)
        }
    }
}

class GooseContext {
    ctx: Context
    turnManager: TeamTurnManager
    scoreManager: ScoreManager
    boardManager: BoardManager
    uiManager: UIManager
    questionManager: QuestionManager

    players: Player[]
    rollQueue: Queue<void>
    startQueue: Queue<void>

    /* Setup */

    constructor (ctx: Context, state: GameState, board: GooseBoard, questions: QuestionSet) {
        this.ctx = ctx
        this.turnManager = new TeamTurnManager(state.players)

        this.turnManager.turnSkipListener = this.playerSkipHandler.bind(this)

        this.scoreManager = new ScoreManager(state.players, board.slots.length)
        this.scoreManager.winListener = this.winHandler.bind(this)

        this.boardManager = new BoardManager(board, (player, roll) => this.scoreManager.setScore(player, 'pending', 'relative', roll))

        this.uiManager = new UIManager(ctx, this.turnManager, this.scoreManager, this.boardManager,
            (player: Player) => this.players.indexOf(player))

        this.questionManager = new QuestionManager(questions, this.runQuestionCallback.bind(this))
        this.questionManager.onQuestionLose = this.scoreManager.dropPendingScore.bind(this.scoreManager)
        this.questionManager.onQuestionWin = this.scoreManager.commitPendingScore.bind(this.scoreManager)
        this.questionManager.eventCallback = this.handleEvent.bind(this)

        this.players = state.players
        this.rollQueue = new Queue<void>('roll-dice')
        this.startQueue = new Queue<void>('start-question')
    }

    destructor () {
        this.rollQueue.destroy()
        this.startQueue.destroy()
        this.uiManager.destroy()
    }

    /* Interactions */

    async rollPhase (player: Player): Promise<Slot> {
        await this.uiManager.displayMainView()
        this.ctx.adminWindow.webContents.send('enable-roll')
        await this.rollQueue.get()

        const cell = await this.boardManager.roll(player)

        return cell
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

    async playerSkipHandler () {
        const skipEvent: Event = {
            type: 'skip',
            nbTurns: 1,
            text: 'Tour sauté'
        }

        await this.uiManager.displayEvent(skipEvent)
    }

    async runQuestionCallback (question: Question, config: GameConfiguration, slot: GameSlot, player: Player): Promise<QuestionWinners> {
        const tempPlayer: Player = {
            name: player.name,
            score: 0,
            color: player.color
        }
        const tempState: GameState = {
            players: [tempPlayer]
        }

        this.uiManager.hideBoard()
        return await startGenericQuestion(this.ctx, question, config, tempState)
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
        await this.uiManager.displayEvent(event)

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

    async slotPhase (slot: Slot, player: Player) {
        switch (slot.type) {
        case 'EventSlot':
            await this.scoreManager.commitPendingScore(player)
            await this.handleEvent(slot.event, player)
            break
        case 'GameSlot': {
            await this.questionManager.handleGooseGameSlot(slot, player)
            break
        }
        default: {
            const exhaustiveCheck: never = slot
            throw new Error(`Unhandled color case: ${exhaustiveCheck}`)
        }
        }
    }

    async run () {
        while (!this.scoreManager.hasWinner()) {
            const player = await this.turnManager.getNextTeam()
            const slot = await this.rollPhase(player)

            this.ctx.adminWindow.webContents.send('enable-start-question')
            await this.startQueue.get()

            await this.slotPhase(slot, player)
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
