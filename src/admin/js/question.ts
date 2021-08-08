import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { GameState, QuestionWinners } from 'ani-grenoble-games-format/dist/GameState'
import { ipcRenderer } from 'electron';

export function onHintClick(id: string) {
    const button = document.getElementById(id)!;
    button.setAttribute('disabled', 'true');
    ipcRenderer.send('give-hint', button.textContent);
}

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q;

    const xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
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
        ipcRenderer.send('admin_question_ready');
    }
    xhttp.open("GET", "/html/question.html", true);
    xhttp.send();
});

var winners: string[] = new Array();
function submit_winners() {
    const response: QuestionWinners = {
        points: Number((document.getElementById('question-score') as HTMLInputElement).value),
        players: winners,
    };
    ipcRenderer.send("admin-send-winners", response);
}

const button_handler = (name: string, insertedButton: HTMLButtonElement) => {
    console.log(insertedButton.style.borderStyle);
    if (winners.includes(name)) {
        winners = winners.filter(x => x != name);
        insertedButton.style.backgroundColor = "";
    } else {
        winners.push(name);
        insertedButton.style.backgroundColor = "#00ff00";
    }
}

ipcRenderer.on('game-state-data', (_, s) => {
    const state: GameState = s;
    const template = document.getElementById("winners-selection-template")! as HTMLTemplateElement;
    const winnersDiv = document.getElementById("winners-selection-div")!;
    for (var teamIdx = 0; teamIdx < state.players.length; teamIdx++) {
        const buttonID = `winners-selection-button-${teamIdx}`;
        const player = state.players[teamIdx];
        const clone = document.importNode(template.content, true);
        const button = clone.getElementById("winners-selection-template-name")!;
        button.id = buttonID;
        button.textContent = player.name;
        winnersDiv.appendChild(clone);
        const insertedButton = document.getElementById(buttonID)! as HTMLButtonElement;
        insertedButton.onclick = () => button_handler(player.name, insertedButton);
    }
});