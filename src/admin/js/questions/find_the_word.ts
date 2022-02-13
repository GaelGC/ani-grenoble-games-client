import { ipcRenderer } from 'electron'
import { Player, GameState, FindTheWordQuestion } from '@gaelgc/ani-grenoble-games-format'

let players: Player[] = []
let currentTeam: Player
let length = 0

ipcRenderer.on('question-data', (_, q : FindTheWordQuestion) => {
    (<HTMLInputElement>document.getElementById('word-input')).maxLength = q.answer.length
    length = q.answer.length
})

ipcRenderer.on('game-state-data', (_, s: GameState) => {
    players = s.players
})

ipcRenderer.on('current-team', (_, t: number) => {
    setCurrentTeam(players[t])
})

ipcRenderer.on('init', (_) => {
    init()
})

function setCurrentTeam (team: Player) {
    currentTeam = team
    document.getElementById('current-team-div')!.textContent = currentTeam.name
}

function init () {
    (<HTMLInputElement>document.getElementById('word-input')).disabled = false
}

export async function onLetterChange (word: string) {
    await ipcRenderer.invoke('find-the-word-temp-select', word)
}

export async function onPotentialWordChoice (pressedKey : string, word : string) {
    if (pressedKey === 'Enter' && word.length === length) {
        const field = (<HTMLInputElement>document.getElementById('word-input'))
        field.value = ''
        field.disabled = true
        field.disabled = await ipcRenderer.invoke('new-word', word)
        field.focus()
    }
}
