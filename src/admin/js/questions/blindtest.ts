import { ipcRenderer } from 'electron'
import { BlindTestQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q
    const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)
    clone.getElementById('audio')!.setAttribute('src', question.path)
    document.getElementById('blindtest-div')!.style.backgroundImage = question.answerImage
    document.getElementById('blindtest-div')!.appendChild(clone)
    document.getElementById('answer')!.textContent = question.answer
})
