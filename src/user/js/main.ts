import { ipcRenderer } from 'electron'

<<<<<<< Updated upstream
let teamCounter = 0
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Rien ne semble se faire ici. Je pense que y'a simplement un soucis de connexion sur les f�netres
ipcRenderer.on('player_add', async (_, name: string) => {
    console.log(name)

=======
<<<<<<< Updated upstream
=======
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Rien ne semble se faire ici. Je pense que y'a simplement un soucis de connexion sur les f�netres
ipcRenderer.on('player_add', async (_, name, id, color) => {
>>>>>>> Stashed changes
    let teamTemplate: HTMLTemplateElement | null = null
    while (teamTemplate === null) {
        teamTemplate = document.getElementById('team-template') as HTMLTemplateElement
        if (teamTemplate === null) {
            await delay(50)
        }
    }

<<<<<<< Updated upstream
    if(document.getElementById('mainTitle')!.style.visibility == "visible"){
        document.getElementById('mainTitle')!.style.visibility = "collapse"
        document.getElementById('teams')!.style.visibility = "visibile"
    }
    
    const teamsDiv = document.getElementById('teams')
    const id = `team-div-${teamCounter++}`
=======
    document.getElementById('neonPink')!.innerHTML = 'Les équipes'

    const teamsDiv = document.getElementById('teams')
>>>>>>> Stashed changes

    const clone = document.importNode(teamTemplate.content, true)
    clone.getElementById('team-template-div')!.id = id
    clone.getElementById('team-template-name')!.textContent = name
<<<<<<< Updated upstream
    teamsDiv!.appendChild(clone)
})

ipcRenderer.on('player_delete', async (_, name: string) => {
    console.log(name)
    const teamsDiv = document.getElementById('teams')
    teamsDiv!.removeChild(document.getElementById(name)!)
})

=======

    clone.getElementById('team-template-name')!.style.textShadow = ' 0 0 7px #fff,0 0 10px #fff,0 0 21px #fff,0 0 42px #' + color + ',0 0 82px #' + color + ',0 0 92px #' + color + ',  0 0 102px #' + color + ',0 0 151px #' + color

    teamsDiv!.appendChild(clone)
})

ipcRenderer.on('player_delete', async (_, name, id) => {
    const divToDelete = document.getElementById(id)
    divToDelete?.remove()
})

>>>>>>> Stashed changes
>>>>>>> Stashed changes
ipcRenderer.send('user_ready')
