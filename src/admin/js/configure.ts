import { GameConfiguration } from '@gaelgc/ani-grenoble-games-format'
import { ipcRenderer } from 'electron'

let config: GameConfiguration | undefined

ipcRenderer.on('configuration', (_, _config: GameConfiguration) => {
    config = _config
    const randomSongSample = document.getElementById('random_song_sample') as HTMLInputElement
    randomSongSample.checked = config.randomSample
    const questionSelectionKind = document.getElementById(`question_selection_${config.playlist}`) as HTMLInputElement
    questionSelectionKind.checked = true
})

export function onRandomSongSampleClick (value: boolean) {
    if (config) {
        config.randomSample = value
    }
}

export function onQuestionSelectionKind (value: string) {
    if (config) {
        config.playlist = <any>value
    }
}

export function sendConfig () {
    ipcRenderer.send('validate-config', config)
}
