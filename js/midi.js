// Reads a standard MIDI file into a flat list of notes in seconds. Only what a piano piece needs is kept:
// note on and off, tempo changes and the sustain pedal. Everything else in the file is skipped.
export function parseMidi(buf) {
  const d = new DataView(buf);
  let p = 0;
  const u8 = () => d.getUint8(p++);
  const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
  const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
  const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  if (tag() !== 'MThd') throw new Error('not a MIDI file');
  u32();
  u16();
  const ntrk = u16();
  const division = u16();
  if (division & 0x8000) throw new Error('SMPTE time is not supported');

  const events = [];
  const tempos = [];
  for (let t = 0; t < ntrk; t++) {
    if (tag() !== 'MTrk') throw new Error('bad track');
    const len = u32();
    const end = p + len;
    let tick = 0, running = 0;
    while (p < end) {
      tick += vlq();
      let status = u8();
      if (status < 0x80) { p--; status = running; } else if (status < 0xf0) running = status;
      if (status === 0xff) {
        const type = u8();
        const n = vlq();
        if (type === 0x51 && n === 3) tempos.push({ tick, us: (u8() << 16) | (u8() << 8) | u8() });
        else p += n;
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else {
        const kind = status & 0xf0;
        const a = u8();
        const b = kind === 0xc0 || kind === 0xd0 ? 0 : u8();
        if (kind === 0x90 && b > 0) events.push({ tick, type: 'on', note: a, vel: b });
        else if (kind === 0x80 || kind === 0x90) events.push({ tick, type: 'off', note: a });
        else if (kind === 0xb0 && a === 64) events.push({ tick, type: 'pedal', down: b >= 64 });
      }
    }
    p = end;
  }

  // ticks to seconds through the tempo map
  tempos.sort((x, y) => x.tick - y.tick);
  const map = [{ tick: 0, sec: 0, us: tempos.length && tempos[0].tick === 0 ? tempos[0].us : 500000 }];
  for (const t of tempos) {
    const last = map[map.length - 1];
    if (t.tick === last.tick) { last.us = t.us; continue; }
    map.push({ tick: t.tick, sec: last.sec + ((t.tick - last.tick) * last.us) / (division * 1e6), us: t.us });
  }
  const toSec = (tick) => {
    let seg = map[0];
    for (const m of map) { if (m.tick <= tick) seg = m; else break; }
    return seg.sec + ((tick - seg.tick) * seg.us) / (division * 1e6);
  };

  events.sort((x, y) => x.tick - y.tick);
  // a note ends when it is released, or when the sustain pedal comes up if it was still down at the release
  const open = new Map();
  let pending = [];
  const notes = [];
  let down = false;
  for (const e of events) {
    const at = toSec(e.tick);
    if (e.type === 'on') {
      pending = pending.filter((n) => { if (n.note !== e.note) return true; n.end = at; notes.push(n); return false; });
      if (!open.has(e.note)) open.set(e.note, []);
      open.get(e.note).push({ note: e.note, vel: e.vel, start: at, end: at });
    } else if (e.type === 'off') {
      const list = open.get(e.note);
      if (!list || !list.length) continue;
      const n = list.shift();
      if (down) pending.push(n); else { n.end = at; notes.push(n); }
    } else if (down && !e.down) {
      for (const n of pending) { n.end = at; notes.push(n); }
      pending = [];
      down = false;
    } else if (!down && e.down) {
      down = true;
    }
  }
  const finish = toSec(events.length ? events[events.length - 1].tick : 0);
  for (const n of pending) { n.end = Math.max(n.end, finish); notes.push(n); }
  for (const list of open.values()) for (const n of list) { n.end = Math.max(n.end, finish); notes.push(n); }
  notes.sort((x, y) => x.start - y.start);
  const duration = notes.reduce((m, n) => Math.max(m, n.end), 0);
  return { notes, duration };
}
