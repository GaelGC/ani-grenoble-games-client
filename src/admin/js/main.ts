import { ipcRenderer } from 'electron';

function load_main() {
    document.getElementById('add-team-button')!.onclick = function () {
        ipcRenderer.send('add_player', (document.getElementById('new-team-name')! as HTMLInputElement).value);
        return false;
    }

    ipcRenderer.send('admin_ready');
}