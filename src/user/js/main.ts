import { ipcRenderer } from 'electron'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

ipcRenderer.on('player_add', async (_, name, id, color) => {
    let teamTemplate: HTMLTemplateElement | null = null
    while (teamTemplate === null) {
        teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
        if (teamTemplate === null) {
            await delay(50)
        }
    }

    const teamsDiv = document.getElementById('teams')
    const clone = document.importNode(teamTemplate.content, true)
    clone.getElementById('team-template-div')!.id = id
    clone.getElementById('team-template-name')!.textContent = name
    clone.getElementById('team-template-name')!.style.color = color
    clone.getElementById('team-template-name')!.style.textShadow = ' 0 0 1px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #' + color + ',0 0 5px #' + color + ',0 0 6px #' + color + ',  0 0 7px #' + color + ',0 0 8px #' + color

    teamsDiv!.appendChild(clone)

    document.getElementById('mainTitle')!.style.display = 'none'
    document.getElementById('teamCat')!.style.visibility = 'visible'
})

ipcRenderer.on('player_delete', async (_, name, id) => {
    const divToDelete = document.getElementById(id)
    divToDelete?.remove()
})

ipcRenderer.on('game-select', async (_, name, id, color) => {
    document.getElementById('gameCat')!.style.visibility = 'visible'
    document.getElementById('teamCat')!.style.display = 'none'
})

ipcRenderer.send('user_ready')
