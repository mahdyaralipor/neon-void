/* WebAudio synth engine — zero assets, all sounds synthesized. */

export class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  muted = false;
  musicVol = 0.8;
  sfxVol = 1;
  private intensity = 0; // 0..1 — driven by wave/danger, controls drums + brightness
  private lastShoot = 0;
  private lastPickup = 0;
  private lastCombo = 0;
  private lastHurt = 0;

  ensure(): void {
    try {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        return;
      }
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // gentle bus compressor — glues the mix, prevents harsh clipping in chaos
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.34;
      this.musicBus.connect(this.master);
      // shared noise buffer
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      /* audio unavailable */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    try {
      if (this.sfx) this.sfx.gain.setTargetAtTime(0.9 * sfx, this.ctx.currentTime, 0.03);
      if (this.musicBus) this.musicBus.gain.setTargetAtTime(0.34 * music, this.ctx.currentTime, 0.03);
    } catch {
      /* ignore */
    }
  }

  /** 0 = calm menu/explore, 1 = boss chaos. Called ~1/s by engine. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  /** dip music briefly so big moments (nuke/boss/victory) punch through */
  duck(sec = 0.8): void {
    if (!this.ctx || !this.musicBus) return;
    try {
      const t = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setTargetAtTime(0.34 * this.musicVol * 0.35, t, 0.05);
      this.musicBus.gain.setTargetAtTime(0.34 * this.musicVol, t + sec, 0.3);
    } catch {
      /* ignore */
    }
  }

  private tone(
    freqFrom: number,
    freqTo: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    when = 0,
  ): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freqFrom), t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  private noise(dur: number, vol: number, filterFreq: number, when = 0): void {
    if (!this.ctx || !this.sfx || !this.noiseBuf || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  shoot(): void {
    // throttle: full-auto at 4-14/s would be pure noise without this.
    // pitch wobble keeps it from sounding mechanical.
    const now = performance.now();
    if (now - this.lastShoot < 55) return;
    this.lastShoot = now;
    const base = 880 + Math.random() * 160;
    this.tone(base, base * 0.28, 0.08, 'square', 0.035 * this.sfxVol);
  }
  comboTick(combo: number): void {
    const now = performance.now();
    if (now - this.lastCombo < 120) return;
    this.lastCombo = now;
    const f = 500 + Math.min(900, combo * 18);
    this.tone(f, f * 1.5, 0.09, 'triangle', 0.07 * this.sfxVol);
  }
  heartbeat(): void {
    this.tone(70, 45, 0.16, 'sine', 0.22 * this.sfxVol);
    this.tone(65, 40, 0.14, 'sine', 0.18 * this.sfxVol, 0.18);
  }
  uiClick(): void {
    this.tone(700, 990, 0.06, 'triangle', 0.08 * this.sfxVol);
  }
  reroll(): void {
    this.noise(0.12, 0.1 * this.sfxVol, 4000);
    this.tone(400, 900, 0.12, 'triangle', 0.1 * this.sfxVol, 0.02);
  }
  enemyShoot(): void {
    this.tone(420, 180, 0.14, 'sawtooth', 0.05 * this.sfxVol);
  }
  sniperShot(): void {
    this.tone(1400, 200, 0.22, 'sawtooth', 0.12 * this.sfxVol);
    this.noise(0.12, 0.1 * this.sfxVol, 5000);
  }
  enemyDie(big = false): void {
    this.noise(big ? 0.4 : 0.2, (big ? 0.32 : 0.16) * this.sfxVol, big ? 900 : 2400);
    this.tone(big ? 300 : 480, 50, big ? 0.4 : 0.18, 'sawtooth', (big ? 0.2 : 0.09) * this.sfxVol);
  }
  eliteDie(): void {
    this.noise(0.5, 0.3 * this.sfxVol, 1200);
    this.tone(250, 40, 0.5, 'sawtooth', 0.22 * this.sfxVol);
    this.tone(500, 1000, 0.3, 'triangle', 0.14 * this.sfxVol, 0.08);
  }
  powerup(): void {
    this.tone(600, 1200, 0.12, 'sine', 0.14 * this.sfxVol);
    this.tone(900, 1800, 0.16, 'sine', 0.12 * this.sfxVol, 0.08);
  }
  nuke(): void {
    this.noise(1.0, 0.35 * this.sfxVol, 600);
    this.tone(150, 30, 1.0, 'sawtooth', 0.3 * this.sfxVol);
    this.tone(80, 400, 0.6, 'sine', 0.2 * this.sfxVol, 0.1);
  }
  nova(): void {
    this.noise(0.35, 0.2 * this.sfxVol, 1800);
    this.tone(200, 900, 0.3, 'triangle', 0.16 * this.sfxVol);
    this.tone(400, 1600, 0.22, 'sine', 0.1 * this.sfxVol, 0.05);
  }
  frost(): void {
    this.tone(1200, 300, 0.5, 'sine', 0.14 * this.sfxVol);
    this.tone(900, 2400, 0.4, 'triangle', 0.08 * this.sfxVol, 0.08);
  }
  secondWind(): void {
    this.tone(300, 1200, 0.5, 'sawtooth', 0.18 * this.sfxVol);
    this.tone(150, 600, 0.7, 'triangle', 0.16 * this.sfxVol, 0.12);
  }
  shieldUp(): void {
    this.tone(300, 900, 0.25, 'triangle', 0.14 * this.sfxVol);
  }
  shieldBreak(): void {
    this.tone(800, 150, 0.3, 'square', 0.16 * this.sfxVol);
    this.noise(0.25, 0.15 * this.sfxVol, 2000);
  }
  announce(): void {
    this.tone(520, 780, 0.14, 'triangle', 0.1 * this.sfxVol);
  }
  hurt(): void {
    const now = performance.now();
    if (now - this.lastHurt < 250) return; // stacked hits shouldn't stack pain
    this.lastHurt = now;
    this.tone(220, 60, 0.3, 'sawtooth', 0.24 * this.sfxVol);
    this.noise(0.25, 0.18 * this.sfxVol, 700);
  }
  dash(): void {
    this.noise(0.18, 0.12 * this.sfxVol, 3600);
    this.tone(300, 900, 0.14, 'sine', 0.1 * this.sfxVol);
  }
  pickup(): void {
    // throttle gem vacuum spam — pitch rises slightly with rapid pickups
    const now = performance.now();
    if (now - this.lastPickup < 60) return;
    this.lastPickup = now;
    const f = 740 + Math.random() * 220;
    this.tone(f, f * 2, 0.08, 'sine', 0.05 * this.sfxVol);
  }
  levelup(): void {
    this.tone(440, 880, 0.16, 'triangle', 0.16 * this.sfxVol);
    this.tone(660, 1320, 0.2, 'triangle', 0.14 * this.sfxVol, 0.09);
    this.tone(880, 1760, 0.26, 'sine', 0.12 * this.sfxVol, 0.18);
  }
  upgradePick(): void {
    this.tone(520, 1040, 0.18, 'triangle', 0.15 * this.sfxVol);
    this.noise(0.15, 0.06 * this.sfxVol, 5000);
  }
  waveStart(): void {
    this.tone(196, 392, 0.35, 'sawtooth', 0.12 * this.sfxVol);
    this.tone(294, 588, 0.35, 'square', 0.06 * this.sfxVol, 0.08);
  }
  bossSpawn(): void {
    this.tone(110, 40, 0.8, 'sawtooth', 0.3);
    this.noise(0.7, 0.2, 400);
    this.tone(55, 110, 0.7, 'square', 0.16, 0.1);
  }
  gameOver(): void {
    this.stopMusic();
    this.tone(400, 40, 1.4, 'sawtooth', 0.25);
    this.noise(1.1, 0.25, 500);
  }

  startMusic(): void {
    this.ensure();
    if (!this.ctx || this.musicTimer !== null) return;
    // dark synthwave: minor bassline + arp + kick/hat/snare.
    // intensity (0..1) adds drums, brighter filter, faster arp octave.
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4, 55, 55, 65.4, 49, 82.4, 73.4, 65.4, 49];
    const arp = [220, 261.6, 329.6, 440, 523.25, 440, 329.6, 261.6];
    this.step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus || this.muted) {
        this.step++;
        return;
      }
      try {
        const t0 = this.ctx.currentTime;
        const s = this.step;
        const inten = this.intensity;
        // --- bass ---
        const b = bass[s % bass.length];
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = b;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 280 + inten * 620;
        f.Q.value = 4;
        g.gain.setValueAtTime(0.15, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        o.start(t0);
        o.stop(t0 + 0.22);
        // --- arp (every other step, octave up when intense) ---
        if (s % 2 === 0) {
          const a = arp[(s / 2) % arp.length | 0] * (inten > 0.6 ? 2 : 1);
          const o2 = this.ctx.createOscillator();
          const g2 = this.ctx.createGain();
          o2.type = 'square';
          o2.frequency.value = a;
          g2.gain.setValueAtTime(0.028 + inten * 0.02, t0);
          g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
          o2.connect(g2);
          g2.connect(this.musicBus);
          o2.start(t0);
          o2.stop(t0 + 0.18);
        }
        // --- kick: four on the floor when intensity > 0.15 ---
        if (inten > 0.15 && s % 2 === 0) {
          const ko = this.ctx.createOscillator();
          const kg = this.ctx.createGain();
          ko.type = 'sine';
          ko.frequency.setValueAtTime(150, t0);
          ko.frequency.exponentialRampToValueAtTime(42, t0 + 0.11);
          kg.gain.setValueAtTime(0.5, t0);
          kg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
          ko.connect(kg);
          kg.connect(this.musicBus);
          ko.start(t0);
          ko.stop(t0 + 0.15);
        }
        // --- hat: offbeats, denser when intense ---
        if ((inten > 0.45 && s % 2 === 1) || (inten > 0.15 && s % 4 === 2)) {
          const src = this.ctx.createBufferSource();
          if (this.noiseBuf) {
            src.buffer = this.noiseBuf;
            src.loop = true;
            const hf = this.ctx.createBiquadFilter();
            hf.type = 'highpass';
            hf.frequency.value = 7000;
            const hg = this.ctx.createGain();
            hg.gain.setValueAtTime(0.06, t0);
            hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
            src.connect(hf);
            hf.connect(hg);
            hg.connect(this.musicBus);
            src.start(t0);
            src.stop(t0 + 0.07);
          }
        }
        // --- snare on 2 & 4 when hot ---
        if (inten > 0.55 && s % 4 === 2) {
          const src = this.ctx.createBufferSource();
          if (this.noiseBuf) {
            src.buffer = this.noiseBuf;
            src.loop = true;
            const sf = this.ctx.createBiquadFilter();
            sf.type = 'bandpass';
            sf.frequency.value = 1800;
            const sg = this.ctx.createGain();
            sg.gain.setValueAtTime(0.11, t0);
            sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
            src.connect(sf);
            sf.connect(sg);
            sg.connect(this.musicBus);
            src.start(t0);
            src.stop(t0 + 0.13);
          }
        }
      } catch {
        /* ignore */
      }
      this.step++;
    }, 195);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
