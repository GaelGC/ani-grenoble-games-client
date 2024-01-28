import { Err, Ok, Result } from 'ts-results'

async function loadImage (src: string): Promise<Result<HTMLImageElement, Error>> {
    const img = new Image()
    img.src = src
    try {
        await img.decode()
    } catch (e) {
        return Err(<Error>e)
    }

    return Ok(img)
}

export async function loadSprites (src: string, widthToHeightRatio: number): Promise<Result<ImageBitmap[], Error>> {
    const imgRes = await loadImage(src)
    if (imgRes.err) {
        return Err(imgRes.val)
    }

    const img = imgRes.val
    const height = img.height
    const width = img.width
    const widthPerSprite = Math.round(height * widthToHeightRatio)
    if (widthPerSprite === 0) {
        return Err(Error('Sprite width can not be 0.'))
    }
    if (width % widthPerSprite !== 0) {
        return Err(Error('Image width not a multiple of sprite width.'))
    }

    const nbWidth = width / widthPerSprite
    const outPromises: Promise<ImageBitmap>[] = new Array(nbWidth)
    for (let spriteIdx = 0; spriteIdx < nbWidth; spriteIdx++) {
        outPromises[spriteIdx] = createImageBitmap(img, widthPerSprite * spriteIdx, 0, widthPerSprite, height, { premultiplyAlpha: 'none' })
    }
    const outs: ImageBitmap[] = new Array(nbWidth)
    try {
        for (let spriteIdx = 0; spriteIdx < nbWidth; spriteIdx++) {
            outs[spriteIdx] = await outPromises[spriteIdx]
        }
    } catch (e) {
        return Err(<Error>e)
    }

    return Ok(outs)
}

export module sprite_loader {

}
