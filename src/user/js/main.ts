import { ipcRenderer } from 'electron'

let teamCounter = 0
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Rien ne semble se faire ici. Je pense que y'a simplement un soucis de connexion sur les f�netres
ipcRenderer.on('player_add', async (_, name: string) => {
    console.log(name)

    let teamTemplate: HTMLTemplateElement | null = null
    while (teamTemplate === null) {
        teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
        if (teamTemplate === null) {
            await delay(50)
        }
    }

    if(document.getElementById('mainTitle')!.style.visibility == "visible"){
        document.getElementById('mainTitle')!.style.visibility = "collapse"
        document.getElementById('teams')!.style.visibility = "visibile"
    }
    
    const teamsDiv = document.getElementById('teams')
    const id = `team-div-${teamCounter++}`

    const clone = document.importNode(teamTemplate.content, true)
    clone.getElementById('team-template-div')!.id = id
    clone.getElementById('team-template-name')!.textContent = name
    teamsDiv!.appendChild(clone)
})

ipcRenderer.on('player_delete', async (_, name: string) => {
    console.log(name)
    const teamsDiv = document.getElementById('teams')
    teamsDiv!.removeChild(document.getElementById(name)!)
})

ipcRenderer.send('user_ready')
