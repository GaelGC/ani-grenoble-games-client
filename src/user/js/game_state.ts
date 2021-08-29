import { GameState } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

ipcRenderer.on('game-state-data', (_, s) => {
    console.log('rezfzefzefz')
    const state: GameState = s

    const xhttp = new XMLHttpRequest()
    xhttp.onloadend = function () {
        document.getElementById('game-state-div')!.innerHTML = this.responseText
        const teamTemplate: HTMLTemplateElement = document.getElementById('team-template') as HTMLTemplateElement
        for (const player of state.players) {
            const clone = document.importNode(teamTemplate.content, true)
            clone.getElementById('team-template-name')!.textContent = player.name
            clone.getElementById('team-template-score')!.textContent = player.score.toString()
            document.getElementById('teams')?.appendChild(clone)
        }
    }
    xhttp.open('GET', '/html/state.html', true)
    xhttp.send()
})
