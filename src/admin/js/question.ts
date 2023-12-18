import { GameState, QuestionWinners, Question } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

export function onHintClick (id: string) {
    const button = document.getElementById(id)!
    button.setAttribute('disabled', 'true')
    ipcRenderer.send('give-hint', button.textContent)
}

ipcRenderer.on('question-data', (_, q) => {
    const question: Question = q

    const xhttp = new XMLHttpRequest()
    xhttp.onloadend = function () {
        document.getElementById('question-div')!.innerHTML = this.responseText;
        (document.getElementById('question-score') as HTMLInputElement).value = question.points.toString()
        const template: HTMLTemplateElement = document.getElementById('hint-template') as HTMLTemplateElement
        for (let hintIdx = 0; hintIdx < question.hints.length; hintIdx++) {
            const clone = document.importNode(template.content, true)
            const button = clone.getElementById('hint-button')!
            button.textContent = question.hints[hintIdx]
            button.setAttribute('id', hintIdx.toString())
            button.setAttribute('onclick', 'onHintClick(this.id);')
            document.getElementById('hints')!.appendChild(clone)
        }
        ipcRenderer.send('admin_question_ready')
    }
    xhttp.open('GET', '/html/question.html', true)
    xhttp.send()
})

let winners: string[] = []
export function submitWinners () {
    const response: QuestionWinners = {
        points: Number((document.getElementById('question-score') as HTMLInputElement).value),
        players: winners
    }
    ipcRenderer.send('admin-send-winners', response)
}

export function updateWinners () {
    const response: QuestionWinners = {
        points: Number((document.getElementById('question-score') as HTMLInputElement).value),
        players: winners
    }
    ipcRenderer.send('admin-update-winners', response)
}

const buttonHandler = (name: string, insertedButton: HTMLButtonElement) => {
    if (winners.includes(name)) {
        winners = winners.filter(x => x !== name)
        insertedButton.style.backgroundColor = ''
        insertedButton.style.color = ''
    } else {
        winners.push(name)
        insertedButton.style.backgroundColor = '#629969a6'
        insertedButton.style.color = '#CAFFD0'
    }
    updateWinners()
}

ipcRenderer.on('game-state-data', (_, s) => {
    const state: GameState = s
    const template = document.getElementById('winners-selection-template')! as HTMLTemplateElement
    const winnersDiv = document.getElementById('winners-selection-div')!
    for (let teamIdx = 0; teamIdx < state.players.length; teamIdx++) {
        const buttonID = `winners-selection-button-${teamIdx}`
        const player = state.players[teamIdx]
        const clone = document.importNode(template.content, true)
        const button = clone.getElementById('winners-selection-template-name')!
        button.id = buttonID
        button.textContent = player.name
        winnersDiv.appendChild(clone)
        const insertedButton = document.getElementById(buttonID)! as HTMLButtonElement
        insertedButton.onclick = () => buttonHandler(player.name, insertedButton)
    }
})

export function revealAnswer () {
    ipcRenderer.send('reveal-answer')
}
