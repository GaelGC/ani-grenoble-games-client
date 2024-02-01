import { Coordinates, GooseBoard, Player } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'
import { loadSprites } from 'utils/sprite_loader'

let currentPlayer: Player
let players: Player[] = []
let board: GooseBoard

let cellSprites: ImageBitmap[] = []
let playerSprites: ImageBitmap[] = []

/* Animation routines */

async function moveCurrentPlayer (destCell: number) {
    const diff = destCell >= currentPlayer.score ? 1 : -1

    while (currentPlayer.score !== destCell) {
        await new Promise(resolve => setTimeout(resolve, 200))
        currentPlayer.score += diff
        drawBoard()
    }
}

ipcRenderer.on('roll', async (_, dice: number) => {
    const rollDiv = document.getElementById('roll-div')!
    // Between 1 and 4 second.
    const nbClicks = 5 + Math.ceil(Math.random() * 15)
    for (let i = 0; i < nbClicks; i++) {
        rollDiv.textContent = Math.ceil(Math.random() * 6).toString()
        await new Promise(resolve => setTimeout(resolve, 200))
    }

    rollDiv.style.textShadow = '0 0 4px #' + currentPlayer.color + ',0 0 5px #' + currentPlayer.color + ',0 0 10px #' + currentPlayer.color
    rollDiv.style.color = '#' + currentPlayer.color
    rollDiv.textContent = `roll: ${dice.toString()}`

    await new Promise(resolve => setTimeout(resolve, 400))
    await moveCurrentPlayer(currentPlayer.score + dice)

    ipcRenderer.send('roll-animation-done')
})

/* Draw routines */

function drawPlayer (ctx: CanvasRenderingContext2D, pos: Coordinates, sprite: ImageBitmap, idxOnCell: number) {
    const positionsOnCell = [[15, 15], [50, 15], [15, 50], [50, 50]]
    const cellSize = 100
    idxOnCell = Math.min(idxOnCell, positionsOnCell.length - 1)
    const posOnCell = positionsOnCell[idxOnCell]
    const drawX = pos.x * cellSize + posOnCell[0]
    const drawY = pos.y * cellSize + posOnCell[1]
    ctx.drawImage(sprite, drawX, drawY, 35, 35)
}

function drawCell (x: number, y: number, id: number, sprite: ImageBitmap, ctx: CanvasRenderingContext2D) {
    const cellWidth = 100
    const cellXStart = (cellWidth) * x
    const cellYStart = (cellWidth) * y
    ctx.drawImage(sprite, cellXStart, cellYStart, cellWidth, cellWidth)
    ctx.fillText(`${id}`, cellXStart + cellWidth / 2, cellYStart + cellWidth / 2)
}

function drawBoard () {
    if (!board) {
        return
    }

    const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('board-canvas')!
    const ctx = canvas.getContext('2d')!
    ctx.reset()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '30px sans-serif'

    for (const cell of board.slots) {
        drawCell(cell.pos.x, cell.pos.y, board.slots.indexOf(cell), cellSprites[cell.tile], ctx)
    }
    drawCell(board.winPos.x, board.winPos.y, -1, cellSprites[0], ctx)

    const playersOnSlot = new Map<number, number>()
    const playerRenderingOrder = players.map(x => x)
    playerRenderingOrder.splice(players.indexOf(currentPlayer), 1)
    playerRenderingOrder.push(currentPlayer)
    for (let playerIdx = 0; playerIdx < playerRenderingOrder.length; playerIdx++) {
        const player = playerRenderingOrder[playerIdx]
        const idxOnCell = (playersOnSlot.get(player.score) ?? 0)
        playersOnSlot.set(player.score, idxOnCell + 1)
        const pos = player.score < board.slots.length ? board.slots[player.score].pos : board.winPos
        let spriteIdx = ((2 * players.indexOf(player)) % playerSprites.length)
        if (player === currentPlayer) {
            spriteIdx++
        }
        drawPlayer(ctx, pos, playerSprites[spriteIdx], idxOnCell)
    }
}

/* Setup routines */

ipcRenderer.on('board', async (_, curBoard: GooseBoard) => {
    const sprites = await loadSprites(curBoard.cellTileSet, 1)
    const loadedPlayerSprites = await loadSprites(curBoard.playersTileSet, 1)

    if (sprites.err) {
        alert(sprites.val)
    } else {
        cellSprites = sprites.val
    }
    if (loadedPlayerSprites.err) {
        alert(loadedPlayerSprites.val)
    } else {
        playerSprites = loadedPlayerSprites.val
    }

    board = curBoard
    drawBoard()
})

ipcRenderer.on('players', (_, _players: Player[], teamIdx: number) => {
    players = _players
    currentPlayer = players[teamIdx]

    const playerDiv = document.getElementById('player-div')!
    playerDiv.textContent = `Current player: ${currentPlayer.name}`
    playerDiv.style.textShadow = '0 0 4px #' + currentPlayer.color + ',0 0 5px #' + currentPlayer.color + ',0 0 10px #' + currentPlayer.color
    playerDiv.style.color = '#' + currentPlayer.color

    const teamTemplate: HTMLTemplateElement = document.getElementById('team-template') as HTMLTemplateElement
    for (const player of players) {
        const temp = document.createElement('template')
        temp.innerHTML = teamTemplate.innerHTML.replace(/\$color/g, player.color)
        const clone = document.importNode(temp.content, true)
        const teamNameDiv = clone.getElementById('team-name')!
        teamNameDiv.textContent = player.name
        document.getElementById('teams')!.appendChild(clone)
    }

    drawBoard()
})
