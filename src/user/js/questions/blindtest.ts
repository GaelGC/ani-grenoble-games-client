import { BlindTestQuestion } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

let question: BlindTestQuestion

ipcRenderer.on('question-data', (_, q: BlindTestQuestion) => {
    question = q
})

ipcRenderer.on('answer', async (_, answer: string) => {
    const img = <HTMLImageElement>document.getElementById('image-loc')
    img.src = question.answerImage
})
