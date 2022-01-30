import { ipcRenderer } from 'electron'

let teamCounter = 0
const names: string[] = []

function onTeamNumberChange () {
    // If there are not teams, we should disable the game buttons.
    // eslint-disable-next-line no-undef
    const buttons = document.getElementsByClassName('game-button') as HTMLCollectionOf<HTMLButtonElement>
    for (let buttonIdx = 0; buttonIdx < buttons.length; buttonIdx++) {
        const button = buttons.item(buttonIdx)!
        button.disabled = names.length === 0
    }
}

export function onAddTeamButtonClick () {
    const nameField = (document.getElementById('new-team-name')! as HTMLInputElement)
    const name = nameField.value
    const teamsDiv = document.getElementById('teams')
    const id = `team-div-${teamCounter++}`

    const template = document.getElementById('team-template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)
    clone.getElementById('team-template-div')!.id = id
    clone.getElementById('team-template-name')!.textContent = '- ' + name + ' __'
    clone.getElementById('team-template-remove')!.onclick = () => {
        teamsDiv!.removeChild(document.getElementById(id)!)
        ipcRenderer.send('del_player', name, id)
        names.splice(names.indexOf(name), 1)
        onTeamNameFieldChange(nameField.value)
        onTeamNumberChange()
    }
    names.push(name)
    teamsDiv!.appendChild(clone)
    ipcRenderer.send('add_player', name, id)
    onTeamNumberChange()

    // Disallow sending the same input twice.
    const button = document.getElementById('add-team-button')! as HTMLButtonElement
    button.disabled = true
    return false
}

export function loadMain () {
    ipcRenderer.send('admin_ready')
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
