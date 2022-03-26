import { GameState, QuestionWinners } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

ipcRenderer.on('update-winners', async (_, winners: QuestionWinners) => {
    for (const teamDiv of Array.from(document.getElementsByClassName('team-div'))) {
        const name = teamDiv.getElementsByClassName('team-name').item(0)!.textContent!
        const text = winners.players.includes(name) ? '+' + winners.points : ''
        teamDiv.getElementsByClassName('team-score-update').item(0)!.textContent = text
    }
})

ipcRenderer.on('game-state-data', (_, s) => {
    const state: GameState = s

    const xhttp = new XMLHttpRequest()
    xhttp.onloadend = function () {
        document.getElementById('game-state-div')!.innerHTML = this.responseText
        const teamTemplate: HTMLTemplateElement = document.getElementById('team-template') as HTMLTemplateElement
        let id = 0
        for (const player of state.players) {
            const clone = document.importNode(teamTemplate.content, true)
            clone.getElementById('team-template-name')!.textContent = player.name
            clone.getElementById('team-template-score')!.textContent = player.score.toString()

            let rgb = ''

            if (id === 0) {
                rgb = 'EC1F1F'
            } else if (id === 1) {
                rgb = '6064DE'
            } else if (id === 2) {
                rgb = '2FC215'
            } else if (id === 3) {
                rgb = 'D0E613'
            } else if (id === 4) {
                rgb = '01FDF5'
            } else if (id === 5) {
                rgb = '860EF1'
            } else if (id === 6) {
                rgb = 'FDA101'
            } else if (id === 7) {
                rgb = 'F32BCF'
            } else {
                rgb = colorOf(player.name + player.name)
            }

            clone.getElementById('team-template-name')!.style.textShadow = ' 0 0 4px #' + rgb + ',0 0 5px #' + rgb + ',0 0 10px #' + rgb
            clone.getElementById('team-template-score')!.style.textShadow = ' 0 0 4px #' + rgb + ',0 0 5px #' + rgb + ',0 0 10px #' + rgb
            clone.getElementById('team-template-name')!.style.color = '#' + rgb
            clone.getElementById('team-template-score')!.style.color = '#' + rgb

            // clone.getElementById('team-score-update')!.style.textShadow = ' 0 0 4px #FFFFFF,0 0 5px #FFFFFF,0 0 10px #FFFFFF'
            // clone.getElementById('team-score-update')!.style.color = '#FFFFFF'

            document.getElementById('teams')?.appendChild(clone)
            id++
        }
    }
    xhttp.open('GET', '/html/state.html', true)
    xhttp.send()
})

function colorOf (name: string) {
    const charArray = name.split('')
    let sizeOf = charArray.length
    while (sizeOf % 3 !== 0) {
        sizeOf -= 1
    }

    let firstInt: number = 0
    let secondInt: number = 0
    let thirdInt: number = 0

    for (let i = 0; i < sizeOf; i++) {
        if (i < (sizeOf / 3)) {
            firstInt += charArray[i].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
        } else if (i < (sizeOf / 3) * 2) {
            secondInt += charArray[i].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
        } else {
            thirdInt += charArray[i].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
        }
    }

    firstInt = firstInt % 16
    secondInt = secondInt % 16
    thirdInt = thirdInt % 16

    const firstHexa = hexaOfInt(firstInt)
    const secondHexa = hexaOfInt(secondInt)
    const thirdHexa = hexaOfInt(thirdInt)

    let avg = (firstInt + secondInt + thirdInt) / 3
    avg = avg % 16
    const avgHexa = hexaOfInt(avg)

    const rgb = firstHexa + avgHexa + secondHexa + avgHexa + thirdHexa + avgHexa

    return rgb.toString()
}

function hexaOfInt (int: number) {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    if (!numbers.includes(int)) {
        switch (int) {
        case 10: {
            return 'A'
        }
        case 11: {
            return 'B'
        }
        case 12: {
            return 'C'
        }
        case 13: {
            return 'D'
        }
        case 14: {
            return 'E'
        }
        case 15: {
            return 'F'
        }
        default: {
            return '0'
        }
        }
    } else {
        return int.toString()
    }
}
