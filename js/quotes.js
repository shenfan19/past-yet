// A line from a scientist or a historian in the header, changed at random intervals. The pieces are cards in cards/quotes.
export function createQuotes(D, el) {
  const Q = D.get('config.ui.quote');
  const list = Object.values(D.get('text.quotes'));
  let last = -1;
  let timer = null;
  const wait = () => (Q.interval_min_s + Math.random() * (Q.interval_max_s - Q.interval_min_s)) * 1000;
  function show() {
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === last);
    last = i;
    const q = list[i];
    el.classList.add('fade');
    setTimeout(() => {
      el.textContent = `${q.quote} · ${q.who}`;
      el.title = `${q.quote} · ${q.who}`;
      el.classList.remove('fade');
    }, Q.fade_ms);
  }
  function next() {
    if (!document.hidden) show();
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
