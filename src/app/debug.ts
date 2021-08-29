import { Context } from './context'
import { BlindTestQuestion, HangedManQuestion, QuoteQuestion } from '@gaelgc/ani-grenoble-games-format'

export async function debug (ctx: Context, req: string) {
    if (req === 'song') {
        const question: BlindTestQuestion = {
            path: 'question://D:/440.mp3',
            name: 'Blind test',
            type: 'BlindTestQuestion',
            points: 1,
            answer: '440Hz',
            hints: ['440', 'Hertz'],
            answerImage: 'question://D:/440.jpg'
        }
        console.log(question)
        await ctx.startBlindtestQuestion(question)
    } else if (req === 'quote') {
        const question: QuoteQuestion = {
            audio: 'question://D:/440.mp3',
            text: 'What frequency is this ?',
            name: 'Quote',
            type: 'QuoteQuestion',
            points: 2,
            answer: '440Hz',
            hints: ['440', 'Hertz']
        }
        console.log(question)
        await ctx.startQuoteQuestion(question)
    } else if (req === 'hanged_man') {
        const question: HangedManQuestion = {
            name: 'Hanged man',
            type: 'HangedManQuestion',
            points: 2,
            answer: 'This is a test of the HangedMan game',
            hints: []
        }
        console.log(question)
        await ctx.startHangedManQuestion(question)
    } else {
        throw Error(`Unknwon debug request ${req}`)
    }
}
