import { ipcRenderer } from 'electron'
import { Player, GameState, HangedManQuestion } from '@gaelgc/ani-grenoble-games-format'

let players: Player[] = []
let currentTeam: Player

ipcRenderer.on('question-data', (_, q) => {
    const question: HangedManQuestion = q
    document.getElementById('answer')!.textContent = question.answer
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

    document.getElementById('used-letter-div')!.textContent = document.getElementById('used-letter-div')!.textContent + ' ' + letter

    const valid = await ipcRenderer.invoke('hanged-man-letter', letter)
    if (!valid) {
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    inputField.disabled = false
    inputField.focus()
}
