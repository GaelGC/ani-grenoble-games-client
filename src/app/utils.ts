import { IpcMainEvent, ipcMain } from 'electron'

export class Queue<T> {
    handler: (_: IpcMainEvent, elem: T) => void
    name: string

    constructor (name: string) {
        this.name = name
        this.handler = (_, elem) => {
            this.elems.push(elem)
        }
        ipcMain.on(name, this.handler)
    }

    destroy () {
        ipcMain.removeListener(this.name, this.handler)
    }

    peek (): T {
        const elem = this.elems[0]
        return elem
    }

    async get (): Promise<T> {
        await this.waitForElem()
        const elem = this.peek()
        this.elems.splice(0, 1)
        return elem
    }

    async waitForElem (): Promise<void> {
        while (this.elems.length === 0) {
            await delay(1)
        }
    }

    elems: Array<T> = []
}
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class Condition extends Queue<void> {
    async wait () {
        return this.get()
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function unreachable (x: never): never {
    throw new Error('Theoretically unreachable code reached')
}
