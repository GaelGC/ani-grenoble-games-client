import { ipcRenderer } from 'electron'
import { BlindTestQuestion, GameConfiguration } from '@gaelgc/ani-grenoble-games-format'
import { audioBufferToBlob, changePitch, createConvolv, createReverse, normalizeAsync } from 'audio_utils'

let config: GameConfiguration
ipcRenderer.on('question-configuration', (_, c) => {
    config = c
})

ipcRenderer.on('question-data', async (_, q) => {
    const question: BlindTestQuestion = q
    const template: HTMLTemplateElement = document.getElementById('template') as HTMLTemplateElement
    const clone = document.importNode(template.content, true)

    clone.getElementById('audio')
    document.getElementById('blindtest-div')!.style.backgroundImage = 'url(' + question.answerImage.replace(/ /g, '%20') + ')'
    document.getElementById('blindtest-div')!.style.backgroundSize = 'cover'
    document.getElementById('blindtest-div')!.appendChild(clone)
    document.getElementById('answer')!.textContent = q.answer

    const audio = <HTMLAudioElement>document.getElementById('audio')
    const tag : string = q.tag
    const audioCtx = new AudioContext()

    // TODO : Move it in database for don't wait for normalization for each music

    /* const response = await fetch(question.path)
    let arrayBuffer = await audioCtx.decodeAudioData(await response.arrayBuffer())
    await normalizeAsync(arrayBuffer)

    switch (tag) {
    case 'pitch':
        arrayBuffer = changePitch(1.33, arrayBuffer)
        break
    case 'reverse':
        arrayBuffer = createReverse(arrayBuffer)
        break
    default:
        break
    } */

    // audio.src = URL.createObjectURL(audioBufferToBlob(arrayBuffer, 'audio/wav'))
    audio.src = q.path
    if (tag === 'convolv') {
        const source = audioCtx.createMediaElementSource(audio)
        // TODO : Stock it for not recalling it everytimes
        const modifier = await fetch('ui:///./audio/underwater.wav')
        createConvolv(audioCtx, source, modifier)
    }

    if (config?.randomSample) {
        audio.addEventListener('loadeddata', () => {
            let maxStartPoint = audio.duration - 20
            maxStartPoint = Math.max(0, maxStartPoint)
            audio.currentTime = Math.random() * maxStartPoint
        })
    }
})
