import { ipcRenderer } from 'electron'
import { GameState, FindTheWordQuestion, Player } from '@gaelgc/ani-grenoble-games-format'
import { IpcRendererEvent } from 'electron/main'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let word = ''
const previousStates: number[][] = []
const previousWords: string[] = []
const players: Player[] = []
const cells: HTMLTableCellElement[][] = []

function setupUI (q: FindTheWordQuestion) {
    const table = <HTMLTableElement>document.getElementById('word-table')
    for (let row = 0; row < q.nbTries; row++) {
        const tableRow = document.createElement('tr')
        table.appendChild(tableRow)
        const cellRefs: HTMLTableCellElement[] = []
        for (let cell = 0; cell < q.answer.length; cell++) {
            const cell = document.createElement('td')
            cellRefs.push(cell)
            cell.innerText = '1'
            tableRow.appendChild(cell)
        }
        cells.push(cellRefs)
    }
    updateUI()
}

async function updateUI () {
    const nbRows = cells.length
    // Reset all cells
    for (let rowIdx = 0; rowIdx < nbRows; rowIdx++) {
        const row = cells[rowIdx]
        for (let cellIdx = 0; cellIdx < row.length; cellIdx++) {
            const cell = row[cellIdx]
            cell.className = 'empty-cell'
            cell.innerText = ''
        }
    }
    // Set completed rows to their value.
    for (let rowIdx = 0; rowIdx < previousWords.length; rowIdx++) {
        const row = cells[rowIdx]
        for (let cellIdx = 0; cellIdx < row.length; cellIdx++) {
            const cell = row[cellIdx]
            const className = ['bad-cell', 'misplaced-cell', 'good-cell']
            cell.className = className[previousStates[rowIdx][cellIdx]]
            cell.innerText = previousWords[rowIdx][cellIdx]
        }
    }
    if (word !== '') {
        // New word is being typed, we write its text.
        const row = cells[previousWords.length]
        for (let cellIdx = 0; cellIdx < word.length; cellIdx++) {
            const cell = row[cellIdx]
            cell.innerText = word[cellIdx]
        }
    } else if (previousWords.length !== 0) {
        // Word validation event, show the animation.
        const row = cells[previousWords.length - 1]
        for (let cellIdx = 0; cellIdx < row.length; cellIdx++) {
            row[cellIdx].className = 'empty-cell'
        }
        for (let cellIdx = 0; cellIdx < row.length; cellIdx++) {
            const rowIdx = previousWords.length - 1
            const cell = row[cellIdx]
            const className = ['bad-cell', 'misplaced-cell', 'good-cell']
            cell.className = className[previousStates[rowIdx][cellIdx]]
            cell.innerText = previousWords[rowIdx][cellIdx]
            await delay(500)
        }
        await ipcRenderer.send('reveal-animation-done')
    }
}

ipcRenderer.on('new-word', (_ : IpcRendererEvent, data: [string, number[], number]) => {
    previousWords.push(data[0])
    previousStates.push(data[1])
    word = ''
    updateUI()
})

ipcRenderer.on('find-the-word-temp-select', (_ : IpcRendererEvent, data: string) => {
    word = data.toUpperCase()
    updateUI()
})

ipcRenderer.on('game-state-data', (_, s: GameState) => {
    const team = s.players
    for (let i = 0; i < team.length; i++) {
        players[i] = team[i]
    }
})

ipcRenderer.on('current-team', (_, t: number) => {
    const teamDiv = document.getElementById('team-div')!
    teamDiv.textContent = players[t].name
    teamDiv.style.color = `#${players[t].color}`
})

ipcRenderer.on('question-data', (_, q: FindTheWordQuestion) => {
    setupUI(q)
})

ipcRenderer.on('answer', async (_, answer: string) => {
    const hangedDiv = document.getElementById('word-div')!
    hangedDiv.textContent = ''
})

async function start () {
    let answerDiv = document.getElementById('answer')!

    while (answerDiv === null) {
        answerDiv = document.getElementById('answer')!
        if (answerDiv === null) {
            await delay(50)
        }
    }
    answerDiv.style.fontFamily = 'monospace'
    answerDiv.style.letterSpacing = '5px'
    answerDiv.textContent = ''
}

start()
