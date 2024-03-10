/* eslint-disable no-unused-expressions */
import { expect } from 'chai'
import { describe, it } from 'mocha'
import { BoardManager, EventManager, QuestionManager, ScoreManager, TeamTurnManager } from '../src/app/goose'
import { Event, GameConfiguration, GooseBoard, Player, Question, QuestionSet, QuestionWinners, TagSelectorSlot, TypeSelectorSlot } from '@gaelgc/ani-grenoble-games-format'

describe('Team Turn Manager', () => {
    const players: Player[] = [
        { color: '#000000', name: 'a', score: 0 },
        { color: '#000000', name: 'b', score: 0 },
        { color: '#000000', name: 'c', score: 0 }
    ]

    it('normal turns', async () => {
        const teamTurnManager = new TeamTurnManager(players)
        teamTurnManager.turnSkipListener = () => expect.fail('Got an erroneous skip.')
        expect(await teamTurnManager.getNextTeam()).eql(players[0])
        expect(await teamTurnManager.getNextTeam()).eql(players[1])
        expect(await teamTurnManager.getNextTeam()).eql(players[2])
        expect(await teamTurnManager.getNextTeam()).eql(players[0])
    })

    it('skip', async () => {
        const teamTurnManager = new TeamTurnManager(players)
        const skips: number[] = []
        teamTurnManager.turnSkipListener = async (idx) => { skips.push(idx) }
        teamTurnManager.registerTeamSkip(players[1], 2)
        teamTurnManager.registerTeamSkip(players[2], 1)
        expect(await teamTurnManager.getNextTeam()).eql(players[0])
        skips.push(-1)
        expect(await teamTurnManager.getNextTeam()).eql(players[0])
        skips.push(-1)
        expect(await teamTurnManager.getNextTeam()).eql(players[2])
        skips.push(-1)
        expect(await teamTurnManager.getNextTeam()).eql(players[0])
        skips.push(-1)
        expect(await teamTurnManager.getNextTeam()).eql(players[1])
        skips.push(-1)
        expect(await teamTurnManager.getNextTeam()).eql(players[2])
        skips.push(-1)
        expect(skips).deep.equal([-1, 1, 2, -1, 1, -1, -1, -1, -1], 'Invalid skip pattern')
    })

    it('display', async () => {
        const teamTurnManager = new TeamTurnManager(players)
        const displayedPlayer: Player[] = []
        teamTurnManager.displayCurrentTeamCallback = async (player) => { displayedPlayer.push(player) }
        await teamTurnManager.getNextTeam()
        await teamTurnManager.display()
        await teamTurnManager.getNextTeam()
        await teamTurnManager.display()
        await teamTurnManager.getNextTeam()
        await teamTurnManager.display()
        expect(displayedPlayer).deep.equal([players[0], players[1], players[2]], 'Invalid players displayed')
    })
})

