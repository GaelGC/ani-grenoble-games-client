import { Player } from '@gaelgc/ani-grenoble-games-format'
import { Context } from './context'
import { Queue } from './utils'
import { createHash } from 'crypto'
import { ipcMain } from 'electron'

// Création d'une couleur pour un string donné
function colorOf (name: string) {
    return createHash('md5').update(name).digest('hex').substring(0, 6)
}

function createPlayer (name: string, id: number): Player {
    const hardcodedColors = ['6064DE', '2FC215', 'D0E613', '01FDF5', '860EF1', 'FDA101', 'F32BCF']
    let rgb = ''

    if (id < hardcodedColors.length) {
        rgb = hardcodedColors[id]
    } else {
        rgb = colorOf(name)
    }

    return {
        name,
        score: 0,
        color: rgb
    }
}

export async function waitForTeamsSelection (ctx: Context): Promise<{mode: string, players: Player[]}> {
    const players = new Map<number, Player>()
    const modeSelection = new Queue<string>('main-menu')

    const addPlayerListener = (_: any, name: string, id: number) => {
        const player = createPlayer(name, id)
        players.set(id, player)
        ctx.userWindow.webContents.send('player_add', name, id, player.color)
    }

    const deletePlayerListener = (_: any, id: number) => {
        players.delete(id)
        console.log(id)
        ctx.userWindow.webContents.send('player_delete', id)
    }

    ipcMain.on('add_player', addPlayerListener)
    ipcMain.on('del_player', deletePlayerListener)

    const mode = await modeSelection.get()
    modeSelection.destroy()

    ipcMain.removeListener('add_player', addPlayerListener)
    ipcMain.removeListener('del_player', deletePlayerListener)
    return { players: [...players.values()], mode }
}
