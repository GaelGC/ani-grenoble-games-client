import { ipcRenderer } from 'electron'

export function song () {
    ipcRenderer.send('debug-page-change', 'song')
}

export function quote () {
    ipcRenderer.send('debug-page-change', 'quote')
}

export function hangedMan () {
    ipcRenderer.send('debug-page-change', 'hanged_man')
}

export function imageQuizz () {
    ipcRenderer.send('debug-page-change', 'images')
}

export function findTheWordQuizz () {
    ipcRenderer.send('debug-page-change', 'find_the_word')
}
