import { app, BrowserWindow, ipcMain } from 'electron';
import { debug } from './debug';
import path = require("path");
import { context } from './context';

var ctx: context;

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
    ctx = new context(user, admin);
});

ipcMain.on('admin_debug_panel', (_, req) => {
    debug(ctx, req);
});