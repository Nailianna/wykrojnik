  // ---------- pulpit: projekty w toku i gotowe, modelki, ostatnie inspiracje ----------
  function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }
  function snapKeyOld(sn) { const o = Object.assign({}, sn); delete o.printImg; return hashStr(JSON.stringify(o)); }
  function snapKey(sn) { const o = Object.assign({}, sn); delete o.printImg; const mo = state.profiles.find((x) => x.id === sn.active); o.model = mo ? [mo.og, mo.ot, mo.ob, mo.wb, mo.wzrost, mo.opx, mo.adv] : null; return hashStr(JSON.stringify(o)); }
  const projDone = (pr) => !!pr.exported && (pr.expV === 2 ? pr.expKey === snapKey(pr.snap) : pr.expKey === snapKeyOld(pr.snap));
  function ago(ts) { const d = Math.floor((Date.now() - (ts || 0)) / 86400000); return !ts ? '' : d <= 0 ? 'dzisiaj' : d === 1 ? 'wczoraj' : d < 14 ? d + ' dni temu' : new Date(ts).toLocaleDateString('pl-PL'); }
  function projThumb(sn) {
    try {
      const mo = state.profiles.find((x) => x.id === sn.active) || state.profiles[0], sid = W.STYLES.some((s) => s.id === sn.style) ? sn.style : 'sk_prosta';
      if (sn.style === 'pusty') return null;
      const d = sn.style === 'import' && sn.imp ? impDraft(sn.imp, mo) : W.draft(mo, Object.assign({}, DEF_P, sn.p, { fac: 'brak', layers: null, extras: [] }), sid), lay = W.layout(d.pieces, 3); let dd = '';
      for (const q of lay.prims) if (q.t === 'poly' && q.s === 'cut') dd += 'M' + q.pts.map((a) => a[0].toFixed(1) + ' ' + a[1].toFixed(1)).join('L') + 'Z';
      const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), pa = document.createElementNS(NS, 'path'); svg.setAttribute('viewBox', '0 0 ' + lay.w.toFixed(1) + ' ' + lay.h.toFixed(1)); svg.setAttribute('aria-hidden', 'true'); pa.setAttribute('d', dd); svg.append(pa);
      return { svg, title: d.title, model: mo.name || 'Bez imienia' };
    } catch (e) { return null; }
  }
  // instalacja: przycisk na pulpicie, gdy da się zainstalować, a w pozostałych przypadkach zdanie, skąd to zrobić
  let instState = '';
  function instFill() {
    const ok = instState === 'available'; $('hInst').hidden = !ok;
    $('hInstNote').hidden = ok || instState === 'installed' || !instState; $('hInstNote').textContent = 'Żeby zainstalować Wykrojnik jako aplikację, otwórz go w aplikacji Claude na Macu. Tutaj działa jako strona.';
  }
  function homeFill() {
    instFill();
    $('hFoot').textContent = 'Wykrojnik ' + BUILD.v + ' (build ' + BUILD.n + '), ' + BUILD.date;
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    const list = state.projects.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)), done = list.filter(projDone), open = list.filter((x) => !projDone(x));
    $('hStat').textContent = (open.length === 1 ? '1 projekt w toku' : open.length + ' projektów w toku') + ' · ' + (done.length === 1 ? '1 gotowy wykrój' : done.length + ' gotowych wykrojów') + ' · ' + (state.profiles.length === 1 ? '1 modelka' : state.profiles.length + ' modelek');
    const card = (pr) => {
      const b = el('button', null, 'hcard'), th = el('div', null, 'hth'), body = el('div', null, 'hb'), t = projThumb(pr.snap); if (t) th.append(t.svg);
      body.append(el('b', pr.name || 'Bez nazwy'), el('small', t ? t.title + ' · ' + t.model : ''), el('small', projDone(pr) ? 'PDF zapisany ' + ago(pr.exported) : 'Zmieniany ' + ago(pr.updated)));
      body.append(projDone(pr) ? el('span', 'Gotowy do szycia', 'hchip ok') : pr.exported ? el('span', 'Zmieniony po zapisie PDF', 'hchip ch') : el('span', 'W toku', 'hchip'));
      b.append(th, body); b.addEventListener('click', () => { if (pr.id !== state.proj) openProj(pr.id); homeShow(false); }); return b;
    };
    $('hOpen').textContent = ''; open.forEach((pr) => $('hOpen').append(card(pr))); $('hOpenS').hidden = !open.length;
    $('hDone').textContent = ''; done.forEach((pr) => $('hDone').append(card(pr))); $('hDoneS').hidden = !done.length;
    $('hMod').textContent = ''; for (const mo of state.profiles) { const b = el('button'); b.append(el('b', mo.name || 'Bez imienia'), el('small', [mo.og, mo.ot, mo.ob].map((v) => f1(v)).join(' / ') + (mo.wzrost ? ' · ' + Math.round(mo.wzrost) + ' cm' : ''))); b.addEventListener('click', () => { state.active = mo.id; fillForm(); persist(); homeShow(false); goPanel('modelka'); }); $('hMod').append(b); }
    $('hIn').textContent = ''; const hi = (state.inspH || []).filter(inspOk).slice(0, 5);
    if (!hi.length) $('hIn').append(el('p', 'Tu pojawią się zdjęcia, z których dobierałaś wykrój.', 'hempty'));
    for (const e of hi) { const b = el('button'), im = document.createElement('img'); im.src = e.img; im.alt = ''; b.setAttribute('aria-label', 'Nowy projekt z tej inspiracji'); b.title = 'Nowy projekt z tej inspiracji'; b.append(im); b.addEventListener('click', () => newFromInsp(e)); $('hIn').append(b); }
  }
  function homeShow(on) { $('home').hidden = !on; if (on) { homeFill(); $('home').scrollTop = 0; } }
  function newFromInsp(e) {
    const sn = snap(); sn.style = 'pusty'; sn.imp = null; sn.p = JSON.parse(JSON.stringify(DEF_P)); sn.layers = [{ role: 'wierzch' }]; sn.sel = {};
    homeShow(false); addProj('Projekt z inspiracji', sn); goPanel('insp'); if (e) inspOpen(e); else { $('inRes').textContent = ''; $('inMoreBox').hidden = true; }
  }
  $('hNew').addEventListener('click', () => { homeShow(false); $('prNew').click(); if (state.view !== '3d') setView('3d'); goPanel('fason'); draw(true); });
  $('hInsp').addEventListener('click', () => newFromInsp(null));
  $('prInsp').addEventListener('click', () => newFromInsp(null));
  $('prHome').addEventListener('click', () => homeShow(true));
  $('logoB').addEventListener('click', () => homeShow($('home').hidden));
  // ekran startowy: znika po niecałych trzech sekundach albo po kliknięciu
  (function () {
    const sp = $('splash'); if (!sp) return; const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const out = () => { if (sp.classList.contains('out')) return; sp.classList.add('out'); setTimeout(() => { const v = $('spV'); if (v) { try { v.pause(); } catch (e) {} } sp.remove(); }, 700); };
    sp.addEventListener('pointerdown', out); document.addEventListener('keydown', out, { once: true }); setTimeout(out, calm ? 900 : 2900);
    const v = $('spV'); if (v && v.play) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
  })();