describe('Score Manager', () => {
    const playerA = { color: '#000000', name: 'a', score: 0 }
    const playerB = { color: '#000000', name: 'b', score: 0 }
    const players: Player[] = [playerA, playerB]

    it('set', async () => {
        const scoreManager = new ScoreManager(players, 5)
        /* Check immediate works */
        await scoreManager.setScore(playerA, 'immediate', 'absolute', 2)
        expect(scoreManager.score(playerA)).eql(2)
        await scoreManager.setScore(playerA, 'immediate', 'relative', 2)
        expect(scoreManager.score(playerA)).eql(4)
        /* Check cancellation works. */
        await scoreManager.setScore(playerA, 'pending', 'absolute', 2)
        expect(scoreManager.score(playerA)).eql(4)
        await scoreManager.dropPendingScore(playerA)
        expect(scoreManager.score(playerA)).eql(4)
        /* Check commit works. */
        await scoreManager.setScore(playerA, 'pending', 'absolute', 2)
        expect(scoreManager.score(playerA)).eql(4)
        await scoreManager.commitPendingScore(playerA)
        expect(scoreManager.score(playerA)).eql(2)
    })

    it('set handlers', async () => {
        const scoreManager = new ScoreManager(players, 5)
        const lastPendingChange: {called: boolean, player ?: Player, old ?: number, newScore ?: number} = { called: false }
        const lastPendingCommit: {called: boolean, player ?: Player, newScore ?: number} = { called: false }
        const lastPendingDrop: {called: boolean, player ?: Player, dropped ?: number, current ?: number} = { called: false }

        scoreManager.pendingScoreChangeListener = async (player, old, newScore) => {
            lastPendingChange.player = player
            lastPendingChange.newScore = newScore
            lastPendingChange.old = old
            lastPendingChange.called = true
        }

        scoreManager.pendingScoreCommitListener = async (player, newScore) => {
            lastPendingCommit.player = player
            lastPendingCommit.newScore = newScore
            lastPendingCommit.called = true
        }

        scoreManager.pendingScoreDropListener = async (player, dropped, current) => {
            lastPendingDrop.player = player
            lastPendingDrop.dropped = dropped
            lastPendingDrop.current = current
            lastPendingDrop.called = true
        }

        await scoreManager.setScore(playerA, 'immediate', 'absolute', 2)
        expect(lastPendingChange.called).to.be.false
        expect(lastPendingDrop.called).to.be.false
        expect(lastPendingCommit).deep.equal({ called: true, player: playerA, newScore: 2 })
        lastPendingCommit.called = false

        await scoreManager.setScore(playerA, 'pending', 'relative', 2)
        expect(lastPendingChange).deep.equal({ called: true, player: playerA, old: 2, newScore: 4 })
        expect(lastPendingDrop.called).to.be.false
        expect(lastPendingCommit.called).to.be.false
        lastPendingChange.called = false

        await scoreManager.dropPendingScore(playerA)
        expect(lastPendingChange.called).to.be.false
        expect(lastPendingDrop).deep.equal({ called: true, player: playerA, dropped: 4, current: 2 })
        expect(lastPendingCommit.called).to.be.false
        lastPendingDrop.called = false

        await scoreManager.setScore(playerA, 'pending', 'relative', 2)
        lastPendingChange.called = false

        await scoreManager.commitPendingScore(playerA)
        expect(lastPendingChange.called).to.be.false
        expect(lastPendingDrop.called).to.be.false
        expect(lastPendingCommit).deep.equal({ called: true, player: playerA, newScore: 4 })
        lastPendingCommit.called = false
    })

    it('win', async () => {
        const scoreManager = new ScoreManager(players, 5)
        const called: {player?: Player} = {}

        scoreManager.winListener = async (player) => { called.player = player }
        await scoreManager.setScore(playerA, 'immediate', 'absolute', 3)
        expect(called.player).to.be.undefined
        /* Check pending scores do not trigger wins. */
        await scoreManager.setScore(playerA, 'pending', 'absolute', 5)
        expect(called.player).to.be.undefined
        await scoreManager.setScore(playerB, 'pending', 'absolute', 5)
        expect(called.player).to.be.undefined
        expect(scoreManager.hasWinner()).to.be.false
        await scoreManager.commitPendingScore(playerB)
        expect(called.player).eql(playerB)
        expect(scoreManager.hasWinner()).to.be.true
    })

    it('swap', async () => {
        const scoreManager = new ScoreManager(players, 5)
        const swapped = new Set<Player>()
        scoreManager.swapListener = async (p1, p2) => {
            swapped.add(p1)
            swapped.add(p2)
        }

        await scoreManager.setScore(playerA, 'immediate', 'absolute', 3)
        /* We set this one as pending as swap commits the score */
        await scoreManager.setScore(playerB, 'pending', 'absolute', 1)
        await scoreManager.swapPlayers(playerA, playerB)
        expect(scoreManager.score(playerA)).eql(1)
        expect(scoreManager.score(playerB)).eql(3)
        expect(swapped.size === 2 && swapped.has(playerA) && swapped.has(playerB))
    })

    it('display', async () => {
        const scoreManager = new ScoreManager(players, 5)
        const scores = new Map<string, number>()
        scoreManager.displayCallback = async (players) => players.forEach(p => scores.set(p.name, p.score))
        await scoreManager.setScore(playerA, 'immediate', 'absolute', 2)
        await scoreManager.setScore(playerB, 'pending', 'absolute', 2)
        await scoreManager.display()
        expect(scores.size).eql(2)
        expect(scores.get(playerA.name)).eql(2)
        expect(scores.get(playerB.name)).eql(0)
    })
})

