import { ipcRenderer } from 'electron'
import { QuoteQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q: unknown) => {
    const question = <QuoteQuestion>q
    document.getElementById('quote-div')!.textContent = question.text
})
