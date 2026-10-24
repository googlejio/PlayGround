export class UI {
  constructor(handlers = {}) {
    this.handlers = handlers
    this.menu = document.getElementById('menu')
    this.hud = document.getElementById('hud')
    this.over = document.getElementById('over')
    this.paused = document.getElementById('paused')
    this.scoreEl = document.getElementById('score')
    this.heartsEl = document.getElementById('hearts')
    this.wordEls = [...document.querySelectorAll('.word-letter')]
    this.toastEl = document.getElementById('toast')
    this.finalScore = document.getElementById('final-score')
    this.finalBest = document.getElementById('final-best')
    this.overNote = document.getElementById('over-note')
    this.menuBest = document.getElementById('menu-best')
    this.flashEl = document.getElementById('flash')
    this.muteBtn = document.getElementById('mute')
    this.lastScore = 0
    this.wordTimer = null

    const bind = (id, fn) => {
      const el = document.getElementById(id)
      if (!el) return
      el.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        fn?.(event)
      })
    }
    bind('play', handlers.onPlay)
    bind('again', handlers.onAgain)
    bind('pause', handlers.onPause)
    bind('resume', handlers.onResume)
    bind('quit', handlers.onQuit)
    bind('mute', handlers.onMute)

    this.setBest(this.getBest())
    this.setMuted(false)
  }

  getBest() {
    try { return Number(localStorage.getItem('hello.best') || 0) || 0 } catch { return 0 }
  }

  saveBest(score) {
    const best = Math.max(this.getBest(), Math.round(score))
    try { localStorage.setItem('hello.best', String(best)) } catch {}
    this.setBest(best)
    return best
  }

  setBest(best) {
    this.menuBest.textContent = Math.round(best).toLocaleString('en-US')
    if (this.finalBest) this.finalBest.textContent = Math.round(best).toLocaleString('en-US')
  }

  setMuted(muted) {
    document.body.classList.toggle('muted', muted)
    this.muteBtn?.setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound')
  }

  setScore(score) {
    const value = Math.round(score)
    if (value !== this.lastScore) {
      this.lastScore = value
      this.scoreEl.textContent = value.toLocaleString('en-US')
    }
  }

  setHearts(count) {
    const hearts = [...this.heartsEl.querySelectorAll('.heart')]
    hearts.forEach((heart, i) => {
      const wasFull = !heart.classList.contains('empty')
      const shouldBeFull = i < count
      heart.classList.toggle('empty', !shouldBeFull)
      if (wasFull && !shouldBeFull) {
        heart.classList.remove('lost')
        void heart.offsetWidth
        heart.classList.add('lost')
      } else {
        heart.classList.remove('lost')
      }
    })
    this.heartsEl.setAttribute('aria-label', `${count} of 3 hearts`)
  }

  setWord(index, complete = false) {
    this.wordEls.forEach((el, i) => {
      const on = complete || i < index
      if (on && !el.classList.contains('on')) {
        el.classList.add('on')
        el.classList.remove('pop')
        void el.offsetWidth
        el.classList.add('pop')
      } else if (!on) {
        el.classList.remove('on', 'pop')
      }
    })
  }

  completeWord() {
    this.wordEls.forEach((el) => {
      if (!el.classList.contains('on')) {
        el.classList.add('on')
        el.classList.remove('pop')
        void el.offsetWidth
        el.classList.add('pop')
      }
    })
  }

  toast(text, variant = '') {
    this.toastEl.textContent = text
    this.toastEl.className = 'toast'
    void this.toastEl.offsetWidth
    this.toastEl.classList.add('show')
    if (variant) this.toastEl.classList.add(variant)
  }

  flashHit() {
    this.flashEl.classList.remove('hit')
    void this.flashEl.offsetWidth
    this.flashEl.classList.add('hit')
  }

  showMenu() {
    this.menu.classList.remove('hidden')
    this.over.classList.add('hidden')
    this.paused.classList.add('hidden')
    this.hud.classList.add('hidden')
    this.menuBest.textContent = Math.round(this.getBest()).toLocaleString('en-US')
  }

  startGame() {
    this.menu.classList.add('hidden')
    this.over.classList.add('hidden')
    this.paused.classList.add('hidden')
    this.hud.classList.remove('hidden')
    this.scoreEl.textContent = '0'
    this.lastScore = 0
    this.setHearts(3)
    this.setWord(0)
    this.toastEl.className = 'toast'
  }

  showOver(score, best, note) {
    this.finalScore.textContent = Math.round(score).toLocaleString('en-US')
    this.finalBest.textContent = Math.round(best).toLocaleString('en-US')
    this.overNote.textContent = note
    this.over.classList.remove('hidden')
    this.hud.classList.add('hidden')
  }

  showPaused() {
    this.paused.classList.remove('hidden')
  }

  hidePaused() {
    this.paused.classList.add('hidden')
  }
}
