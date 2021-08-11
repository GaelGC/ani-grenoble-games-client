import { ipcRenderer } from 'electron'

ipcRenderer.send('user_ready')
