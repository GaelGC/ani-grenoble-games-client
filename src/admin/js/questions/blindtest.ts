import { ipcRenderer } from 'electron'
import { BlindTestQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, q) => {
    const question: BlindTestQuestion = q
    const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true);
    (<HTMLAudioElement>clone.getElementById('audio')).src = question.path

    document.getElementById('blindtest-div')!.appendChild(clone)

    const audio = <HTMLAudioElement>document.getElementById('audio')
    audio.addEventListener('loadeddata', () => {
        let maxStartPoint = audio.duration - 20
        maxStartPoint = Math.max(0, maxStartPoint)
        audio.currentTime = Math.random() * maxStartPoint
    })
})
