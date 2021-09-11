import { Player } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

ipcRenderer.on('player_add', async (_, player: Player) => {
    const teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
    const teamsDiv = document.getElementById('teams')
    const clone = document.importNode(teamTemplate.content, true)
    clone.getElementById('team-template-name')!.textContent = player.name
    clone.getElementById('team-template-score')!.textContent = player.score.toString()
    clone.getElementById('team-template-name')!.style.textShadow = ' 0 0 7px #fff,0 0 10px #fff,0 0 21px #fff,0 0 42px #' + player.color + ',0 0 82px #' + player.color + ',0 0 92px #' + player.color + ',  0 0 102px #' + player.color + ',0 0 151px #' + player.color

    teamsDiv!.appendChild(clone)
})
