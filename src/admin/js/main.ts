import { ipcRenderer } from 'electron';

ipcRenderer.send('admin_ready');