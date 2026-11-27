  // ---------- warstwy ----------
  const LYDEF = { podszewka: 'wiskoza', narzutka: 'szyfon', halka: 'tiul', usztywnienie: 'bawelna' };
  function renderLayers(d) {
    const dress = flags().dress, list = $('lyList'), add = $('lyAdd'), out = $('lyOut'); list.textContent = ''; add.textContent = ''; out.textContent = '';
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    state.layers.forEach((L, i) => {
      const row = el('div', null, 'ly'), hd = el('b', W.ROLES[L.role]);
      if (i) { const x = el('button', '✕', 'x'); x.setAttribute('aria-label', 'Usuń warstwę'); x.addEventListener('click', () => { state.layers.splice(i, 1); persist(); draw(true); }); hd.append(x); }
      row.append(hd);
      if (!i) { // tkaninę wierzchu wybiera się tylko w panelu Tkanina
        const ln = el('button', (FAB[state.fabric] || FAB.bawelna).name, 'lnk'); ln.title = 'Zmień w panelu Tkanina'; ln.addEventListener('click', () => goPanel('tkanina')); row.append(ln);
      } else {
        const fs = document.createElement('select'); fs.setAttribute('aria-label', 'Tkanina warstwy');
        for (const k in FAB) { const o = el('option', FAB[k].name); o.value = k; fs.append(o); }
        fs.value = L.fabric; fs.addEventListener('change', () => { L.fabric = fs.value; persist(); draw(); }); row.append(fs);
      }
      if (i && dress && (L.role === 'podszewka' || L.role === 'narzutka')) {
        const zs = document.createElement('select'); zs.setAttribute('aria-label', 'Zakres warstwy');
        for (const [v, t] of [['calosc', 'Cała sukienka'], ['gora', 'Tylko góra'], ['dol', 'Tylko dół']]) { const o = el('option', t); o.value = v; zs.append(o); }
        zs.value = L.zakres || 'calosc'; zs.addEventListener('change', () => { L.zakres = zs.value; persist(); draw(); }); row.append(zs);
      }
      if (i && L.role === 'narzutka' && !(dress && L.zakres === 'gora')) {
        const fo = document.createElement('select'); fo.setAttribute('aria-label', 'Forma dołu warstwy wierzchniej');
        for (const [v, t] of [['te_same', 'Dół: te same formy co spód'], ['marszczona', 'Dół: marszczony prostokąt'], ['polkole', 'Dół: z półkola'], ['kolo', 'Dół: z koła']]) { const o = el('option', t); o.value = v; fo.append(o); }
        fo.value = L.forma || 'te_same'; fo.addEventListener('change', () => { L.forma = fo.value; persist(); draw(true); }); row.append(fo);
      }
      list.append(row);
    });
    for (const r of ['podszewka', 'narzutka', 'halka', 'usztywnienie']) {
      if (r === 'usztywnienie' && !dress) continue;
      const b = el('button', W.ROLES[r]); b.addEventListener('click', () => { state.layers.push({ role: r, fabric: LYDEF[r], zakres: r === 'narzutka' ? 'dol' : 'calosc' }); persist(); draw(true); }); add.append(b);
    }
    if (!d.layers) { out.append(el('p', 'Dodaj warstwę, a pokażę, co kroić z której tkaniny i w jakiej kolejności szyć. To samo trafi do PDF.', 'note')); return; }
    out.append(el('h3', 'Krojenie'));
    for (const c of d.layers.cut) {
      const h4 = el('h4', c.name + ' '); h4.append(el('small', c.fabric + (c.scope ? ' · ' + c.scope : ''))); out.append(h4);
      const ul = el('ul'); c.items.forEach((t) => ul.append(el('li', t))); c.notes.forEach((t) => ul.append(el('li', t, 'n'))); out.append(ul);
    }
    out.append(el('h3', 'Kolejność szycia')); const ol = el('ol'); d.layers.steps.forEach((t) => ol.append(el('li', t))); out.append(ol);
  }

