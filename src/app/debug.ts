import { Context } from './context'
import { BlindTestQuestion } from 'ani-grenoble-games-format/dist/QuestionTypes'

export async function debug (ctx: Context, req: string) {
    if (req === 'song') {
        const question: BlindTestQuestion = {
            path: 'question://D:/440.mp3',
            name: 'Blind test',
            type: 'BlindTestQuestion',
            points: 1,
            answer: '440Hz',
            hints: ['440', 'Hertz']
        }
        console.log(question)
        await ctx.startBlindtestQuestion(question)
    } else {
        throw Error(`Unknwon debug request ${req}`)
    }
}
