import * as THREE from 'three'
import { Pickup, CloudObstacle, Puddle } from './entities.js'
import { clamp, damp, rand, pick } from './assets.js'

const LETTERS = ['H', 'E', 'L', 'L', 'O']
const LETTER_STYLE = [
  { color: '#ff7d99', light: '#ffd3dc' },
  { color: '#ffc75e', light: '#fff0c2' },
  { color: '#ff92c2', light: '#ffd9ec' },
  { color: '#74e9d2', light: '#d3fff7' },
  { color: '#8fc6ff', light: '#d9ecff' },
]
const NOTES = [
  'The clouds send their regards.',
  'Even tiny robots need a breather.',
  'The sky is still cheering for you.',
  'Pip will say hello again tomorrow.',
  'A little stumble, a lot of heart.',
]
const CONFETTI = [0xff7d99, 0xffc75e, 0x74e9d2, 0x8fc6ff, 0xff92c2, 0xffffff]

export class Game {
  constructor({ scene, player, world, particles, sound, ui }) {
    this.scene = scene
    this.player = player
    this.world = world
    this.particles = particles
    this.sound = sound
    this.ui = ui
    this.state = 'menu'
    this.entities = []
    this.best = ui.getBest()

    this.score = 0
    this.speed = 15
    this.hearts = 3
    this.letterIndex = 0
    this.elapsed = 0
    this.distance = 0
    this.spawnTimer = 1
    this.wavesSinceLetter = 0
    this.wordCooldown = 0
    this.slowTimer = 0
    this.shake = 0
    this.overTimer = 0
    this.pausedFrom = 'playing'
    this.time = 0
    this.scoreFlash = 0
  }

  start() {
    this.clearEntities()
    this.state = 'playing'
    this.score = 0
    this.speed = 14
    this.hearts = 3
    this.letterIndex = 0
    this.elapsed = 0
    this.distance = 0
    this.spawnTimer = 0.9
    this.wavesSinceLetter = 0
    this.wordCooldown = 0
    this.slowTimer = 0
    this.shake = 0
    this.overTimer = 0
    this.time = 0
    this.player.reset()
    this.player.model.rotation.y = 0
    this.ui.startGame()
    this.sound.ensure()
    this.sound.startMusic()
    this.spawnPickup('letter', 0, 1.45, -24)
    this.spawnPickup('heart', 1.9, 1.5, -44)
    this.spawnObstacle('puddle', -1.5, -66)
  }

  pause() {
    if (this.state !== 'playing') return
    this.pausedFrom = this.state
    this.state = 'paused'
    this.sound.stopMusic()
    this.ui.showPaused()
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = 'playing'
    this.ui.hidePaused()
    this.sound.ensure()
    this.sound.startMusic()
  }

  quitToMenu() {
    this.state = 'menu'
    this.clearEntities()
    this.player.reset()
    this.ui.hidePaused()
    this.ui.showMenu()
    this.sound.stopMusic()
  }

  clearEntities() {
    for (const e of this.entities) e.destroy()
    this.entities = []
  }

  spawnPickup(type, x, y, z) {
    const options = { type, x, y, z }
    if (type === 'letter') {
      const style = LETTER_STYLE[this.letterIndex] || LETTER_STYLE[0]
      options.index = this.letterIndex
      options.color = style.color
      options.light = style.light
    }
    const entity = new Pickup(this.scene, options)
    this.entities.push(entity)
    return entity
  }

  spawnObstacle(type, x, z) {
    const entity = type === 'puddle' ? new Puddle(this.scene, { x, z }) : new CloudObstacle(this.scene, { x, z })
    this.entities.push(entity)
    return entity
  }

  spawnWave() {
    const diff = clamp((this.speed - 14) / 20, 0, 1)
    const wantsLetter =
      this.wordCooldown <= 0 &&
      (this.wavesSinceLetter >= 2 || Math.random() < 0.44 - diff * 0.12)
    this.wavesSinceLetter += 1

    if (wantsLetter) {
      this.wavesSinceLetter = 0
      const x = rand(-3.05, 3.05)
      const high = Math.random() < (this.letterIndex >= 1 ? 0.3 : 0.14)
      this.spawnPickup('letter', x, high ? 2.62 : 1.45, -118 + rand(-4, 4))
      return
    }

    if (Math.random() < 0.12) {
      this.spawnPickup('heart', rand(-3, 3), Math.random() < 0.25 ? 2.5 : 1.5, -118 + rand(-4, 4))
      return
    }

    const roll = Math.random()
    if (roll < 0.32) {
      this.spawnObstacle('puddle', rand(-2.7, 2.7), -116 + rand(-5, 5))
    } else if (roll < 0.58) {
      this.spawnObstacle('cloud', rand(-2.7, 2.7), -116 + rand(-5, 5))
    } else if (roll < 0.86) {
      const spread = 2.35 + diff * 0.25
      const z = -118 + rand(-4, 4)
      this.spawnObstacle('cloud', -spread, z)
      this.spawnObstacle('cloud', spread, z + rand(-2.5, 2.5))
    } else {
      const z = -120 + rand(-4, 4)
      this.spawnObstacle('cloud', rand(-2.4, 2.4), z)
      this.spawnObstacle('puddle', rand(-2.4, 2.4), z + rand(9, 13))
    }
  }

  explode(entity, colors) {
    const pos = new THREE.Vector3(entity.x, entity.group.position.y, entity.z)
    this.particles.emit(pos, {
      count: 20,
      colors,
      speed: 5,
      spread: 1,
      gravity: 2.6,
      life: 0.9,
      size: 0.42,
      drag: 1.8,
    })
  }

