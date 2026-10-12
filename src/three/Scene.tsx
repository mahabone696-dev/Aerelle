import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Floating fitness objects in glass and pearl: a ring, exercise balls, a foam roller, a dumbbell, a kettlebell,
// a slowly morphing glass form and drifting light particles.
// "hero" fills the sign-in page; "ambient" sits behind the app at the edges, quieter and cheaper.

export type SceneVariant = 'hero' | 'ambient'

const BABY = new THREE.Color('#bfe4fb')
const SKY = new THREE.Color('#95d0f5')
const ICE = new THREE.Color('#eef8fe')

export default function Scene({ variant }: { variant: SceneVariant }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const hero = variant === 'hero'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: hero ? 'high-performance' : 'low-power' })
    } catch {
      return // No WebGL: the CSS gradient behind stays on its own.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, hero ? 1.75 : 1.25))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTexture

    const camera = new THREE.PerspectiveCamera(hero ? 38 : 42, 1, 0.1, 100)
    camera.position.set(0, 0, hero ? 11 : 13)

    scene.add(new THREE.HemisphereLight('#ffffff', '#bfe3fa', 1.1))
    const key = new THREE.DirectionalLight('#ffffff', 1.6)
    key.position.set(4, 6, 5)
    scene.add(key)
    const rim = new THREE.PointLight(SKY, 18, 30)
    rim.position.set(-5, -2, 4)
    scene.add(rim)

    const disposables: { dispose: () => void }[] = [envTexture, pmrem]
    const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)

    // Materials
    const glass = track(
      new THREE.MeshPhysicalMaterial({
        color: ICE,
        roughness: 0.06,
        metalness: 0,
        transmission: hero ? 1 : 0,
        transparent: !hero,
        opacity: hero ? 1 : 0.8,
        thickness: 1.4,
        ior: 1.42,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        iridescence: 0.7,
        iridescenceIOR: 1.3,
        attenuationColor: BABY,
        attenuationDistance: 2.5,
      }),
    )
    const pearl = track(
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 1, sheenColor: BABY, sheenRoughness: 0.4 }),
    )
    const baby = track(new THREE.MeshPhysicalMaterial({ color: BABY, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.3 }))
    const sky = track(new THREE.MeshPhysicalMaterial({ color: SKY, roughness: 0.35, clearcoat: 0.8, metalness: 0.05 }))

    // Morphing glass form: vertices ripple along their normals.
    const time = { value: 0 }
    const blobMat = track(glass.clone())
    blobMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float w = sin(position.x * 1.7 + uTime * 0.9) * sin(position.y * 2.1 + uTime * 0.7) * sin(position.z * 1.5 + uTime * 1.1);
           transformed += normal * w * 0.22;`,
        )
    }

    type Floater = { obj: THREE.Object3D; base: THREE.Vector3; amp: number; speed: number; phase: number; spin: THREE.Vector3 }
    const floaters: Floater[] = []
    const add = (obj: THREE.Object3D, pos: [number, number, number], opts: Partial<Omit<Floater, 'obj' | 'base'>> = {}) => {
      obj.position.set(...pos)
      scene.add(obj)
      floaters.push({
        obj,
        base: obj.position.clone(),
        amp: opts.amp ?? 0.25,
        speed: opts.speed ?? 0.6,
        phase: opts.phase ?? Math.random() * Math.PI * 2,
        spin: opts.spin ?? new THREE.Vector3(0.1, 0.15, 0.05),
      })
      return obj
    }
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(track(g), m)

    // Pilates ring with two grip pads.
    const ring = new THREE.Group()
    ring.add(mesh(new THREE.TorusGeometry(1.15, 0.1, 40, 180), sky))
    for (const side of [-1, 1]) {
      const pad = mesh(new THREE.CapsuleGeometry(0.2, 0.32, 12, 24), pearl)
      pad.position.x = side * 1.15
      ring.add(pad)
    }
    const blob = mesh(new THREE.IcosahedronGeometry(1.5, hero ? 48 : 20), blobMat)
    const ball = (r: number, m: THREE.Material) => mesh(new THREE.SphereGeometry(r, 64, 48), m)
    const roller = (m: THREE.Material) => mesh(new THREE.CapsuleGeometry(0.26, 1.3, 16, 40), m)
    const dumbbell = () => {
      const g = new THREE.Group()
      const bar = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 24), pearl)
      bar.rotation.z = Math.PI / 2
      g.add(bar)
      for (const side of [-1, 1]) {
        const plate = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 40), sky)
        plate.rotation.z = Math.PI / 2
        plate.position.x = side * 0.62
        g.add(plate)
      }
      return g
    }
    const kettlebell = () => {
      const g = new THREE.Group()
      g.add(mesh(new THREE.SphereGeometry(0.5, 48, 32), baby))
      const handle = mesh(new THREE.TorusGeometry(0.3, 0.07, 16, 48, Math.PI), pearl)
      handle.position.y = 0.38
      g.add(handle)
      return g
    }

    if (hero) {
      add(blob, [-1.6, 0.2, 0], { amp: 0.18, speed: 0.4, spin: new THREE.Vector3(0.05, 0.12, 0) })
      add(ring, [1.9, 1.1, 0.8], { amp: 0.3, speed: 0.5, spin: new THREE.Vector3(0.25, 0.35, 0.1) }).rotation.set(0.9, 0.3, 0)
      add(ball(0.75, pearl), [2.4, -1.6, -0.5], { amp: 0.35, speed: 0.45 })
      add(ball(0.42, baby), [-3.9, -1.9, 1.2], { amp: 0.25, speed: 0.7 })
      add(ball(0.25, glass), [0.2, 2.5, 1.5], { amp: 0.2, speed: 0.9 })
      add(roller(baby), [-3.6, 2.1, -1], { amp: 0.3, speed: 0.55, spin: new THREE.Vector3(0.1, 0.05, 0.3) }).rotation.z = 0.8
      add(dumbbell(), [0.6, -2.6, 0.4], { amp: 0.2, speed: 0.5, spin: new THREE.Vector3(0.05, 0.25, 0.1) }).rotation.z = -0.4
      add(kettlebell(), [4.2, 0.4, -1.2], { amp: 0.25, speed: 0.45, spin: new THREE.Vector3(0.02, 0.2, 0.02) })
    } else {
      // Keep the middle clear for content: everything sits toward the corners.
      add(blob, [6.2, 3.2, -3], { amp: 0.25, speed: 0.3 }).scale.setScalar(1.1)
      add(ring, [-6.3, -2.6, -1.5], { amp: 0.3, speed: 0.4, spin: new THREE.Vector3(0.15, 0.25, 0.05) }).rotation.set(1, 0.4, 0)
      add(ball(0.6, pearl), [6.6, -3.4, -1], { amp: 0.3, speed: 0.4 })
      add(ball(0.32, baby), [-6.8, 3.6, -2], { amp: 0.25, speed: 0.6 })
      add(roller(baby), [-8.2, 4.6, -4], { amp: 0.2, speed: 0.45 }).rotation.z = 0.7
    }

    // Light particles drifting upward.
    const count = hero ? 420 : 160
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
    }
    const pGeo = track(new THREE.BufferGeometry())
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const sprite = track(dotTexture())
    const points = new THREE.Points(
      pGeo,
      track(new THREE.PointsMaterial({ size: hero ? 0.09 : 0.07, map: sprite, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true })),
    )
    scene.add(points)

    // Sizing
    const resize = () => {
      const w = host.clientWidth || window.innerWidth
      const h = host.clientHeight || window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // On narrow screens pull back so the composition still fits.
      camera.position.z = (hero ? 11 : 13) * (camera.aspect < 0.8 ? 1.6 : camera.aspect < 1.2 ? 1.25 : 1)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    // Pointer and scroll parallax
    const pointer = new THREE.Vector2()
    const onPointer = (e: PointerEvent) => pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5)
    window.addEventListener('pointermove', onPointer, { passive: true })

    const clock = new THREE.Clock()
    let raf = 0
    let frame = 0
    const render = () => {
      const t = clock.getElapsedTime()
      time.value = t
      for (const f of floaters) {
        f.obj.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * f.amp
        f.obj.position.x = f.base.x + Math.cos(t * f.speed * 0.7 + f.phase) * f.amp * 0.4
        f.obj.rotation.x += f.spin.x * 0.01
        f.obj.rotation.y += f.spin.y * 0.01
        f.obj.rotation.z += f.spin.z * 0.01
      }
      const arr = pGeo.attributes.position.array as Float32Array
      for (let i = 0; i < count; i++) {
        arr[i * 3 + 1] += 0.004 + (i % 5) * 0.0008
        if (arr[i * 3 + 1] > 7) arr[i * 3 + 1] = -7
      }
      pGeo.attributes.position.needsUpdate = true
      const scroll = hero ? 0 : Math.min(window.scrollY, 2000) * 0.0015
      camera.position.x += (pointer.x * 1.2 - camera.position.x) * 0.04
      camera.position.y += (-pointer.y * 0.8 - scroll - camera.position.y) * 0.04
      camera.lookAt(0, -scroll, 0)
      renderer.render(scene, camera)
    }
    const loop = () => {
      raf = requestAnimationFrame(loop)
      // The background scene runs at half rate to save battery.
      if (!hero && frame++ % 2) return
      render()
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduceMotion) loop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (reduceMotion) render()
    else loop()
    requestAnimationFrame(() => host.classList.add('ready'))

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [variant])

  return <div ref={hostRef} className={`scene scene-${variant}`} aria-hidden="true" />
}

/** Soft round sprite for the particles. */
function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(225,243,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
