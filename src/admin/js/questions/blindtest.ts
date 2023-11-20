import { ipcRenderer } from 'electron'
import { BlindTestQuestion, GameConfiguration } from '@gaelgc/ani-grenoble-games-format'

let config: GameConfiguration
ipcRenderer.on('question-configuration', (_, c) => {
    config = c
})

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q
    const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)

    clone.getElementById('audio')!.setAttribute('src', question.path)
    document.getElementById('blindtest-div')!.style.backgroundImage = 'url(' + question.answerImage.replace(/ /g, '%20') + ')'
    document.getElementById('blindtest-div')!.style.backgroundSize = 'cover'
    document.getElementById('blindtest-div')!.appendChild(clone)
    document.getElementById('answer')!.textContent = q.answer

    const audio = <HTMLAudioElement>document.getElementById('audio')
    audio.src = question.path
    if (config?.randomSample) {
        audio.addEventListener('loadeddata', () => {
            let maxStartPoint = audio.duration - 20
            maxStartPoint = Math.max(0, maxStartPoint)
            audio.currentTime = Math.random() * maxStartPoint
        })
    }
})
