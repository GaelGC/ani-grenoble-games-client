import { ipcRenderer } from 'electron'

ipcRenderer.on('show-image', (_, image: string) => {
    const imagesDiv = document.getElementById('images-div')!
    const template = document.getElementById('image-template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)
    const cloneImg = <HTMLImageElement>clone.getElementById('image-elem')
    cloneImg.src = image
    imagesDiv.appendChild(cloneImg)
})
