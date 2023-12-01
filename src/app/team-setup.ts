import { Player } from '@gaelgc/ani-grenoble-games-format'
import { Context } from './context'
import { Queue } from './utils'
import { createHash } from 'crypto'
import { ipcMain } from 'electron'

// Création d'une couleur pour un string donné
function colorOf (name: string) {
    return createHash('md5').update(name).digest('hex').substring(0, 6)
}

function createPlayer (name: string, id: string): Player {
    let rgb = ''

    if (id === 'team-div-0') {
        rgb = 'EC1F1F'
    } else if (id === 'team-div-1') {
        rgb = '6064DE'
    } else if (id === 'team-div-2') {
        rgb = '2FC215'
    } else if (id === 'team-div-3') {
        rgb = 'D0E613'
    } else if (id === 'team-div-4') {
        rgb = '01FDF5'
    } else if (id === 'team-div-5') {
        rgb = '860EF1'
    } else if (id === 'team-div-6') {
        rgb = 'FDA101'
    } else if (id === 'team-div-7') {
        rgb = 'F32BCF'
    } else {
        rgb = colorOf(name)
        console.log(rgb)
    }

    return {
        name,
        score: 0,
        color: rgb
    }
}

export async function waitForTeamsSelection (ctx: Context): Promise<{mode: string, players: Player[]}> {
    let players: Player[] = []
    const modeSelection = new Queue<string>('main-menu')

    const addPlayerListener = (_: any, name: string, id: string) => {
        console.log(name, id)
        const player = createPlayer(name, id)
        players.push(player)
        ctx.userWindow.webContents.send('player_add', name, id, player.color)
    }

    const deletePlayerListener = (_: any, name: string, id: string) => {
        players = players.filter(x => x.name !== name)
        ctx.userWindow.webContents.send('player_delete', name, id)
    }

    ipcMain.on('add_player', addPlayerListener)
    ipcMain.on('del_player', deletePlayerListener)

    const mode = await modeSelection.get()
    modeSelection.destroy()

    ipcMain.removeListener('add_player', addPlayerListener)
    ipcMain.removeListener('del_player', deletePlayerListener)
    return { players, mode }
}
