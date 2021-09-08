import { ipcRenderer } from 'electron'

export function start () {
    const packPicker = document.getElementById('pack-file') as HTMLInputElement
    ipcRenderer.send('pack-file', packPicker.files![0].path)
    const boardPicker = document.getElementById('board-file') as HTMLInputElement
    ipcRenderer.send('goose-board-file', boardPicker.files![0].path)
}
