import * as THREE from 'three'

async function main () {
    // Canvas
    let canvas = document.getElementById('mainTit')

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    while (canvas === null) {
        canvas = document.getElementById('mainTit') as HTMLTemplateElement
        if (canvas === null) {
            await delay(50)
        }
    }

    // Scene
    const scene = new THREE.Scene()

    const group = new THREE.Group()

    const fontLoader = new THREE.FontLoader()

    fontLoader.load(
        '/three/RobotoBlackRegular.json',
        (font) => {
            const textGeometry = new THREE.TextGeometry(
                'ANI',
                {
                    font: font,
                    size: 1.8,
                    height: 3,
                    curveSegments: 10,
                    bevelEnabled: true,
                    bevelThickness: 0.003,
                    bevelSize: 0.002,
                    bevelOffset: 0,
                    bevelSegments: 0
                }
            )
            const edges = new THREE.EdgesGeometry(textGeometry)
            const text = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xDB1A1A }))
            edges.center()
            text.position.y = text.position.y + 1
            group.add(text)
        }
    )

    fontLoader.load(
        '/three/RobotoBlackRegular.json',
        (font) => {
            const textGeometry = new THREE.TextGeometry(
                'Games',
                {
                    font: font,
                    size: 2,
                    height: 3,
                    curveSegments: 5,
                    bevelEnabled: true,
                    bevelThickness: 0.003,
                    bevelSize: 0.002,
                    bevelOffset: 0,
                    bevelSegments: 0
                }
            )
            const edges = new THREE.EdgesGeometry(textGeometry)
            const text = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xE7ABDF }))
            edges.center()
            text.position.y = text.position.y - 0.5
            text.position.x = text.position.x + 0.05
            group.add(text)
        }
    )

    scene.add(group)

    // Sizes
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    }

    // Camera
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
    camera.position.z = 10
    scene.add(camera)

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Animate

    const clock = new THREE.Clock()

    const time = 60

    const tick = () => {
        const elapsedTime = clock.getElapsedTime()

        if (elapsedTime < time - time / 2) {
            group.rotation.y = (elapsedTime - (time - time / 2)) * 0.005
            group.rotation.x = (elapsedTime - (time - time / 2)) * 0.005
            group.rotation.z = (elapsedTime - (time - time / 2)) * 0.005
        } else if (elapsedTime > time - time / 2) {
            group.rotation.y = (elapsedTime - (time - time / 2)) * 0.05
            group.rotation.x = (elapsedTime - (time - time / 2)) * 0.05
            group.rotation.z = (elapsedTime - (time - time / 2)) * 0.05
        } else {
            group.rotation.y = (elapsedTime - (time - time / 2)) * 0.1
            group.rotation.x = (elapsedTime - (time - time / 2)) * 0.1
            group.rotation.z = (elapsedTime - (time - time / 2)) * 0.1
        }

        // Render
        renderer.render(scene, camera)

        // Call tick again on the next frame
        window.requestAnimationFrame(tick)
    }

    tick()

    window.addEventListener('resize', () => {
    // Update sizes
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight

        // Update camera
        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()

        // Update renderer
        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })
}

main()
