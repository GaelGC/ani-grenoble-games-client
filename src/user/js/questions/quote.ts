import { ipcRenderer } from 'electron'
import { QuoteQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q: unknown) => {
    const question = <QuoteQuestion>q
    const len = question.text.length
    const fontSize = 1.5 - 0.1 * (len / 10)

    document.getElementById('quote-div')!.textContent = question.text
    document.getElementById('quote-div')!.style.fontSize = fontSize + 'em'
})
