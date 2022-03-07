import { ipcRenderer } from 'electron'
import { ImagesQuestion } from '@gaelgc/ani-grenoble-games-format'

ipcRenderer.on('question-data', (_, question: ImagesQuestion) => {
    const imagesDiv = document.getElementById('images-div')!
    const template = document.getElementById('image-template') as HTMLTemplateElement
    for (const image of question.images) {
        const clone = document.importNode(template.content, true)
        const cloneImg = <HTMLImageElement>clone.getElementById('image-elem')
        cloneImg.src = image
        imagesDiv.appendChild(cloneImg)
    }
    const q : ImagesQuestion = question
    document.getElementById('answer')!.textContent = q.answer
})

export function onImageClick (img: HTMLImageElement) {
    document.getElementById('images-div')!.removeChild(img)
    ipcRenderer.send('show-image', img.src)
}