  collectLetter(entity) {
    const index = this.letterIndex
    const style = LETTER_STYLE[index]
    this.letterIndex += 1
    this.score += 110 + index * 30
    this.ui.setWord(this.letterIndex)
    this.sound.letter(index)
    this.explode(entity, [style.color, style.light, 0xffffff])
    entity.destroy()
    this.entities.splice(this.entities.indexOf(entity), 1)

    if (this.letterIndex >= LETTERS.length) {
      this.score += 500
      this.ui.completeWord()
      this.ui.toast('HELLO!')
      this.sound.word()
      this.player.celebrateNow()
      this.wordCooldown = 1.8
      this.letterIndex = 0
      const pos = new THREE.Vector3(this.player.x, 2.4, -1)
      this.particles.emit(pos, {
        count: 42,
        colors: CONFETTI,
        speed: 6.5,
        spread: 1.1,
        gravity: 3.2,
        life: 1.5,
        size: 0.4,
        drag: 1.3,
        direction: new THREE.Vector3(0, 0.6, 0.3),
      })
    }
  }

  collectHeart(entity) {
    if (this.hearts < 3) {
      this.hearts += 1
      this.ui.setHearts(this.hearts)
      this.sound.heart()
      this.ui.toast('+1 HEART')
    } else {
      this.score += 150
      this.sound.pickup()
      this.ui.toast('+150')
    }
    this.explode(entity, [0xff5f83, 0xffc2cf, 0xffffff])
    entity.destroy()
    this.entities.splice(this.entities.indexOf(entity), 1)
  }

  hit(entity) {
    if (this.player.invuln > 0) return
    if (!this.player.hurt()) return
    this.hearts -= 1
    this.ui.setHearts(this.hearts)
    this.ui.flashHit()
    this.sound.hit()
    this.shake = 0.85
    this.slowTimer = 0.9
    this.explode(entity, [0x5a3d78, 0x9d6bd0, 0xffb0c6])
    entity.destroy()
    this.entities.splice(this.entities.indexOf(entity), 1)
    if (this.hearts <= 0) {
      this.state = 'dying'
      this.overTimer = 0.95
      this.sound.stopMusic()
    }
  }

  finish() {
    this.state = 'over'
    const best = this.ui.saveBest(this.score)
    this.best = best
    this.ui.showOver(this.score, best, pick(NOTES))
    this.sound.over()
    this.player.celebrate = 0
  }

  update(dt) {
    this.time += dt
    const t = this.time

    if (this.state === 'menu') {
      this.world.update(dt, 3.1, this.state)
      this.player.update(dt, this.state, 3.1)
      this.particles.update(dt)
      this.shake = damp(this.shake, 0, 6, dt)
      return
    }

    if (this.state === 'paused') {
      this.particles.update(dt * 0.15)
      return
    }

    if (this.state === 'over') {
      this.world.update(dt, 1.5, this.state)
      this.player.update(dt, this.state, 1.5)
      this.particles.update(dt)
      this.shake = damp(this.shake, 0, 6, dt)
      return
    }

    if (this.state === 'dying') {
      this.overTimer -= dt
      const slow = Math.max(2, this.speed * 0.25)
      this.speed = damp(this.speed, slow, 3, dt)
      this.world.update(dt, this.speed, this.state)
      this.player.update(dt, 'playing', this.speed)
      this.updateEntities(dt, t, false)
      this.particles.update(dt)
      this.shake = damp(this.shake, 0, 5, dt)
      if (this.overTimer <= 0) this.finish()
      return
    }

    this.elapsed += dt
    const target = 14 + Math.min(20, this.elapsed * 0.62)
    let goal = target
    if (this.slowTimer > 0) {
      this.slowTimer -= dt
      goal *= 0.62
    }
    this.speed = damp(this.speed, goal, 2.2, dt)
    this.distance += this.speed * dt
    this.score += this.speed * dt * 1.15
    this.ui.setScore(this.score)

    this.world.update(dt, this.speed, this.state)
    this.player.update(dt, this.state, this.speed)

    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnWave()
      const interval = rand(0.62, 0.92) * (18 / this.speed + 0.55)
      this.spawnTimer = clamp(interval, 0.7, 1.7)
    }

    if (this.wordCooldown > 0) {
      this.wordCooldown -= dt
      if (this.wordCooldown <= 0) this.ui.setWord(0)
    }

    this.updateEntities(dt, t, true)
    this.particles.update(dt)
    this.shake = damp(this.shake, 0, 5.5, dt)
  }

  updateEntities(dt, t, active) {
    const player = this.player
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]
      if (e.dead) continue
      const prevZ = e.z
      e.z += this.speed * dt
      e.group.position.z = e.z
      e.update(dt, t)

      if (active) {
        const dx = Math.abs(e.x - player.x)
        const crossing = prevZ <= 0.9 && e.z >= -0.9
        if (e.type === 'letter') {
          if (dx < 1.05 && crossing) {
            const py = player.y + 0.9
            if (Math.abs(e.group.position.y - py) < 1.2) {
              this.collectLetter(e)
              continue
            }
          }
        } else if (e.type === 'heart') {
          if (dx < 1.0 && crossing && Math.abs(e.group.position.y - (player.y + 0.9)) < 1.15) {
            this.collectHeart(e)
            continue
          }
        } else if (e.type === 'puddle') {
          if (dx < 1.05 && crossing && player.y < 0.72) {
            this.hit(e)
            if (this.state !== 'playing') return
            continue
          }
        } else if (e.type === 'cloud') {
          if (dx < 1.08 && crossing) {
            this.hit(e)
            if (this.state !== 'playing') return
            continue
          }
        }
      }

      if (e.z > 3.2) {
        e.destroy()
        this.entities.splice(i, 1)
      }
    }
  }

  getShake() {
    return this.shake
  }
}
