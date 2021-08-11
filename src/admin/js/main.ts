import { ipcRenderer } from 'electron'

let teamCounter = 0

export function loadMain () {
    document.getElementById('add-team-button')!.onclick = function () {
        const name = (document.getElementById('new-team-name')! as HTMLInputElement).value
        const teamsDiv = document.getElementById('teams')
        const id = `team-div-${teamCounter++}`

        const template = document.getElementById('team-template') as HTMLTemplateElement
        const clone = document.importNode(template.content, true)
        clone.getElementById('team-template-div')!.id = id
        clone.getElementById('team-template-name')!.textContent = name
        clone.getElementById('team-template-remove')!.onclick = () => {
            teamsDiv!.removeChild(document.getElementById(id)!)
            ipcRenderer.send('del_player', name)
        }

        teamsDiv!.appendChild(clone)
        ipcRenderer.send('add_player', name)

        return false
    }

    ipcRenderer.send('admin_ready')
}

export function debug () {
    ipcRenderer.send('main-menu', 'debug')
}
