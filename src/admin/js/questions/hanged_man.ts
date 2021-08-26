import { ipcRenderer } from 'electron'
import { GameState, Player } from 'ani-grenoble-games-format/dist/GameState'

let players: Player[] = []
let currentTeam: Player

ipcRenderer.on('question-data', (_, q) => {
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
    (<HTMLInputElement>document.getElementById('letter-input')).disabled = false
}

export async function onLetterChoice (letter: string) {
    const inputField = <HTMLInputElement>document.getElementById('letter-input')
    inputField.disabled = true
    inputField.value = ''

    const valid = await ipcRenderer.invoke('hanged-man-letter', letter)
    if (!valid) {
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    inputField.disabled = false
    inputField.focus()
}
