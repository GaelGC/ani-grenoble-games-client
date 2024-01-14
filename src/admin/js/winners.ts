import { ipcRenderer } from 'electron'

export function end () {
    ipcRenderer.send('winners-ack')
}
