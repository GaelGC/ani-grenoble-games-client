import { app, ipcRenderer } from 'electron';
import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q;
});
