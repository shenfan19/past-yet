// Shops, stock and antiques as framed lists. Chosen purchases sit in a cart pinned at the top of the frame.
import { firstSentence } from './narrate.js';

export function createShop(X) {
  const { D, ctx, T, U, esc, st, DEV, listbox, office } = X;
  const S_ = U.shop;
  // an item sells for exactly what it costs, in the currency of its shop, whenever the player likes
  const sell1 = (id) => D.get(`items.${id}.cost`);
  const s = () => st.shop;
  const tagOk = (tags) => !s().tag || tags.includes(s().tag);
  const textOk = (name, desc) => { const q = s().q.trim().toLowerCase(); return !q || (name + ' ' + desc).toLowerCase().includes(q); };
  const tagChips = (tags) => tags.map((t) => `<span class="chip">${esc(T.tags[t])}</span>`).join('');
  const hiddenChip = () => `<span class="chip warn">${U.enc.hidden}</span>`;
  const cart = () => st.cart;
  // each shop is paid in its own currency, funds for the modern shop and time energy for the future one
  const curOf = (shopId) => D.get('shops.shops.' + shopId + '.currency');
  const icon = (c) => D.get('config.ui.currency_icons.' + c);
  const bal = (c) => (c === 'energy' ? ctx.S().energy : ctx.S().funds);
  const cartTotal = (shopId) => Object.entries(cart()).reduce((a, [id, n]) => a + (D.get(`items.${id}.shop`) === shopId ? D.get(`items.${id}.cost`) * n : 0), 0);
  const oneLine = firstSentence;
  const COLON = U.fmt.colon, SEP = U.fmt.sep;

  // one row is one line: the name, then the description in a column of its own, cut short with the whole text in the tooltip
  const nameCell = (kind, id, name, tip, extra = '') => `<span class="nowrap">${X.wl(kind + ':' + id, name, tip)}${extra}</span>`;
  const descCell = (desc) => `<div class="oneline muted"${X.tip(desc)}>${esc(oneLine(desc))}</div>`;
  const itemTip = (id) => {
    const it = D.get('items.' + id);
    return `${T.items[id].desc}\n${U.enc.weight} ${it.weight} · ${S_.buy_price} ${it.cost} · ${S_.sell_price} ${sell1(id)}\n${it.tags.map((t) => T.tags[t]).join(SEP)}`;
  };
  const stepper = (decAct, incAct, id, n, decOff, incOff) => `<span class="stepper"><button data-act="${decAct}" data-id="${id}" ${decOff ? 'disabled' : ''}>−</button><span class="n">${n}</span><button data-act="${incAct}" data-id="${id}" ${incOff ? 'disabled' : ''}>+</button></span>`;

  function shopBox(shopId) {
    const sh = D.get('shops.shops.' + shopId);
    const S = ctx.S();
    const ids = Object.keys(D.get('items')).filter((id) => {
      const it = D.get('items.' + id);
      return it.shop === shopId && tagOk(it.tags) && textOk(T.items[id].name, T.items[id].desc);
    });
    const rows = ids.map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id) }));
    const buyable = (it) => it.playable && sh.playable && !it.ip;
    const total = cartTotal(shopId);
    const cur = curOf(shopId);
    const foot = Object.keys(cart()).some((id) => D.get(`items.${id}.shop`) === shopId)
      ? `<span>${S_.total} <b>${total}</b> ${icon(cur)}</span> <button class="primary" data-act="cartbuy" data-id="${shopId}" ${total > bal(cur) ? 'disabled' : ''}>${S_.confirm}</button> <button class="ghost" data-act="cartclear">${S_.clear_cart}</button>` : '';
    return listbox.html({
      id: 'shop_' + shopId, rows, maxH: D.get('config.ui.box_h.shop'), pinned: (r) => (cart()[r.id] || 0) > 0, pinTitle: S_.cart, foot,
      cols: [
        { k: 'name', label: S_.col_name, w: '20%', val: (r) => r.name, cell: (r) => nameCell('items', r.id, r.name, itemTip(r.id), !buyable(r.it) && DEV ? ' ' + hiddenChip() : '') },
        { k: 'desc', label: S_.col_desc, w: '28%', cell: (r) => descCell(T.items[r.id].desc) },
        { k: 'tags', label: S_.col_tags, w: '16%', cell: (r) => `<span class="nowrap">${tagChips(r.it.tags)}</span>` },
        { k: 'price', label: S_.buy_price, w: '9%', cls: 'num', val: (r) => r.it.cost, cell: (r) => `${r.it.cost} ${icon(cur)}` },
        { k: 'stock', label: S_.stock, w: '8%', cls: 'num', val: (r) => S.inv[r.id] || 0, cell: (r) => S.inv[r.id] || 0 },
        { k: 'qty', label: S_.col_qty, w: '19%', cls: 'num', cell: (r) => (r.it.unlock_energy > S.energy ? `<span class="muted"${X.tip(S_.locked_tip)}>🔒 ${r.it.unlock_energy} ${icon('energy')}</span>` : buyable(r.it)
          ? stepper('cartdec', 'cartinc', r.id, cart()[r.id] || 0, !(cart()[r.id] > 0), total + r.it.cost * r.it.step > bal(cur))
          : `<span class="muted">${r.it.ip ? S_.ip_short : S_.planned}</span>`) },
      ],
    });
  }

  function invBox() {
    const S = ctx.S();
    const rows = Object.keys(D.get('items')).filter((id) => (S.inv[id] || 0) > 0 && tagOk(D.get('items.' + id).tags) && textOk(T.items[id].name, T.items[id].desc)).map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id) }));
    return listbox.html({
      id: 'inv', rows, maxH: D.get('config.ui.box_h.inv'), empty: S_.inv_empty,
      cols: [
        { k: 'name', label: S_.col_name, w: '24%', val: (r) => r.name, cell: (r) => nameCell('items', r.id, r.name, itemTip(r.id)) },
        { k: 'desc', label: S_.col_desc, w: '38%', cell: (r) => descCell(T.items[r.id].desc) },
        { k: 'stock', label: S_.stock, w: '9%', cls: 'num', val: (r) => S.inv[r.id], cell: (r) => S.inv[r.id] },
        { k: 'sell', label: S_.sell_price, w: '12%', cls: 'num', val: (r) => sell1(r.id), cell: (r) => `${sell1(r.id)} ${icon(curOf(r.it.shop))}` },
        { k: 'act', label: '', w: '17%', cls: 'num', cell: (r) => `<button data-act="shopsell" data-id="${r.id}">${S_.sell} ×${Math.min(r.it.step, S.inv[r.id])}</button>` },
      ],
    });
  }

  // An antique opens its place only while it is anchored. It cannot be released while someone is away there,
  // and the last anchored place cannot be released, so the office always has somewhere to send people.
  function releasable(id) {
    const S = ctx.S();
    const an = D.get('antiques.antiques.' + id);
    if (!an.era) return true;
    if (S.dispatches.some((d) => !d.claimed && d.eraId === an.era)) return false;
    return S.locks.some((x) => x !== id && D.get('antiques.antiques.' + x).era);
  }

  const copies = (id) => ctx.S().antiques.filter((x) => x === id).length;
  // a copy that is anchored is not for sale, the rest are
  const sellable = (id) => copies(id) - (ctx.S().locks.includes(id) ? 1 : 0) > 0;

  function antiqueBox() {
    const S = ctx.S();
    const ids = Object.keys(D.get('antiques.antiques')).filter((id) => {
      const an = D.get('antiques.antiques.' + id);
      return (DEV || S.antiques.includes(id)) && an.playable !== undefined && tagOk(an.tags) && textOk(T.antiques[id].name, T.antiques[id].desc);
    });
    const rows = ids.map((id) => ({ id, name: T.antiques[id].name, an: D.get('antiques.antiques.' + id), own: S.antiques.includes(id), n: copies(id), lock: S.locks.includes(id) }));
    return listbox.html({
      id: 'ants', rows, maxH: D.get('config.ui.box_h.ants'), empty: S_.antiques_empty,
      cols: [
        { k: 'name', label: S_.col_name, w: '22%', val: (r) => r.name, cell: (r) => nameCell('antiques', r.id, r.name, T.antiques[r.id].desc + '\n' + r.an.tags.map((t) => T.tags[t]).join(SEP), (DEV && !r.an.playable ? ' ' + hiddenChip() : '') + (r.lock ? ` <span class="chip">${S_.locked}</span>` : '')) },
        { k: 'desc', label: S_.col_desc, w: '26%', cell: (r) => descCell(T.antiques[r.id].desc) },
        { k: 'dest', label: U.dispatch.points_to, w: '16%', cell: (r) => esc(r.own || DEV ? (r.an.era ? T.eras[r.an.era].short : r.an.event ? T.catalog[r.an.event].place : U.dispatch.not_ready) : U.dispatch.unknown_dest) },
        { k: 'count', label: S_.copies, w: '6%', cls: 'num', val: (r) => r.n, cell: (r) => r.n },
        { k: 'sell', label: S_.sell_price, w: '9%', cls: 'num', val: (r) => r.an.price, cell: (r) => `${r.an.price} ${icon('funds')}` },
        { k: 'act', label: '', w: '21%', cls: 'num', cell: (r) => (r.own
          ? `<button data-act="antlock" data-id="${r.id}" ${r.lock && !releasable(r.id) ? 'disabled' : ''}${r.lock && !releasable(r.id) ? ' data-tip="' + esc(S_.keep_one) + '"' : ''}>${r.lock ? S_.unlock : S_.lock}</button> <button data-act="antsell" data-id="${r.id}" ${sellable(r.id) ? '' : 'disabled'}>${S_.sell}</button>`
          : '') },
      ],
    });
  }

  // The agency page: antiques, items, the two shops, the employees and the hiring offer. The employee blocks come from the page as they are.
  function html(extra) {
    const S = ctx.S();
    const present = new Set();
    for (const id of Object.keys(D.get('items'))) D.get('items.' + id).tags.forEach((t) => present.add(t));
    for (const id of Object.keys(D.get('antiques.antiques'))) D.get('antiques.antiques.' + id).tags.forEach((t) => present.add(t));
    const bar = `<details class="tagfold"><summary>${S_.tag_filter}${s().tag ? COLON + esc(T.tags[s().tag]) : ''}</summary><div class="tagbar"><button class="chipbtn ${s().tag ? '' : 'on'}" data-act="shoptag" data-id="">${S_.all_tags}</button>${[...present].map((t) => `<button class="chipbtn ${s().tag === t ? 'on' : ''}" data-act="shoptag" data-id="${t}">${esc(T.tags[t])}</button>`).join('')}</div></details>`;
    const future = `<p class="muted">${esc(S_.future.desc)}</p>${shopBox('future')}`;
    const spares = office.spareCount();
    const spareFund = [...new Set(S.antiques)].reduce((a, id) => a + (copies(id) - 1) * D.get('antiques.antiques.' + id).price, 0);
    // what comes in (the two shops and the hiring offer) and what is held (employees, goods, antiques), one tab at a time
    const parts = {
      modern: () => `<p class="muted">${esc(S_.modern.desc)}</p>${shopBox('modern')}`,
      future: () => future,
      hire: () => extra.hire,
      staff: () => extra.staff,
      inv: () => invBox(),
      ants: () => `<p class="muted">${S_.antiques_hint}</p><div class="row" style="margin-bottom:6px"><button data-act="sellspares" ${spares ? '' : 'disabled'}>${S_.sell_spares}${spares ? ` ×${spares} · ${spareFund} ${icon('funds')}` : ''}</button></div>${antiqueBox()}`,
    };
    const names = { modern: S_.modern.name, future: S_.future.name, hire: U.office.hire_title, staff: U.office.staff, inv: S_.inv_title, ants: S_.antiques_title };
    const groups = [[S_.group_buy, ['modern', 'future', 'hire']], [S_.group_own, ['staff', 'inv', 'ants']]];
    const sub = s().sub in parts ? s().sub : 'staff';
    const tabs = `<div class="subtabs">${groups.map(([label, ids]) => `<span class="tabgroup"><span class="grouplabel">${esc(label)}</span>${ids.map((id) => `<button class="${id === sub ? 'on' : ''}" data-act="shopsub" data-id="${id}">${esc(names[id])}</button>`).join('')}</span>`).join('')}</div>`;
    const filtered = ['modern', 'future', 'inv', 'ants'].includes(sub);
    return `
      ${tabs}
      ${filtered ? `<div class="row" style="margin-bottom:6px"><input id="shop-q" type="search" placeholder="${S_.filter_ph}" value="${esc(s().q)}" style="flex:1;min-width:200px"></div>${bar}` : ''}
      ${parts[sub]()}`;
  }

  function act(a, id) {
    const S = ctx.S();
    if (a === 'shoptag') { s().tag = id; return true; }
    if (a === 'shopsub') { s().sub = id; return true; }
    if (a === 'cartinc' || a === 'cartdec') {
      const it = D.get('items.' + id);
      const n = (cart()[id] || 0) + (a === 'cartinc' ? it.step : -it.step);
      if (it.unlock_energy > S.energy && a === 'cartinc') return true;
      if (n <= 0) delete cart()[id]; else if (cartTotal(it.shop) + it.cost * it.step <= bal(curOf(it.shop)) || a === 'cartdec') cart()[id] = n;
      return true;
    }
    if (a === 'cartclear') { st.cart = {}; return true; }
    if (a === 'cartbuy') {
      const cur = curOf(id);
      if (cartTotal(id) <= bal(cur)) {
        for (const [cid, n] of Object.entries(cart())) {
          const it = D.get('items.' + cid);
          if (it.shop !== id) continue;
          if (it.playable && !it.ip && D.get('shops.shops.' + it.shop).playable) {
            if (cur === 'energy') S.energy -= it.cost * n; else S.funds -= it.cost * n;
            S.inv[cid] = (S.inv[cid] || 0) + n;
          }
          delete cart()[cid];
        }
        ctx.save();
      }
      return true;
    }
    if (a === 'shopsell') {
      const it = D.get('items.' + id), n = Math.min(it.step, S.inv[id] || 0);
      if (n > 0) { if (curOf(it.shop) === 'energy') S.energy += sell1(id) * n; else S.funds += sell1(id) * n; S.inv[id] -= n; ctx.save(); }
      return true;
    }
    if (a === 'sellspares') { if (office.sellSpares()) return true; return false; }
    if (a === 'antsell') {
      const an = D.get('antiques.antiques.' + id);
      if (sellable(id)) { S.funds += an.price; S.antiques.splice(S.antiques.indexOf(id), 1); ctx.save(); }
      return true;
    }
    if (a === 'antlock') {
      if (S.antiques.includes(id)) {
        if (!S.locks.includes(id)) S.locks.push(id);
        else if (releasable(id)) S.locks = S.locks.filter((x) => x !== id);
        ctx.save();
      }
      return true;
    }
    return false;
  }
  function onInput(el) {
    if (el.id !== 'shop-q') return false;
    s().q = el.value;
    return true;
  }
  return { html, act, onInput };
}
