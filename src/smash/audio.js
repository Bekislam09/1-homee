const MAX_VOICES = 12;

/** Small procedural sound bank. Call init from a pointer/key gesture. */
export class AudioSystem {
  constructor() {
    this._enabled = true;
    this.ctx = null;
    this.voices = new Set();
    this.speed = 0;
    this.active = false;
  }

  get enabled() { return this._enabled; }

  set enabled(value) {
    this._enabled = Boolean(value);
    if (!this.ctx || this.ctx.state === 'closed') return;
    this.master.gain.setTargetAtTime(this._enabled ? 1 : 0, this.ctx.currentTime, 0.015);
    this.update(this.speed, this.active);
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return false;
        const ctx = new AudioContext();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? 1 : 0;
        this.master.connect(ctx.destination);

        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineFilter = filter;
        this.engine = ctx.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 30;
        this.engine.connect(filter).connect(this.engineGain).connect(this.master);
        this.engine.start();

        const size = Math.ceil(ctx.sampleRate * 0.8);
        this.noise = ctx.createBuffer(1, size, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'closed') return false;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.update(this.speed, this.active);
      return true;
    } catch {
      // Audio is optional, including on browsers without a usable audio device.
      this.dispose();
      return false;
    }
  }

  update(speed = 0, active = false) {
    this.speed = Number.isFinite(speed) ? Math.min(400, Math.abs(speed)) : 0;
    this.active = Boolean(active);
    if (!this.ctx || this.ctx.state === 'closed') return;
    const fraction = this.speed / 400;
    const now = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(29 + fraction * 100, now, 0.075);
    this.engineFilter.frequency.setTargetAtTime(230 + fraction * 850, now, 0.075);
    const gain = this.enabled && this.active ? 0.025 + fraction * 0.035 : 0;
    this.engineGain.gain.setTargetAtTime(gain, now, 0.05);
  }

  play(type) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (type) {
      case 'ram':
        this.note(115, 36, 0.19, 0.18, 'triangle');
        this.noiseHit(0.17, 0.13, 650);
        break;
      case 'hit':
        this.note(165, 60, 0.11, 0.1, 'triangle');
        this.noiseHit(0.09, 0.08, 1100);
        break;
      case 'destroy':
        this.note(85, 23, 0.45, 0.22, 'triangle');
        this.noiseHit(0.48, 0.23, 1500);
        break;
      case 'coin':
        this.note(880, 1080, 0.08, 0.055, 'sine');
        this.note(1320, 1640, 0.15, 0.05, 'sine', 0.065);
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
          this.note(frequency, frequency, 0.25, 0.075, 'triangle', i * 0.11);
        });
        break;
      case 'lose':
        [330, 261.63, 196].forEach((frequency, i) => {
          this.note(frequency, frequency * 0.8, 0.28, 0.075, 'triangle', i * 0.16);
        });
        break;
    }
  }

  note(frequency, endFrequency, duration, volume, wave, delay = 0) {
    const source = this.ctx.createOscillator();
    source.type = wave;
    const time = this.ctx.currentTime + delay;
    source.frequency.setValueAtTime(frequency, time);
    source.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    this.startVoice(source, duration, volume, delay);
  }

  noiseHit(duration, volume, cutoff) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    this.startVoice(source, duration, volume, 0, filter);
  }

  startVoice(source, duration, volume, delay = 0, filter = null) {
    while (this.voices.size >= MAX_VOICES) this.voices.values().next().value.stop();
    const gain = this.ctx.createGain();
    const time = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    if (filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(this.master);
    const cleanup = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    const voice = {
      stop() {
        try { source.stop(); } catch { /* Already stopped. */ }
        cleanup();
      },
    };
    this.voices.add(voice);
    source.onended = cleanup;
    source.start(time);
    source.stop(time + duration + 0.01);
  }

  dispose() {
    for (const voice of [...this.voices]) voice.stop();
    if (this.engine) {
      try { this.engine.stop(); } catch { /* Already stopped. */ }
      this.engine.disconnect();
    }
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.master?.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    this.ctx = null;
    this.engine = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.master = null;
    this.noise = null;
  }
}
