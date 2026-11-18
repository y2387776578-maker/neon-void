// Synthesized sound effects for NEON VOID, built on WebAudio only.
// No audio files ship with the game: every sound is an oscillator or a
// short burst of filtered noise, generated at play time. The context is
// created lazily on the first user gesture, so loading the page never
// asks for audio, and a mute toggle (M key or the HUD button) silences
// everything. All calls are guarded so a browser without WebAudio, or a
// headless render, simply plays nothing.
export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    try {
      this.muted = window.localStorage.getItem('neonvoid.muted') === '1';
    } catch (err) {
      this.muted = false;
    }
  }

  ensureContext() {
    if (this.context) return this.context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.context.destination);
    } catch (err) {
      this.context = null;
    }
    return this.context;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      window.localStorage.setItem('neonvoid.muted', muted ? '1' : '0');
    } catch (err) {
      /* storage unavailable: keep the in-memory flag */
    }
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.32, this.context.currentTime, 0.01);
    }
  }

  tone({ type = 'sine', from = 440, to = null, duration = 0.12, volume = 0.5, delay = 0 }) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || this.muted) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch (err) {
      /* a failed blip must never break the game loop */
    }
  }

  noise({ duration = 0.2, volume = 0.5, lowpass = 1200, delay = 0 }) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master || this.muted) return;
    try {
      const start = ctx.currentTime + delay;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(start);
    } catch (err) {
      /* a failed burst must never break the game loop */
    }
  }

  shoot() {
    this.tone({ type: 'square', from: 880, to: 420, duration: 0.07, volume: 0.16 });
  }

  enemyHit() {
    this.noise({ duration: 0.06, volume: 0.2, lowpass: 2400 });
  }

  explode(big) {
    this.noise({ duration: big ? 0.45 : 0.25, volume: big ? 0.55 : 0.35, lowpass: big ? 700 : 1100 });
    this.tone({ type: 'sine', from: big ? 160 : 220, to: 40, duration: big ? 0.4 : 0.25, volume: 0.4 });
  }

  playerHit() {
    this.tone({ type: 'sawtooth', from: 220, to: 55, duration: 0.3, volume: 0.45 });
    this.noise({ duration: 0.2, volume: 0.3, lowpass: 900 });
  }

  gemPickup() {
    this.tone({ type: 'sine', from: 990, to: 1480, duration: 0.09, volume: 0.22 });
  }

  levelUp() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this.tone({ type: 'triangle', from: freq, duration: 0.16, volume: 0.3, delay: i * 0.07 });
    });
  }

  waveStart() {
    this.tone({ type: 'triangle', from: 392, to: 784, duration: 0.22, volume: 0.28 });
  }

  cardPick() {
    this.tone({ type: 'triangle', from: 660, to: 990, duration: 0.1, volume: 0.3 });
    this.tone({ type: 'sine', from: 1320, duration: 0.12, volume: 0.18, delay: 0.06 });
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => {
      this.tone({ type: 'sawtooth', from: freq, duration: 0.28, volume: 0.22, delay: i * 0.16 });
    });
  }

  click() {
    this.tone({ type: 'sine', from: 1200, to: 900, duration: 0.05, volume: 0.2 });
  }
}
