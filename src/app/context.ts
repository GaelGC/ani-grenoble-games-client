import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { BrowserWindow, ipcMain, ipcRenderer } from 'electron';
import path = require("path");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class context {
    constructor(user_window: BrowserWindow, admin_window: BrowserWindow) {
        this.user_window = user_window;
        this.admin_window = admin_window;
        this.give_hint_listener = (_, hint) => {
            console.log(hint);
            this.user_window.webContents.send('hint', hint);
        };
        ipcMain.on('give-hint', this.give_hint_listener);
    }

    destroy() {
        ipcMain.removeListener('give-hint', this.give_hint_listener)
    }

    async start_blindtest_question(q: BlindTestQuestion) {
        const userHTML = 'file:///html/blindtest.html';
        const adminHTML = 'file:///html/blindtest.html';
        await this.user_window.loadURL(userHTML);
        await this.admin_window.loadURL(adminHTML);
        this.user_window.webContents.send('question-data', q);
        this.admin_window.webContents.send('question-data', q);
    }
    user_window: BrowserWindow;
    admin_window: BrowserWindow;
    give_hint_listener: (event: any, hint: string) => void;
}