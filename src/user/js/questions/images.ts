import { ipcRenderer } from 'electron'

let imageColumn = 0

ipcRenderer.on('show-image', (_, image: string) => {
    const imagesDiv = document.getElementById('images-div')!
    const template = document.getElementById('image-template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)
    const cloneImg = <HTMLImageElement>clone.getElementById('image-elem')
    cloneImg.src = image
    imagesDiv.appendChild(clone)

    const size = imagesDiv.children.length - 1

    if (size % 2 !== 0) {
        imageColumn++
    }

    if (size <= 1) {
        imagesDiv.style.gridTemplateColumns = '1fr'
        resizeImg(imagesDiv.children, 50)
    } else if (size > 1 && size <= 4) {
        imagesDiv.style.gridTemplateColumns = '1fr 1fr'
        resizeImg(imagesDiv.children, 30)
    } else {
        imagesDiv.style.gridTemplateColumns = ('1fr ').repeat(imageColumn)
        resizeImg(imagesDiv.children, 40 / imageColumn)
    }
})

function resizeImg (array: HTMLCollection, imgSize: number) {
    for (let i = 1; i < array.length; i++) {
        array[i].setAttribute('style', 'margin: 0.5em; width: ' + imgSize + 'vw; height: ' + imgSize + 'vh; object-fit: contain')
    }
}
