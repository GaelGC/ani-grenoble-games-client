import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import { debug } from './debug';
import path = require("path");
import { context } from './context';
import { ProtocolRequest, ProtocolResponse } from 'electron/main';

var ctx: context;

app.on('ready', async () => {
    console.log('App is ready');
    
    for (const partitionName of ['user', 'admin']) {
        const partition = `persist:${partitionName}`;
        const selectedSession = session.fromPartition(partition);
        selectedSession.protocol.interceptFileProtocol('file', (request, callback) => {
            console.log(request.url);
            var url = request.url.substr(7);
            if (url.length !== 0 && url[0] === '/') {
                url = request.url.substr(7);
                url = `${__dirname}/${partitionName}/${url}`
            }
            console.log(url);
            callback({ path: url });
        });
        selectedSession.protocol.registerFileProtocol('question', (request, callback) => {
            var url = request.url.replace('question://', '');
            console.log(url);
            callback({ path: url });
        });
    }
    
    const admin = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            partition: 'persist:admin',
        },
        width: 600,
        height: 400
    });
    
    const user = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            partition: 'persist:user',
        },
        width: 600,
        height: 400
    });
    
    const userHTML = 'file:///html/index.html';
    const adminHTML = 'file:///html/index.html';
    
    await user.loadURL(userHTML);
    await admin.loadURL(adminHTML);
    ctx = new context(user, admin);
});


ipcMain.on('admin_debug_panel', (_, req) => {
    debug(ctx, req);
});

ipcMain.on('add_player', (_, name) => {
    ctx.state.players.push({
        name: name,
        score: 0
    });
});