describe('Board Manager', () => {
    const board: GooseBoard = {
        slots: [
            { type: 'GameSlot', pos: { x: 0, y: 0 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 1, y: 1 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 2, y: 2 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 3, y: 3 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 4, y: 4 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 5, y: 5 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 6, y: 6 }, selector: 'TypeSelector', types: [], tile: 0 },
            { type: 'GameSlot', pos: { x: 7, y: 7 }, selector: 'TypeSelector', types: [], tile: 0 }
        ],
        winPos: {
            x: 0,
            y: 0
        },
        cellTileSet: '',
        playersTileSet: '',
        eventCardImage: '',
        pawnMoveSound: '',
        eventRevealSound: '',
        eventTextColor: '',
        version: 2
    }

    it('roll', async () => {
        const boardManager = new BoardManager(board, async (_, roll) => { return roll + 1 })
        const lastRoll: {roll?: number} = {}
        boardManager.rollListener = async (roll) => { lastRoll.roll = roll }

        const roll = (await boardManager.roll({ color: '', name: '', score: 0 })).pos.x
        expect(roll).eql(lastRoll.roll! + 1)
    })

    it('fairness', async () => {
        const boardManager = new BoardManager(board, async (_, roll) => { return roll })
        const nbs = new Map<number, number>()
        /* Fairness test, just in case we failed proper conversion. */
        for (let i = 1; i <= 6; i++) {
            nbs.set(i, 0)
        }
        for (let i = 0; i < 10000; i++) {
            const roll = (await boardManager.roll({ color: '', name: '', score: 0 })).pos.x
            nbs.set(roll, nbs.get(roll)! + 1)
        }
        nbs.forEach((value, key) => {
            /* Approximately 5 sigmas, so we expect less than a fail per million run. */
            expect(value).to.be.closeTo(1666, 382, `Unfair roll on ${key}`)
        })
    })

    it('display', async () => {
        /* Not that useful for now, but let's still have it as a stub. */
        const boardManager = new BoardManager(board, async (_, roll) => { return roll })
        const displayed: {board?: GooseBoard} = {}
        boardManager.displayBoardCallback = async (board) => { displayed.board = board }
        await boardManager.display()
        expect(displayed.board).equal(board)
    })
})

describe('Question Manager', () => {
    const configuration: GameConfiguration = {
        playlist: 'random',
        randomSample: false
    }
    const questions: QuestionSet = {
        configuration,
        questions: [
            { type: 'TextQuestion', answer: '111', name: '', hints: [], question: '', tags: ['1'], points: 4 },
            { type: 'QuoteQuestion', answer: '111', name: '', hints: [], text: '', tags: ['2', '4'], points: 4 },
            { type: 'BlindTestQuestion', answer: '111', name: '', hints: [], path: '', tags: ['3', '1'], points: 4, answerImage: '' },
            { type: 'HangedManQuestion', answer: '111', name: '', hints: [], points: 4, tags: ['4'] }
        ]
    }

    it('Type selector', async () => {
        for (let iter = 0; iter < 50; iter++) {
            let seen: Question[] = []
            const questionManager = new QuestionManager(questions, async (question) => {
                seen.push(question)
                const winners: QuestionWinners = {
                    players: [],
                    points: 0
                }
                return winners
            })
            const baseSlot: TypeSelectorSlot = { type: 'GameSlot', pos: { x: 0, y: 0 }, selector: 'TypeSelector', tile: 0, types: [] }
            const player: Player = { name: '', color: '', score: 0 }

            /* A single question is compatible each time, none should be removed. */
            for (const q of questions.questions) {
                baseSlot.types = [q.type]
                await questionManager.handleGooseGameSlot(baseSlot, player)
            }
            expect(seen).deep.equal([questions.questions[0], questions.questions[1], questions.questions[2], questions.questions[3]])

            seen = []
            baseSlot.types = ['TextQuestion', 'QuoteQuestion', 'BlindTestQuestion', 'HangedManQuestion']
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const q of questions.questions) {
                await questionManager.handleGooseGameSlot(baseSlot, player)
            }
            /* We expect one of those to be removed each time we called. */
            expect(seen).contains(questions.questions[0])
            expect(seen).contains(questions.questions[1])
            expect(seen).contains(questions.questions[2])
            expect(seen).contains(questions.questions[3])
        }
    })

    it('Tag selector', async () => {
        for (let iter = 0; iter < 50; iter++) {
            let seen: Question[] = []
            const questionManager = new QuestionManager(questions, async (question) => {
                seen.push(question)
                const winners: QuestionWinners = {
                    players: [],
                    points: 0
                }
                return winners
            })
            const baseSlot: TagSelectorSlot = { type: 'GameSlot', pos: { x: 0, y: 0 }, selector: 'TagSelector', tile: 0, tags: [] }
            const player: Player = { name: '', color: '', score: 0 }

            baseSlot.tags = ['1']
            await questionManager.handleGooseGameSlot(baseSlot, player)
            await questionManager.handleGooseGameSlot(baseSlot, player)
            expect(seen).contains(questions.questions[0])
            expect(seen).contains(questions.questions[2])
            seen = []
            baseSlot.tags = ['2', '4']
            await questionManager.handleGooseGameSlot(baseSlot, player)
            expect(seen).deep.equal([questions.questions[1]])
            seen = []
            baseSlot.tags = ['4']
            await questionManager.handleGooseGameSlot(baseSlot, player)
            await questionManager.handleGooseGameSlot(baseSlot, player)
            expect(seen).contains(questions.questions[1])
            expect(seen).contains(questions.questions[3])
        }
    })

    it('evt', async () => {
        let first = true
        let seen: Event | undefined
        let lastHasWon: boolean | undefined

        const baseSlot: TagSelectorSlot = {
            type: 'GameSlot',
            pos: { x: 0, y: 0 },
            selector: 'TagSelector',
            tile: 0,
            tags: [],
            onLose: { type: 'skip', nbTurns: 1, text: '' },
            onWin: { type: 'skip', nbTurns: 3, text: '' }
        }
        const player: Player = { name: '', color: '', score: 0 }
        const questionManager = new QuestionManager(questions, async () => {
            const winners: QuestionWinners = {
                players: [],
                points: 0
            }
            if (first) {
                first = false
            } else {
                winners.players = [player.name]
            }
            return winners
        })
        questionManager.onQuestionLose = () => { lastHasWon = false }
        questionManager.onQuestionWin = () => { lastHasWon = true }
        questionManager.eventCallback = async (evt) => { seen = evt }

        await questionManager.handleGooseGameSlot(baseSlot, player)
        expect(lastHasWon).to.be.false
        expect(seen).deep.equal(baseSlot.onLose)
        await questionManager.handleGooseGameSlot(baseSlot, player)
        expect(lastHasWon).to.be.true
        expect(seen).deep.equal(baseSlot.onWin)
    })
})

