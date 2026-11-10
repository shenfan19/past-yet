// Music and sound effects. Music is a piano piece read from a MIDI file and played by a small synthesiser built on Web Audio, so the
// page carries no sampled audio and no third party code. The effects are short tones made from the recipes in audio.yaml.
import { parseMidi } from './midi.js';

export function createAudio(D, settings) {
  const A = D.get('audio');
  const M = A.music;
  const V = A.voice;
  let ac = null;
  let musicBus = null;
  let sfxBus = null;
  const state = { playing: false, index: 0, loading: false, error: null };
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());
  let song = null;
  let startAt = 0;
  let cursor = 0;
  let timer = null;
  let nextTimer = null;
  const live = new Set();

  function context() {
    if (ac) return ac;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('no Web Audio');
    ac = new Ctor();
    musicBus = ac.createGain();
    sfxBus = ac.createGain();
    const lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = V.lowpass_hz;
    const dry = ac.createGain();
    const wet = ac.createGain();
    dry.gain.value = 1 - A.reverb.mix;
    wet.gain.value = A.reverb.mix;
    const conv = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * A.reverb.seconds);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, A.reverb.decay);
    }
    conv.buffer = ir;
    musicBus.connect(lowpass);
    lowpass.connect(dry); lowpass.connect(conv); conv.connect(wet);
    dry.connect(ac.destination); wet.connect(ac.destination);
    sfxBus.connect(ac.destination);
    applyVolumes();
    return ac;
  }
  function applyVolumes() {
    if (!ac) return;
    musicBus.gain.value = settings.get('music_volume') * V.master;
    sfxBus.gain.value = settings.get('sfx_volume');
  }
  settings.onChange(applyVolumes);

  // ---------- music ----------
  async function load(index) {
    const t = M.tracks[index];
    const res = await fetch(`${M.folder}/${t.file}`);
    if (!res.ok) throw new Error(t.file);
    return parseMidi(await res.arrayBuffer());
  }
  function voice(n, when, dur) {
    const hz = 440 * Math.pow(2, (n.note - 69) / 12);
    const decay = hz >= V.decay_split_hz ? V.decay_high_s : V.decay_low_s;
    const amp = Math.pow(n.vel / 127, V.velocity_curve) * 0.28;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(amp, when + V.attack_s);
    out.gain.exponentialRampToValueAtTime(0.0001, when + V.attack_s + decay);
    const stop = when + Math.max(dur, 0.05);
    out.gain.setTargetAtTime(0, stop, V.release_s / 4);
    out.connect(musicBus);
    const oscs = V.partials.map((p) => {
      const o = ac.createOscillator();
      o.type = p.wave;
      o.frequency.value = hz * p.ratio;
      const g = ac.createGain();
      g.gain.value = p.gain / V.partials.length;
      o.connect(g); g.connect(out);
      o.start(when);
      o.stop(stop + V.release_s * 2);
      return o;
    });
    const rec = { out, oscs };
    live.add(rec);
    oscs[0].onended = () => { live.delete(rec); out.disconnect(); };
  }
  function schedule() {
    if (!state.playing || !song) return;
    const now = ac.currentTime - startAt;
    const until = now + M.lookahead_s;
    while (cursor < song.notes.length && song.notes[cursor].start < until) {
      const n = song.notes[cursor++];
      if (n.start < now - 0.05) continue;
      voice(n, startAt + n.start, n.end - n.start);
    }
    if (cursor >= song.notes.length && now > song.duration + M.gap_s) next();
  }
  function silence() {
    clearInterval(timer); clearTimeout(nextTimer);
    timer = null; nextTimer = null;
    for (const r of live) { try { r.out.gain.cancelScheduledValues(0); r.out.gain.setTargetAtTime(0, ac.currentTime, 0.05); r.oscs.forEach((o) => o.stop(ac.currentTime + 0.3)); } catch (e) { /* already stopped */ } }
  }
  async function start(index) {
    const ctx = context();
    if (ctx.state === 'suspended') await ctx.resume();
    silence();
    state.index = (index + M.tracks.length) % M.tracks.length;
    state.loading = true; state.error = null; state.playing = true;
    notify();
    try {
      song = await load(state.index);
    } catch (e) {
      state.error = String(e.message || e); state.playing = false; state.loading = false; notify();
      return;
    }
    state.loading = false;
    if (!state.playing) { notify(); return; }
    startAt = ctx.currentTime + 0.2;
    cursor = 0;
    timer = setInterval(schedule, M.tick_ms);
    notify();
  }
  function next() { start(state.index + 1); }
  function prev() { start(state.index - 1); }
  function pause() {
    if (!state.playing) return;
    state.playing = false;
    if (ac) silence();
    song = null;
    notify();
  }
  function toggle() { if (state.playing) pause(); else start(state.index); }

  // ---------- effects ----------
  function sfx(name) {
    const r = A.sfx[name];
    if (!r || settings.get('sfx_volume') <= 0) return;
    let ctx;
    try { ctx = context(); } catch (e) { return; }
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const n of r.notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = r.wave;
      o.frequency.value = n.f;
      g.gain.setValueAtTime(0.0001, t0 + n.t);
      g.gain.linearRampToValueAtTime(r.gain, t0 + n.t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
      o.connect(g); g.connect(sfxBus);
      o.start(t0 + n.t);
      o.stop(t0 + n.t + n.d + 0.05);
    }
  }

  return {
    state, tracks: M.tracks, credit: M.credit,
    toggle, next, prev, pause, play: (i) => start(i), sfx,
    onChange: (fn) => listeners.add(fn),
  };
}
