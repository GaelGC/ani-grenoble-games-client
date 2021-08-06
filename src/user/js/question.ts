import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { ipcRenderer } from 'electron';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q;

    const xhttp = new XMLHttpRequest();
    xhttp.onloadend = function() {
        document.getElementById('question-div')!.innerHTML = this.responseText;
    }
    xhttp.open("GET", "/html/question.html", true);
    xhttp.send();
});

ipcRenderer.on('hint', async (_, hint: string) => {
    var hint_template: HTMLTemplateElement | null = null;
    while (hint_template === null) {
        hint_template = document.getElementById('hint-template') as HTMLTemplateElement;
        if (hint_template === null) {
            await delay(50);
        }
    }
    const clone = document.importNode(hint_template.content, true);
    clone.getElementById('hint')!.textContent = hint;
    document.getElementById('hints')?.appendChild(clone);
});