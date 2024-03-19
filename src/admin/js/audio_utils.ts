export function audioBufferToBlob (audioBuffer: AudioBuffer, audioType: string) {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length
    const interleaved = new Float32Array(length * numberOfChannels)
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel)
        for (let i = 0; i < length; i++) {
            interleaved[i * numberOfChannels + channel] = channelData[i]
        }
    }
    const dataView = encodeWAV(interleaved, numberOfChannels, sampleRate)
    const blob = new Blob([dataView], { type: audioType })
    return blob
}

function encodeWAV (samples : Float32Array, channels: number, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * channels * 2, true)
    view.setUint16(32, channels * 2, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, 'data')
    view.setUint32(40, samples.length * 2, true)
    floatTo16BitPCM(view, 44, samples)
    return view
}

function floatTo16BitPCM (output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]))
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
}

function writeString (view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
    }
}

export const normalizeAsync = async (audioBuffer: AudioBuffer) => {
    const maxAmplitudeScale = 0.25

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        let maxVolume = 0
        const bufferData = audioBuffer.getChannelData(channel)
        for (let i = 0; i < bufferData.length; i++) {
            const volume = Math.abs(bufferData[i])
            if (volume > maxVolume) {
                maxVolume = volume
            }
        }
        for (let i = 0; i < bufferData.length; i++) {
            bufferData[i] = maxAmplitudeScale * (bufferData[i] / maxVolume)
        }
    }
}

export async function createConvolv (audioCtx: AudioContext, source: MediaElementAudioSourceNode, modifier: Response) {
    const convolver = audioCtx.createConvolver()
    const reverbBuffer = await modifier.arrayBuffer()
    convolver.buffer = await audioCtx.decodeAudioData(reverbBuffer)

    source.connect(convolver)
    convolver.connect(audioCtx.destination)
}

export function changePitch (speedValue: number, arrayBuffer: AudioBuffer) {
    const pitchedLength = Math.floor(arrayBuffer.length / speedValue)
    const pitchedBuffer = new AudioBuffer({
        sampleRate: arrayBuffer.sampleRate,
        numberOfChannels: arrayBuffer.numberOfChannels,
        length: pitchedLength
    })

    for (let channel = 0; channel < arrayBuffer.numberOfChannels; channel++) {
        const bufferData = arrayBuffer.getChannelData(channel)
        const bufferDataCopy = new Float32Array(pitchedLength)
        for (let i = 0; i < bufferDataCopy.length; i++) {
            const calc = (i * speedValue) - Math.floor(i * speedValue)
            bufferDataCopy[i] = (1 - calc) * bufferData[Math.floor(i * speedValue)] + calc * bufferData[Math.floor(i * speedValue) + 1]
        }
        pitchedBuffer.copyToChannel(bufferDataCopy, channel)
    }
    return pitchedBuffer
    /* const bufferSource = audioCtx.createBufferSource()
    bufferSource.buffer = arrayBuffer
    bufferSource.detune.value = 1000
    bufferSource.connect(audioCtx.destination)
    bufferSource.start() */
    // arrayBuffer = bufferSource.buffer
}

export function createReverse (arrayBuffer: AudioBuffer) {
    for (let channel = 0; channel < arrayBuffer.numberOfChannels; channel++) {
        const bufferData = arrayBuffer.getChannelData(channel)
        const bufferDataCopy = new Float32Array(bufferData.length)
        for (let i = 0; i < bufferData.length; i++) {
            bufferDataCopy[i] = bufferData[bufferData.length - i]
        }
        arrayBuffer.copyToChannel(bufferDataCopy, channel)
    }
    return arrayBuffer
}
