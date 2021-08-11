import { ipcRenderer } from 'electron'

export function song () {
    ipcRenderer.send('debug-page-change', 'song')
}
