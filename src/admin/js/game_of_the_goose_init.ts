import { ipcRenderer } from 'electron'

export function start () {
    const picker = document.getElementById('pack-file') as HTMLInputElement
    ipcRenderer.send('pack-file', picker.files![0].path)
}
