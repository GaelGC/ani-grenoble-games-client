const { ipcRenderer } = require('electron')

function toLauncher() {
    ipcRenderer.send('launcher')
}
