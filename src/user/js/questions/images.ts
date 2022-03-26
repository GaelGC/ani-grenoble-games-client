import { ipcRenderer } from 'electron'

ipcRenderer.on('show-image', (_, image: string) => {
    const imagesDiv = document.getElementById('images-div')!
    const template = document.getElementById('image-template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)
    const cloneImg = <HTMLImageElement>clone.getElementById('image-elem')
    cloneImg.src = image
    imagesDiv.appendChild(clone)

    const size = imagesDiv.children.length - 1
    console.log(size)

    if (size <= 1) {
        imagesDiv.style.gridTemplateColumns = '1fr'
    } else if (size > 1 && size <= 4) {
        imagesDiv.style.gridTemplateColumns = '1fr 1fr'
    } else if (size > 4 && size <= 6) {
        imagesDiv.style.gridTemplateColumns = '1fr 1fr 1fr'
    } else if (size > 6 && size <= 8) {
        imagesDiv.style.gridTemplateColumns = '1fr 1fr 1fr 1fr'
    } else if (size > 8 && size <= 10) {
        imagesDiv.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1fr'
    } else {
        imagesDiv.style.gridTemplateColumns = '1fr'
    }
})
