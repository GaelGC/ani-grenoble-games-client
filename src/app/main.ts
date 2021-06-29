import { app, BrowserWindow } from 'electron';
import path = require("path");

app.on('ready', async () => {
    console.log('App is ready');
    
    const admin = new BrowserWindow({
        width: 600,
        height: 400
    });

    const user = new BrowserWindow({
        width: 600,
        height: 400
    });
    
    const indexHTML = path.join(__dirname + '/user/index.html');
    await admin.loadFile(indexHTML);
    await user.loadFile(indexHTML);
});