import { ipcRenderer } from 'electron'

ipcRenderer.on('question-data', (_, q: unknown) => {
})
