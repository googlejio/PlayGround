import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { glowTexture, starTexture, deckTexture, makeSprite, rand, pick, lerp } from './assets.js'

const PATH_SEGMENTS = 38
const SEGMENT_LENGTH = 4.05
const PATH_WIDTH = 9.4
const SPAN = PATH_SEGMENTS * SEGMENT_LENGTH

const TRIM_COLORS = [0xff7d99, 0x74e9d2, 0xffc75e, 0x9db7ff]

function deckGeometry() {
  const geo = new THREE.BoxGeometry(PATH_WIDTH, 0.55, SEGMENT_LENGTH - 0.35, 1, 1, 1)
  return geo
}

export class World {
  constructor(scene, particles) {
    this.scene = scene
    this.particles = particles
    this.segments = []
    this.lanterns = []
    this.clouds = []
    this.islands = []
    this.birds = []
    this.time = 0
    this.travel = 0
    this.sunBase = new THREE.Vector3(-46, 30, -168)

    this.buildLights()
    this.buildSky()
    this.buildSun()
    this.buildPath()
    this.buildClouds()
    this.buildIslands()
    this.buildBirds()
    this.buildMotes()
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xffe6ef, 0x9a8bd6, 1.3)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfff0cf, 2.05)
    sun.position.set(-12, 24, 14)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 70
    sun.shadow.camera.left = -13
    sun.shadow.camera.right = 13
    sun.shadow.camera.top = 13
    sun.shadow.camera.bottom = -13
    sun.shadow.bias = -0.0015
    sun.shadow.normalBias = 0.02
    sun.shadow.radius = 3
    sun.target.position.set(0, 0, -6)
    this.scene.add(sun, sun.target)
    this.sunLight = sun

    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.65)
    rim.position.set(14, 10, -22)
    this.scene.add(rim)
  }

  buildSky() {
    const uniforms = {
      topColor: { value: new THREE.Color(0x6a5aa8) },
      midColor: { value: new THREE.Color(0xf0a1c2) },
      lowColor: { value: new THREE.Color(0xffd6a4) },
      horizonColor: { value: new THREE.Color(0xffe9c8) },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 lowColor;
        uniform vec3 horizonColor;
        varying vec3 vWorld;
        void main() {
          float h = clamp(vWorld.y / 230.0, -0.15, 1.0);
          vec3 col = mix(lowColor, midColor, smoothstep(0.0, 0.35, h));
          col = mix(col, topColor, smoothstep(0.3, 0.95, h));
          float band = smoothstep(0.02, 0.0, h) * smoothstep(-0.06, 0.0, h);
          col = mix(col, horizonColor, band * 0.75);
          float haze = smoothstep(-0.02, 0.16, h);
          col = mix(horizonColor, col, haze);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(340, 40, 24), mat)
    this.scene.add(this.sky)

    this.scene.fog = new THREE.Fog(0xffd9c1, 52, 205)
  }

  buildSun() {
    const glowTex = glowTexture('#fff6dd')
    const outer = makeSprite(glowTex, { color: 0xffc79c, scale: 74, opacity: 0.5 })
    outer.position.copy(this.sunBase)
    const mid = makeSprite(glowTex, { color: 0xffdda6, scale: 33, opacity: 0.75 })
    mid.position.copy(this.sunBase)
    const core = makeSprite(glowTex, { color: 0xfff8e6, scale: 13, opacity: 1 })
    core.position.copy(this.sunBase)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(13, 13.6, 64),
      new THREE.MeshBasicMaterial({ color: 0xffe9bb, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    ring.position.copy(this.sunBase)
    ring.lookAt(0, 8, 0)
    this.scene.add(outer, mid, core, ring)
    this.sunSprites = [outer, mid, core]
    this.sunRing = ring
  }

  buildMountains() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb79ad0, roughness: 1, flatShading: true, fog: true })
    const matFar = new THREE.MeshStandardMaterial({ color: 0xc7a9d8, roughness: 1, flatShading: true })
    for (let i = 0; i < 9; i++) {
      const height = rand(34, 72)
      const radius = rand(26, 44)
      const geo = new THREE.ConeGeometry(radius, height, 6, 1)
      const mesh = new THREE.Mesh(geo, i % 2 ? mat : matFar)
      mesh.position.set(rand(-150, 150), -18 + rand(-4, 4), rand(-260, -170))
      mesh.rotation.y = rand(0, Math.PI)
      this.scene.add(mesh)
    }
  }

  buildPath() {
    this.deckGeo = deckGeometry()
    const deckMap = deckTexture()
    this.deckMaterials = [
      new THREE.MeshStandardMaterial({ map: deckMap, color: 0xffe9d2, roughness: 0.82, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: deckMap, color: 0xffe0c5, roughness: 0.82, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: deckMap, color: 0xfff1dc, roughness: 0.82, metalness: 0.02 }),
    ]
    this.trimGeo = new THREE.BoxGeometry(0.17, 0.15, SEGMENT_LENGTH - 0.35)
    this.trimMats = TRIM_COLORS.map((color) =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.35 }))
    this.postGeo = new THREE.CylinderGeometry(0.055, 0.075, 0.92, 8)
    this.postMat = new THREE.MeshStandardMaterial({ color: 0xf3dfc4, roughness: 0.7 })
    this.orbGeo = new THREE.SphereGeometry(0.095, 14, 10)
    this.orbMats = [0xffcf7a, 0x8ff6e3, 0xffa8bc].map((color) =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.3, roughness: 0.3 }))
    this.lampGlow = glowTexture('#ffffff')
    this.dashGeo = new THREE.BoxGeometry(0.15, 0.018, 1.15)
    this.dashMat = new THREE.MeshBasicMaterial({ color: 0xffcfae, transparent: true, opacity: 0.42 })

    const start = 13
    for (let i = 0; i < PATH_SEGMENTS; i++) {
      const seg = new THREE.Group()
      seg.position.set(0, 0, start - i * SEGMENT_LENGTH)

      const deck = new THREE.Mesh(this.deckGeo, this.deckMaterials[i % this.deckMaterials.length])
      deck.position.y = -0.275
      deck.receiveShadow = true
      deck.castShadow = false
      seg.add(deck)

      const trimL = new THREE.Mesh(this.trimGeo, this.trimMats[i % this.trimMats.length])
      trimL.position.set(-PATH_WIDTH / 2 + 0.09, 0.045, 0)
      const trimR = trimL.clone()
      trimR.position.x = PATH_WIDTH / 2 - 0.09
      seg.add(trimL, trimR)

      if (i % 2 === 0) {
        const dash = new THREE.Mesh(this.dashGeo, this.dashMat)
        dash.position.set(0, 0.012, 0)
        seg.add(dash)
      }

      if (i % 3 === 0) {
        const crystalColor = pick([0xffb3c4, 0x9ff5e6, 0xffdf9a])
        const crystal = new THREE.Mesh(
          new THREE.ConeGeometry(0.26, 0.9, 5),
          new THREE.MeshStandardMaterial({ color: crystalColor, emissive: crystalColor, emissiveIntensity: 1.1, roughness: 0.3, transparent: true, opacity: 0.85 }),
        )
        crystal.position.set(rand(-3.2, 3.2), -0.9, rand(-1, 1))
        crystal.rotation.x = Math.PI
        seg.add(crystal)
      }

      if (i % 6 === 2) {
        const base = i % 12 === 2 ? 0 : 1
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(this.postGeo, this.postMat)
          post.position.set(side * (PATH_WIDTH / 2 + 0.33), 0.34, 0)
          post.castShadow = true
          seg.add(post)
          const orbMat = this.orbMats[(base + (side > 0 ? 1 : 0)) % this.orbMats.length]
          const orb = new THREE.Mesh(this.orbGeo, orbMat)
          orb.position.set(side * (PATH_WIDTH / 2 + 0.33), 0.84, 0)
          const halo = makeSprite(this.lampGlow, { color: orbMat.color, scale: 0.72, opacity: 0.38 })
          halo.position.copy(orb.position)
          seg.add(orb, halo)
          this.lanterns.push({ mesh: orb, halo, phase: rand(0, Math.PI * 2) })
        }
      }

      this.scene.add(seg)
      this.segments.push(seg)
    }
  }

  buildClouds() {
    const white = new THREE.MeshStandardMaterial({ color: 0xfff6f2, roughness: 1, flatShading: true, emissive: 0xffe9ec, emissiveIntensity: 0.18 })
    const pink = new THREE.MeshStandardMaterial({ color: 0xffdfe9, roughness: 1, flatShading: true, emissive: 0xffc9da, emissiveIntensity: 0.16 })
    const cream = new THREE.MeshStandardMaterial({ color: 0xfff0da, roughness: 1, flatShading: true, emissive: 0xffe0bd, emissiveIntensity: 0.14 })
    const mats = [white, pink, cream]
    for (let i = 0; i < 14; i++) {
      const parts = []
      const puffs = 4 + Math.floor(Math.random() * 4)
      for (let p = 0; p < puffs; p++) {
        const geo = new THREE.SphereGeometry(rand(1.5, 3.4), 7, 5)
        geo.translate(rand(-3.5, 3.5), rand(-0.7, 1.2), rand(-2, 2))
        parts.push(geo)
      }
      const merged = mergeGeometries(parts)
      const mesh = new THREE.Mesh(merged, mats[i % mats.length])
      const scale = rand(0.9, 2.3)
      mesh.scale.set(scale, scale * rand(0.6, 0.9), scale)
      mesh.position.set(rand(-56, 56), rand(6, 22), rand(-195, -65))
      mesh.rotation.y = rand(0, Math.PI * 2)
      this.scene.add(mesh)
      this.clouds.push({ mesh, drift: rand(0.7, 1.8), phase: rand(0, 10), baseY: mesh.position.y })
    }
  }

  buildIslands() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xb18ac9, roughness: 1, flatShading: true })
    const rockDark = new THREE.MeshStandardMaterial({ color: 0x8d6cae, roughness: 1, flatShading: true })
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x9fe3c1, roughness: 0.95, flatShading: true })
    const grassAlt = new THREE.MeshStandardMaterial({ color: 0xffd8a3, roughness: 0.95, flatShading: true })
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xa9716f, roughness: 0.9, flatShading: true })
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x8fdcc0, roughness: 0.9, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xffb9c9, roughness: 0.9, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xa9d6ff, roughness: 0.9, flatShading: true }),
    ]
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group()
      const radius = rand(2.4, 5.2)
      const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.86, 0.9, 7), i % 3 === 0 ? grassAlt : grassMat)
      top.position.y = 0.2
      const rock = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.94, radius * 2.4, 7), i % 2 ? rockMat : rockDark)
      rock.rotation.x = Math.PI
      rock.position.y = -1.1 - radius * 0.6
      group.add(top, rock)
      const trees = 1 + Math.floor(Math.random() * 3)
      for (let t = 0; t < trees; t++) {
        const tree = new THREE.Group()
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 1.4, 6), trunkMat)
        trunk.position.y = 0.7
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(rand(0.55, 0.9), rand(1.1, 1.8), 6), pick(leafMats))
        leaf.position.y = 1.8
        tree.add(trunk, leaf)
        const a = rand(0, Math.PI * 2)
        const r = rand(0.2, radius * 0.6)
        tree.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r)
        group.add(tree)
      }
      const side = Math.random() < 0.5 ? -1 : 1
      group.position.set(side * rand(14, 34), rand(-1, 7), rand(-210, -70))
      group.rotation.y = rand(0, Math.PI * 2)
      group.scale.setScalar(rand(0.65, 1.15))
      this.scene.add(group)
      this.islands.push({ group, baseY: group.position.y, phase: rand(0, 10), drift: rand(0.85, 1.5) })
    }
  }

  buildBirds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x574370, transparent: true, opacity: 0.72 })
    const wingGeo = new THREE.BoxGeometry(0.7, 0.06, 0.16)
    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group()
      const left = new THREE.Mesh(wingGeo, mat)
      left.position.x = -0.35
      const right = left.clone()
      right.position.x = 0.35
      group.add(left, right)
      group.userData = {
        left, right,
        radius: rand(18, 45),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.08, 0.16),
        y: rand(14, 34),
        z: rand(-120, -40),
        flap: rand(5, 9),
      }
      this.scene.add(group)
      this.birds.push(group)
    }
  }

  buildMotes() {
    const count = 280
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = [new THREE.Color(0xfff3d0), new THREE.Color(0xffc7d8), new THREE.Color(0x9ff5e6), new THREE.Color(0xc7e6ff)]
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand(-55, 55)
      positions[i * 3 + 1] = rand(-8, 32)
      positions[i * 3 + 2] = rand(-190, 30)
      const c = pick(palette)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.34,
      map: starTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.motes = new THREE.Points(geo, mat)
    this.motes.frustumCulled = false
    this.motes.renderOrder = 3
    this.scene.add(this.motes)
    this.moteArr = positions
  }

  update(dt, speed, mode) {
    this.time += dt
    const t = this.time
    this.travel += speed * dt

    for (const seg of this.segments) {
      seg.position.z += speed * dt
      if (seg.position.z > 19) seg.position.z -= SPAN
    }

    for (const lamp of this.lanterns) {
      const pulse = 1 + Math.sin(t * 3.2 + lamp.phase) * 0.14
      lamp.mesh.scale.setScalar(pulse)
      lamp.halo.material.opacity = 0.4 + Math.sin(t * 3.2 + lamp.phase) * 0.14
    }

    for (const cloud of this.clouds) {
      cloud.mesh.position.z += speed * 0.09 * dt
      cloud.mesh.position.x += Math.sin(t * 0.2 + cloud.phase) * cloud.drift * dt
      cloud.mesh.position.y = cloud.baseY + Math.sin(t * 0.35 + cloud.phase) * 0.55
      if (cloud.mesh.position.z > -40) {
        cloud.mesh.position.z = rand(-205, -150)
        cloud.mesh.position.x = rand(-56, 56)
      }
    }

    for (const island of this.islands) {
      island.group.position.z += speed * 0.16 * dt
      island.group.position.y = island.baseY + Math.sin(t * 0.5 + island.phase) * 0.7
      island.group.rotation.y += dt * 0.02 * island.drift
      if (island.group.position.z > -30) {
        island.group.position.z = rand(-210, -160)
        island.group.position.x = (Math.random() < 0.5 ? -1 : 1) * rand(12, 42)
        island.group.position.y = rand(-1, 7)
        island.baseY = island.group.position.y
      }
    }

    for (const bird of this.birds) {
      const d = bird.userData
      d.phase += d.speed * dt
      const x = Math.cos(d.phase) * d.radius
      const z = d.z + Math.sin(d.phase) * d.radius * 0.35 + this.travel * 0.03
      bird.position.set(x, d.y + Math.sin(t + d.phase) * 1.4, z)
      bird.rotation.y = -d.phase + Math.PI
      const flap = Math.sin(t * d.flap + d.phase) * 0.55
      d.left.rotation.z = flap
      d.right.rotation.z = -flap
    }

    for (let i = 0; i < this.moteArr.length; i += 3) {
      this.moteArr[i + 2] += speed * 0.3 * dt
      this.moteArr[i + 1] += Math.sin(t * 0.8 + this.moteArr[i]) * 0.06 * dt
      if (this.moteArr[i + 2] > 32) {
        this.moteArr[i + 2] = -190
        this.moteArr[i] = rand(-55, 55)
        this.moteArr[i + 1] = rand(-8, 32)
      }
    }
    this.motes.geometry.attributes.position.needsUpdate = true

    if (this.sunSprites) {
      const pulse = 1 + Math.sin(t * 0.7) * 0.018
      this.sunSprites[0].scale.setScalar(74 * pulse)
      this.sunRing.rotation.z += dt * 0.03
    }
  }
}
