const { ipcRenderer } = require('electron')

function play() {
    ipcRenderer.send('play')
}

function db() {
    ipcRenderer.send('db')
}
