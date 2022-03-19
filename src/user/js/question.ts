import { ipcRenderer } from 'electron'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

ipcRenderer.on('question-data', (_, q) => {
    const xhttp = new XMLHttpRequest()
    xhttp.onloadend = function () {
        document.getElementById('question-div')!.innerHTML = this.responseText
    }
    xhttp.open('GET', '/html/question.html', true)
    xhttp.send()
})

ipcRenderer.on('hint', async (_, hint: string) => {
    let hintTemplate: HTMLTemplateElement | null = null
    while (hintTemplate === null) {
        hintTemplate = document.getElementById('hint-template') as HTMLTemplateElement
        if (hintTemplate === null) {
            await delay(50)
        }
    }
    var len = hint.length;
    const fontSize = 1 - 0.1 * (len/10)

    const clone = document.importNode(hintTemplate.content, true)
    clone.getElementById('hint')!.textContent = hint
    clone.getElementById('hint')!.style.fontSize = fontSize  + 'em'
    document.getElementById('hints')?.appendChild(clone)
})

ipcRenderer.on('answer', async (_, answer: string) => {
    const answerDiv = document.getElementById('answer')!
    var len = answer.length;
    const fontSize = 1.5 - 0.1 * (len/10)

    answerDiv.textContent = answer
    answerDiv.style.fontSize = fontSize  + 'em'
})
