import { ipcRenderer } from 'electron'

ipcRenderer.on('roll', async (_, dice: number) => {
    const rollDiv = document.getElementById('roll-div')!
    // Between 1 and 4 second.
    const nbClicks = 5 + Math.ceil(Math.random() * 15)
    for (let i = 0; i < nbClicks; i++) {
        rollDiv.textContent = Math.ceil(Math.random() * 6).toString()
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    rollDiv.textContent = dice.toString()
    ipcRenderer.send('roll-animation-done')
})
