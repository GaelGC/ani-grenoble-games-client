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

    document.getElementById('neonPink')!.innerHTML = 'Les équipes'

    const teamsDiv = document.getElementById('teams')
    const clone = document.importNode(teamTemplate.content, true)
    clone.getElementById('team-template-div')!.id = id
    clone.getElementById('team-template-name')!.textContent = name

    clone.getElementById('team-template-name')!.style.textShadow = ' 0 0 7px #fff,0 0 10px #fff,0 0 21px #fff,0 0 42px #' + color + ',0 0 82px #' + color + ',0 0 92px #' + color + ',  0 0 102px #' + color + ',0 0 151px #' + color

    teamsDiv!.appendChild(clone)

    document.getElementById('bigImg')!.style.maxWidth = '25vw'
})

ipcRenderer.on('player_delete', async (_, name, id) => {
    const divToDelete = document.getElementById(id)
    divToDelete?.remove()
})

ipcRenderer.on('game-select', async (_, name, id, color) => {
    document.getElementById('bigImg')!.style.maxWidth = '15vw'
    document.getElementById('gameCat')!.style.visibility = 'visible'
    document.getElementById('teams')!.style.display = 'none'
    document.getElementById('neonPink')!.innerHTML = 'Les différents jeux'
})

ipcRenderer.send('user_ready')
