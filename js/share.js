// The share card of one finished trip, shown in a pop-up over the page. It is drawn on a canvas from the record of the report: the line of the employee,
// how it ended, and a few lines of the record, the deeds that won a star, the lines written for this employee and the history around them. No curves and no tables.
// The site address and a QR code from a matrix shipped with the game are on it. Nothing is uploaded and no outside service is asked.
import { staffName, isoDateLabel } from './narrate.js';

export function createShare(X) {
  const { D, ctx, T, U, esc } = X;
  const H = U.share;
  const C = D.get('config.share');
  const CV = C.canvas;
  const QR = D.get('share_qr');
  const logo = new Image();
  logo.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(D.get('logo'));

  const dispatch = (id) => ctx.S().dispatches.find((d) => d.id === id);
  const hookOf = (n) => H.hooks[n % H.hooks.length];

  // The lines of the record the card keeps: every line that won a star, then the lines written for this employee, then the lines of history by importance,
  // up to config.share.record_lines, told in the order they happened.
  function pickLines(timeline) {
    const N = C.record_lines;
    const rank = (t) => (t.star ? 0 : t.own ? 1 : t.tag === 'history' ? 2 : 3);
    const chosen = timeline.map((t, i) => ({ t, i })).filter(({ t }) => rank(t) < 3)
      .sort((a, b) => rank(a.t) - rank(b.t) || (b.t.importance || 0) - (a.t.importance || 0) || a.i - b.i).slice(0, N).sort((a, b) => a.i - b.i);
    return chosen.map(({ t }) => ({ text: t.text, star: !!t.star, history: t.tag === 'history' }));
  }
  // what the card says about a trip: its name, how it ended, the story told in a few lines, and the hook
  // the line the employee says, as the report shows it under the title
  const said = (d) => { const x = ctx.backend.sayingOf(d); return x ? [U.fmt.quote.replace('{x}', x) + ' ' + U.fmt.dash + staffName(D, d.spec.staffId)] : []; };
  // the echo of a trip, 5.15 of the story outline: the recorded line of the person and who said it, when and where
  const echoOf = (d) => {
    const id = d.echo ?? ctx.backend.echoOf(d);
    const q = id && T.quotes[id];
    const Q = id && D.get('quotes.quotes')[id];
    return q && Q ? { quote: U.fmt.quote.replace('{x}', q.quote), cite: U.report.echo_cite.replace('{who}', q.who).replace('{date}', isoDateLabel(D, Q.date)).replace('{occasion}', q.occasion) } : null;
  };
  function parts(d) {
    const R = d.report;
    const who = staffName(D, d.spec.staffId);
    const index = ctx.S().dispatches.indexOf(d);
    if (d.evacuation) return {
      name: d.light ? T.catalog[d.eraId].name : T.eras[d.eraId].name,
      outcome: U.report.evacuated,
      text: [U.report.evacuation_text.replace('{day}', String(d.evacuation.day))],
      points: [], hook: hookOf(index),
    };
    if (R.journey?.accepted === false) return {
      name: d.light ? T.catalog[d.eraId].name : T.eras[d.eraId].name,
      outcome: U.report.stamp[ctx.backend.stampOf(d)],
      text: [U.report.participation.share_missed.replace('{staff}', who)],
      echo: echoOf(d),
      points: [], hook: hookOf(index),
    };
    if (d.light) {
      const c = T.catalog[d.eraId];
      const ev = D.get('catalog.events').find((x) => x.id === d.eraId);
      const o = R.outcomeId;
      return {
        name: c.name,
        outcome: U.report.stamp[ctx.backend.stampOf(d)],
        text: R.timeline ? said(d) : [...said(d), U.light.summary[o].replace('{staff}', who).replace('{place}', c.place).replace('{figure}', c.figure)],
        lines: R.timeline ? pickLines(R.timeline) : null,
        echo: echoOf(d),
        points: R.points.map((p) => ({ hit: p.hit, redeem: !!p.redeem, text: ev.scene ? c.points[p.id] : U.light.points[p.id] })),
        hook: hookOf(index),
      };
    }
    return {
      name: T.eras[d.eraId].name,
      outcome: U.report.stamp[ctx.backend.stampOf(d)],
      text: [...said(d), R.summary],
      lines: pickLines(R.timeline),
      echo: echoOf(d),
      hook: hookOf(index),
    };
  }
  const caption = (d) => { const p = parts(d); return [H.result.replace('{staff}', staffName(D, d.spec.staffId)).replace('{era}', p.name).replace('{outcome}', p.outcome), ...(p.echo ? [p.echo.quote + ' ' + p.echo.cite] : []), ...p.text, ...(p.lines || []).map((l) => (l.star ? '★ ' : '') + l.text), p.hook, QR.url].join(' '); };

  // the pop-up body: the card and what can be done with it
  function html(d) {
    return `<div class="share">
      <h3>${esc(H.title)}</h3>
      <p class="muted">${esc(H.intro)}</p>
      <canvas id="sharecanvas" width="${CV.w}" height="${CV.h}" aria-label="${esc(caption(d))}"></canvas>
      <div class="row" style="margin:12px 0"><button class="primary" data-act="sharesave">${esc(H.save)}</button><button data-act="sharecopy">${esc(H.copy)}</button>${navigator.share ? `<button data-act="sharenative">${esc(H.send)}</button>` : ''}<span class="muted" id="sharemsg"></span></div>
    </div>`;
  }

  // CJK characters break anywhere, other text breaks between words
  function wrap(g, text, maxW) {
    const tokens = text.match(/[　-〿぀-ヿ㐀-鿿＀-￯]|[^\s　-〿぀-ヿ㐀-鿿＀-￯]+\s*/g) || [];
    const lines = [];
    let line = '';
    for (const t of tokens) {
      // closing punctuation never starts a line
      if (line && !/^[，。！？；：、）」』”,.!?;:)]/.test(t) && g.measureText((line + t).trimEnd()).width > maxW) { lines.push(line.trimEnd()); line = t.trimStart(); } else line += t;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  }
  // at most n lines, the last one ending in an ellipsis when something was left out
  const cut = (lines, n) => (lines.length <= n ? lines : [...lines.slice(0, n - 1), lines[n - 1].replace(/[\s，。,.;；、]*$/, '') + '…']);

  function draw(d) {
    const cv = document.getElementById('sharecanvas');
    if (!cv) return;
    const g = cv.getContext('2d');
    const K = C.colors;
    const p = parts(d);
    const serif = '"Noto Serif SC", "Songti SC", SimSun, serif';
    const sans = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
    g.fillStyle = K.bg; g.fillRect(0, 0, CV.w, CV.h);
    g.strokeStyle = K.stamp; g.lineWidth = CV.border; g.strokeRect(CV.border / 2, CV.border / 2, CV.w - CV.border, CV.h - CV.border);

    // logo and title; the card is drawn again once the logo has loaded
    const L = CV.logo_px;
    if (logo.complete && logo.naturalWidth) g.drawImage(logo, CV.pad, CV.pad, L, L);
    else logo.addEventListener('load', () => draw(d), { once: true });
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = K.ink; g.font = `700 ${CV.title_px}px ${serif}`;
    g.fillText(H.card_title, CV.pad + L + 20, CV.pad + L / 2 + CV.title_px * 0.35);

    // text column on the left, the QR code on the right
    const qrX = CV.w - CV.pad - CV.qr_size;
    const colW = qrX - CV.pad - 40;
    let y = CV.pad + L + 56;
    g.fillStyle = K.ink; g.font = `700 ${CV.event_px}px ${serif}`;
    for (const l of cut(wrap(g, p.name, colW), 2)) { g.fillText(l, CV.pad, y); y += CV.event_px * CV.line_gap; }
    g.fillStyle = K.stamp; g.font = `700 ${CV.body_px}px ${sans}`;
    // the empty stars are those the place has and this trip did not win; a place may have from one to five
    const stars = '★'.repeat(d.stars || 0) + '☆'.repeat(Math.max(0, ctx.backend.maxStars(d.eraId) - (d.stars || 0)));
    g.fillText(`${p.outcome}  ${stars}`, CV.pad, y); y += CV.body_px * CV.line_gap + 6;
    g.fillStyle = K.ink; g.font = `400 ${CV.body_px - 2}px ${sans}`;
    const room = Math.floor((CV.vis_y - 50 - y) / ((CV.body_px - 2) * CV.line_gap));
    const body = [];
    for (const t of p.text) body.push(...wrap(g, t, colW));
    for (const l of cut(body, Math.max(2, room))) { g.fillText(l, CV.pad, y); y += (CV.body_px - 2) * CV.line_gap; }

    // QR code with its quiet zone, then the address
    const rows = QR.rows;
    const cells = rows.length + CV.qr_quiet * 2;
    const qrY = CV.pad + 8;
    g.fillStyle = K.qr_bg; g.fillRect(qrX, qrY, CV.qr_size, CV.qr_size);
    g.fillStyle = K.ink;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] !== '1') continue;
        const x0 = Math.round(((c + CV.qr_quiet) * CV.qr_size) / cells);
        const y0 = Math.round(((r + CV.qr_quiet) * CV.qr_size) / cells);
        g.fillRect(qrX + x0, qrY + y0, Math.round(((c + CV.qr_quiet + 1) * CV.qr_size) / cells) - x0, Math.round(((r + CV.qr_quiet + 1) * CV.qr_size) / cells) - y0);
      }
    }
    g.fillStyle = K.ink; g.font = `600 ${CV.small_px + 2}px ${sans}`; g.textAlign = 'center';
    g.fillText(QR.url.replace(/^https?:\/\//, ''), qrX + CV.qr_size / 2, qrY + CV.qr_size + CV.small_px + 14);
    g.textAlign = 'left';

    // the middle band: a few lines of the record, the ones that won a star marked; a report written before it kept a record shows its sync points
    const vy = CV.vis_y;
    let py = vy + 30;
    const bandEnd = CV.h - CV.pad - 140;
    // the echo first, the recorded line of the person, large and centred, who said it below; the record fills the band under it
    if (p.echo) {
      g.textAlign = 'center';
      g.fillStyle = K.ink; g.font = `700 ${CV.echo_px}px ${serif}`;
      py += CV.echo_px * 0.4;
      for (const l of cut(wrap(g, p.echo.quote, CV.w - CV.pad * 4), CV.echo_lines)) { g.fillText(l, CV.w / 2, py); py += CV.echo_px * CV.line_gap; }
      g.fillStyle = K.ink2; g.font = `400 ${CV.small_px + 2}px ${sans}`;
      g.fillText(p.echo.cite, CV.w / 2, py); py += (CV.small_px + 2) * CV.line_gap + 18;
      g.textAlign = 'left';
    }
    if (p.lines) {
      g.font = `400 ${CV.body_px - 2}px ${sans}`;
      for (const l of p.lines) {
        if (py > bandEnd) break;
        g.fillStyle = l.star ? K.stamp : l.history ? K.ink2 : K.ink;
        for (const [i, t] of cut(wrap(g, (l.star ? '★ ' : '') + l.text, CV.w - CV.pad * 2), 2).entries()) { g.fillText(i ? '    ' + t : t, CV.pad, py); py += (CV.body_px - 2) * CV.line_gap; }
        py += 6;
      }
    } else {
      g.font = `400 ${CV.body_px}px ${sans}`;
      for (const pt of p.points || []) {
        g.fillStyle = pt.hit ? K.stamp : K.ink2;
        const mark = pt.redeem ? (pt.hit ? '♥' : '♡') : (pt.hit ? '★' : '☆');
        for (const [i, l] of cut(wrap(g, `${mark} ${pt.text}`, CV.w - CV.pad * 2), 2).entries()) { g.fillText(i ? '    ' + l : l, CV.pad, py); py += CV.body_px * CV.line_gap; }
        py += 6;
      }
    }

    // the hook and the disclaimer sit along the bottom
    g.strokeStyle = K.line; g.lineWidth = 2;
    g.font = `italic 400 ${CV.body_px - 2}px ${serif}`;
    const hook = cut(wrap(g, p.hook, CV.w - CV.pad * 2), 2);
    g.font = `400 ${CV.small_px}px ${sans}`;
    const lines = wrap(g, H.disclaimer, CV.w - CV.pad * 2);
    const dy = CV.h - CV.pad + 8 - lines.length * CV.small_px * CV.line_gap;
    g.beginPath(); g.moveTo(CV.pad, dy - CV.small_px * 1.4); g.lineTo(CV.w - CV.pad, dy - CV.small_px * 1.4); g.stroke();
    g.fillStyle = K.ink2; g.font = `italic 400 ${CV.body_px - 2}px ${serif}`;
    hook.forEach((l, i) => g.fillText(l, CV.pad, dy - CV.small_px * 1.4 - 14 - (hook.length - 1 - i) * (CV.body_px - 2) * CV.line_gap));
    g.font = `400 ${CV.small_px}px ${sans}`;
    lines.forEach((l, i) => g.fillText(l, CV.pad, dy + i * CV.small_px * CV.line_gap));
  }

  function save() {
    const cv = document.getElementById('sharecanvas');
    cv.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = C.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }
  async function copy(d) {
    const msg = document.getElementById('sharemsg');
    try { await navigator.clipboard.writeText(caption(d)); if (msg) msg.textContent = H.copied; } catch (e) { if (msg) msg.textContent = caption(d); }
  }
  async function send(d) {
    const cv = document.getElementById('sharecanvas');
    try {
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const file = new File([blob], C.file_name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: caption(d) });
      else await navigator.share({ text: caption(d), url: QR.url });
    } catch (e) { /* the player closed the share sheet */ }
  }
  return { html, draw, save, copy, send, dispatch, caption };
}
