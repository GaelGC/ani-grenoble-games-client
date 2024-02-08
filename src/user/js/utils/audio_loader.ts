import { Err, Ok, Result } from 'ts-results'

export async function loadAudio (src: string): Promise<Result<HTMLAudioElement, Error>> {
    const audio = new Audio(src)
    /* TODO: Make it so we are 100% sure it fully loaded. */
    const promise = new Promise<Result<HTMLAudioElement, Error>>(resolve => {
        audio.oncanplaythrough = () => resolve(Ok(audio))
        audio.onerror = (_, __, ___, ____, reason) => resolve(Err(reason ?? Error('Unknown error')))
    })

    return promise
}

export module audio_loader {

}
