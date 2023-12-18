import { Context } from './context'
import { BlindTestQuestion, HangedManQuestion, QuoteQuestion, ImagesQuestion, FindTheWordQuestion, GameConfiguration } from '@gaelgc/ani-grenoble-games-format'
import { startGenericQuestion } from './question'

export async function debug (ctx: Context, req: string) {
    const config: GameConfiguration = {
        playlist: 'random',
        randomSample: true
    }
    if (req === 'song') {
        const question: BlindTestQuestion = {
            path: 'question://D:/440.mp3',
            name: 'Blind test',
            type: 'BlindTestQuestion',
            points: 1,
            answer: '440Hz',
            hints: ['440', 'Hertz'],
            answerImage: 'question://D:/440.jpg',
            tags: []
        }
        console.log(question)
        await startGenericQuestion(ctx, question, config, ctx.state)
    } else if (req === 'quote') {
        const question: QuoteQuestion = {
            audio: 'question://D:/440.mp3',
            text: 'What frequency is this ?',
            name: 'Quote',
            type: 'QuoteQuestion',
            points: 2,
            answer: '440Hz',
            hints: ['440', 'Hertz'],
            tags: []
        }
        console.log(question)
        await startGenericQuestion(ctx, question, config, ctx.state)
    } else if (req === 'hanged_man') {
        const question: HangedManQuestion = {
            name: 'Hanged man',
            type: 'HangedManQuestion',
            points: 2,
            answer: 'This is a test of the HangedMan game',
            hints: [],
            tags: []
        }
        console.log(question)
        await startGenericQuestion(ctx, question, config, ctx.state)
    } else if (req === 'find_the_word') {
        const question: FindTheWordQuestion = {
            name: 'Find the Word',
            type: 'FindTheWordQuestion',
            points: 1,
            answer: 'Madoka',
            nbTries: 5,
            hints: [],
            tags: []
        }
        console.log(question)
        await startGenericQuestion(ctx, question, config, ctx.state)
    } else if (req === 'images') {
        const question: ImagesQuestion = {
            name: 'two images, one answer',
            type: 'ImagesQuestion',
            points: 2,
            answer: 'three',
            images: ['question://D:/one.jpg', 'question://D:/one.jpg', 'question://D:/one.jpg', 'question://D:/one.jpg', 'question://D:/one.jpg', 'question://D:/one.jpg', 'question://D:/one.jpg', 'question://D:/one.jpg'],
            hints: [],
            tags: []
        }
        console.log(question)
        await startGenericQuestion(ctx, question, config, ctx.state)
    } else {
        throw Error(`Unknwon debug request ${req}`)
    }
}
