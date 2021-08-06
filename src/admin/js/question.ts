import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { ipcRenderer } from 'electron';

export function onHintClick(id: string) {
    const button = document.getElementById(id)!;
    button.setAttribute('disabled', 'true');
    ipcRenderer.send('give-hint', button.textContent);
}

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q;

    const xhttp = new XMLHttpRequest();
    xhttp.onloadend = function() {
        document.getElementById('question-div')!.innerHTML = this.responseText;
        document.getElementById('answer')!.textContent = question.answer;
        (document.getElementById('question-score') as HTMLInputElement).value = question.points.toString();
        const template: HTMLTemplateElement = document.getElementById('hint-template') as HTMLTemplateElement;
        for (var hint_idx = 0; hint_idx < question.hints.length; hint_idx++) {
            const clone = document.importNode(template.content, true);
            const button = clone.getElementById('hint-button')!
            button.textContent = question.hints[hint_idx];
            button.setAttribute('id', hint_idx.toString());
            button.setAttribute('onclick', `onHintClick(this.id);`);
            document.getElementById('hints')!.appendChild(clone);
        }
    }
    xhttp.open("GET", "/html/question.html", true);
    xhttp.send();
});