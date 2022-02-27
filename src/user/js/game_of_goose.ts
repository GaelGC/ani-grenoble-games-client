import { GooseBoard, Player } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

let currentPlayer: Player

ipcRenderer.on('roll', async (_, dice: number) => {
    const rollDiv = document.getElementById('roll-div')!
    // Between 1 and 4 second.
    const nbClicks = 5 + Math.ceil(Math.random() * 15)
    for (let i = 0; i < nbClicks; i++) {
        rollDiv.textContent = Math.ceil(Math.random() * 6).toString()
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    rollDiv.textContent = dice.toString()
    await new Promise(resolve => setTimeout(resolve, 400))
    for (let i = 1; i <= dice; i++) {
        movePawnDiv(document.getElementById('current-player-pawn')!, currentPlayer.score + i)
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    ipcRenderer.send('roll-animation-done')
})

const playersOnSlot = new Map<number, number>()
function movePawnDiv (playerDiv: HTMLElement, score: number) {
    let dstCell = document.getElementById(`cell-${score}`)
    if (dstCell === null) {
        dstCell = document.getElementById('cell--1')!
    }
    const nbPlayers = playersOnSlot.get(score) ?? 0
    const pos = [[15, 15], [85, 15], [15, 85], [85, 85]]
    const cellCoords = dstCell.getBoundingClientRect()
    document.getElementById('players-pawn-div')!.appendChild(playerDiv)
    const x = Math.round(cellCoords.left + (cellCoords.width * pos[nbPlayers][0] / 100) - playerDiv.clientWidth / 2)
    const y = Math.round(cellCoords.top + (cellCoords.height * pos[nbPlayers][1] / 100) - playerDiv.clientHeight / 2)
    playerDiv.style.top = `${y}px`
    playerDiv.style.left = `${x}px`
    playersOnSlot.set(score, nbPlayers + 1)
}

ipcRenderer.on('players', (_, players: Player[], teamIdx: number) => {
    currentPlayer = players[teamIdx]
    const playerDiv = document.getElementById('player-div')!
    playerDiv.textContent = currentPlayer.name
    playerDiv.style.textShadow = '0 0 4px #' + currentPlayer.color + ',0 0 5px #' + currentPlayer.color + ',0 0 10px #' + currentPlayer.color
    playerDiv.style.color = '#' + currentPlayer.color

    for (const player of players) {
        const playerDiv = document.createElement('div')
        playerDiv.textContent = '♟'
        playerDiv.style.position = 'absolute'
        playerDiv.style.textShadow = '0 0 4px #' + player.color + ',0 0 5px #' + player.color + ',0 0 10px #' + player.color
        if (player === players[teamIdx]) {
            playerDiv.style.textShadow = ''
            for (let size = 1; size < 30; size++) {
                playerDiv.style.textShadow += `${size === 1 ? '' : ','}0 0 ${size}px #${player.color}`
            }
            playerDiv.id = 'current-player-pawn'
        }

        movePawnDiv(playerDiv, player.score)
    }
})

function getCell (x: number, y: number, id: number, div: HTMLElement) {
    const teamTemplate: HTMLTemplateElement = document.getElementById('board-cell-template') as HTMLTemplateElement
    const clone = document.importNode(teamTemplate.content, true)
    const textCell = clone.getElementById('template-text-cell')!
    const paddingCell = clone.getElementById('template-padding-cell')!
    const cell = clone.getElementById('template-cell')!

    cell.id = `cell-${id}`
    textCell.id = `text-cell-${id}`

    cell.style.gridColumn = (x + 1).toString()
    cell.style.gridRow = (y + 1).toString()
    const rgb = ['D0E613', '01FDF5', '860EF1'][(id + 1) % 3]
    cell.style.boxShadow = `0 0 4px #${rgb},0 0 5px #${rgb},0 0 10px #${rgb}`
    textCell.style.textShadow = `0 0 4px #${rgb},0 0 5px #${rgb},0 0 10px #${rgb}`

    textCell.textContent = id >= 0 ? (id + 1).toString() : '👑'

    // Center the text by adding an empty, fixed-size div
    div.appendChild(clone)
    const margin = Math.ceil((cell.clientHeight - textCell.clientHeight) / 2)
    paddingCell.style.height = `${margin}px`
}

ipcRenderer.on('board', (_, board: GooseBoard) => {
    const boardDiv = document.getElementById('grid-div')!
    const xCoords = board.slots.map(slot => slot.coordinates.x)
    const yCoords = board.slots.map(slot => slot.coordinates.y)
    xCoords.push(board.winCoordinates.x)
    yCoords.push(board.winCoordinates.y)
    const xMax = Math.max.apply(null, xCoords)
    const yMax = Math.max.apply(null, yCoords)
    document.getElementById('grid-div')!.style.gridTemplateColumns = (xMax + 1).toString()
    document.getElementById('grid-div')!.style.gridTemplateRows = (yMax + 1).toString()
    for (const cell of board.slots) {
        getCell(cell.coordinates.x, cell.coordinates.y, board.slots.indexOf(cell), boardDiv)
    }
    getCell(board.winCoordinates.x, board.winCoordinates.y, -1, boardDiv)
})
