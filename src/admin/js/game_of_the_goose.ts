import { ipcRenderer } from 'electron'

export function roll () {
    ipcRenderer.send('roll-dice')
    const button = <HTMLButtonElement>document.getElementById('roll-button')
    button.disabled = true
}

export function start () {
    ipcRenderer.send('start-question')
}

ipcRenderer.on('roll-ack', () => {
    const rollButton = <HTMLButtonElement>document.getElementById('roll-button')
    const startButton = <HTMLButtonElement>document.getElementById('start-button')
    rollButton.hidden = true
    startButton.disabled = false
    startButton.hidden = false
})
