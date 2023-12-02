import { ipcRenderer } from 'electron'

let teamCounter = 0
const names: string[] = []

export function onAddTeamButtonClick () {
    const nameField = (document.getElementById('new-team-name')! as HTMLInputElement)
    const name = nameField.value
    const teamsDiv = document.getElementById('teams')
    const id = teamCounter++
    const elemId = `team-div-${id}`

    const template = document.getElementById('team-template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)
    clone.getElementById('team-template-div')!.id = elemId
    clone.getElementById('team-template-name')!.textContent = '- ' + name + ' __'
    clone.getElementById('team-template-remove')!.onclick = () => {
        teamsDiv!.removeChild(document.getElementById(elemId)!)
        ipcRenderer.send('del_player', id)
        names.splice(names.indexOf(name), 1)
        onTeamNameFieldChange(nameField.value)
    }
    names.push(name)
    teamsDiv!.appendChild(clone)
    ipcRenderer.send('add_player', name, id)

    // Disallow sending the same input twice.
    const button = document.getElementById('add-team-button')! as HTMLButtonElement
    button.disabled = true
    return false
}

export function debug () {
    ipcRenderer.send('main-menu', 'debug')
}

export function random () {
    ipcRenderer.send('main-menu', 'random')
}

export function gameOfTheGoose () {
    ipcRenderer.send('main-menu', 'game-of-the-goose')
}

export function onTeamNameFieldChange (name: string) {
    const invalid = name.length === 0 || names.includes(name)
    const button = document.getElementById('add-team-button')! as HTMLButtonElement
    button.disabled = invalid
}
