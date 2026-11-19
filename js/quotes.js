// Title lines are separate from the historical quotes and echoes.
export function createHeaderLines(D, el) {
  const Q = D.get('config.ui.quote');
  const list = D.get('text.ui.header_lines');
  let last = -1;
  let timer = null;
  const wait = () => (Q.interval_min_s + Math.random() * (Q.interval_max_s - Q.interval_min_s)) * 1000;
  function show() {
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === last);
    last = i;
    const { line, source, url } = list[i];
    el.classList.add('fade');
    setTimeout(() => {
      el.textContent = line;
      if (source) {
        const citation = document.createElement('a');
        citation.className = 'quote-source';
        citation.href = url;
        citation.target = '_blank';
        citation.rel = 'noopener noreferrer';
        citation.textContent = `— ${source}`;
        el.append(' ', citation);
      }
      el.classList.remove('fade');
    }, Q.fade_ms);
  }
  function next() {
    if (!document.hidden && !el.contains(document.activeElement)) show();
    timer = setTimeout(next, wait());
  }
  return {
    start() {
      if (!list.length) return;
      el.textContent = '';
      show();
      timer = setTimeout(next, wait());
    },
    stop() { clearTimeout(timer); },
  };
}
export function echoSources(D, ids, esc) {
  if (!ids?.length) return '';
  const rows = ids.map((id) => {
    const citation = D.get('enc_text.refs.' + id);
    const url = citation.match(/https?:\/\/[^\s<>"']+/u)?.[0];
    return `<li>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(citation)}</a>` : esc(citation)}</li>`;
  }).join('');
  return `<details class="echo-sources"><summary>${esc(D.get('text.ui.enc.refs'))}</summary><ul>${rows}</ul></details>`;
}
