import { app, ipcRenderer } from 'electron';
import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q;
    const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement;
    const clone = document.importNode(template.content, true);
    clone.getElementById('audio')!.setAttribute('src', question.path);
    document.querySelector("body")!.appendChild(clone);
});