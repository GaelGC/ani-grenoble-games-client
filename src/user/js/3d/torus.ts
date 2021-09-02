import * as THREE from 'three'

async function main () {
    // Canvas
    let canvas = document.getElementById('3d')
    console.log(canvas)

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    while (canvas === null) {
        canvas = document.getElementById('3d') as HTMLTemplateElement
        if (canvas === null) {
            await delay(50)
        }
    }

    // Scene
    const scene = new THREE.Scene()

    /**
 * Objects
 */
    const geometry = new THREE.TorusGeometry(1.3, 1.3, 7, 15)
    const material = new THREE.MeshBasicMaterial({ color: 0xDEA716 })
    material.wireframe = true
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

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
    camera.translateZ(5)
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
