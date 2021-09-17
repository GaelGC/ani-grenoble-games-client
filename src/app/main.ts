import { app, BrowserWindow, session, ProtocolResponse } from 'electron'
import { Context } from './context'

let ctx: Context

app.on('ready', async () => {
    console.log('App is ready')

    for (const partitionName of ['user', 'admin']) {
        const partition = `persist:${partitionName}`
        const selectedSession = session.fromPartition(partition)
        selectedSession.protocol.interceptFileProtocol('file', (request, callback) => {
            console.log(request.url)
            let url = request.url.substr(7)
            if (url.length !== 0 && url[0] === '/') {
                url = request.url.substr(7)
                // eslint-disable-next-line node/no-path-concat
                url = `${__dirname}/${partitionName}/${url}`
            }
            console.log(url)
            const response: ProtocolResponse = { path: url }
            callback(response)
        })
    }

    const windows = new Map<string, BrowserWindow>()
    for (const key of ['admin', 'user']) {
        const window = new BrowserWindow({
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                partition: `persist:${key}`
            },
            width: 600,
            height: 400
        })
        windows.set(key, window)
    }
    ctx = new Context(windows.get('user')!, windows.get('admin')!)
    await ctx.run()
})
