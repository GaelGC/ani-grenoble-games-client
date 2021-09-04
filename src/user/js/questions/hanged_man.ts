import { ipcRenderer } from 'electron'
import { HangedManQuestion, GameState } from '@gaelgc/ani-grenoble-games-format'

let word = ''
let shownWord = ''
const players: string[] = []

function updateWordDiv () {
    const wordDiv = document.getElementById('word-div')!
    wordDiv.textContent = shownWord
}

ipcRenderer.on('game-state-data', (_, s: GameState) => {
    const stock = s.players
    for (let i = 0; i < stock.length; i++) {
        players[i] = stock[i].name
    }
})

ipcRenderer.on('current-team', (_, t: number) => {
    document.getElementById('team-div')!.textContent = players[t]
})

ipcRenderer.on('question-data', (_, q: HangedManQuestion) => {
    word = q.answer
    shownWord = word.replace(/[a-zA-Z0-9]/g, '_')
    updateWordDiv()
})

ipcRenderer.on('letter', (_, letter: string) => {
    letter = letter.toLowerCase()
    for (let idx = 0; idx < word.length; idx++) {
        if (word[idx].toLowerCase() === letter) {
            shownWord = shownWord.substr(0, idx) + word[idx] + shownWord.substr(idx + 1)
        }
    }
    updateWordDiv()
    document.getElementById('used-letter-div')!.textContent += letter.toUpperCase()
})

ipcRenderer.on('answer', async (_, answer: string) => {
    const hangedDiv = document.getElementById('word-div')!
    hangedDiv.textContent = ''
})

async function start () {
    let answerDiv = document.getElementById('answer')!
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    while (answerDiv === null) {
        answerDiv = document.getElementById('answer')!
        if (answerDiv === null) {
            await delay(50)
        }
    }
    answerDiv.style.fontSize = '1.5em'
    answerDiv.style.fontFamily = 'monospace'
    answerDiv.style.letterSpacing = '5px'
    answerDiv.textContent = ''
}

start()
