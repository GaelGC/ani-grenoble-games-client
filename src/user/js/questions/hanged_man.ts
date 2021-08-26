import { ipcRenderer } from 'electron'
import { HangedManQuestion } from 'ani-grenoble-games-format/dist/QuestionTypes'

let word = ''
let shownWord = ''

function updateWordDiv () {
    const wordDiv = document.getElementById('word-div')!
    wordDiv.textContent = shownWord
}

ipcRenderer.on('question-data', (_, q: HangedManQuestion) => {
    word = q.answer
    shownWord = word.replace(/[a-zA-Z0-9]/g, '_')
    updateWordDiv()
})

ipcRenderer.on('letter', (_, letter: string) => {
    letter = letter.toLowerCase()
    for (let idx = 0; idx < word.length; idx++) {
        if (word[idx].toLowerCase() === letter) {
            shownWord = shownWord.substr(0, idx) + word[idx] + shownWord.substr(idx + 1)
        }
    }
    updateWordDiv()
    document.getElementById('used-letter-div')!.textContent += letter.toUpperCase()
})
