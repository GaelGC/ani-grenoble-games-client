import { ipcRenderer } from 'electron'
import { QuoteQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q: unknown) => {
    const question = <QuoteQuestion>q
    const lens = question.text.split('\n').map(x => x.length)
    let len = 0
    for (const _len of lens) {
        len = _len > len ? _len : len
    }
    const fontSize = 55 / len

    document.getElementById('quote-div')!.textContent = question.text
    document.getElementById('quote-div')!.style.fontSize = fontSize + 'em'
})
