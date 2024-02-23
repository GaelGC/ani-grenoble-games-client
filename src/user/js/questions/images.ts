import { ipcRenderer } from 'electron'

// TODO : Move into a model or declare it in question format
let size = 0
let divNumber = 0
const maxImageLine = 2

ipcRenderer.on('show-image', (_, image: string) => {
    const heart = document.getElementById('gameHeart')!
    if (size % maxImageLine === 0) {
        divNumber++
        const div = document.createElement('div')
        div.setAttribute('id', 'images-div' + divNumber)
        div.setAttribute('class', 'imgbox')
        heart.appendChild(div)
    }

    const img = document.createElement('img')
    img.setAttribute('id', 'image-elem')
    img.setAttribute('class', 'center-fit')
    img.src = image
    size++

    const imagesDiv = document.getElementById('images-div' + divNumber)!
    imagesDiv.appendChild(img)
    imagesDiv.style.gridTemplateColumns = ('1fr ').repeat(maxImageLine)
    for (let i = 1; i < heart.children.length; i++) {
        const imagesDiv = document.getElementById('images-div' + i)!
        if (heart.children.length > maxImageLine) {
            resizeImg(imagesDiv.children, 60 / (heart.children.length - 1))
        } else {
            resizeImg(imagesDiv.children, 60 / maxImageLine)
        }
    }
})

function resizeImg (array: HTMLCollection, imgSize: number) {
    for (let i = 0; i < array.length; i++) {
        array[i].setAttribute('style', 'margin: 0.0em; width: ' + imgSize + 'vw; height: ' + imgSize + 'vh; object-fit: contain')
    }
}
