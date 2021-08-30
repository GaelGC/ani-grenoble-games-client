import { ipcRenderer } from 'electron'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Rien ne semble se faire ici. Je pense que y'a simplement un soucis de connexion sur les f�netres
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
})

ipcRenderer.on('player_delete', async (_, name, id) => {
    const divToDelete = document.getElementById(id)
    divToDelete?.remove()
})

ipcRenderer.send('user_ready')
