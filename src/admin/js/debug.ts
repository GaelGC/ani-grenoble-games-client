import { app, ipcRenderer } from 'electron';

function song() {
    ipcRenderer.send('admin_debug_panel', 'song')
}