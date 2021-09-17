import { Player } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

ipcRenderer.on('player_add', async (_, player: Player) => {
    let teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
    while (teamTemplate === null) {
        teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
        if (teamTemplate === null) {
            await delay(50)
        }
    }

    teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
    const teamsDiv = document.getElementById('teams')
    const clone = document.importNode(teamTemplate.content, true)
    clone.getElementById('team-template-name')!.textContent = player.name
    clone.getElementById('team-template-score')!.textContent = player.score.toString()
    clone.getElementById('team-template-name')!.style.textShadow = ' 0 0 7px #fff,0 0 10px #fff,0 0 21px #fff,0 0 42px #' + player.color + ',0 0 82px #' + player.color + ',0 0 92px #' + player.color + ',  0 0 102px #' + player.color + ',0 0 151px #' + player.color

    teamsDiv!.appendChild(clone)
})

ipcRenderer.on('game-select', async (_, name, id, color) => {
    document.getElementById('bigImg')!.style.maxWidth = '15vw'
    document.getElementById('gameCat')!.style.visibility = 'visible'
    document.getElementById('teams')!.style.display = 'none'
    document.getElementById('neonPink')!.innerHTML = 'Le jeu continue !'
})
