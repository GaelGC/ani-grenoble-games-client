import { context } from './context';
import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'

export function debug(ctx: context, req: string) {
    if (req === 'song') {
        const question: BlindTestQuestion = {
            path: 'question://D:/440.mp3',
            name: 'Blind test',
            type: 'BlindTestQuestion',
            points: 1,
            answer: '440Hz',
            hints: ["440", "Hertz"]
        };
        console.log(question);
        ctx.start_blindtest_question(question);
    } else {
        throw Error(`Unknwon debug request ${req}`);
    }
}