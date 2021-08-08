import { BlindTestQuestion } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { GameState, QuestionWinners } from 'ani-grenoble-games-format/dist/GameState'
import { BrowserWindow, ipcMain, ipcRenderer } from 'electron';
import path = require("path");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class Semaphore {
    constructor(name: string) {
        ipcMain.on(name, () => {
            this.count++;
        });
    }
    async wait() {
        while (this.count == 0) {
            await delay(1);
        }
    }
    count = 0;
};

class Queue<T> {
    constructor(name: string) {
        ipcMain.on(name, (_, elem) => {
            this.elems.push(elem);
        });
    }
    async get(): Promise<T> {
        while (this.elems.length == 0) {
            await delay(1);
        }
        const elem = this.elems[0];
        this.elems.splice(1);
        return elem;
    }
    elems = new Array<T>();
};

export class context {
    constructor(user_window: BrowserWindow, admin_window: BrowserWindow) {
        this.user_window = user_window;
        this.admin_window = admin_window;
        this.state = {
            players: []
        };
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
        await this.adminQuestionWaiter.wait();
        this.user_window.webContents.send('game-state-data', this.state);
        this.admin_window.webContents.send('game-state-data', this.state);
        const winners = await this.winnersQueue.get();
    }
    user_window: BrowserWindow;
    admin_window: BrowserWindow;
    state: GameState;
    adminQuestionWaiter = new Semaphore("admin_question_ready");
    give_hint_listener: (event: any, hint: string) => void;
    winnersQueue = new Queue<QuestionWinners>("admin-send-winners");
}