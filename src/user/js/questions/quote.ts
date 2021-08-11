import { ipcRenderer } from 'electron'
import { QuoteQuestion } from 'ani-grenoble-games-format/dist/QuestionTypes'

ipcRenderer.on('question-data', (_, q: unknown) => {
    const question = <QuoteQuestion>q
    document.getElementById('quote-div')!.textContent = question.text
})
