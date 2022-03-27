import { ipcRenderer } from 'electron'
import { QuoteQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q) => {
    const question: QuoteQuestion = q
    if (question.audio !== undefined) {
        const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement
        const clone = document.importNode(template.content, true)
        clone.getElementById('audio')!.setAttribute('src', question.audio)
        document.getElementById('audio-div')!.appendChild(clone)
    }
    document.getElementById('answer')!.textContent = question.answer
})
