import { ipcRenderer } from 'electron'

const rollButton = <HTMLButtonElement>document.getElementById('roll-button')!
const startButton = <HTMLButtonElement>document.getElementById('start-button')!
const doEventButton = <HTMLButtonElement>document.getElementById('event-button')!

export function roll () {
    rollButton.hidden = true
    rollButton.disabled = true
    ipcRenderer.send('roll-dice')
}

export function start () {
    startButton.hidden = true
    startButton.disabled = true
    ipcRenderer.send('start-question')
}

export function doEvent () {
    doEventButton.hidden = true
    doEventButton.disabled = true
    ipcRenderer.send('do-event')
}

ipcRenderer.on('enable-roll', () => {
    rollButton.hidden = false
    rollButton.disabled = false
})

ipcRenderer.on('enable-start-question', () => {
    startButton.hidden = false
    startButton.disabled = false
})

ipcRenderer.on('enable-do-event', () => {
    doEventButton.hidden = false
    doEventButton.disabled = false
})
