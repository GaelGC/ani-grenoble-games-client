import { context } from './context';
import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'

export function debug(ctx: context, req: string) {
    if (req === 'song') {
        const question: BlindTestQuestion = {
            path: 'file://E:/OST/[Nipponsei] Wakaba Girl OP Single - Hajimete Girls  [Ray]/01 - Hajimete Girls!.mp3',
            name: 'Blind test',
            type: 'BlindTestQuestion',
            points: 1,
            answer: 'Wakaba*Girl',
            hints: ["2015", "Studio Nexus", "4koma adaptation"]
        };
        console.log(question);
        ctx.start_blindtest_question(question);
    } else {
        throw Error(`Unknwon debug request ${req}`);
    }
}