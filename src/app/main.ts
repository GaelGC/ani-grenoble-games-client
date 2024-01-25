import { app, BrowserWindow, session, ProtocolResponse } from 'electron'
import { Context } from './context'
import { join } from 'path'

let ctx: Context

app.on('ready', async () => {
    console.log('App is ready')

    const windows = new Map<string, BrowserWindow>()
    for (const key of ['admin', 'user']) {
        const window = new BrowserWindow({
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                partition: `persist:${key}`,
                preload: join(__dirname, key, 'js', 'preload.js')
            },
            width: 600,
            height: 400
        })
        windows.set(key, window)

        const protocol = 'ui'
        const protocolPrefix = `${protocol}://`
        const patchURL = function (url: string): string {
            url = url.substring(protocolPrefix.length)
            if (url.length !== 0 && url[0] === '/') {
                return join(__dirname, key, url)
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

    ctx = new Context(windows.get('user')!, windows.get('admin')!)
    await ctx.run()
})
