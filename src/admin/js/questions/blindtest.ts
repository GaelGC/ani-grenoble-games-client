import { ProtocolResponse, ipcRenderer } from 'electron'
import { BlindTestQuestion, GameConfiguration } from '@gaelgc/ani-grenoble-games-format'
import { log } from 'console'

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

    // Vitesse x2
    // audio.playbackRate = 2
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaElementSource(audio)

    const normalizeAsync = async () => {
        log('start ' + question.path)
        const response = await fetch(question.path)
        log('response')
        const myArrayBuffer = await audioCtx.decodeAudioData(await response.arrayBuffer())
        log('arraybuffer')

        for (let channel = 0; channel < myArrayBuffer.numberOfChannels; channel++) {
            const bufferData = myArrayBuffer.getChannelData(channel)
            let maxVolume = 0
            for (let i = 0; i < bufferData.length; i++) {
                const volume = Math.abs(bufferData[i])
                if (volume > maxVolume) {
                    maxVolume = volume
                }
            }
            log('maxvol' + maxVolume)
        }
    }
    normalizeAsync()
})