describe('Event Manager', () => {
    it('move', async () => {
        const moves: [string, string, number][] = []
        const eventManager = new EventManager([], async () => {}, () => {}, async (p, pending, kind, score) => {
            moves.push([pending, kind, score])
            return 0
        }, () => 0, async () => {})
        const player: Player = { name: '', color: '', score: 0 }
        await eventManager.handleEvent({ type: 'move', nbPos: 2, movetype: 'absolute', text: '' }, player)
        await eventManager.handleEvent({ type: 'move', nbPos: 5, movetype: 'relative', text: '' }, player)
        expect(moves).deep.equal([['immediate', 'absolute', 2], ['immediate', 'relative', 5]])
    })

    it('skips', async () => {
        const seen: number[] = []
        const eventManager = new EventManager([], async () => {}, (_, nbTurns) => { seen.push(nbTurns) }, async () => { return 0 }, () => 0, async () => {})
        const player: Player = { name: '', color: '', score: 0 }
        await eventManager.handleEvent({ type: 'skip', nbTurns: 4, text: '' }, player)
        expect(seen).deep.equal([4])
    })

    it('swaps', async () => {
        const playerA: Player = { name: 'm', color: '', score: 0 }
        const playerB: Player = { name: 'a', color: '', score: 1 }
        const playerC: Player = { name: 'M', color: '', score: 2 }
        const players = [playerA, playerB, playerC]

        let seen: Player[] = []
        const eventManager = new EventManager(players, async () => {}, () => { }, async () => { return 0 }, (p) => p.score, async (p1, p2) => {
            seen.push(p1)
            seen.push(p2)
        })
        await eventManager.handleEvent({ type: 'swap', text: '', swapType: 'best' }, playerB)
        expect(seen.length).eq(2)
        expect(seen).and.contains(playerB).and.contains(playerC)
        seen = []
        await eventManager.handleEvent({ type: 'swap', text: '', swapType: 'worst' }, playerB)
        expect(seen.length).eq(2)
        expect(seen).and.contains(playerB).and.contains(playerA)

        seen = []
        for (let i = 0; i < 10000; i++) {
            await eventManager.handleEvent({ type: 'swap', text: '', swapType: 'random' }, playerB)
        }
        expect(seen.length).eq(20000)
        const nbs = new Map<string, number>()
        seen.forEach(x => nbs.set(x.name, (nbs.get(x.name) ?? 0) + 1))
        nbs.set('a', nbs.get('a')! - 10000)
        nbs.forEach((value, key) => {
            /* Approximately 5 sigmas, so we expect less than a fail per million run. */
            expect(value).to.be.closeTo(3333, 289, `Unfair roll on ${key}`)
        })
    })

    it('display', async () => {
        const seen: Event[] = []
        const eventManager = new EventManager([], async (evt) => { seen.push(evt) }, () => { }, async () => { return 0 }, () => 0, async () => {})
        const player: Player = { name: '', color: '', score: 0 }
        const evt: Event = { type: 'skip', nbTurns: 4, text: '' }
        await eventManager.handleEvent(evt, player)
        expect(seen.length).eql(1)
        expect(seen[0]).deep.equal(evt)
    })
})
