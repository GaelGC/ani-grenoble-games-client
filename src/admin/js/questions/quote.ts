import { ipcRenderer } from 'electron'
import { QuoteQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q) => {
    const question: QuoteQuestion = q
    const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement
    if (question.audio !== undefined) {
        const clone = document.importNode(template.content, true)
        clone.getElementById('audio')!.setAttribute('src', question.audio)
        document.getElementById('quote-div')!.appendChild(clone)
    }
})
