/* ==========================================================================
   Turbo Times! — Zero-Dependency Web Audio Arcade Synth
   Ascending pentatonic streak chimes, combo fanfares, shield save & ticks
   ========================================================================== */

class ArcadeAudio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('turbotimes_muted') === '1';
    // Major pentatonic ladder (C5 up to E6) so streaks climb musically!
    this.streakScale = [
      523.25, // C5
      587.33, // D5
      659.25, // E5
      783.99, // G5
      880.00, // A5
      1046.50, // C6
      1174.66, // D6
      1318.51  // E6
    ];
  }

  ensureContext() {
    if (this.muted) return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('turbotimes_muted', this.muted ? '1' : '0');
    if (!this.muted) {
      this.playTap();
    }
    return this.muted;
  }

  tone(freq, duration = 0.12, type = 'triangle', gainPeak = 0.18, delay = 0) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playTap() {
    this.tone(440, 0.055, 'sine', 0.1);
  }

  playCorrect(streak = 1) {
    const idx = Math.min(Math.max(0, streak - 1), this.streakScale.length - 1);
    const baseFreq = this.streakScale[idx];
    this.tone(baseFreq, 0.13, 'triangle', 0.2, 0);
    this.tone(baseFreq * 1.25, 0.18, 'sine', 0.16, 0.055);

    // Extra sparkle arpeggio on milestone streaks (5, 10, 15, 20...)
    if (streak > 0 && streak % 5 === 0) {
      this.tone(783.99, 0.12, 'triangle', 0.18, 0.1);
      this.tone(1046.50, 0.14, 'triangle', 0.2, 0.17);
      this.tone(1318.51, 0.26, 'sine', 0.22, 0.24);
    }
  }

  playShieldBlock() {
    this.tone(659.25, 0.12, 'sine', 0.2, 0);
    this.tone(880.00, 0.22, 'triangle', 0.2, 0.07);
  }

  playWrong() {
    this.tone(240, 0.14, 'sawtooth', 0.09, 0);
    this.tone(195, 0.2, 'triangle', 0.12, 0.09);
  }

  playTick(urgent = false) {
    this.tone(urgent ? 880 : 620, 0.045, 'sine', urgent ? 0.11 : 0.06, 0);
  }

  playVictory(isNewRecord = false) {
    const notes = isNewRecord
      ? [523.25, 659.25, 783.99, 1046.50, 1318.51]
      : [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((n, i) => {
      this.tone(n, i === notes.length - 1 ? 0.38 : 0.14, 'triangle', 0.2, i * 0.085);
    });
  }
}

window.arcadeAudio = new ArcadeAudio();
