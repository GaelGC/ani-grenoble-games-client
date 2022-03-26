import * as THREE from 'three'

async function main () {
    // Canvas
    let canvas = document.getElementById('coneLogo')
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    while (canvas === null) {
        canvas = document.getElementById('coneLogo') as HTMLTemplateElement
        if (canvas === null) {
            await delay(50)
        }
    }

    // Scene
    const scene = new THREE.Scene()

    /**
 * Objects
 */
    const geometry = new THREE.ConeGeometry(1, 1, 7)
    const material = new THREE.MeshBasicMaterial({ color: 0x1FC445 })
    material.wireframe = true
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    /**
 * Fonts
 */
    const fontLoader = new THREE.FontLoader()

    fontLoader.load(
        '/three/helvetiker_regular.typeface.json',
        (font) => {
            const textGeometry = new THREE.TextGeometry(
                'QT',
                {
                    font: font,
                    size: 1,
                    height: 0.5,
                    curveSegments: 1,
                    bevelEnabled: true,
                    bevelThickness: 0.003,
                    bevelSize: 0.002,
                    bevelOffset: 0,
                    bevelSegments: 0
                }
            )
            const text = new THREE.Mesh(textGeometry, material)
            text.position.x = -0.5
            text.position.y = -1
            text.position.z = -0.5
            scene.add(text)
        }
    )

    /**
 * Sizes
 */
    const sizes = {
        width: 200,
        height: 200
    }

    /**
 * Camera
 */
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
    camera.translateZ(2)
    scene.add(camera)

    /**
 * Renderer
 */
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.render(scene, camera)

    /**
 * Animate
*/
    const clock = new THREE.Clock()

    const tick = () => {
        const elapsedTime = clock.getElapsedTime()

        // Update objects
        mesh.rotation.y = 0.1 * elapsedTime

        mesh.rotation.x = 0.15 * elapsedTime

        // Render
        renderer.render(scene, camera)

        // Call tick again on the next frame
        window.requestAnimationFrame(tick)
    }

    tick()
}

main()
