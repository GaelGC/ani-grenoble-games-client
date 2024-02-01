import { ipcRenderer } from 'electron'

const rollButton = <HTMLButtonElement>document.getElementById('roll-button')!
const startButton = <HTMLButtonElement>document.getElementById('start-button')!

export function roll () {
    rollButton.hidden = true
    rollButton.disabled = true
    ipcRenderer.send('roll-dice')
}

export function start () {
    startButton.hidden = true
    rollButton.disabled = true
    ipcRenderer.send('start-question')
}

ipcRenderer.on('enable-roll', () => {
    rollButton.hidden = false
    rollButton.disabled = false
})

ipcRenderer.on('enable-start-question', () => {
    startButton.hidden = false
    startButton.disabled = false
})
