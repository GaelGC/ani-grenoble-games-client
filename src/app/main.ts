import { app, BrowserWindow, ipcMain } from 'electron';
import path = require("path");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

var context = {
    user_ready: false,
    admin_ready: false,
    async wait_ready() {
        while (!this.user_ready || !this.admin_ready) {
            console.log('Not ready');
            await delay(100);
        }
        console.log('Ready')
    }
};

app.on('ready', async () => {
    console.log('App is ready');
    
    const admin = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        width: 600,
        height: 400
    });

    const user = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        width: 600,
        height: 400
    });
    
    const userHTML = path.join(__dirname + '/user/index.html');
    const adminHTML = path.join(__dirname + '/admin/index.html');
    await user.loadFile(userHTML);
    await admin.loadFile(adminHTML);
    await context.wait_ready();
});

ipcMain.on('admin_ready', () => context.admin_ready = true);
ipcMain.on('user_ready', () => context.user_ready = true);

function wait_ready() {
    throw new Error('Function not implemented.');
}
