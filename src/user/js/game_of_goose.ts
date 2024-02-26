import { Coordinates, Event, GooseBoard, Player } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'
import { loadAudio } from 'utils/audio_loader'
import { loadImage, loadSprites } from 'utils/sprite_loader'

let currentPlayer: Player
let players: Player[] = []
let board: GooseBoard

let cellSprites: ImageBitmap[] = []
let playerSprites: ImageBitmap[] = []
let eventCardImg: ImageBitmap

let pawnMoveAudio: HTMLAudioElement
let eventRevealAudio: HTMLAudioElement

/* Animation routines */

async function moveCurrentPlayer (destCell: number) {
    const diff = destCell >= currentPlayer.score ? 1 : -1

    while (currentPlayer.score !== destCell) {
        const minTimer = new Promise(resolve => setTimeout(resolve, 200))
        const audioTimer = new Promise(resolve => {
            pawnMoveAudio.onended = resolve
            pawnMoveAudio.play()
        })
        currentPlayer.score += diff
        drawBoard()
        await minTimer
        await audioTimer
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

    rollDiv.textContent = `roll: ${dice.toString()}`

    await new Promise(resolve => setTimeout(resolve, 400))
    await moveCurrentPlayer(currentPlayer.score + dice)

    ipcRenderer.send('roll-animation-done')
})

ipcRenderer.on('absmove', async (_, destPos: number) => {
    await moveCurrentPlayer(destPos)
    ipcRenderer.send('absmove-animation-done')
})

ipcRenderer.on('swap-players', async (_, team1Idx: number, team2Idx: number) => {
    const team1 = players[team1Idx]
    const team2 = players[team2Idx]
    const tmp = team1.score
    team1.score = team2.score
    team2.score = tmp

    drawBoard()
})

/* Draw routines */

function drawPlayer (ctx: CanvasRenderingContext2D, pos: Coordinates, sprite: ImageBitmap, idxOnCell: number) {
    const positionsOnCell = [[30, 30], [100, 30], [30, 100], [100, 100]]
    const cellSize = 200
    idxOnCell = Math.min(idxOnCell, positionsOnCell.length - 1)
    const posOnCell = positionsOnCell[idxOnCell]
    const drawX = pos.x * cellSize + posOnCell[0]
    const drawY = pos.y * cellSize + posOnCell[1]
    ctx.drawImage(sprite, drawX, drawY, 70, 70)
}

function drawCell (x: number, y: number, id: number, sprite: ImageBitmap, ctx: CanvasRenderingContext2D) {
    const cellWidth = 200
    const cellXStart = (cellWidth) * x
    const cellYStart = (cellWidth) * y
    ctx.drawImage(sprite, cellXStart, cellYStart, cellWidth, cellWidth)
    ctx.fillText(`${id}`, cellXStart + cellWidth / 2, cellYStart + cellWidth / 2)
}

function drawBoard () {
    if (!board || !players || !currentPlayer) {
        return
    }

    const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('board-canvas')!
    const ctx = canvas.getContext('2d')!
    ctx.reset()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '60px sans-serif'
    const eventCanvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('event-canvas')!
    const eventCtx = eventCanvas.getContext('2d')!
    eventCtx.reset()

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

function setCanvasDimensions () {
    if (!board) {
        return
    }

    const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('board-canvas')!
    const boardDiv: HTMLDivElement = <HTMLDivElement> document.getElementById('board-div')!

    const maxWidth = Math.round(boardDiv.clientWidth)
    const maxHeight = Math.round(boardDiv.clientHeight)

    let ratio = maxWidth / canvas.width
    if (canvas.height * ratio > maxHeight) {
        ratio = maxHeight / canvas.height
    }

    canvas.style.width = `${canvas.width * ratio}px`
    canvas.style.height = `${canvas.height * ratio}px`

    const eventCanvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('event-canvas')!
    const eventDiv: HTMLDivElement = <HTMLDivElement> document.getElementById('event-div')!

    const eventMaxWidth = Math.round(eventDiv.clientWidth)
    const eventMaxHeight = Math.round(eventDiv.clientHeight)

    eventCanvas.width = eventMaxWidth
    eventCanvas.height = eventMaxHeight
    eventCanvas.style.width = `${eventMaxWidth}px`
    eventCanvas.style.height = `${eventMaxHeight}px`
}

ipcRenderer.on('board', async (_, curBoard: GooseBoard) => {
    const sprites = await loadSprites(curBoard.cellTileSet, 1)
    const loadedPlayerSprites = await loadSprites(curBoard.playersTileSet, 1)
    const eventImg = await loadImage(curBoard.eventCardImage)

    const pawnMoveAudioPromise = await loadAudio(curBoard.pawnMoveSound)
    const eventRevealAudioPromise = await loadAudio(curBoard.eventRevealSound)

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
    if (eventImg.err) {
        alert(eventImg.val)
    } else {
        eventCardImg = await createImageBitmap(eventImg.val)
    }

    if (pawnMoveAudioPromise.err) {
        alert(pawnMoveAudioPromise.val)
    } else {
        pawnMoveAudio = pawnMoveAudioPromise.val
    }
    if (eventRevealAudioPromise.err) {
        alert(eventRevealAudioPromise.val)
    } else {
        eventRevealAudio = eventRevealAudioPromise.val
    }

    ipcRenderer.send('board-ack')

    board = curBoard

    const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('board-canvas')!
    let maxX = board.slots.map(x => x.pos.x).reduce((x, y) => Math.max(x, y))
    let maxY = board.slots.map(x => x.pos.y).reduce((x, y) => Math.max(x, y))
    maxX = Math.max(maxX, board.winPos.x)
    maxY = Math.max(maxX, board.winPos.y)
    canvas.width = (maxX + 1) * 200
    canvas.height = (maxY + 1) * 200

    setCanvasDimensions()
    drawBoard()
})

ipcRenderer.on('players', (_, _players: Player[]) => {
    players = _players

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

ipcRenderer.on('current-player', (_, teamIdx: number) => {
    currentPlayer = players[teamIdx]

    const playerDiv = document.getElementById('player-div')!
    playerDiv.textContent = `Current player: ${currentPlayer.name}`
    playerDiv.style.textShadow = '0 0 4px #' + currentPlayer.color + ',0 0 5px #' + currentPlayer.color + ',0 0 10px #' + currentPlayer.color
    playerDiv.style.color = '#' + currentPlayer.color

    const rollDiv = document.getElementById('roll-div')!
    rollDiv.style.textShadow = playerDiv.style.textShadow
    rollDiv.style.color = playerDiv.style.color
    rollDiv.textContent = ''

    drawBoard()
})

ipcRenderer.on('show-event', (_, event: Event) => {
    drawBoard()

    const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('event-canvas')!
    const ctx = canvas.getContext('2d')!
    ctx.font = '30px Arial'

    // TODO Do better, the size and position of the image
    // should be adapted to some extend
    ctx.drawImage(eventCardImg, 400, 100, 1200, 705)
    ctx.fillStyle = board.eventTextColor
    const x = 700
    const y = 350
    const lineheight = 30
    const lines = event.text.split('\n')

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, y + (i * lineheight))
    }

    eventRevealAudio.play()
})

/* TODO: Support event redraw */
window.onresize = () => {
    setCanvasDimensions()
    drawBoard()
}
