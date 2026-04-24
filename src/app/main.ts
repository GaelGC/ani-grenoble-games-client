import { app, BrowserWindow, session, ProtocolResponse, dialog } from 'electron'
import { Context } from './context'
import { connectDB, getFileMetadata, setFileMetadata } from './database'
import * as fs from 'fs'

import * as path from 'path'
let ctx: Context

app.on('ready', async () => {
    console.log('App is ready')

    const windows = new Map<string, BrowserWindow>()
    for (const key of ['admin', 'user', 'db', 'launcher']) {
        const window = new BrowserWindow({
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                partition: `persist:${key}`,
                preload: path.join(__dirname, key, 'js', 'preload.js')
            },
            width: 600,
            height: 400
        })
        windows.set(key, window)

//        // POUR AFFICHER CETTE FICHUE CONSOLE PASKE SINON CA ME FAIT UNE CAPTURE D ECRAN DE SA TABARNAK
//        if (key === 'db') {
//            window.webContents.openDevTools();
//        }

        const protocol = 'ui'
        const protocolPrefix = `${protocol}://`
        const patchURL = function (url: string): string {
            url = url.substring(protocolPrefix.length)
            if (url.length !== 0 && url[0] === '/') {
                return path.join(__dirname, key, url)
            } else {
                const curUrl = window.webContents.getURL()
                const curDir = curUrl.substring(0, curUrl.lastIndexOf('/') + 1)
                url = curDir + url
                return patchURL(url)
            }
        }
        const partition = `persist:${key}`
        const selectedSession = session.fromPartition(partition)
        selectedSession.protocol.registerFileProtocol(protocol, (request, callback) => {
            const url = patchURL(request.url)
            console.debug(`Patching ${request.url} to ${url}`)
            const response: ProtocolResponse = { path: url }
            callback(response)
        })
    }

    for (const window of windows.values()) {
        window.on('close', () => {
            app.quit()
        })
    }
    const { ipcMain } = require('electron')

    ipcMain.handle('db:connect', async (_event: any, config: any) => {
        await connectDB(config)
    })

    ipcMain.handle('db:get-metadata', async (_event: Electron.IpcMainInvokeEvent, fileid: number) => {
        return await getFileMetadata(fileid)
    })

    ipcMain.handle('db:set-metadata', async (_event: Electron.IpcMainInvokeEvent, fileid: number, data: { artiste?: string, genre?: string, annee?: number, indice?: string }) => {
        await setFileMetadata(fileid, data)
    })
    ipcMain.handle('quiz:save-local', async (_event: Electron.IpcMainInvokeEvent, { filename, json }: { filename: string, json: string }) => {
        const { filePath } = await dialog.showSaveDialog({
            defaultPath: filename,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        })
        if (filePath) {
            fs.writeFileSync(filePath, json, 'utf-8')
        }
    })
    ipcMain.handle('quiz:export', async (_event: Electron.IpcMainInvokeEvent, { quizName, files }: { quizName: string, files: { destPath: string, buffer: number[] }[] }) => {
        const { filePaths } = await dialog.showOpenDialog({
            title: 'Choisir un dossier d\'export',
            properties: ['openDirectory']
        });

        if (!filePaths || !filePaths[0]) return { cancelled: true };

        const exportRoot = path.join(filePaths[0], quizName);

        for (const file of files) {
            const fullPath = path.join(exportRoot, file.destPath);
            const dir = path.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, Buffer.from(file.buffer));
        }

        return { cancelled: false, exportPath: exportRoot };
    })
    ctx = new Context(windows.get('user')!, windows.get('admin')!, windows.get('db')!, windows.get('launcher')!)
    await ctx.run()
})
