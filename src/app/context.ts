import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { BrowserWindow, ipcMain, ipcRenderer } from 'electron';
import path = require("path");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class context {
    constructor(user_window: BrowserWindow, admin_window: BrowserWindow) {
        this.user_window = user_window;
        this.admin_window = admin_window;
    }

    async start_blindtest_question(q: BlindTestQuestion) {
        const userHTML = path.join(__dirname + '/user/blindtest.html');
        const adminHTML = path.join(__dirname + '/admin/blindtest.html');
        await this.user_window.loadFile(userHTML);
        await this.admin_window.loadFile(adminHTML);
        this.user_window.webContents.send('question-data', q);
        this.admin_window.webContents.send('question-data', q);
    }
    user_window: BrowserWindow;
    admin_window: BrowserWindow;
}