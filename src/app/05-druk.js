  // ---------- druk: wybór elementów, papier, zużycie tkaniny, dodatki ----------
  function fabricRows(d) {
    const rows = [], m = (v) => (Math.ceil(v / 10) / 10).toFixed(1).replace('.', ',') + ' m';
    const one = (label, pcs) => {
      if (!pcs.length) return; const u = W.usage(pcs, state.fabW);
      rows.push([label, u.len == null ? 'elementy szersze niż bela' : 'około ' + m(u.len), u.len == null ? 'trzeba sztukować albo wziąć szerszą tkaninę' : u.folded ? 'tkanina złożona na pół' : 'tkanina rozłożona płasko']);
    };
    if (d.layers) for (const L of state.layers) { const rn = W.ROLES[L.role].toLowerCase(); if (L.role === 'halka') continue; one(W.ROLES[L.role], d.pieces.filter((pc) => (d.layers.notes[pc.id] || []).includes(rn))); }
    else one('Tkanina wierzchnia', d.pieces);
    return rows;
  }
  function renderPrint(mo) {
    const d = mo.d, box = $('selList'); box.textContent = '';
    for (const pc of d.pieces) {
      const l = document.createElement('label'), c = document.createElement('input'), sm = document.createElement('small'); l.className = 'chk'; c.type = 'checkbox'; c.checked = !state.sel[pc.id];
      c.addEventListener('change', () => { if (c.checked) delete state.sel[pc.id]; else state.sel[pc.id] = 1; if (!d.pieces.some((q) => !state.sel[q.id])) { delete state.sel[pc.id]; say('Do druku musi zostać przynajmniej jeden element.'); } persist(); draw(true); });
      sm.textContent = Math.round(pc.box.x1 - pc.box.x0) + ' × ' + Math.round(pc.box.y1 - pc.box.y0) + ' cm';
      l.append(c, pc.name.charAt(0) + pc.name.slice(1).toLowerCase(), sm); box.appendChild(l);
    }
    const dl2 = (id, rows) => { const el = $(id); el.textContent = ''; for (const r of rows) { const a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = r[0]; b.textContent = r[1]; if (r[2]) { const s2 = document.createElement('small'); s2.textContent = r[2]; b.appendChild(s2); } el.append(a, b); } };
    dl2('usage', fabricRows(d)); dl2('notions', d.notions || []);
  }
  $('paper').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.paper = b.dataset.pp; fillForm(); persist(); draw(true); }));
  $('fabW').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.fabW = +b.dataset.fw; fillForm(); persist(); draw(); }));
  $('packT').addEventListener('change', () => { state.pack = $('packT').checked; persist(); draw(true); });

  const cv = $('cv');
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), k = Math.exp(e.deltaY * 0.0015), nw = Math.min(900, Math.max(8, vb.w * k)), kk = nw / vb.w;
    const px = vb.x + ((e.clientX - r.left) / r.width) * vb.w, py = vb.y + ((e.clientY - r.top) / r.height) * vb.h;
    vb = { x: px - (px - vb.x) * kk, y: py - (py - vb.y) * kk, w: nw, h: vb.h * kk }; applyVb();
  }, { passive: false });
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; const r = cv.getBoundingClientRect(); vb.x = drag.vx - ((e.clientX - drag.x) / r.width) * vb.w; vb.y = drag.vy - ((e.clientY - drag.y) / r.height) * vb.h; applyVb(); });
  const endDrag = () => { drag = null; cv.classList.remove('drag'); };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  $('fitV').addEventListener('click', () => { if (state.view === '3d') { cam.yaw = 0; cam.pitch = 0.06; } draw(true); });
  $('zoom').addEventListener('input', () => {
    const z = Math.pow(2, $('zoom').value / 100);
    if (state.view === '3d') { cam.dist = fitDist / z; paint3d(); showZoom(); return; }
    const r = cv.getBoundingClientRect(), nw = r.width / (fitScale * z), k = nw / vb.w, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    vb = { x: cx - (vb.w * k) / 2, y: cy - (vb.h * k) / 2, w: nw, h: vb.h * k }; applyVb();
  });
  // panele i motyw
  const FLOW = ['modelka', 'fason', 'wymiary', 'tkanina', 'druk'];
  const PT = { proj: 'Projekty', druk: 'Krojenie i druk', insp: 'Inspiracja', tkanina: 'Tkanina', fason: 'Fason', wymiary: 'Dopasowanie', modelka: 'Modelka' };
  function cardUi() { const none = state.style === 'pusty'; $('card').toggleAttribute('hidden', !state.card || none); $('cardBtn').toggleAttribute('hidden', state.card || none); }
  function layoutUi() {
    const refOff = state.ref ? ['fason', 'wymiary', 'druk'] : []; if (refOff.includes(state.panel)) state.panel = '';
    document.querySelectorAll('nav [data-panel]').forEach((b) => (/** @type {HTMLElement} */ (b).hidden = refOff.includes(/** @type {HTMLElement} */ (b).dataset.panel)));
    $('panel').toggleAttribute('hidden', !state.panel);
    if (state.panel && !PT[state.panel]) state.panel = 'druk'; // starsze zapisy: Warstwy i Zapasy na szwy są teraz w jednym panelu
    if (state.panel) { $('panelT').textContent = PT[state.panel]; document.querySelectorAll('[data-sec]').forEach((el) => (el.hidden = el.dataset.sec !== state.panel)); }
    document.querySelectorAll('nav [data-panel]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.panel === state.panel));
    { const fl = FLOW.filter((x) => !refOff.includes(x)), k = fl.indexOf(state.panel), nx = k >= 0 && k < fl.length - 1 ? fl[k + 1] : null; $('panelF').hidden = !nx; $('next').textContent = nx ? 'Dalej: ' + PT[nx].toLowerCase() : ''; $('next').dataset.to = nx || ''; }
    cardUi();
    const ins = insets(), gl0 = ins.l > 12 ? ins.l - 12 : 0, gr0 = ins.r > 12 ? ins.r - 12 : 0; $('gl').style.left = gl0 + 'px'; $('gl').style.width = 'calc(100% - ' + (gl0 + gr0) + 'px)';
    $('mini').style.left = ins.l + 'px';

    document.documentElement.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
  }
  function goPanel(id) { if (id && !$('home').hidden) $('home').hidden = true; state.panel = id; if (id === 'tkanina' && state.view !== '3d') { layoutUi(); setView('3d'); return; } if (id === 'druk' && state.view !== '2d') { layoutUi(); setView('2d'); return; } layoutUi(); persist(true); draw(true); }
  document.querySelectorAll('nav [data-panel]').forEach((b) => b.addEventListener('click', () => goPanel(state.panel === b.dataset.panel && $('home').hidden ? null : b.dataset.panel)));
  $('next').addEventListener('click', () => { if ($('next').dataset.to) { goPanel($('next').dataset.to); document.querySelector('#panel .body').scrollTop = 0; } });
  $('views').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { cam.yaw = +b.dataset.yaw; cam.pitch = 0.06; paint3d(); }));
  $('panelX').addEventListener('click', () => { state.panel = null; layoutUi(); persist(); draw(true); });
  $('cardX').addEventListener('click', () => { state.card = false; layoutUi(); persist(); draw(true); });
  $('cardBtn').addEventListener('click', () => { state.card = true; layoutUi(); persist(); draw(true); });
  $('theme').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; layoutUi(); persist(); });
  window.addEventListener('resize', () => draw(true));

