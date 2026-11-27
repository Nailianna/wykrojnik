/* Wykrojnik: interfejs */
(function () {
  'use strict';
  const BUILD = { v: '0.78.0', n: 81, date: '2026-11-27' }; // wersja: główna.funkcje.poprawki; build rośnie przy każdej publikacji
  const W = window.Wykroj, $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mkEl = /** @type {(tag: string) => any} */ ((tag) => document.createElement(tag));
  const f1 = (v) => W.fmt(v, 1);
  const KEY = 'wykrojnik.v3', FILE = '~/Documents/Wykrojnik/wykrojnik.json';
  let desktop = null, downloads = null, fileOk = false;

  const FAB = {
    szyfon: { name: 'Szyfon, jedwab', st: 0.05, wt: 0.2 }, wiskoza: { name: 'Wiskoza, krepa', st: 0.2, wt: 0.55 }, dzersej: { name: 'Dżersej', st: 0.15, wt: 0.75 },
    bawelna: { name: 'Bawełna, popelina', st: 0.5, wt: 0.5 }, welna: { name: 'Wełna, dżins', st: 0.7, wt: 0.9 }, tafta: { name: 'Tafta, satyna duchesse', st: 0.82, wt: 0.4 }, tiul: { name: 'Tiul, organza', st: 0.95, wt: 0.05 },
  };
  let state = {
    profiles: [
      { id: 'p1', name: 'Modelka przykładowa', og: 85, ot: 65, ob: 88, wb: 20, wzrost: 176, adv: {} },
      { id: 'p2', name: 'Rozmiar 38', og: 88, ot: 68, ob: 92, wb: 21, wzrost: 168, adv: {} },
    ],
    active: 'p1', style: 'sk_prosta',
    p: /** @type {WParams} */ ({ dl: 58, kn: 55, gf: 9, fac: 'laczone', facW: 5, flare: 0, gora: 'ramiona', bk: 'prosta', bh: 6, gr: 5, gh: 9, gd: 11, gg: 5, gp: 6, ram: 'brak', ramW: 1, rekL: 0, dol: '', fit: 'regular', baza: 'wlasna', extras: [], falN: false, falR: false, marsz: false, sciag: false, tren: 0, kop: false, pasT: 0, zakK: 2.5, rek: 'brak', mank: false, bok: 0, ff: 1, zp: 'bok', kol: 'brak', kolW: 3, rozp: 0, nk: 'okragly', nkb: 'okragly', nd: 0, nw: 0, nb: 0, luzG: 4, luzB: 2, luzT: 1, saSzew: 1.5, saTalia: 1, saDol: 4, pasek: 3 }),
    grid: false, tiles: true, view: '2d', color: '#d9447d', fabric: 'bawelna', bust: true, seams: true, figure: false, labels: true, layers: [{ role: 'wierzch' }], print: 'gladka', color2: '#fff4e2', pscale: 100, panel: 'fason', card: true, theme: 'dark',
    inspH: [], wish: [], sim: true, sel: {}, paper: 'a4', pack: true, fabW: 140, printImg: null, projects: [], proj: null,
  };
  const DEF_P = JSON.parse(JSON.stringify(state.p));
  // projekt = fason, parametry, modelka, tkanina i ustawienia druku; modelki są wspólne dla wszystkich projektów
  const PK = ['imp', 'style', 'p', 'active', 'fabric', 'color', 'color2', 'print', 'pscale', 'layers', 'printImg', 'sel', 'paper', 'pack', 'fabW'];
  const snap = () => { const o = {}; for (const k of PK) o[k] = state[k]; return JSON.parse(JSON.stringify(o)); };
  const projCur = () => state.projects.find((x) => x.id === state.proj);
  function ensureProjects() {
    if (!Array.isArray(state.projects)) state.projects = [];
    state.projects = state.projects.filter((x) => x && x.id && x.snap && x.snap.p);
    if (!state.projects.length) { const id = 'j' + Date.now(); state.projects = [{ id, name: 'Pierwszy projekt', updated: Date.now(), snap: snap() }]; state.proj = id; }
    if (!projCur()) state.proj = state.projects[0].id;
    if (!state.sel || typeof state.sel !== 'object') state.sel = {};
    if (state.uiV !== 2) { state.uiV = 2; state.theme = 'dark'; } // nowy wygląd startuje w ciemnym motywie, potem decyduje przełącznik
  }
  function adopt(raw) {
    try {
      const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!s || !Array.isArray(s.profiles) || !s.profiles.length || !s.p) return false;
      s.p = Object.assign({}, state.p, s.p);
      s.profiles.forEach((x) => { if (!isFinite(x.og)) x.og = 85; if (!isFinite(x.wzrost)) x.wzrost = 172; if (!x.adv) x.adv = {}; });
      state = Object.assign(state, s);
      if (state.style !== 'pusty' && !(state.style === 'import' && state.imp && state.imp.pieces) && !W.STYLES.some((x) => x.id === state.style)) state.style = 'sk_prosta';
      return true;
    } catch (e) { return false; }
  }
  try { if (!adopt(localStorage.getItem(KEY)) && adopt(localStorage.getItem('wykrojnik.v2'))) { state.theme = 'light'; state.panel = 'fason'; state.card = true; } } catch (e) {}
  ensureProjects();
  let saveT = 0, hist = [], hi = -1, histT = 0;
  const hsnap = () => { const o = snap(); delete o.printImg; delete o.imp; o.profiles = state.profiles; return JSON.stringify(o); };
  function histUi() { $('undo').disabled = hi <= 0; $('redo').disabled = hi >= hist.length - 1; }
  function histPush(now) {
    clearTimeout(histT);
    const f = () => { const j = hsnap(); if (hist[hi] === j) return; hist = hist.slice(0, hi + 1); hist.push(j); if (hist.length > 120) hist.shift(); hi = hist.length - 1; histUi(); };
    if (now) f(); else histT = setTimeout(f, 450);
  }
  function histReset() { clearTimeout(histT); hist = [hsnap()]; hi = 0; histUi(); }
  function histGo(dir) {
    histPush(true);
    const ni = hi + dir; if (ni < 0 || ni >= hist.length) return;
    hi = ni; const img = state.printImg, im0 = state.imp; Object.assign(state, JSON.parse(hist[hi])); state.printImg = img; state.imp = im0;
    if (!state.profiles.some((x) => x.id === state.active)) state.active = state.profiles[0].id;
    persist(true); fillForm(); layoutUi(); draw(true); histUi();
  }
  // wskaźnik pracy: co aplikacja właśnie robi i od jak dawna; kilka zadań naraz pokazuje ostatnie
  const busyQ = []; let busyT = 0;
  function busyDraw() { const top = busyQ[busyQ.length - 1]; $('busy').hidden = !top; if (!top) { clearInterval(busyT); busyT = 0; return; } const s = Math.floor((Date.now() - top.t0) / 1000); $('busyTx').textContent = top.text; $('busyTm').textContent = s >= 4 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : ''; if (!busyT) busyT = setInterval(busyDraw, 1000); }
  function busyOn(text) { const o = { text, t0: Date.now() }; busyQ.push(o); busyDraw(); return o; }
  function busySet(o, text) { o.text = text; busyDraw(); }
  function busyOff(o) { const i = busyQ.indexOf(o); if (i >= 0) busyQ.splice(i, 1); busyDraw(); }
  const paintTick = () => new Promise((r) => setTimeout(r, 40)); // chwila na narysowanie wskaźnika przed ciężką pracą
  // gdzie byłaś ostatnio: po przeładowaniu (aktualizacja, zgoda na pliki) aplikacja wraca do projektu zamiast na pulpit
  const UIK = 'wykrojnik.ui';
  let uiReady = false; // przed startem nie zapisujemy, żeby nie nadpisać tego, co zostało po poprzedniej sesji
  function uiMark() { if (!uiReady) return; try { localStorage.setItem(UIK, JSON.stringify({ home: !$('home').hidden, t: Date.now() })); } catch (e) {} }
  function uiResume() { try { const u = JSON.parse(localStorage.getItem(UIK) || 'null'); return !!u && u.home === false && Date.now() - u.t < 30 * 60e3; } catch (e) { return false; } }
  function persist(noHist) {
    const pr = projCur(); if (pr) { const ns = snap(), k = snapKey(ns); if (pr.key === undefined) pr.key = k; else if (pr.key !== k) { pr.key = k; pr.updated = Date.now(); } pr.snap = ns; }
    if (!noHist) histPush();
    const json = JSON.stringify(state);
    try { localStorage.setItem(KEY, json); } catch (e) {}
    uiMark(); if (pr && pr.thumbKey !== pr.key) shotPlan();
    if (fileOk) { clearTimeout(saveT); saveT = setTimeout(() => desktop.fs.writeFile(FILE, json, 'utf8').catch(() => {}), 400); }
  }
  const GRP = { 'Spódnice': 'Spódnica: ', 'Sukienki': 'Sukienka: ', 'Gorsety': 'Gorset: ', 'Topy': 'Top: ' };
  const tabOf = (s) => (s.indexOf('su_') === 0 ? 'suk' : s.indexOf('sk_') === 0 ? 'doly' : 'gory'), ODC = ['su_polkole', 'su_kolo', 'su_2kola', 'su_zakl'];
  const cur = () => state.profiles.find((x) => x.id === state.active) || state.profiles[0];
  const flags = () => {
    const s = state.style, top = s === 'to_stanik', dress = s.indexOf('su_') === 0 || s.indexOf('to_') === 0, circ = /kol|polkole|zakl/.test(s), corset = s.indexOf('go_') === 0;
    const kliny = s === 'su_rybka_kliny', bez = dress && state.p.gora === 'bez', dolC = (s === 'su_empire' || s === 'su_princeska') && ['polkole', 'kolo', 'kolo2'].includes(state.p.dol); return { rekOn: dress && !bez && !!state.p.rek && state.p.rek !== 'brak' && !(state.p.bok > 0), tren: ['su_dopasowana', 'su_trapez', 'su_zakl'].includes(s), odcTop: dress && !bez && (ODC.includes(s) || s === 'to_stanik'), odc: ODC.includes(s), zakl: s === 'su_zakl', rek34: dress && !bez && state.p.rek === '34', dolsel: s.indexOf('su_') === 0 && !kliny, kol: dress && !bez && (state.p.kol === 'stojka' || state.p.kol === 'bebe'), zpok: dress && !bez && !/princeska|kliny|tshirt/.test(s), corsetU: s === 'go_pod', bez, tee: s.indexOf('to_tshirt') === 0 && s !== 'to_tshirt_s', rozp: ['sk_prosta', 'sk_olowkowa', 'sk_trapez', 'su_dopasowana', 'su_trapez'].includes(s), ram: bez && (state.p.ram === 'cienkie' || state.p.ram === 'szyja'), rekLen: dress && !bez && !!state.p.rek && state.p.rek !== 'brak' && state.p.rek !== 'bufka' && !(state.p.bok > 0), corset, len: !corset && !top, waist: !corset && !(s.indexOf('to_tshirt') === 0 && state.p.fit !== 'slim'), facw: dress && !bez && state.p.fac === 'osobne', straps: dress && !bez, nostraps: bez || s === 'go_nad', dress, circ, flare: !circ && !kliny && !corset && !top && !dolC, hip: !circ && !corset && !top && !dolC, pasek: !dress && !corset, rybka: s === 'su_rybka' || kliny, kliny };
  };

  // ---------- formularz ----------
  const MF = ['og', 'ot', 'ob', 'wb', 'wzrost'], PF = ['rekL', 'tren', 'pasT', 'bok', 'kolW', 'rozp', 'ramW', 'gr', 'gh', 'gd', 'gg', 'bh', 'dl', 'kn', 'gf', 'facW', 'flare', 'nd', 'nw', 'nb', 'luzG', 'luzB', 'luzT', 'saSzew', 'saTalia', 'saDol', 'pasek'];
  const ADVL = { os: 'Obwód szyi', Dt: 'Długość tyłu od 7. kręgu', Dts: 'Długość tyłu z ramienia', Dps: 'Długość przodu z ramienia', Wg: 'Wysokość biustu', Rg: 'Rozstaw biustu', Gp: 'Głębokość pachy', Sb: 'Szerokość barków', St: 'Szerokość tyłu', Sp: 'Szerokość przodu' };
  (function buildStatic() {
    const NK = [['okragly', 'Okrągły', 'M4 8L13 4Q20 21 27 4L36 8'], ['v', 'V', 'M4 8L13 4L20 19L27 4L36 8'], ['karo', 'Karo', 'M4 8L13 4L14.5 16L25.5 16L27 4L36 8'],
      ['serce', 'Serce', 'M4 8L13 4C13 15 18 9 20 16C22 9 27 15 27 4L36 8'], ['lodka', 'Łódka', 'M4 8L8 5Q20 12 32 5L36 8']];
    for (const [id, name, d] of NK) {
      const b = document.createElement('button'); b.dataset.nk = id;
      b.innerHTML = '<svg viewBox="0 0 40 24" aria-hidden="true"><path d="' + d + '"/></svg>'; b.append(name);
      b.addEventListener('click', () => {
        const p = state.p, was = p.nk; p.nk = id;
        if (id === 'lodka') { p.nd = -3; p.nw = 6; }
        else { if (was === 'lodka' || p.nd < 0) { p.nd = 0; p.nw = 0; } if (id === 'v') p.nd = Math.max(p.nd, 8); if (id === 'karo') { p.nd = Math.max(p.nd, 5); p.nw = Math.max(p.nw, 2); } if (id === 'serce') { p.nd = Math.max(p.nd, 7); p.nw = Math.max(p.nw, 3); } }
        fillForm(); persist(); draw();
      });
      $('nk').appendChild(b);
    }
    $('fTab').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.fTab = b.dataset.t; fillForm(); persist(true); }));
    $('dolK').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.f, f = +v, own = state.style === 'su_empire' || state.style === 'su_princeska';
      state.sel = {};
      if (state.style === 'su_rybka') state.p.ff = f;
      else if (own) state.p.dol = f === 2 ? 'kolo2' : f === 1 ? 'kolo' : f === 0.5 ? 'polkole' : ''; // empire i princeska zostają sobą, zmienia się tylko dół
      else if (v === 'z') state.style = 'su_zakl';
      else if (v === 'p') { state.style = 'su_dopasowana'; state.p.flare = 0; }
      else if (v === 't') { state.style = 'su_trapez'; if (!(state.p.flare > 0)) state.p.flare = 7; }
      else state.style = f === 2 ? 'su_2kola' : f === 1 ? 'su_kolo' : 'su_polkole';
      fillForm(); persist(); draw(true);
    }));
    document.querySelectorAll('[data-pb]').forEach((c) => c.addEventListener('change', () => { state.p[c.dataset.pb] = c.checked; fillForm(); persist(); draw(true); }));
    $('kop').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.kop = b.dataset.w === '1'; if (state.p.kop && (state.p.kol === 'stojka' || state.p.kol === 'bebe')) state.p.kol = 'brak'; if (!state.p.kop && state.p.kol === 'szal') state.p.kol = 'brak'; fillForm(); persist(); draw(true); }));
    $('rek').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.rek = b.dataset.r; state.p.rekL = ['krotki', '34', 'dlugi'].includes(b.dataset.r) ? rekDef(b.dataset.r) : 0; if (b.dataset.r !== 'brak') state.p.bok = 0; fillForm(); persist(); draw(true); }));
    $('mankT').addEventListener('change', () => { state.p.mank = $('mankT').checked; persist(); draw(true); });
    $('kol').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.kol = b.dataset.k; state.p.kolW = b.dataset.k === 'szal' ? 7 : b.dataset.k === 'bebe' ? 6 : 3; fillForm(); persist(); draw(true); }));
    $('zp').addEventListener('change', () => { state.p.zp = $('zp').value; persist(); draw(); });
    $('ram').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.ram = b.dataset.r; fillForm(); persist(); draw(true); }));
    $('gp').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.gp = +b.dataset.n; fillForm(); persist(); draw(true); }));
    $('gora').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.gora = b.dataset.g; if (b.dataset.g === 'bez' && state.p.luzG > 0) state.p.luzG = 0; fillForm(); persist(); draw(true); }));
    $('baza').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.baza = b.dataset.bz; fillForm(); persist(); draw(true); }));
    // krój t-shirtu ustawia luzy: slim przylega, regular ma kilka centymetrów zapasu, oversize kilkanaście
    $('fit').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { const f = b.dataset.fit; state.p.fit = f; Object.assign(state.p, f === 'slim' ? { luzG: -4, luzT: 0, luzB: -4 } : f === 'oversize' ? { luzG: 16, luzT: 12, luzB: 14 } : { luzG: 6, luzT: 8, luzB: 4 }); fillForm(); persist(); draw(true); }));
    $('bk').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.bk = b.dataset.b; fillForm(); persist(); draw(); }));
    $('fac').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.fac = b.dataset.v3; fillForm(); persist(); draw(true); }));
    $('nkb').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.p.nkb = b.dataset.v2; if (b.dataset.v2 === 'v' && state.p.nb < 6) state.p.nb = 10; fillForm(); persist(); draw(); }));
    const SL = [['zakK', 'Obfitość zakładek', 1.6, 3.5, 'zakl'], ['gr', 'Redukcja talii', 0, 15, 'corset'], ['gh', 'Wysokość nad talią', 5, 14, 'corsetU'], ['gd', 'Długość pod talią z przodu', 5, 16, 'corset'], ['gg', 'Odstęp sznurowania', 0, 10, 'corset'], ['dl', 'Długość od talii', 25, 130, 'len'], ['kn', 'Wysokość kolan od talii', 35, 90, 'rybka'], ['gf', 'Rozkloszowanie klinów', 2, 30, 'kliny'], ['flare', 'Poszerzenie dołu', -6, 30, 'flare'], ['nd', 'Dekolt z przodu', -4, 24, 'straps'], ['nw', 'Szerokość dekoltu', 0, 9, 'straps'],
      ['nb', 'Dekolt z tyłu', 0, 30, 'straps'], ['bh', 'Góra nad linią biustu', 2, 12, 'nostraps'], ['luzG', 'Luz w biuście', -10, 16, 'dress'], ['luzT', 'Luz w talii', -8, 12, 'waist'], ['luzB', 'Luz w biodrach', -12, 16, 'hip']];
    const TOPK = ['gr', 'gh', 'gd', 'gg', 'nd', 'nw', 'nb', 'bh', 'luzG', 'rekL', 'bok', 'ramW', 'kolW'], tg = {};
    for (const [id, cap] of [['top', 'Góra'], ['bot', 'Dół']]) { const w = document.createElement('div'), b = document.createElement('b'), gd = document.createElement('div'); w.className = 'tgrp'; w.id = 'tg_' + id; b.textContent = cap; w.append(b, gd); $('tuneG').appendChild(w); tg[id] = gd; }
    SL.push(['rekL', 'Długość rękawa', 12, 75, 'rekLen'], ['bok', 'Zwężenie ramienia', 0, 12, 'straps'], ['ramW', 'Szerokość ramiączka', 0.5, 4, 'ram'], ['kolW', 'Szerokość kołnierza', 2, 12, 'kol']);
    for (const [k, name, mn, mx, cond] of /** @type {any[][]} */ (SL)) {
      const l = mkEl('label'); l.className = 'sl'; if (cond) l.dataset.if = cond;
      const top = mkEl('span'), o = mkEl('output'), i = mkEl('input');
      top.append(name, o); o.id = 'o_' + k; i.type = 'range'; i.min = mn; i.max = mx; i.step = 0.5; i.id = 's_' + k;
      i.addEventListener('input', () => { state.p[k] = parseFloat(i.value); $('p_' + k).value = state.p[k]; o.textContent = f1(state.p[k]) + ' cm';
        if (k === 'bok' && state.p.bok > 0 && state.p.rek && state.p.rek !== 'brak') { state.p.rek = 'brak'; state.p.falR = false; fillForm(); } // odsłonięte ramiona wykluczają rękawy
        persist(); drawSoon(); });
      l.append(top, i); tg[TOPK.includes(k) ? 'top' : 'bot'].appendChild(l);
    }
    const box = $('adv');
    for (const k of W.ADV) {
      const l = document.createElement('label'); l.className = 'f';
      const a = document.createElement('span'); a.textContent = ADVL[k];
      const n = document.createElement('span'); n.className = 'num';
      const i = document.createElement('input'); i.type = 'number'; i.step = '0.5'; i.min = '5'; i.max = '70'; i.id = 'a_' + k;
      i.addEventListener('input', () => {
        const v = parseFloat(i.value);
        if (i.value === '') delete cur().adv[k]; else if (isFinite(v) && i.checkValidity()) cur().adv[k] = v; else return;
        persist(); draw();
      });
      n.appendChild(i); l.append(a, n); box.appendChild(l);
    }
  })();
  function fillForm() {
    const sel = $('prof'); sel.textContent = '';
    for (const pr of state.profiles) { const o = document.createElement('option'); o.value = pr.id; o.textContent = pr.name || 'Bez imienia'; sel.appendChild(o); }
    sel.value = cur().id; fillGallery();
    $('m_name').value = cur().name;
    MF.forEach((k) => ($('m_' + k).value = cur()[k]));
    { const mn = dlMin(); if (!(state.p.dl >= mn)) state.p.dl = Math.max(mn, 58); $('p_dl').min = mn; $('s_dl').min = mn; $('s_dl').max = mn < 0 ? Math.max(70, state.p.dl) : 130; } // top może kończyć się nad talią, rybka potrzebuje długości
    if (['krotki', '34', 'dlugi'].includes(state.p.rek) && !(state.p.rekL >= 12)) state.p.rekL = rekDef(state.p.rek); // starsze projekty: długość rękawa z rodzaju
    PF.forEach((k) => { $('p_' + k).value = state.p[k]; syncSl(k); });
    fillAdv();
    $('delP').disabled = state.profiles.length < 2; $('delP').textContent = 'Usuń';
    const fl = state.style === 'pusty' ? {} : flags();
    document.querySelectorAll('[data-if]').forEach((el) => (el.hidden = !fl[el.dataset.if]));
    document.querySelectorAll('.tgrp').forEach((gq) => { gq.hidden = !Array.from(gq.querySelectorAll('.sl')).some((e) => !e.hidden); gq.querySelector('b').textContent = gq.id === 'tg_top' ? (fl.corset ? 'Gorset' : 'Góra') : fl.dress && !fl.corset ? (state.style.indexOf('to_') === 0 ? 'Długość i luz' : 'Dół') : 'Spódnica'; });
    $('col').value = state.color; $('fab').value = FAB[state.fabric] ? state.fabric : 'bawelna';
    if (state.print === 'wlasny' && !customImg && !state.printImg) state.print = 'gladka';
    fillFabricPanel(); fillProj(); wishFill(); inspHist(); impFill();
    $('paper').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pp === state.paper));
    $('fabW').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.fw === state.fabW));
    $('packT').checked = !!state.pack; $('packRow').hidden = state.paper === 'one';
    $('nk').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.nk === state.p.nk));
    $('nkb').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v2 === state.p.nkb));
    $('fac').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v3 === state.p.fac));
    { // konfigurator fasonu: zakładka, opcje góry i dołu tylko przy pasującym fasonie
      const tb = ['gory', 'doly', 'suk'].includes(state.fTab) ? state.fTab : tabOf(state.style); state.fTab = tb;
      $('fTab').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === tb));
      document.querySelectorAll('[data-ft]').forEach((el) => (el.hidden = el.dataset.ft !== tb));
      $('fOpts').hidden = tabOf(state.style) !== tb;
      const s = state.style, ryb = s === 'su_rybka', emp = s === 'su_empire', pri = s === 'su_princeska', dk = state.p.dol;
      const cur = ryb ? String(state.p.ff === 0.5 || state.p.ff === 2 ? state.p.ff : 1) : emp || pri ? (dk === 'kolo2' ? '2' : dk === 'kolo' ? '1' : dk === 'polkole' ? '0.5' : emp ? 't' : 'p') : s === 'su_zakl' ? 'z' : s === 'su_2kola' ? '2' : s === 'su_kolo' ? '1' : s === 'su_polkole' ? '0.5' : s === 'su_trapez' ? 't' : 'p';
      $('dolK').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === cur));
      $('dolZ').hidden = ryb || emp || pri; $('dolP').hidden = ryb || emp; $('dolT').hidden = ryb || pri; $('dolP').textContent = pri ? 'Z paneli' : 'Prosty'; $('dolH').textContent = ryb ? 'Falbana' : 'Dół';
    }
    impFill(); // na końcu: wykrój z pliku chowa galerie fasonów, które blok wyżej właśnie pokazał
    document.querySelectorAll('[data-pb]').forEach((c) => (c.checked = !!state.p[c.dataset.pb]));
    { const kopOn = !!state.p.kop && fl.odcTop; $('kop').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.w === '1') === kopOn)); $('kol').querySelectorAll('button').forEach((b) => (b.hidden = b.dataset.k === 'szal' ? !kopOn : b.dataset.k !== 'brak' && kopOn)); }
    $('rek').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.r === (state.p.rek || 'brak'))); $('mankT').checked = !!state.p.mank;
    $('kol').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === (state.p.kol || 'brak'))); $('zp').value = state.p.zp || 'bok';
    $('ram').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.r === (state.p.ram || 'brak')));
    $('gp').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.n === (state.p.gp === 5 ? 5 : 6)));
    $('gora').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.g === (state.p.gora === 'bez' ? 'bez' : 'ramiona')));
    $('baza').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.bz === (state.p.baza === 'stark' ? 'stark' : 'wlasna')));
    $('fit').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fit === (['slim', 'oversize'].includes(state.p.fit) ? state.p.fit : 'regular')));
    $('bk').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.b === (state.p.bk === 'serce' || (state.p.bk === 'luk' && state.style !== 'go_nad') ? state.p.bk : 'prosta')));
  }
  function syncSl(k) { const s = $('s_' + k); if (s) { s.value = state.p[k]; $('o_' + k).textContent = f1(state.p[k]) + ' cm'; } }
  function fillAdv() {
    const e = W.estimate(cur());
    { const i = $('m_opx'), v = cur().opx; i.placeholder = f1(cur().og - 14); if (document.activeElement !== i) i.value = isFinite(v) && v !== null && v !== undefined ? v : ''; }
    fillBra();
    let est = 0;
    for (const k of W.ADV) { const i = $('a_' + k), v = cur().adv[k], has = isFinite(v) && v !== null && v !== undefined; if (!has) est++; i.placeholder = f1(e[k]); if (document.activeElement !== i) i.value = has ? v : ''; }
    $('advN').textContent = est ? '· szacowane: ' + est + ' z ' + W.ADV.length : '· wszystkie zmierzone';
  }
  // rozmiar biustonosza: obwód pod biustem zaokrąglony do 5 cm, miseczka z różnicy biust minus pod biustem (co 2 cm, A = 12-14)
  const CUPS = ['AA', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  (function () {
    const o0 = () => { const o = document.createElement('option'); o.value = ''; o.textContent = '–'; return o; };
    $('braB').append(o0()); for (let b = 60; b <= 110; b += 5) { const o = mkEl('option'); o.value = b; o.textContent = b; $('braB').append(o); }
    $('braC').append(o0()); CUPS.forEach((c, i) => { const o = mkEl('option'); o.value = i; o.textContent = c; $('braC').append(o); });
    const set = () => {
      const m = cur(), hadB = $('braB').value !== '', hadC = $('braC').value !== '';
      const band = hadB ? +$('braB').value : Math.round((isFinite(m.opx) ? m.opx : m.og - 15) / 5) * 5, ci = hadC ? +$('braC').value : 2;
      m.opx = band; m.og = band + 11 + 2 * ci; persist(); fillForm(); draw(); clearTimeout(galT); galT = setTimeout(fillGallery, 500);
    };
    $('braB').addEventListener('change', set); $('braC').addEventListener('change', set);
  })();
  function fillBra() {
    const m = cur(), has = isFinite(m.opx) && m.opx !== null && m.opx !== undefined;
    if (!has) { $('braB').value = ''; $('braC').value = ''; return; }
    const band = Math.max(60, Math.min(110, Math.round(m.opx / 5) * 5)), ci = Math.max(0, Math.min(CUPS.length - 1, Math.floor((m.og - m.opx - 10) / 2)));
    $('braB').value = band; $('braC').value = ci;
  }
  // ---------- dodatki opisowe: prostokąty liczone z wykroju, dodawane ręcznie albo z analizy zdjęcia ----------
  const EXB = { dekolt: 'długości dekoltu', talia: 'obwodu talii', biust: 'obwodu biustu', biodra: 'obwodu bioder', dol: 'obwodu dołu', pacha: 'obwodu pachy', rekaw: 'dołu rękawa', stala: 'stała (tylko dodatkowa długość)' };
  function exClean(o) {
    if (!o || typeof o !== 'object') return null; const name = String(o.name || o.nazwa || '').replace(/[<>]/g, '').trim().slice(0, 40), base = String(o.base || o.baza || '');
    if (!name || !(base in EXB)) return null; const num = (v, lo, hi, df) => (isFinite(+v) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, +v)) : df);
    return { name: name.charAt(0).toUpperCase() + name.slice(1), base, k: num(o.k != null ? o.k : o.mnoznik, 0.2, 4, 1), plus: num(o.plus, 0, 300, 0), w: num(o.w != null ? o.w : o.szerokosc, 1, 60, 5), n: Math.round(num(o.n != null ? o.n : o.ile, 1, 8, 1)), note: String(o.note || o.opis || '').replace(/[<>]/g, '').slice(0, 140) };
  }
  for (const k in EXB) { const o = document.createElement('option'); o.value = k; o.textContent = EXB[k]; $('exBase').append(o); }
  $('exAdd').addEventListener('click', () => {
    const ex = exClean({ name: $('exName').value, base: $('exBase').value, k: $('exK').value, plus: $('exPlus').value, w: $('exW').value, n: $('exN').value });
    if (!ex) { say('Wpisz nazwę dodatku.'); return; } if (!Array.isArray(state.p.extras)) state.p.extras = [];
    if (state.p.extras.length >= 12) { say('Projekt mieści 12 dodatków.'); return; }
    state.p.extras.push(ex); $('exName').value = ''; $('exForm').open = false; persist(); draw(true);
  });
  function renderExtras(d) {
    const box = $('exList'); box.textContent = ''; const list = Array.isArray(state.p.extras) ? state.p.extras : [];
    list.forEach((ex, i) => {
      const row = document.createElement('div'), sp = document.createElement('span'), sm = document.createElement('small'), x = document.createElement('button'); row.className = 'wrow';
      const base = d.bases ? d.bases[ex.base] : 0, ok = ex.base === 'stala' || base > 0, L = Math.max(3, base * ex.k + ex.plus);
      sp.textContent = ex.name + ' '; sm.style.color = 'var(--mute)'; sm.textContent = ok ? ex.n + ' × ' + f1(L) + ' × ' + f1(ex.w + 2) + ' cm' + (ex.note ? ' · ' + ex.note : '') : 'nie dotyczy tego fasonu'; sp.append(document.createElement('br'), sm);
      x.textContent = 'Usuń'; x.addEventListener('click', () => { state.p.extras.splice(i, 1); persist(); draw(true); }); row.append(sp, x); box.append(row);
    });
  }
  // ---------- projekty ----------
  function fillProj() {
    const box = $('prList'); box.textContent = '';
    state.projects.slice().reverse().forEach((pr) => {
      const b = document.createElement('button'), a = document.createElement('b'), sm = document.createElement('small'); b.className = 'pj';
      const st = W.STYLES.find((x) => x.id === pr.snap.style), mo = state.profiles.find((x) => x.id === pr.snap.active);
      a.textContent = pr.name || 'Bez nazwy'; sm.textContent = (st ? GRP[st.group] + st.name.toLowerCase().replace(/ \(.*\)/, '') : '') + (mo ? ' · ' + (mo.name || 'Bez imienia') : '');
      b.append(a, sm); b.setAttribute('aria-pressed', pr.id === state.proj);
      b.addEventListener('click', () => { if (pr.id !== state.proj) openProj(pr.id); });
      box.appendChild(b);
    });
    if (document.activeElement !== $('prName')) $('prName').value = projCur().name;
    $('prDel').disabled = state.projects.length < 2; $('prDel').textContent = 'Usuń projekt';
  }
  function loadSnap(sn) {
    const o = JSON.parse(JSON.stringify(sn)); o.p = Object.assign({}, DEF_P, o.p);
    Object.assign(state, o);
    if (state.style !== 'pusty' && !(state.style === 'import' && state.imp && state.imp.pieces) && !W.STYLES.some((x) => x.id === state.style)) state.style = 'sk_prosta';
    if (!state.profiles.some((x) => x.id === state.active)) state.active = state.profiles[0].id;
    if (!state.sel || typeof state.sel !== 'object') state.sel = {};
    loadPrintImg();
  }
  function openProj(id) {
    persist(true); state.proj = id; loadSnap(projCur().snap); histReset();
    fillForm(); persist(true); draw(true);
  }
  function addProj(name, sn) {
    persist(true); const id = 'j' + Date.now(); state.projects.push({ id, name, updated: Date.now(), snap: sn }); state.proj = id; loadSnap(sn); histReset();
    fillForm(); persist(true); draw(true); $('prName').focus(); $('prName').select();
  }
  // import wykrojów: pracownia Przymiarka otwierana w oknie aplikacji, z wymiarami bieżącej modelki
  function przOpen() {
    const box = $('przBox'), fr = $('przF'); box.hidden = false;
    const fill = () => { try { const d = fr.contentDocument, m = cur(); const st = d.getElementById('pdfStudio'); if (st) { st.open = true; st.scrollIntoView(); } for (const [k, v] of /** @type {any[][]} */ ([['height', m.wzrost], ['bust', m.og], ['waist', m.ot], ['hips', m.ob]])) { const e = d.getElementById('dst_' + k); if (e && isFinite(v)) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } } } catch (e) { /* inna domena albo strona jeszcze się ładuje */ } };
    if (!fr.getAttribute('src')) { const bz = busyOn('Otwieram Przymiarkę.'); fr.addEventListener('load', () => { busyOff(bz); setTimeout(fill, 300); }, { once: true }); fr.setAttribute('src', 'przymiarka.html'); } else fill();
  }
  $('przX').addEventListener('click', () => { $('przBox').hidden = true; });
  $('prPdf').addEventListener('click', anOpen);
  $('prPdfIn').addEventListener('change', () => { const f = $('prPdfIn').files[0]; $('prPdfIn').value = ''; impLoad(f); });
  $('impSize').addEventListener('change', () => { const data = impCache[state.proj]; if (!data) { impFill(); say('Wczytaj plik jeszcze raz, żeby zmienić rozmiar.'); return; } { const an = state.imp.an, z = $('impSize').value, rz = an && (an.rozm || []).find((x) => x.w === z); state.imp = Object.assign({}, state.imp, { size: z, pieces: anApply(window.PatImport.pick(data, z), an) }, an ? { an: Object.assign({}, an, { body: rz ? { n: rz.n, b: rz.b, t: rz.t, h: rz.h } : null }) } : {}); } state.sel = {}; persist(); draw(true); });
  $('prNew').addEventListener('click', () => { const sn = snap(); sn.style = 'pusty'; sn.imp = null; sn.p = JSON.parse(JSON.stringify(DEF_P)); sn.layers = [{ role: 'wierzch' }]; sn.sel = {}; addProj('Nowy projekt', sn); });
  $('prDup').addEventListener('click', () => addProj((projCur().name || 'Projekt') + ' (kopia)', snap()));
  $('prName').addEventListener('input', () => { projCur().name = $('prName').value; persist(true); fillProj(); draw(); });
  $('prDel').addEventListener('click', () => {
    const b = $('prDel');
    if (b.textContent === 'Usuń projekt') { b.textContent = 'Na pewno usunąć?'; setTimeout(() => (b.textContent = 'Usuń projekt'), 3000); return; }
    state.projects = state.projects.filter((x) => x.id !== state.proj); state.proj = state.projects[state.projects.length - 1].id; loadSnap(projCur().snap); histReset();
    fillForm(); persist(true); draw(true);
  });
  $('undo').addEventListener('click', () => histGo(-1)); $('redo').addEventListener('click', () => histGo(1));
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    const t = e.target; if (t && t.tagName === 'INPUT' && (t.type === 'text' || t.type === '') ) return;
    e.preventDefault(); if (t && t.blur && t.tagName === 'INPUT') t.blur(); histGo(e.shiftKey ? 1 : -1);
  });
  // podpowiedzi, jak zdjąć wymiar: pokazują się przy polu, w którym stoi kursor
  const HINT = {
    braB: 'Rozmiar ustawia obwód pod biustem i obwód biustu na typowe wartości. Zmierzone wymiary wpisz w polach obok, są dokładniejsze.', braC: 'Rozmiar ustawia obwód pod biustem i obwód biustu na typowe wartości. Zmierzone wymiary wpisz w polach obok, są dokładniejsze.', m_og: 'Biust mierz poziomo przez najwyższe punkty, w biustonoszu, który będzie pod ubraniem.', m_opx: 'Pod biustem mierz ciasno i poziomo, tuż pod piersiami.',
    m_ot: 'Talię mierz w najwęższym miejscu tułowia. Zawiąż tam tasiemkę, od niej mierzysz wszystkie długości.', m_ob: 'Biodra mierz poziomo w najszerszym miejscu pośladków.',
    m_wb: 'Wysokość bioder mierz po boku, od tasiemki w talii do poziomu, na którym mierzyłaś biodra.', m_wzrost: 'Wzrost bez butów.',
    a_os: 'Szyję mierz u podstawy, tam gdzie leży łańcuszek.', a_Dt: 'Od wystającego kręgu na karku prosto w dół do tasiemki w talii.', a_Dts: 'Od ramienia przy samej szyi, przez łopatkę, pionowo do tasiemki w talii.',
    a_Dps: 'Od ramienia przy samej szyi, przez szczyt biustu, pionowo do tasiemki w talii.', a_Wg: 'Od ramienia przy samej szyi do szczytu biustu.', a_Rg: 'Odległość między szczytami biustu.',
    a_Gp: 'Od kręgu na karku pionowo w dół do poziomu pach. Najłatwiej włożyć pod pachy linijkę i mierzyć do niej.', a_Sb: 'Przez plecy, od końca jednego ramienia do końca drugiego.',
    a_St: 'Na plecach między pachami, mniej więcej w połowie wysokości pachy.', a_Sp: 'Z przodu między pachami, nad biustem.',
  };
  document.querySelector('[data-sec="modelka"]').addEventListener('focusin', (e) => { $('hint').textContent = HINT[e.target.id] || ''; });
  function rekDef(r) { const armL = 0.345 * (cur().wzrost || 168); return Math.round((r === 'krotki' ? 22 : r === '34' ? armL * 0.75 : armL) * 2) / 2; }
  function dlMin() { const s = state.style; return s.indexOf('to_') === 0 && s !== 'to_stanik' ? -10 : s === 'su_rybka' || s === 'su_rybka_kliny' ? 50 : 25; }
  function bindNum(el, obj, k) {
    el.addEventListener('input', () => {
      const v = parseFloat(el.value.replace(',', '.'));
      if (!isFinite(v) || !el.checkValidity()) return;
      obj()[k] = v; persist(); fillAdv(); syncSl(k); draw(); clearTimeout(galT); galT = setTimeout(fillGallery, 500);
    });
    el.addEventListener('change', () => { const v = parseFloat(el.value.replace(',', '.')); if (!isFinite(v) || !el.checkValidity()) el.value = obj()[k]; });
  }
  MF.forEach((k) => bindNum($('m_' + k), cur, k));
  $('p_bok').addEventListener('input', () => { if (state.p.bok > 0 && state.p.rek && state.p.rek !== 'brak') { state.p.rek = 'brak'; state.p.falR = false; fillForm(); persist(); draw(true); } });
  $('m_opx').addEventListener('input', () => { const i = $('m_opx'), v = parseFloat(i.value); if (i.value === '') delete cur().opx; else if (isFinite(v) && i.checkValidity()) cur().opx = v; else return; persist(); draw(); });
  PF.forEach((k) => bindNum($('p_' + k), () => state.p, k));
  $('m_name').addEventListener('input', () => { cur().name = $('m_name').value; $('prof').selectedOptions[0].textContent = cur().name || 'Bez imienia'; persist(); draw(); });
  $('prof').addEventListener('change', () => { state.active = $('prof').value; fillForm(); persist(); draw(true); });
  const TINTS = ['#f7e3ee', '#e6ebfb', '#e9f4e1', '#fbefd9', '#efe6fa'];
  let galT = 0;
  function fillGallery() {
    const boxes = { 'Spódnice': $('galSk'), 'Sukienki': $('galSu'), 'Gorsety': $('galGo'), 'Topy': $('galGo') };
    for (const k in boxes) boxes[k].textContent = '';
    W.STYLES.forEach((st, i) => {
      if (st.id === 'su_kolo' || st.id === 'su_2kola' || st.id === 'su_zakl') return; // jedna kafelka „Odcinana w talii”, rodzaj koła wybiera się niżej
      const odc = st.id === 'su_polkole', b = document.createElement('button'); b.setAttribute('aria-pressed', odc ? ODC.includes(state.style) : st.id === state.style);
      let svg = '';
      try {
        const d = W.draft(cur(), Object.assign({}, state.p, { flare: st.flare || 0, dl: st.dl ? 95 : 58, kn: 55, gf: 9, fac: 'brak', kol: 'brak', layers: null, extras: [] }, st.preset ? Object.assign({ dl: st.dl || 58 }, st.preset) : { bok: 0 }), st.id), lay = W.layout(d.pieces, 3);
        svg = `<svg viewBox="0 0 ${lay.w} ${lay.h}" aria-hidden="true">` + lay.prims.filter((q) => q.t === 'poly' && q.s === 'cut').map((q) => `<path d="M${q.pts.map((a) => a[0].toFixed(1) + ' ' + a[1].toFixed(1)).join('L')}Z"/>`).join('') + '</svg>';
      } catch (e) {}
      const th = document.createElement('span'); th.className = 'th'; th.style.setProperty('--tint', TINTS[i % TINTS.length]); th.innerHTML = svg;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = odc ? 'Odcinana w talii' : st.group === 'Gorsety' ? 'Gorset ' + st.name.toLowerCase() : st.id === 'to_stanik' ? 'Top do talii' : st.group === 'Topy' ? 'Top: ' + st.name.toLowerCase() : st.name;
      b.append(th, nm);
      b.addEventListener('click', () => { if (!(odc && ODC.includes(state.style))) pickStyle(st); });
      boxes[st.group].appendChild(b);
    });
  }
  function pickStyle(st) { if (st.id !== state.style) state.sel = {}; state.fTab = tabOf(st.id); if (st.preset) { Object.assign(state.p, st.preset); if (st.preset.rek) state.p.rekL = ['krotki', '34', 'dlugi'].includes(st.preset.rek) ? rekDef(st.preset.rek) : 0; if (st.id.indexOf('to_tshirt') === 0) state.fabric = 'dzersej'; } else state.p.bok = 0; if (st.id.indexOf('to_tshirt') !== 0 && state.style.indexOf('to_tshirt') === 0 && state.fabric === 'dzersej') state.fabric = 'bawelna'; const was = W.STYLES.find((s) => s.id === state.style); state.style = st.id; state.p.flare = st.flare || 0; state.p.dol = ''; if (st.dl) state.p.dl = st.dl; else if (was && was.dl && state.p.dl === was.dl) state.p.dl = 58; fillForm(); persist(); draw(true); }
  $('addP').addEventListener('click', () => {
    const c = cur(), id = 'p' + Date.now();
    state.profiles.push({ id, name: 'Nowa modelka', og: c.og, ot: c.ot, ob: c.ob, wb: c.wb, wzrost: c.wzrost, adv: {} });
    state.active = id; fillForm(); persist(); draw(); $('m_name').focus(); $('m_name').select();
  });
  $('delP').addEventListener('click', () => {
    const b = $('delP');
    if (b.textContent === 'Usuń') { b.textContent = 'Na pewno?'; setTimeout(() => (b.textContent = 'Usuń'), 3000); return; }
    state.profiles = state.profiles.filter((x) => x.id !== state.active); state.active = state.profiles[0].id;
    fillForm(); persist(); draw(true);
  });
  function toggle(id, k) { $(id).addEventListener('click', () => { state[k] = !state[k]; $(id).setAttribute('aria-pressed', state[k]); persist(); draw(k === 'tiles'); }); $(id).setAttribute('aria-pressed', state[k]); }
  toggle('tGrid', 'grid'); toggle('tTiles', 'tiles'); toggle('tLab', 'labels'); toggle('tBust', 'bust'); toggle('tSeams', 'seams'); toggle('tSim', 'sim'); $('tFig').addEventListener('click', () => { state.figure = !state.figure; $('tFig').setAttribute('aria-pressed', state.figure); persist(); draw(true); }); $('tFig').setAttribute('aria-pressed', state.figure);
  function setView(v) {
    if (v === '3d' && state.style === 'import') { say('Wczytane wykroje nie mają jeszcze podglądu 3D. Pracuję nad tym, żeby szwy brały się z analizy arkusza i instrukcji.'); v = '2d'; }
    state.view = v;
    $('v2d').setAttribute('aria-pressed', v === '2d'); $('v3d').setAttribute('aria-pressed', v === '3d');
    $('cv').toggleAttribute('hidden', v !== '2d'); $('gl').toggleAttribute('hidden', v !== '3d');
    document.querySelectorAll('[data-v]').forEach((el) => (el.hidden = el.dataset.v !== v));
    layoutUi(); persist(); draw(true);
  }
  $('v2d').addEventListener('click', () => setView('2d'));
  $('mini').addEventListener('click', () => setView('2d'));
  $('v3d').addEventListener('click', () => setView('3d'));
  const P = window.WykrojPrints; let customImg = null, swT = 0;
  function fillFabricPanel() {
    $('fabC').textContent = '';
    for (const k in FAB) { const b = document.createElement('button'); b.textContent = FAB[k].name; b.setAttribute('aria-pressed', k === state.fabric); b.addEventListener('click', () => { state.fabric = k; $('fab').value = k; persist(); fillFabricPanel(); draw(); }); $('fabC').appendChild(b); }
    $('colA').value = state.color; $('colB').value = state.color2; $('pscale').value = state.pscale; $('o_pscale').textContent = state.pscale + '%';
    const plain = state.print === 'gladka'; $('colBrow').hidden = plain || state.print === 'wlasny'; $('pscaleRow').hidden = plain;
    const box = $('prints'); box.textContent = '';
    const add = (id, name, cvs) => { const b = document.createElement('button'); b.setAttribute('aria-pressed', id === state.print); b.append(cvs, name); b.addEventListener('click', () => { state.print = id; persist(); fillFabricPanel(); draw(); }); box.appendChild(b); };
    const sw = (src) => { const c = document.createElement('canvas'); c.width = c.height = 96; c.getContext('2d').drawImage(src, 0, 0, src.width * 0.55, src.height * 0.55, 0, 0, 96, 96); return c; };
    add('gladka', 'Gładka', sw(P.render('gladka', state.color, state.color2, 64)));
    for (const pr of P.LIST) add(pr.id, pr.name, sw(P.render(pr.id, state.color, state.color2, 256)));
    if (customImg) add('wlasny', 'Własny', sw(customImg));
  }
  function loadPrintImg() {
    customImg = null; const src = state.printImg; if (!src || !/^data:image\/jpeg;base64,/.test(src)) return;
    const img = new Image(); img.onload = () => { if (state.printImg !== src) return; const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(img, 0, 0, 512, 512); c._id = Date.now(); customImg = c; fillFabricPanel(); if (state.print === 'wlasny') draw(); };
    img.src = src;
  }
  const swatchesSoon = () => { clearTimeout(swT); swT = setTimeout(fillFabricPanel, 250); };
  $('colA').addEventListener('input', () => { state.color = $('colA').value; $('col').value = state.color; persist(); draw(); swatchesSoon(); });
  $('colB').addEventListener('input', () => { state.color2 = $('colB').value; persist(); draw(); swatchesSoon(); });
  $('pscale').addEventListener('input', () => { state.pscale = +$('pscale').value; $('o_pscale').textContent = state.pscale + '%'; persist(); draw(); });
  $('upImg').addEventListener('change', () => {
    const f = $('upImg').files[0]; if (!f) return;
    const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 512, 512); c._id = Date.now(); customImg = c; state.print = 'wlasny'; try { const k = document.createElement('canvas'); k.width = k.height = 256; k.getContext('2d').drawImage(c, 0, 0, 256, 256); state.printImg = k.toDataURL('image/jpeg', 0.8); } catch (e) {} persist(); fillFabricPanel(); draw(); URL.revokeObjectURL(img.src); };
    img.onerror = () => say('Nie udało się wczytać tego pliku jako obrazu.'); img.src = URL.createObjectURL(f);
  });
  for (const k in FAB) { const o = document.createElement('option'); o.value = k; o.textContent = FAB[k].name; $('fab').appendChild(o); }
  $('fab').addEventListener('change', () => { state.fabric = $('fab').value; persist(); fillFabricPanel(); draw(); });
  $('col').addEventListener('input', () => { state.color = $('col').value; persist(); draw(); swatchesSoon(); });

  // ---------- rysunek 2D ----------
  // wykrój wczytany z PDF: gotowe elementy jednego rozmiaru zamiast konstrukcji z wymiarów
  function impDraft(imp, m) {
    const pcs = (imp && imp.pieces) || [], an = imp.an || null, sa = an && an.sa, bd = an && an.body;
    // opisy cięcia, zapas i wymiary ciała dla rozmiaru pochodzą z analizy arkusza
    const fit = bd && bd.b ? ' Rozmiar ' + bd.n + ' jest szyty na biust ' + f1(bd.b) + (bd.t ? ', talię ' + f1(bd.t) : '') + (bd.h ? ', biodra ' + f1(bd.h) : '') + ' cm; modelka ma ' + [m.og, m.ot, m.ob].map((v) => f1(v)).join(' / ') + '.' : '';
    const saT = !sa ? 'Linie i zapasy na szwy są takie jak w oryginale, Wykrojnik ich nie przelicza.' : (sa.inc ? 'Zapas na szwy jest wliczony w linie' + (sa.cm !== null ? ': ' + f1(sa.cm) + ' cm' : ', ale arkusz nie podaje, ile wynosi') : 'Linie nie zawierają zapasu na szwy' + (sa.cm !== null ? ', dodaj ' + f1(sa.cm) + ' cm' : '')) + (sa.ex && sa.ex.length ? ' (' + sa.ex.map((w) => w.gdzie + ': ' + f1(w.cm) + ' cm').join(', ') + ')' : '') + '.' + (an.skos ? ' Wykrój jest cięty ze skosu.' : '');
    return { pieces: pcs, info: { rows: [], darts: [], cut: pcs.map((q) => [q.name, q.cut ? q.cut.replace(/^wytnij /, '') : 'według oryginału']), warn: 'Wykrój wczytany z pliku, rozmiar ' + (imp.size || 'jedyny') + '. ' + saT + fit },
      sil: { top: 'import', lower: 'none', hemC: 0, a: W.full(m), neckGap: 99, lowerArm: 0 }, title: (imp.name || 'Wykrój z pliku') + (imp.size ? ' · ' + imp.size : ''), notions: an && an.pasm ? an.pasm.map((x) => [x, '']) : [], bases: {}, imported: true };
  }
  // nowy projekt zaczyna od pustego manekina: fason wybiera się dopiero w panelu
  function emptyDraft(m) { return { pieces: [], info: { rows: [], darts: [], cut: [], warn: '' }, sil: { top: 'waist', lower: 'none', empty: true, hemC: 0, a: W.full(m), neckGap: 99, lowerArm: 0 }, title: 'bez fasonu', notions: [], bases: {}, empty: true }; }
  const impCache = {}; // pełne dane ostatnio wczytanych plików (wszystkie rozmiary), tylko na czas sesji
  async function impLoad(file) {
    if (!file) return; const bz = busyOn('Czytam wykrój z pliku.'); await paintTick();
    try {
      await new Promise((r) => { if (window.PatImport) r(undefined); else { const sc = document.createElement('script'); sc.src = 'importer.js'; sc.onload = r; sc.onerror = r; document.head.appendChild(sc); } });
      if (!window.PatImport) throw new Error('Nie udało się wczytać modułu importu.');
      const data = await window.PatImport.load(file), size = data.sizes[Math.floor(data.sizes.length / 2)] || '', pieces = window.PatImport.pick(data, size);
      if (!pieces.length) throw new Error('Nie znalazłam w tym pliku elementów wykroju.');
      const sn = snap(); sn.style = 'import'; sn.imp = { name: data.name, sizes: data.sizes, size, pieces }; sn.sel = {}; sn.layers = [{ role: 'wierzch' }];
      addProj(data.name, sn); impCache[state.proj] = data; impFill(); if (state.view !== '2d') setView('2d'); goPanel('fason');
      say('Wczytałam ' + pieces.length + ' elementów' + (data.sizes.length ? ' w rozmiarze ' + size + '. Rozmiar zmienisz w panelu Fason.' : '.'));
    } catch (e) { say(e && e.message ? e.message : 'Nie udało się wczytać tego pliku.', true); } finally { busyOff(bz); }
  }
  function impFill() {
    const on = state.style === 'import' && !!state.imp, box = $('impBox'); box.hidden = !on; $('fTab').hidden = on; document.querySelectorAll('[data-ft]').forEach((el) => { if (on) el.hidden = true; }); if (on) $('fOpts').hidden = true; if (!on) return;
    const sel = $('impSize'); sel.textContent = ''; for (const z of state.imp.sizes || []) { const o = document.createElement('option'); o.value = z; o.textContent = z; sel.appendChild(o); } sel.value = state.imp.size || ''; sel.disabled = !(state.imp.sizes || []).length; $('impSizeRow').hidden = sel.disabled;
    $('impNote').textContent = sel.disabled ? 'Ten plik zawiera jeden rozmiar.' : impCache[state.proj] ? '' : 'Żeby zmienić rozmiar, wczytaj plik jeszcze raz. Zapisuję tylko wybrany rozmiar.';
  }
  let model = null, vb = null, rafD = 0;
  function drawSoon() { if (rafD) return; rafD = requestAnimationFrame(() => { rafD = 0; draw(); }); }
  function compute() {
    if (!Array.isArray(state.layers) || !state.layers.length || state.layers[0].role !== 'wierzch') state.layers = [{ role: 'wierzch' }];
    const lys = state.layers.map((L) => (L.role === 'wierzch' ? { role: 'wierzch', fabric: state.fabric } : Object.assign({}, L)));
    const d = state.style === 'pusty' ? emptyDraft(cur()) : state.style === 'import' ? impDraft(state.imp, cur()) : W.draft(cur(), Object.assign({}, state.p, { layers: lys, fabName: (id) => (FAB[id] ? FAB[id].name.toLowerCase() : id) }), state.style);
    const pick = d.pieces.filter((pc) => !state.sel[pc.id]), use = pick.length ? pick : d.pieces;
    const lay = state.pack && state.paper !== 'one' ? W.pack(use, 2, state.paper) : W.layout(use, 2), tl = W.tiles(lay, state.paper);
    return { d, lay, tl, use };
  }
  function fitView() {
    const r = $('cv').getBoundingClientRect(), pad = 3, T = model.tl, ins = insets();
    const ew = state.tiles ? Math.max(model.lay.w, T.cols * T.tw) : model.lay.w, eh = state.tiles ? Math.max(model.lay.h, T.rows * T.th) : model.lay.h;
    const w = ew + 2 * pad, h = eh + 2 * pad, avW = Math.max(120, r.width - ins.l - ins.r), avH = Math.max(120, r.height - 24);
    const sc = Math.min(avW / w, avH / h);
    fitScale = sc;
    vb = { x: -pad - (ins.l + (avW - w * sc) / 2) / sc, y: -pad - (12 + (avH - h * sc) / 2) / sc, w: r.width / sc, h: r.height / sc };
  }
  let fitScale = 1, fitDist = 230;
  function insets() {
    const wide = $('stage').getBoundingClientRect().width > 760;
    return { l: state.panel && wide ? 348 : 12, r: state.card && wide ? 300 : 12 };
  }
  function showZoom() {
    let z = 1;
    if (state.view === '3d') z = fitDist / cam.dist; else if (vb) z = $('cv').getBoundingClientRect().width / vb.w / fitScale;
    $('zoom').value = Math.round(Math.log2(z) * 100); $('zoomV').textContent = Math.round(z * 100) + '%';
  }
  function applyVb() { $('cv').setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].join(' ')); showZoom(); }
  function draw(refit) {
    try { model = compute(); } catch (e) { say('Z tych wymiarów nie da się zbudować wykroju. Sprawdź wpisane wartości.'); return; }
    const { d, lay, tl } = model;
    $('emptyN').hidden = !d.empty || !$('home').hidden;
    $('tune').style.display = d.empty ? 'none' : ''; { const mb = $('miniS').closest('.float') || $('miniS').parentElement; if (mb) mb.style.display = d.empty ? 'none' : ''; }
    $('sub').textContent = (projCur().name || 'Bez nazwy') + ' · ' + d.title + ' · ' + (cur().name || 'Bez imienia');
    if (state.view === '3d') {
      $('miniS').innerHTML = `<svg viewBox="0 0 ${lay.w} ${lay.h}" aria-hidden="true">` + lay.prims.filter((q) => q.t === 'poly' && q.s === 'cut').map((q) => `<path d="M${q.pts.map((a) => a[0].toFixed(1) + ' ' + a[1].toFixed(1)).join('L')}Z"/>`).join('') + '</svg>';
      render3d(refit);
    }
    else {
      if (!vb || refit) fitView();
      let s = '';
      if (state.tiles) for (const t of tl.pages) s += `<rect class="sheet" x="${t.x}" y="${t.y}" width="${tl.tw}" height="${tl.th}"/>`;
      for (const q of lay.prims) {
        if (q.t === 'poly') {
          if (q.s === 'grid' && !state.grid) continue;
          s += `<path class="${q.s}" d="M${q.pts.map((a) => a[0].toFixed(3) + ' ' + a[1].toFixed(3)).join('L')}${q.closed ? 'Z' : ''}"/>`;
        } else if (!q.lab || state.labels) {
          s += `<text ${q.lab ? 'class="lb" ' : ''}x="${q.x}" y="${q.y}" font-size="${q.size === 'L' ? 1.5 : 0.75}" ${q.size === 'L' ? 'font-weight="600"' : ''} text-anchor="${q.anchor || 'start'}"${q.rot ? ` transform="rotate(${q.rot} ${q.x} ${q.y})"` : ''}>${esc(q.text)}</text>`;
        }
      }
      if (state.tiles) for (const t of tl.pages) s += `<path class="tile" d="M${t.x} ${t.y}h${tl.tw}v${tl.th}h${-tl.tw}Z"/><text class="tl" x="${t.x + 0.6}" y="${t.y + 1.7}" font-size="1.2">${t.label}</text>`;
      $('cv').innerHTML = s; applyVb();
    }
    const dl = (id, rows) => {
      const el = $(id); el.textContent = '';
      for (const r of rows) {
        const a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = r[0]; b.textContent = r[1];
        if (r[2] === true) b.className = 'ok'; else if (r[2]) { const sm = document.createElement('small'); sm.textContent = r[2]; b.appendChild(sm); }
        el.append(a, b);
      }
    };
    const i = d.info;
    const chk = i.rows.filter((r) => r[2] != null), rest = i.rows.filter((r) => r[2] == null), bad = chk.filter((r) => Math.abs(r[1] - r[2]) >= 0.15).length;
    dl('info', chk.map((r) => [r[0], f1(r[1]) + ' cm', Math.abs(r[1] - r[2]) < 0.15 ? true : (/Szew/.test(r[0]) ? 'druga strona: ' : 'modelka + luz: ') + f1(r[2])]));
    $('verdict').textContent = bad ? (bad === 1 ? 'Jeden wymiar odbiega od modelki.' : 'Wymiary odbiegające od modelki: ' + bad + '.') : d.empty ? 'Wybierz fason, a pokażę wykrój i sprawdzę wymiary.' : d.imported ? 'Wykrój z pliku. Dopasowania do modelki jeszcze nie sprawdzam.' : 'Wykrój zgadza się z wymiarami modelki.'; $('verdict').classList.toggle('bad', !!bad);
    dl('info2', rest.map((r) => [r[0], f1(r[1]) + ' cm'])); $('moreBox').hidden = !rest.length;
    $('warn').textContent = i.warn;
    $('dartsH').hidden = !i.darts.length; dl('darts', i.darts);
    dl('cutlist', i.cut);
    renderLayers(d); renderPrint(model); renderExtras(d);
    const pg = tl.single ? 'Jedna strona ' + Math.ceil(tl.tw + 2) + ' × ' + Math.ceil(tl.th + 2) + ' cm' : (tl.pages.length + 1) + ' stron ' + tl.fmt.toUpperCase() + ', ' + (tl.landscape ? 'poziomo' : 'pionowo');
    $('pages').textContent = pg; $('pagesN').textContent = pg + (tl.single ? '. Do plotera albo projektora.' : ', razem ze stroną tytułową.');
  }

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
  $('fit').addEventListener('click', () => draw(true));
  $('zoom').addEventListener('input', () => {
    const z = Math.pow(2, $('zoom').value / 100);
    if (state.view === '3d') { cam.dist = fitDist / z; paint3d(); showZoom(); return; }
    const r = cv.getBoundingClientRect(), nw = r.width / (fitScale * z), k = nw / vb.w, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    vb = { x: cx - (vb.w * k) / 2, y: cy - (vb.h * k) / 2, w: nw, h: vb.h * k }; applyVb();
  });
  // panele i motyw
  const FLOW = ['modelka', 'fason', 'wymiary', 'tkanina', 'warstwy', 'szwy', 'druk'];
  const PT = { proj: 'Projekty', druk: 'Druk i materiały', warstwy: 'Warstwy', insp: 'Inspiracja', tkanina: 'Tkanina', fason: 'Fason', wymiary: 'Wymiary fasonu', modelka: 'Modelka', szwy: 'Zapasy na szwy' };
  function layoutUi() {
    $('panel').toggleAttribute('hidden', !state.panel);
    if (state.panel) { $('panelT').textContent = PT[state.panel]; document.querySelectorAll('[data-sec]').forEach((el) => (el.hidden = el.dataset.sec !== state.panel)); }
    document.querySelectorAll('nav [data-panel]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.panel === state.panel));
    { const k = FLOW.indexOf(state.panel), nx = k >= 0 && k < FLOW.length - 1 ? FLOW[k + 1] : null; $('panelF').hidden = !nx && state.panel !== 'druk'; $('next').textContent = state.panel === 'druk' ? 'Zapisz PDF' : nx ? 'Dalej: ' + PT[nx].toLowerCase() : ''; $('next').dataset.to = nx || ''; }
    $('card').toggleAttribute('hidden', !state.card); $('cardBtn').toggleAttribute('hidden', state.card);
    const ins = insets(), gl0 = ins.l > 12 ? ins.l - 12 : 0, gr0 = ins.r > 12 ? ins.r - 12 : 0; $('gl').style.left = gl0 + 'px'; $('gl').style.width = 'calc(100% - ' + (gl0 + gr0) + 'px)';
    $('tune').style.left = ins.l + 'px'; $('tune').style.right = ins.r + 'px'; $('mini').style.left = ins.l + 'px';

    document.documentElement.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
  }
  function goPanel(id) { if (id && !$('home').hidden) $('home').hidden = true; state.panel = id; if (id === 'tkanina' && state.view !== '3d') { layoutUi(); setView('3d'); return; } if (id === 'druk' && state.view !== '2d') { layoutUi(); setView('2d'); return; } layoutUi(); persist(true); draw(true); }
  document.querySelectorAll('nav [data-panel]').forEach((b) => b.addEventListener('click', () => goPanel(state.panel === b.dataset.panel && $('home').hidden ? null : b.dataset.panel)));
  $('next').addEventListener('click', () => { if ($('next').dataset.to) { goPanel($('next').dataset.to); document.querySelector('#panel .body').scrollTop = 0; } else $('pdf').click(); });
  $('views').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { cam.yaw = +b.dataset.yaw; cam.pitch = 0.06; paint3d(); }));
  $('panelX').addEventListener('click', () => { state.panel = null; layoutUi(); persist(); draw(true); });
  $('cardX').addEventListener('click', () => { state.card = false; layoutUi(); persist(); draw(true); });
  $('cardBtn').addEventListener('click', () => { state.card = true; layoutUi(); persist(); draw(true); });
  $('theme').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; layoutUi(); persist(); });
  window.addEventListener('resize', () => draw(true));

  // ---------- podgląd 3D (manekin + bryła ubrania, bez symulacji tkaniny) ----------
  const T3 = window.THREE;
  let g3 = null;
  const cam = { yaw: 0.55, pitch: 0.12, dist: 230 };
  const ellA = (C, k) => C / (Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))));
  const ellP = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  const sstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  function bodyFn(m, a) {
    const nr = a.os / (2 * Math.PI), yb = a.Dps - a.Wg;
    const under = isFinite(m.opx) ? Math.min(m.opx, m.og - 2) : m.og - 14, bh = Math.max(1.5, Math.min(8, 0.28 * (m.og - under) + 0.5));
    const L = [
      { y: a.Dts + 6, a: nr * 0.95, b: nr * 0.95, z: 0 }, { y: a.Dts + 0.8, a: nr * 1.12, b: nr * 1.02, z: 0 },
      { y: a.Dts - 1.9, a: (a.Sb / 2) * 0.6, b: (a.Sb / 2) * 0.37, z: 0 }, { y: a.Dts - 4.6, a: (a.Sb / 2) * 0.97, b: (a.Sb / 2) * 0.4, z: 0 },
      { y: Math.max(yb + 5, a.Dts - a.Gp + 1.5), C: m.og * 0.97 - bh * 0.5, k: 0.68, z: 0.3 }, { y: yb, C: m.og - bh * 1.1, k: 0.71, z: 0.5 },
      { y: yb - 8, C: isFinite(m.opx) ? Math.min(m.opx, m.og - 2) : m.og * 0.5 + m.ot * 0.47, k: 0.74, z: 0.6 }, { y: 0, C: m.ot, k: 0.76, z: 0 },
      { y: -m.wb * 0.5, C: (m.ot + m.ob) / 2 + 3, k: 0.74, z: -0.3 }, { y: -m.wb, C: m.ob, k: 0.72, z: -0.8 }, { y: -m.wb - 9, C: m.ob * 0.95, k: 0.72, z: -0.5 },
    ].map((l) => (l.C ? { y: l.y, a: ellA(l.C, l.k), b: ellA(l.C, l.k) * l.k, z: l.z } : l));
    // sklejana krzywa Hermite'a z nachyleniami liczonymi po rzeczywistych odstępach poziomów (bez załamań)
    const n = L.length, tan = {};
    for (const k of ['a', 'b', 'z']) {
      tan[k] = L.map((l, i) => {
        if (i === 0) return (L[1][k] - l[k]) / (L[1].y - l.y);
        if (i === n - 1) return (l[k] - L[i - 1][k]) / (l.y - L[i - 1].y);
        const h0 = L[i - 1].y - l.y, h1 = l.y - L[i + 1].y, d0 = (l[k] - L[i - 1][k]) / -h0, d1 = (L[i + 1][k] - l[k]) / -h1;
        return d0 * d1 <= 0 ? 0 : (d0 * h1 + d1 * h0) / (h0 + h1);
      });
    }
    const f = (y) => {
      y = Math.max(L[n - 1].y, Math.min(L[0].y, y));
      let i = 0; while (i < n - 2 && y < L[i + 1].y) i++;
      const h = L[i + 1].y - L[i].y, t = (y - L[i].y) / h, t2 = t * t, t3 = t2 * t;
      const g = (k) => (2 * t3 - 3 * t2 + 1) * L[i][k] + (t3 - 2 * t2 + t) * h * tan[k][i] + (-2 * t3 + 3 * t2) * L[i + 1][k] + (t3 - t2) * h * tan[k][i + 1];
      return { a: Math.max(1, g('a')), b: Math.max(1, g('b')), z: g('z') };
    };
    f.top = L[0].y; f.bottom = L[L.length - 1].y; f.yb = yb; f.bh = bh;
    // wypukłość piersi; bridge = tkanina napięta między piersiami
    const xc = a.Rg / 2, rx = Math.max(4.2, xc * 0.72);
    f.butt = (x, y, sn, aHip) => { // wypukłość pośladków (tył)
      if (sn >= 0) return 0; const dy = y + m.wb - 1.5; if (Math.abs(dy) > 16) return 0;
      return 2.4 * Math.sqrt(m.ob / 90) * Math.exp(-Math.pow(dy / 7.5, 2) - Math.pow((Math.abs(x) - aHip * 0.42) / (aHip * 0.38), 2)) * sstep(-sn * 3);
    };
    f.bump = (x, y, sn, bridge) => {
      if (sn <= 0) return 0;
      const dy = y - yb; if (dy > 16 || dy < -20) return 0;
      const gy = Math.exp(-Math.pow(dy / (dy > 0 ? 7.5 : bridge ? 9.5 : 5), 2)), ax = Math.abs(x);
      let gx = Math.exp(-Math.pow((ax - xc) / rx, 2)); if (bridge && ax < xc) gx = 0.82 + 0.18 * gx;
      return bh * gy * gx * sstep(sn * 4);
    };
    return f;
  }

  // ---------- symulacja tkaniny (PBD): siatka o wymiarach z wykroju, grawitacja, zginanie zależne od tkaniny, kolizja z ciałem ----------
  function makeSim(spec, key, seed, collide, floorY, fab) {
    const NU = 72, NV = Math.max(12, Math.min(48, Math.round(spec.L / 1.6))), n = NU * (NV + 1), dv = spec.L / NV;
    const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), Wt = new Float32Array(n);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) { const q = seed(spec.yPin - dv * j, (i / NU) * Math.PI * 2), k = (j * NU + i) * 3; P[k] = Q[k] = q[0]; P[k + 1] = Q[k + 1] = q[1]; P[k + 2] = Q[k + 2] = q[2]; Wt[j * NU + i] = j === 0 ? 0 : 1; }
    const c1 = [], c2 = [], cr = [], ck = [], add = (a, b, r, k) => { c1.push(a); c2.push(b); cr.push(r); ck.push(k); };
    const kb = Math.min(0.7, 0.02 + 0.55 * fab.st * fab.st * (1 - 0.4 * fab.wt)), h = []; for (let j = 0; j <= NV; j++) h.push(spec.C(dv * j) / NU);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * NU + i, r = j * NU + ((i + 1) % NU);
      if (j > 0) { add(a, r, h[j], 1); add(a, j * NU + ((i + 2) % NU), 2 * h[j], kb); }
      if (j < NV) { const hm = (h[j] + h[j + 1]) / 2, dg = Math.hypot(hm, dv); add(a, a + NU, dv, 1); add(a, r + NU, dg, 0.5); add(r, a + NU, dg, 0.5); }
      if (j < NV - 1) add(a, a + 2 * NU, 2 * dv, kb);
    }
    const C1 = Int32Array.from(c1), C2 = Int32Array.from(c2), CR = Float32Array.from(cr), CK = Float32Array.from(ck), tmp = [0, 0, 0];
    const sim = { key, yPin: spec.yPin, L: spec.L, steps: 0, ready: false, done: false };
    sim.step = (count) => {
      let move = 0;
      for (let s = 0; s < count; s++) {
        for (let v = NU; v < n; v++) { const k = v * 3; for (let c = 0; c < 3; c++) { const vel = (P[k + c] - Q[k + c]) * 0.9; Q[k + c] = P[k + c]; P[k + c] += vel; } P[k + 1] -= 0.27; }
        for (let it = 0; it < 10; it++) for (let c = 0; c < C1.length; c++) {
          const a = C1[c] * 3, b = C2[c] * 3, wa = Wt[C1[c]], wb = Wt[C2[c]], w = wa + wb; if (!w) continue;
          const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = ((len - CR[c]) / len) * CK[c] / w;
          P[a] += dx * f * wa; P[a + 1] += dy * f * wa; P[a + 2] += dz * f * wa; P[b] -= dx * f * wb; P[b + 1] -= dy * f * wb; P[b + 2] -= dz * f * wb;
        }
        // tkanina nie rozciąga się pod własnym ciężarem: żaden punkt nie odejdzie od przypiętej krawędzi dalej, niż pozwala długość wykroju
        for (let j = 1; j <= NV; j++) { const mx = dv * j; for (let i = 0; i < NU; i++) { const k = (j * NU + i) * 3, t = i * 3, dx = P[k] - P[t], dy = P[k + 1] - P[t + 1], dz = P[k + 2] - P[t + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz); if (len > mx) { const f = mx / len; P[k] = P[t] + dx * f; P[k + 1] = P[t + 1] + dy * f; P[k + 2] = P[t + 2] + dz * f; } } }
        move = 0;
        for (let v = NU; v < n; v++) { // kolizja z ciałem i podłogą; przy kontakcie tkanina wytraca prędkość (tarcie)
          const k = v * 3; tmp[0] = P[k]; tmp[1] = P[k + 1]; tmp[2] = P[k + 2];
          if (tmp[1] < floorY + 0.4) { tmp[1] = floorY + 0.4; }
          collide(tmp);
          if (tmp[0] !== P[k] || tmp[2] !== P[k + 2] || tmp[1] !== P[k + 1]) { P[k] = tmp[0]; P[k + 1] = tmp[1]; P[k + 2] = tmp[2]; Q[k] += (P[k] - Q[k]) * 0.6; Q[k + 1] += (P[k + 1] - Q[k + 1]) * 0.6; Q[k + 2] += (P[k + 2] - Q[k + 2]) * 0.6; }
          move = Math.max(move, Math.abs(P[k] - Q[k]) + Math.abs(P[k + 1] - Q[k + 1]) + Math.abs(P[k + 2] - Q[k + 2]));
        }
        sim.steps++;
      }
      if (sim.steps >= 240 || (sim.steps > 60 && move < 0.02)) sim.done = true;
    };
    sim.sample = (phi, d) => {
      const TAU2 = Math.PI * 2, fu = ((((phi % TAU2) + TAU2) % TAU2) / TAU2) * NU, i0 = Math.floor(fu) % NU, i1 = (i0 + 1) % NU, tu = fu - Math.floor(fu);
      const fv = Math.max(0, Math.min(NV, (d / spec.L) * NV)), j0 = Math.min(NV - 1, Math.floor(fv)), tv = fv - j0;
      const a = (j0 * NU + i0) * 3, b = (j0 * NU + i1) * 3, c = a + NU * 3, e = b + NU * 3, o = [0, 0, 0];
      for (let k = 0; k < 3; k++) o[k] = (P[a + k] * (1 - tu) + P[b + k] * tu) * (1 - tv) + (P[c + k] * (1 - tu) + P[e + k] * tu) * tv;
      return o;
    };
    return sim;
  }
  function topRun(tp) {
    const quiet = () => { clearTimeout(tp.bzT); tp.bzT = 0; if (tp.bz) { busyOff(tp.bz); tp.bz = null; } }; // wskaźnik pracy pojawia się dopiero, gdy układanie trwa dłużej niż pół sekundy
    if (!g3 || g3.top !== tp || state.view !== '3d') { tp.run = false; quiet(); return; }
    if (!tp.run && !tp.bzT && !tp.bz) tp.bzT = setTimeout(() => { tp.bzT = 0; if (tp.run) tp.bz = busyOn('Układam tkaninę na sylwetce.'); }, 500);
    tp.run = true; tp.S.step(3); tp.done = tp.S.done;
    if (tp.done || tp.S.steps % 24 === 0) { tp.ready = true; render3d(); }
    if (!tp.done) requestAnimationFrame(() => topRun(tp)); else { tp.run = false; quiet(); }
  }
  function simRun(sim) {
    if (!g3 || g3.sim !== sim || state.view !== '3d') return;
    sim.step(8);
    if (sim.done || sim.steps % 24 === 0) { sim.ready = true; render3d(); }
    if (!sim.done) requestAnimationFrame(() => simRun(sim));
  }
  function surface(nu, nv, fn, mat) {
    const nc = nu + 1, pos = new Float32Array(nc * nv * 3), uv = new Float32Array(nc * nv * 2), cutV = new Uint8Array(nc * nv), idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nc; i++) {
      const p = fn(i / nu, j / (nv - 1)), q = j * nc + i;
      pos[q * 3] = p[0]; pos[q * 3 + 1] = p[1]; pos[q * 3 + 2] = p[2]; cutV[q] = p[3] ? 1 : 0; uv[q * 2] = p[4] || 0; uv[q * 2 + 1] = p[5] || 0;
    }
    const tri = (x, y, z) => { if (!(cutV[x] && cutV[y] && cutV[z])) idx.push(x, y, z); };
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu; i++) { const x = j * nc + i, y = x + 1, c = x + nc, d = y + nc; tri(x, y, c); tri(y, d, c); } // kolejność wierzchołków: lico na zewnątrz
    const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T3.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const nr = geo.attributes.normal.array; // sklejenie normalnych na szwie powłoki
    for (let j = 0; j < nv; j++) {
      const p = j * nc * 3, q = (j * nc + nu) * 3, x = nr[p] + nr[q], y = nr[p + 1] + nr[q + 1], z = nr[p + 2] + nr[q + 2], l = Math.hypot(x, y, z) || 1;
      nr[p] = nr[q] = x / l; nr[p + 1] = nr[q + 1] = y / l; nr[p + 2] = nr[q + 2] = z / l;
    }
    return new T3.Mesh(geo, mat);
  }
  // tekstury splotów rysowane w locie (kafelek powtarzalny, skala w cm)
  const texCache = {};
  function fabTex(id) {
    if (texCache[id]) return texCache[id];
    const N = 256, mk = (fn) => {
      const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = Math.max(0, Math.min(255, fn(x, y))), q = (y * N + x) * 4; im.data[q] = im.data[q + 1] = im.data[q + 2] = v; im.data[q + 3] = 255; }
      g.putImageData(im, 0, 0);
      const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = g3 ? g3.renderer.capabilities.getMaxAnisotropy() : 4; return t;
    };
    const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const weave = (cell) => (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell), fx = (x % cell) / cell - 0.5, fy = (y % cell) / cell - 0.5, over = (i + j) % 2; return 150 + (over ? 105 * (1 - 4 * fy * fy) : 70 * (1 - 4 * fx * fx)) + rnd(x, y) * 12; };
    const D = {
      bawelna: { tile: 3.6, rough: 0.92, metal: 0, bump: 0.16, map: weave(8) },
      szyfon: { tile: 1.6, rough: 0.55, metal: 0, bump: 0.05, opacity: 0.78, map: weave(4) },
      wiskoza: { tile: 5, rough: 0.72, metal: 0, bump: 0.1, map: (x, y) => 175 + 80 * (0.5 * rnd(x >> 1, y >> 1) + 0.5 * rnd(x >> 2, (y >> 2) + 9)) },
      dzersej: { tile: 3.4, rough: 0.86, metal: 0, bump: 0.16, map: (x, y) => { const fx = (x % 8) / 8, s = Math.abs(fx - 0.5) * 2; return 150 + 105 * (1 - s) * (0.75 + 0.25 * Math.cos((2 * Math.PI * (y + 6 * s)) / 8)) + rnd(x, y) * 6; } },
      welna: { tile: 4.6, rough: 0.98, metal: 0, bump: 0.2, map: (x, y) => 150 + (((x + y) % 8) < 4 ? 95 : 10) * (0.8 + 0.2 * Math.cos((2 * Math.PI * x) / 4)) + rnd(x, y) * 16 },
      tafta: { tile: 6, rough: 0.3, metal: 0.1, bump: 0.02, map: (x, y) => 232 + 16 * rnd(0, y >> 1) + 5 * rnd(x, y) },
      tiul: { tile: 7, rough: 0.8, metal: 0, bump: 0, opacity: 1, net: true, map: () => 255,
        alpha: (x, y) => { const a = (x + y) % 16, b = (x - y + 256) % 16, d = Math.min(a, 16 - a, b, 16 - b); return d < 1.8 ? 255 : 30; } },
    };
    const d = D[id] || D.bawelna, out = { tile: d.tile, rough: d.rough, metal: d.metal, bump: d.bump, opacity: d.opacity, net: d.net, map: mk(d.map), alpha: d.alpha ? mk(d.alpha) : null };
    return (texCache[id] = out);
  }
  // wzór + splot w jednym kafelku (wspólna skala), żeby nadruk i faktura trzymały się razem
  let printSet = null;
  function printTex(tx) {
    const key = [state.fabric, state.print, state.color, state.color2, state.print === 'wlasny' ? customImg && customImg._id : ''].join('|');
    if (printSet && printSet.key === key) return printSet;
    if (printSet) for (const t of [printSet.map, printSet.bumpT, printSet.alpha]) if (t) t.dispose();
    const N = 512, pr = P.LIST.find((q) => q.id === state.print), tile = pr ? pr.tile : 22;
    const src = state.print === 'wlasny' ? customImg : P.render(state.print, state.color, state.color2, N);
    const reps = Math.max(1, Math.round(tile / tx.tile)), sc = N / reps / 256;
    const layer = (img, base, over) => {
      const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      if (base) g.drawImage(base, 0, 0, N, N);
      const pat = g.createPattern(img, 'repeat'); pat.setTransform(new DOMMatrix().scale(sc)); if (over) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; }
      g.fillStyle = pat; g.fillRect(0, 0, N, N);
      const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = g3.renderer.capabilities.getMaxAnisotropy(); return t;
    };
    printSet = { key, tile, map: layer(tx.map.image, src, true), bumpT: tx.bump ? layer(tx.map.image) : null, alpha: tx.alpha ? layer(tx.alpha.image) : null };
    return printSet;
  }
  // sylwetka: siatka bazowa MakeHuman (CC0), dopasowywana do wzrostu i obwodów modelki
  let FIG = null;
  function figData() {
    if (FIG || !window.WYKROJ_FIG) return FIG;
    const F = window.WYKROJ_FIG, dec = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    const q = new Int16Array(dec(F.P)), P = new Float32Array(q.length); for (let i = 0; i < q.length; i++) P[i] = q[i] / 2000;
    FIG = { P, T: new Uint16Array(dec(F.T)), H: F.H, lv: F.lv, n: F.n, half: F.half, zc: F.zc };
    return FIG;
  }
  const pw = (knots) => (x) => { if (x <= knots[0][0]) return knots[0][1]; for (let i = 1; i < knots.length; i++) if (x <= knots[i][0]) return knots[i - 1][1] + ((x - knots[i - 1][0]) / (knots[i][0] - knots[i - 1][0])) * (knots[i][1] - knots[i - 1][1]); return knots[knots.length - 1][1]; };
  function init3d() {
    if (g3 || !T3) return !!g3;
    try {
      const canvas = $('gl'), renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new T3.Scene(), camera = new T3.PerspectiveCamera(32, 1, 30, 1500);
      scene.add(new T3.HemisphereLight(0xfff4e6, 0x20242e, 0.95));
      const d1 = new T3.DirectionalLight(0xffffff, 0.75); d1.position.set(120, 200, 180); scene.add(d1);
      const d2 = new T3.DirectionalLight(0x9fb4ff, 0.3); d2.position.set(-160, 60, -120); scene.add(d2);
      g3 = { canvas, renderer, scene, camera, group: null, mid: 0 };
      let dr = null;
      canvas.addEventListener('pointerdown', (e) => { dr = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
      canvas.addEventListener('pointermove', (e) => { if (!dr) return; cam.yaw = dr.yaw - (e.clientX - dr.x) * 0.008; cam.pitch = Math.max(-0.3, Math.min(1.1, dr.pitch + (e.clientY - dr.y) * 0.006)); paint3d(); });
      const end = () => { dr = null; canvas.classList.remove('drag'); };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(80, Math.min(700, cam.dist * Math.exp(e.deltaY * 0.0012))); paint3d(); showZoom(); }, { passive: false });
      return true;
    } catch (e) { g3 = null; return false; }
  }
  function paint3d() {
    const r = g3.canvas.getBoundingClientRect(); if (r.width < 2) return;
    g3.renderer.setSize(r.width, r.height, false); g3.camera.aspect = r.width / r.height; g3.camera.updateProjectionMatrix();
    const cp = Math.cos(cam.pitch);
    g3.camera.position.set(Math.sin(cam.yaw) * cp * cam.dist, g3.mid + Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist);
    g3.camera.lookAt(0, g3.mid, 0); g3.renderer.render(g3.scene, g3.camera);
  }
  function render3d(refit) {
    if (!init3d()) { say('Podgląd 3D nie działa w tym widoku (brak WebGL).', true); return; }
    const m = cur(), p = state.p, a = W.full(m), sil = model.d.sil, body = bodyFn(m, a), TAU = Math.PI * 2;
    if (g3.group) { g3.scene.remove(g3.group); g3.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    const FG = figData(), fs = FG ? m.wzrost / FG.H : 0, headLen = FG ? (FG.H - FG.lv.neck) * fs : m.wzrost * 0.165;
    const grp = new T3.Group(), floor = -(m.wzrost - a.Dts - headLen);
    // manekin
    const bm = new T3.MeshStandardMaterial({ color: state.figure ? 0xd2c8b6 : 0xcdc3ae, roughness: state.figure ? 0.85 : 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
    const NB = 64;
    const useFig = state.figure && !!FG;
    if (!useFig) grp.add(surface(72, NB, (u, v) => {
      const y = body.top + (body.bottom - body.top) * v, s = body(y);
      const k = v < 0.001 || v > 0.999 ? 0.02 : v < 0.03 ? 0.75 : v > 0.97 ? 0.8 : 1;
      const x = s.a * Math.cos(u * TAU) * k, sn = Math.sin(u * TAU);
      let z = s.z + s.b * sn * k + (state.bust ? body.bump(x, y, sn, false) : body.bump(x, y, sn, true) * 0.6);
      z -= body.butt(x, y, sn, s.a);
      return [x, y, z];
    }, bm));
    // proporcje orientacyjne: talia 62% wzrostu, kolano 28,5%, kostka 4%
    const H = m.wzrost, legH = -m.wb - floor, kneeY = floor + legH * (FG ? FG.lv.knee / FG.lv.hip : 0.58), ankleY = floor + legH * (FG ? FG.lv.ankle / FG.lv.hip : 0.09), hemY = -p.dl;
    let figArm = null; // przy sylwetce: czy punkt ubrania leży już w ramieniu (wtedy jest wycinany, żeby ręka nie szarpała krawędzi pachy)
    let figArmAt = null; // przy sylwetce: oś i promień ręki w odległości t od barku, po niej układa się rękaw
    let figFit = null, figDrape = null, figShX = 0, figTop = null, figCol = null, figArmP = null, figClear = null; // przy włączonej sylwetce ubranie jest wypychane na zewnątrz ciała, żeby siatka nie przebijała przez tkaninę
    if (useFig) {
      const lv = FG.lv, hipA = body(-m.wb).a, yb1 = a.Dps - a.Wg;
      let nkF = a.Dts, yMap = pw([[0, floor], [lv.hip, -m.wb], [lv.waist, 0], [lv.bust, yb1], [lv.neck, nkF], [FG.H, nkF + headLen]]);
      const rH = (m.ob * 0.97) / (lv.gH * fs), rW = (m.ot * 0.97) / (lv.gW * fs), rB = (m.og * 0.97) / (lv.gB * fs), rL = Math.max(0.85, Math.min(1.25, Math.sqrt(rH)));
      const ratio = pw([[0, rL], [lv.knee, rL], [lv.hip, rH], [lv.waist, rW], [lv.bust, rB], [lv.bust + 0.7, (rB + 1) / 2 * 0.98], [lv.neck - 0.4, 0.94], [lv.neck + 0.35, 1], [FG.H, 1]]);
      const tab = (arr, y) => { const t = Math.max(0, Math.min(FG.n - 1.001, (y / FG.H) * (FG.n - 1))), i = Math.floor(t); return arr[i] + (arr[i + 1] - arr[i]) * (t - i); };
      const zModel = (Y) => { const yy = Math.max(-m.wb, Math.min(a.Dts, Y)), s = body(yy); return s.z + 0.5 * body.bump(a.Rg / 2, yy, 1, false) - 0.5 * body.butt(hipA * 0.42, yy, -1, hipA); };
      const n = FG.P.length / 3, pos = new Float32Array(n * 3), crotch = 7.4, armF = new Uint8Array(n);
      const cupD = Math.max(-2.2, Math.min(5, (body.bh - 4.7) * 0.9)); // siatka bazowa ma mniej więcej miseczkę B
      const mkPos = () => { for (let i = 0; i < n; i++) {
        const x = FG.P[i * 3], y = FG.P[i * 3 + 1], z = FG.P[i * 3 + 2], ax = Math.abs(x), arm = ax > (y >= 12 ? 1.75 : 1.5 + (12 - y) * 0.55);
        const r = ratio(y), yc = Math.max(lv.hip, Math.min(lv.neck, y)), Y = yMap(y); armF[i] = arm ? 1 : 0;
        const close = y < crotch ? (1 - y / crotch) * 0.85 : 0; // nogi bliżej siebie niż w siatce bazowej, żeby mieściły się w wąskich spódnicach
        pos[i * 3] = arm ? Math.sign(x) * (ax + (r - 1) * tab(FG.half, y)) * fs : (x * r - Math.sign(x) * Math.min(close, ax * 0.9)) * fs;
        pos[i * 3 + 1] = Y;
        pos[i * 3 + 2] = (z - tab(FG.zc, yc)) * (arm ? 1 : r) * fs + zModel(yMap(yc));
        if (!arm && cupD) { const dz = (z - tab(FG.zc, yc)) * fs, dyb = Y - yb1; if (dz > 0 && Math.abs(dyb) < 14) pos[i * 3 + 2] += cupD * Math.exp(-Math.pow(dyb / (dyb > 0 ? 6 : 5), 2) - Math.pow((Math.abs(pos[i * 3]) - a.Rg / 2) / Math.max(4.2, a.Rg * 0.36), 2)) * sstep(dz / 4); }
      } };
      mkPos();
      { // dopasowanie wysokości barków sylwetki do wymiarów: droga po ciele od talii przez ramię przy szyi z powrotem do talii ma mieć długość tyłu plus długość przodu z wykroju
        const nbn = Math.ceil(a.Dts + 9), zl = new Float32Array(nbn).fill(1e9), zh = new Float32Array(nbn).fill(-1e9); let top = 0;
        for (let t = 0; t < FG.T.length; t += 3) {
          const i0 = FG.T[t], i1 = FG.T[t + 1], i2 = FG.T[t + 2]; if (armF[i0] || armF[i1] || armF[i2]) continue; const p0 = i0 * 3, p1 = i1 * 3, p2 = i2 * 3;
          if (Math.min(Math.abs(pos[p0]), Math.abs(pos[p1]), Math.abs(pos[p2])) > 9.5 || Math.max(Math.abs(pos[p0]), Math.abs(pos[p1]), Math.abs(pos[p2])) < 6.5 || Math.max(pos[p0 + 1], pos[p1 + 1], pos[p2 + 1]) < -1) continue;
          for (let u = 0; u <= 8; u++) for (let v = 0; u + v <= 8; v++) { const b1 = u / 8, b2 = v / 8, b0 = 1 - b1 - b2, X = Math.abs(pos[p0] * b0 + pos[p1] * b1 + pos[p2] * b2), Y = pos[p0 + 1] * b0 + pos[p1 + 1] * b1 + pos[p2 + 1] * b2; if (X < 7 || X > 9 || Y < -0.5 || Y >= nbn - 1) continue; const b = Math.round(Y), z = pos[p0 + 2] * b0 + pos[p1 + 2] * b1 + pos[p2 + 2] * b2; if (z < zl[b]) zl[b] = z; if (z > zh[b]) zh[b] = z; if (Y > top) top = Y; }
        }
        const nT = Math.round(top); let okc = nT > yb1 + 6 && zl[0] < 1e8;
        for (let b = 1; b <= nT && okc; b++) if (zl[b] > 1e8) { zl[b] = zl[b - 1]; zh[b] = zh[b - 1]; }
        if (okc) {
          const loop = (sc) => { let L = 0; for (let b = 1; b <= nT; b++) { const dy = b > yb1 ? sc : 1; L += Math.hypot(dy, zl[b] - zl[b - 1]) + Math.hypot(dy, zh[b] - zh[b - 1]); } return L + Math.max(0, zh[nT] - zl[nT]); };
          const target = a.Dts + a.Dps - 1.5; let lo = 0.82, hi = 1.1; for (let it = 0; it < 24; it++) { const mid = (lo + hi) / 2; if (loop(mid) > target) hi = mid; else lo = mid; }
          const sc = (lo + hi) / 2; if (Math.abs(sc - 1) > 0.008) { nkF = yb1 + (a.Dts - yb1) * sc; yMap = pw([[0, floor], [lv.hip, -m.wb], [lv.waist, 0], [lv.bust, yb1], [lv.neck, nkF], [FG.H, nkF + headLen]]); mkPos(); }
        }
      }
      const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setIndex(new T3.BufferAttribute(FG.T, 1)); geo.computeVertexNormals();
      grp.add(new T3.Mesh(geo, bm));
      { // mapa promieni tułowia i nóg (bez rąk) wokół osi manekina: co 1 cm wysokości i co 3,75 stopnia
        const y0m = Math.floor(floor), ny = Math.ceil(a.Dts + 6 - y0m) + 1, NPH = 96, Rm = new Float32Array(ny * NPH), cz = new Float32Array(ny);
        for (let i = 0; i < ny; i++) cz[i] = body(Math.max(-m.wb, Math.min(a.Dts, y0m + i))).z;
        const yPit = a.Dts - a.Gp - 1, xTip = a.Sb / 2 + 0.8, slv = !!sil.sleeve && p.gora !== 'bez', yArmLim = slv ? Math.min(a.Dts - 11, yPit + 2) : a.Dts - 11, xTipS = xTip + (slv ? 1.5 : 0); // z rękawem stanik obejmuje też nasadę ręki
        const put = (x, Y, z, isA) => { const iy = Math.round(Y - y0m); if (iy < 0 || iy >= ny || (isA ? Math.abs(x) > xTipS : Y > yPit && Math.abs(x) > xTip)) return; const dz = z - cz[iy]; let ph = Math.atan2(dz, x); if (ph < 0) ph += TAU; const k = iy * NPH + Math.min(NPH - 1, Math.floor((ph / TAU) * NPH)), r = Math.hypot(x, dz); if (r > Rm[k]) Rm[k] = r; };
        for (let t = 0; t < FG.T.length; t += 3) {
          const i0 = FG.T[t] * 3, i1 = FG.T[t + 1] * 3, i2 = FG.T[t + 2] * 3;
          const isArm = armF[i0 / 3] || armF[i1 / 3] || armF[i2 / 3]; // z ręki do mapy wchodzi tylko czapka barku, na której leży ramię ubrania
          if (isArm && Math.max(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1]) < yArmLim) continue;
          for (let u = 0; u <= 4; u++) for (let v = 0; u + v <= 4; v++) { const b1 = u / 4, b2 = v / 4, b0 = 1 - b1 - b2; if (isArm && pos[i0 + 1] * b0 + pos[i1 + 1] * b1 + pos[i2 + 1] * b2 < yArmLim) continue; put(pos[i0] * b0 + pos[i1] * b1 + pos[i2] * b2, pos[i0 + 1] * b0 + pos[i1 + 1] * b1 + pos[i2 + 1] * b2, pos[i0 + 2] * b0 + pos[i1 + 2] * b1 + pos[i2 + 2] * b2, isArm); }
        }
        const Rd = new Float32Array(ny * NPH);
        for (let iy = 0; iy < ny; iy++) for (let ip = 0; ip < NPH; ip++) { let mx = 0; for (let dy = -1; dy <= 1; dy++) { const jy = iy + dy; if (jy < 0 || jy >= ny) continue; for (let dp = -1; dp <= 1; dp++) mx = Math.max(mx, Rm[jy * NPH + ((ip + dp + NPH) % NPH)]); } Rd[iy * NPH + ip] = mx; }
        // wygładzenie, żeby wypchnięta tkanina nie miała schodków
        for (let pass = 0; pass < 2; pass++) { const src = Rd.slice(); for (let iy = 1; iy < ny - 1; iy++) for (let ip = 0; ip < NPH; ip++) { const c = src[iy * NPH + ip]; if (!c) continue; let sum = 0, cnt = 0; for (let dy = -1; dy <= 1; dy++) for (let dp = -2; dp <= 2; dp++) { const v = src[(iy + dy) * NPH + ((ip + dp + NPH) % NPH)]; if (v) { sum += v; cnt++; } } Rd[iy * NPH + ip] = Math.max(c - 0.3, sum / cnt); } }
        // powłoka dla ubrań dopasowanych: otoczka wypukła każdego przekroju (tkanina nie wchodzi między piersi ani w zagłębienie pleców),
        // a między biodrami i pachą dodatkowo łagodne przejścia w pionie, bo materiał pod biustem się napina, zamiast wklejać się w ciało
        const Hd = new Float32Array(ny * NPH), crs = (o, p1, p2) => (p1[0] - o[0]) * (p2[1] - o[1]) - (p1[1] - o[1]) * (p2[0] - o[0]);
        for (let iy = 0; iy < ny; iy++) {
          const P = []; for (let ip = 0; ip < NPH; ip++) { const r = Rd[iy * NPH + ip]; Hd[iy * NPH + ip] = r; if (r > 0) { const ph = ((ip + 0.5) / NPH) * TAU; P.push([r * Math.cos(ph), r * Math.sin(ph)]); } }
          if (P.length < 8) continue;
          P.sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]); const lo = [], up = [];
          for (const pt of P) { while (lo.length >= 2 && crs(lo[lo.length - 2], lo[lo.length - 1], pt) <= 0) lo.pop(); lo.push(pt); }
          for (let i = P.length - 1; i >= 0; i--) { const pt = P[i]; while (up.length >= 2 && crs(up[up.length - 2], up[up.length - 1], pt) <= 0) up.pop(); up.push(pt); }
          const Hl = lo.slice(0, -1).concat(up.slice(0, -1));
          for (let ip = 0; ip < NPH; ip++) {
            const ph = ((ip + 0.5) / NPH) * TAU, dx = Math.cos(ph), dz = Math.sin(ph); let best = Rd[iy * NPH + ip];
            for (let j = 0; j < Hl.length; j++) { const A = Hl[j], B = Hl[(j + 1) % Hl.length], ex = B[0] - A[0], ez = B[1] - A[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const sR = (A[0] * ez - A[1] * ex) / den, tE = (A[0] * dz - A[1] * dx) / den; if (sR > 0 && tE >= -1e-6 && tE <= 1 + 1e-6 && sR > best) best = sR; }
            Hd[iy * NPH + ip] = best;
          }
        }
        { const iA = Math.max(0, Math.round(-m.wb - y0m)), iB = Math.min(ny - 1, Math.round(yPit - y0m)), sl = 0.75;
          for (let iy = iB - 1; iy >= iA; iy--) for (let ip = 0; ip < NPH; ip++) Hd[iy * NPH + ip] = Math.max(Hd[iy * NPH + ip], Hd[(iy + 1) * NPH + ip] - sl);
          for (let iy = iA + 1; iy <= iB; iy++) for (let ip = 0; ip < NPH; ip++) Hd[iy * NPH + ip] = Math.max(Hd[iy * NPH + ip], Hd[(iy - 1) * NPH + ip] - sl * 2); }
        figFit = (q, e, w) => { // dosuwa punkt ubrania do powłoki sylwetki powiększonej o luz e
          const fy = q[1] - y0m, iy = Math.floor(fy); if (iy < 0 || iy >= ny - 1) return q;
          const ty = fy - iy, czz = cz[iy] + (cz[iy + 1] - cz[iy]) * ty, dz = q[2] - czz, r = Math.hypot(q[0], dz); if (r < 1e-6) return q; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
          const fp = (ph / TAU) * NPH - 0.5, ip = Math.floor(fp), tp = fp - ip, i0 = (ip + NPH) % NPH, i1 = (ip + 1) % NPH;
          const h = (Hd[iy * NPH + i0] * (1 - tp) + Hd[iy * NPH + i1] * tp) * (1 - ty) + (Hd[(iy + 1) * NPH + i0] * (1 - tp) + Hd[(iy + 1) * NPH + i1] * tp) * ty; if (!(h > 0)) return q;
          // nad pachą punkt, pod którym na tej wysokości nie ma już ciała, po bokach zostaje na miejscu: opadnie na bark w następnym kroku
          if (q[1] > yPit - 4) w *= 1 - sstep((q[1] - (yPit - 4)) / 6) * sstep((Math.abs(q[0]) / r - 0.5) / 0.3);
          const k = (r + (h + e - r) * w) / r; q[0] *= k; q[2] = czz + dz * k; return q;
        };
        { // mapa wysokości barków i ramion widzianych z góry: tkanina, pod którą na danej wysokości nie ma już ciała, opada na bark, a poza nim zwisa
          const hx0 = -Math.ceil(a.Sb / 2 + 16), hnx = -2 * hx0 + 1, yLo = yPit - 6, zNk = body(a.Dts).z, rNk = a.os / TAU + 1.6; let zlo = 1e9, zhi = -1e9;
          for (let i = 0; i < n; i++) if (pos[i * 3 + 1] >= yLo && Math.abs(pos[i * 3]) < -hx0) { zlo = Math.min(zlo, pos[i * 3 + 2]); zhi = Math.max(zhi, pos[i * 3 + 2]); }
          const hz0 = Math.floor(zlo) - 8, hnz = Math.ceil(zhi) + 8 - hz0 + 1, Hs = new Float32Array(hnx * hnz).fill(-1e9);
          for (let t = 0; t < FG.T.length; t += 3) {
            const i0 = FG.T[t] * 3, i1 = FG.T[t + 1] * 3, i2 = FG.T[t + 2] * 3; if (Math.max(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1]) < yLo || Math.min(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1]) > a.Dts + 6) continue; // bez głowy: nad barkiem przy szyi liczy się skóra barku, nie wystający nad nim podbródek
            for (let u = 0; u <= 6; u++) for (let v = 0; u + v <= 6; v++) { const b1 = u / 6, b2 = v / 6, b0 = 1 - b1 - b2, ix = Math.round(pos[i0] * b0 + pos[i1] * b1 + pos[i2] * b2 - hx0), iz = Math.round(pos[i0 + 2] * b0 + pos[i1 + 2] * b1 + pos[i2 + 2] * b2 - hz0); if (ix < 0 || iz < 0 || ix >= hnx || iz >= hnz) continue; const Y = pos[i0 + 1] * b0 + pos[i1 + 1] * b1 + pos[i2 + 1] * b2; if (Y > Hs[iz * hnx + ix] && Y <= a.Dts + 6 && !(Y > a.Dts + 1 && Math.hypot(ix + hx0, iz + hz0 - zNk) < rNk)) Hs[iz * hnx + ix] = Y; } // szyja i głowa nie należą do tej mapy: od szyi tkanina jest odpychana na boki, nie w górę
          }
          // mapa samej skóry (bez dociągania poza obrys ciała) do kolizji: drobne dziury między próbkami są zalepiane
          const Hr = Hs.slice(); for (let pass = 0; pass < 2; pass++) { const src = Hr.slice(); for (let iz = 1; iz < hnz - 1; iz++) for (let ix = 1; ix < hnx - 1; ix++) { if (src[iz * hnx + ix] > -1e8) continue; let sum = 0, c = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const v = src[(iz + dz) * hnx + ix + dx]; if (v > -1e8) { sum += v; c++; } } if (c >= 4) Hr[iz * hnx + ix] = sum / c; } }
          const sl = 1.3, rx = (iz, ix, dz, dx, d) => { const jz = iz + dz, jx = ix + dx; if (jz < 0 || jx < 0 || jz >= hnz || jx >= hnx) return; const v = Hs[jz * hnx + jx] - sl * d; if (v > Hs[iz * hnx + ix]) Hs[iz * hnx + ix] = v; };
          for (let pass = 0; pass < 2; pass++) {
            for (let iz = 0; iz < hnz; iz++) for (let ix = 0; ix < hnx; ix++) { rx(iz, ix, 0, -1, 1); rx(iz, ix, -1, 0, 1); rx(iz, ix, -1, -1, 1.414); rx(iz, ix, -1, 1, 1.414); }
            for (let iz = hnz - 1; iz >= 0; iz--) for (let ix = hnx - 1; ix >= 0; ix--) { rx(iz, ix, 0, 1, 1); rx(iz, ix, 1, 0, 1); rx(iz, ix, 1, 1, 1.414); rx(iz, ix, 1, -1, 1.414); }
          }
          for (let pass = 0; pass < 2; pass++) { const src = Hs.slice(); for (let iz = 1; iz < hnz - 1; iz++) for (let ix = 1; ix < hnx - 1; ix++) { let sum = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) sum += src[(iz + dz) * hnx + ix + dx]; Hs[iz * hnx + ix] = Math.max(src[iz * hnx + ix] - 0.4, sum / 9); } }
          figTop = (x, z) => { const fx = x - hx0, fz = z - hz0, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= hnx - 1 || iz >= hnz - 1) return -1e9; const tx2 = fx - ix, tz = fz - iz; const h00 = Hr[iz * hnx + ix], h01 = Hr[iz * hnx + ix + 1], h10 = Hr[(iz + 1) * hnx + ix], h11 = Hr[(iz + 1) * hnx + ix + 1]; if (h00 < -1e8 || h01 < -1e8 || h10 < -1e8 || h11 < -1e8) return -1e9; return (h00 * (1 - tx2) + h01 * tx2) * (1 - tz) + (h10 * (1 - tx2) + h11 * tx2) * tz; };
          figDrape = (q, e) => {
            if (q[1] <= yPit - 2) return q; const fx = q[0] - hx0, fz = q[2] - hz0, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= hnx - 1 || iz >= hnz - 1) return q;
            const tx2 = fx - ix, tz = fz - iz, top = (Hs[iz * hnx + ix] * (1 - tx2) + Hs[iz * hnx + ix + 1] * tx2) * (1 - tz) + (Hs[(iz + 1) * hnx + ix] * (1 - tx2) + Hs[(iz + 1) * hnx + ix + 1] * tx2) * tz + e;
            if (q[1] > top) q[1] += (top - q[1]) * sstep((q[1] - (yPit - 2)) / 4); return q;
          };
        }
        // przekrój ramienia na każdej wysokości jako okrąg (środek i promień): ubranie nie może leżeć w środku ręki
        const ax = new Float32Array(ny), az = new Float32Array(ny), ar = new Float32Array(ny), an = new Float32Array(ny);
        for (let i = 0; i < n; i++) { if (!armF[i] || pos[i * 3 + 1] < yPit - 14) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) { ax[iy] += Math.abs(pos[i * 3]); az[iy] += pos[i * 3 + 2]; an[iy]++; } }
          for (let iy = 0; iy < ny; iy++) if (an[iy]) { ax[iy] /= an[iy]; az[iy] /= an[iy]; }
          for (let i = 0; i < n; i++) { if (!armF[i] || pos[i * 3 + 1] < yPit - 14) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) ar[iy] += Math.hypot(Math.abs(pos[i * 3]) - ax[iy], pos[i * 3 + 2] - az[iy]) / an[iy]; }
        { // oś ręki: dwa proste odcinki (ramię i przedramię) dopasowane do środków przekrojów, promień wygładzony
          const yS = nkF - 3, all = []; for (let iy = ny - 1; iy >= 0; iy--) if (an[iy] >= 8 && y0m + iy < yS - 3 && y0m + iy > yS - 60) all.push([y0m + iy, ax[iy], az[iy], ar[iy]]);
          const seg = (rows) => { const nR = rows.length, my = rows.reduce((s2, r) => s2 + r[0], 0) / nR, f = (k) => { const mv = rows.reduce((s2, r) => s2 + r[k], 0) / nR; let num = 0, den = 0; for (const r of rows) { num += (r[0] - my) * (r[k] - mv); den += (r[0] - my) * (r[0] - my); } const sl = num / (den || 1); return (y) => mv + sl * (y - my); }; return [f(1), f(2), f(3)]; };
          const up = all.filter((r) => r[0] > yS - 27), lowR = all.filter((r) => r[0] <= yS - 27);
          if (up.length > 6) {
            const A1 = seg(up), A2 = lowR.length > 6 ? seg(lowR) : A1, yE = yS - 27, x0 = Math.min(A1[0](yS), a.Sb / 2 - 1), z0 = A1[1](yS);
            const d1 = [A1[0](yE) - A1[0](yS), -27, A1[1](yE) - A1[1](yS)], l1 = Math.hypot(d1[0], d1[1], d1[2]), d2 = [A2[0](yE - 20) - A2[0](yE), -20, A2[1](yE - 20) - A2[1](yE)], l2 = Math.hypot(d2[0], d2[1], d2[2]);
            figShX = A1[0](yS);
            figArmAt = (sx, t) => {
              const s1 = Math.min(t, l1) / l1, s3 = Math.max(0, t - l1) / l2, c = [x0 + d1[0] * s1 + d2[0] * s3, yS + d1[1] * s1 + d2[1] * s3, z0 + d1[2] * s1 + d2[2] * s3], dd = t < l1 ? d1 : d2, an2 = Math.atan2(dd[0], -dd[1]);
              return { c: [sx * c[0], c[1], c[2]], r: Math.max(2.5, (t < l1 ? A1 : A2)[2](c[1])), ca: Math.cos(an2), sa: Math.sin(an2) };
            };
            { // dokładniejsza oś ręki: łamana przez wygładzone środki przekrojów, żeby rękaw szedł po ręce także za łokciem
              const bx = new Float32Array(ny), bz = new Float32Array(ny), bn = new Float32Array(ny), rz = new Float32Array(ny), rx2 = new Float32Array(ny);
              for (let i = 0; i < n; i++) { if (!armF[i]) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) { bx[iy] += Math.abs(pos[i * 3]); bz[iy] += pos[i * 3 + 2]; bn[iy]++; } }
              for (let iy = 0; iy < ny; iy++) if (bn[iy]) { bx[iy] /= bn[iy]; bz[iy] /= bn[iy]; }
              for (let i = 0; i < n; i++) { if (!armF[i]) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) { rz[iy] = Math.max(rz[iy], Math.abs(pos[i * 3 + 2] - bz[iy])); rx2[iy] = Math.max(rx2[iy], Math.abs(Math.abs(pos[i * 3]) - bx[iy])); } }
              for (let iy = 0; iy < ny; iy++) rz[iy] = Math.min(rz[iy], rx2[iy]);
              const rows = []; for (let iy = ny - 1; iy >= 0; iy--) { const Y = y0m + iy; if (bn[iy] >= 8 && Y < yPit - 2 && Y > yS - 64) rows.push(iy); }
              if (rows.length > 20) {
                const smo = (arr, k) => rows.map((iy, j) => { let sum = 0, c = 0; for (let d = -k; d <= k; d++) { const r = rows[j + d]; if (r !== undefined) { sum += arr[r]; c++; } } return sum / c; });
                const X = smo(bx, 6), Z = smo(bz, 6), R = smo(rz, 5), P = [[x0, yS, z0, Math.min(8.5, R[0])]]; rows.forEach((iy, j) => { if (j % 3 === 0 || j === rows.length - 1) P.push([X[j], y0m + iy, Z[j], Math.min(8.5, R[j])]); }); // co trzeci przekrój: oś ręki bez drobnych zygzaków, które zawyżały jej długość
                { const A0 = P[0], A1 = P[1], Rm = Math.min(9.5, A1[3] * 1.2); A0[3] = A1[3] * 0.85; for (const f of [0.66, 0.33]) P.splice(1, 0, [A0[0] + (A1[0] - A0[0]) * f, A0[1] + (A1[1] - A0[1]) * f, A0[2] + (A1[2] - A0[2]) * f, f > 0.5 ? Rm : (Rm + A0[3]) / 2]); } // nasada ręki jest grubsza niż ramię niżej
                figArmP = { P, tPit: 0 };
                const S = [0]; for (let j = 1; j < P.length; j++) S.push(S[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1], P[j][2] - P[j - 1][2]));
                figArmP.tPit = Math.max(2, S[3] - 3);
                figArmAt = (sx, t) => {
                  let j = 1; while (j < P.length - 1 && S[j] < t) j++;
                  const k = (t - S[j - 1]) / (S[j] - S[j - 1] || 1), A = P[j - 1], B = P[j], c = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
                  const T0 = P[Math.max(0, j - 2)], T1 = P[Math.min(P.length - 1, j + 1)], an2 = Math.atan2(T1[0] - T0[0], -(T1[1] - T0[1]));
                  return { c: [sx * c[0], c[1], c[2]], r: Math.max(2.2, A[3] + (B[3] - A[3]) * Math.max(0, Math.min(1, k))), ca: Math.cos(an2), sa: Math.sin(an2) };
                };
              }
            }
          }
        }
        const armOut = (q) => { // nad pachą tkanina układa się na ramieniu, pod pachą zostaje między ręką a tułowiem
          const iy = Math.round(q[1] - y0m); if (iy < 0 || iy >= ny || an[iy] < 4) return;
          const sx = q[0] < 0 ? -1 : 1, dx = Math.abs(q[0]) - ax[iy], dz2 = q[2] - az[iy], d = Math.hypot(dx, dz2), R = ar[iy] + 0.45; if (d >= R) return;
          if (q[1] > yPit - 1) { const k = R / (d || 1e-6); q[0] = sx * (ax[iy] + dx * k); q[2] = az[iy] + dz2 * k; }
          else if (!(sil.sleeve && p.gora !== 'bez')) { const nx = ax[iy] - Math.sqrt(Math.max(0, R * R - dz2 * dz2)); if (Math.abs(q[0]) > nx) q[0] = sx * Math.max(0, nx); }
        };
        figCol = (q, e, arms) => {
          let hit = false; const fy = q[1] - y0m, iy = Math.floor(fy);
          if (iy >= 0 && iy < ny - 1) {
            const ty = fy - iy, czz = cz[iy] + (cz[iy + 1] - cz[iy]) * ty, dz = q[2] - czz; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
            const fp = (ph / TAU) * NPH - 0.5, ip = Math.floor(fp), tp = fp - ip, i0 = (ip + NPH) % NPH, i1 = (ip + 1) % NPH;
            const base = (Rd[iy * NPH + i0] * (1 - tp) + Rd[iy * NPH + i1] * tp) * (1 - ty) + (Rd[(iy + 1) * NPH + i0] * (1 - tp) + Rd[(iy + 1) * NPH + i1] * tp) * ty, need = base + e, r = Math.hypot(q[0], dz);
            let up = false;
            if (q[1] > Math.max(yPit - 1, a.Dts - 11) && figTop) { const top = figTop(q[0], q[2]) + e * 1.5 + 0.35, dv = top - q[1]; if (dv > 0 && (dv < 3.5 || (base > 0.5 && r < need && dv < need - r))) { q[1] = top; up = true; hit = true; } } // punkt tuż pod skórą barku albo ramienia idzie w górę
            if (!up && base > 0.5 && r < need) {
              { if (r < 1e-6) { q[2] = czz + need; } else { const k = need / r; q[0] *= k; q[2] = czz + dz * k; } }
              hit = true;
            }
          }
          if (arms && figArmP) {
            const P = figArmP.P, sx = q[0] < 0 ? -1 : 1, x = Math.abs(q[0]); let bd = 1e9, bx = 0, by = 0, bz = 0, bR = 0;
            if (q[1] < P[0][1] + 7 && q[1] > P[P.length - 1][1] - 6 && x > P[0][0] - 9) {
              for (let j = 1; j < P.length; j++) { const A = P[j - 1], B = P[j]; if (A[1] < q[1] - 9 || B[1] > q[1] + 9) continue; const ex = B[0] - A[0], ey = B[1] - A[1], ez = B[2] - A[2], l2 = ex * ex + ey * ey + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - A[0]) * ex + (q[1] - A[1]) * ey + (q[2] - A[2]) * ez) / l2)) : 0, cx = A[0] + ex * t, cy = A[1] + ey * t, cz2 = A[2] + ez * t, dd = Math.hypot(x - cx, q[1] - cy, q[2] - cz2); if (dd < bd) { bd = dd; bx = cx; by = cy; bz = cz2; bR = A[3] + (B[3] - A[3]) * t; } }
              const R = bR + e; if (bd < R && bd > 1e-6) { const k = R / bd; q[0] = sx * (bx + (x - bx) * k); q[1] = by + (q[1] - by) * k; q[2] = bz + (q[2] - bz) * k; hit = true; }
            }
          }
          return hit;
        };
        if (state.sim && window.Cloth && sil.top === 'dress') { // pole odległości od ciała: liczone raz dla danej sylwetki
          let ck = n; for (let i = 0; i < pos.length; i += 23) ck = (ck * 31 + Math.round(pos[i] * 50)) % 2147483647;
          if (!g3.sdf || g3.sdf.key !== ck) {
            const yL = floor - 1, yH = a.Dts + 9; let xa = 1e9, xb = -1e9, za = 1e9, zb = -1e9, vol = 0;
            for (let i = 0; i < n; i++) { const Y = pos[i * 3 + 1]; if (Y < yL - 2 || Y > yH + 2) continue; xa = Math.min(xa, pos[i * 3]); xb = Math.max(xb, pos[i * 3]); za = Math.min(za, pos[i * 3 + 2]); zb = Math.max(zb, pos[i * 3 + 2]); }
            for (let t = 0; t < FG.T.length; t += 3) { const p0 = FG.T[t] * 3, p1 = FG.T[t + 1] * 3, p2 = FG.T[t + 2] * 3; vol += pos[p0] * (pos[p1 + 1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2 + 1]) - pos[p0 + 1] * (pos[p1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2]) + pos[p0 + 2] * (pos[p1] * pos[p2 + 1] - pos[p1 + 1] * pos[p2]); }
            let ix = FG.T; if (vol < 0) { ix = new Uint32Array(FG.T.length); for (let t = 0; t < ix.length; t += 3) { ix[t] = FG.T[t]; ix[t + 1] = FG.T[t + 2]; ix[t + 2] = FG.T[t + 1]; } }
            g3.sdf = { key: ck, S: window.Cloth.sdf(pos, ix, [xa - 5, yL, za - 5], [xb + 5, yH, zb + 5], 1) };
          }
          const SD = g3.sdf.S; figCol = (q, e) => SD.push(q, e);
        }
        figClear = (q) => {
          const fy = q[1] - y0m, iy = Math.floor(fy); if (iy < 0 || iy >= ny - 1) return q;
          const ty = fy - iy, czz = cz[iy] + (cz[iy + 1] - cz[iy]) * ty, dz = q[2] - czz; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
          const fp = (ph / TAU) * NPH - 0.5, ip = Math.floor(fp), tp = fp - ip, i0 = (ip + NPH) % NPH, i1 = (ip + 1) % NPH;
          const need = (Rd[iy * NPH + i0] * (1 - tp) + Rd[iy * NPH + i1] * tp) * (1 - ty) + (Rd[(iy + 1) * NPH + i0] * (1 - tp) + Rd[(iy + 1) * NPH + i1] * tp) * ty + 0.5, r = Math.hypot(q[0], dz);
          if (need > 0.5 && r < need && r > 1e-6) { const k = need / r; q[0] *= k; q[2] = czz + dz * k; }
          armOut(q);
          return q;
        };
      }
      for (const sx of [-1, 1]) for (const [yy, jx, rr] of [[kneeY, 1.35, 6.4], [ankleY + 1, 1.62, 3.9]]) { const pts = []; for (let i = 0; i <= 40; i++) pts.push(new T3.Vector3(sx * (jx * rL - (1 - (yy === kneeY ? lv.knee : lv.ankle) / crotch) * 0.85) * fs + rr * rL * (m.wzrost / 170) * Math.cos((i / 40) * TAU), yy, zModel(-m.wb) + (yy === kneeY ? 2 : 0) + rr * rL * (m.wzrost / 170) * Math.sin((i / 40) * TAU))); grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x7fc4e8 }))); }
      const fl = new T3.Mesh(new T3.CylinderGeometry(42, 42, 0.6, 48), new T3.MeshStandardMaterial({ color: 0x8b8fa0, roughness: 0.9, transparent: true, opacity: 0.35 })); fl.position.y = floor - 0.3; grp.add(fl);
    } else {
      const sm = new T3.MeshStandardMaterial({ color: 0x3a3f4d, roughness: 0.6, metalness: 0.4 });
      const pole = new T3.Mesh(new T3.CylinderGeometry(1.4, 1.4, body.bottom - floor, 16), sm); pole.position.y = (body.bottom + floor) / 2; grp.add(pole);
      const base = new T3.Mesh(new T3.CylinderGeometry(22, 24, 2, 40), sm); base.position.y = floor + 1; grp.add(base);
    }
    { // gdzie wypada dół względem kolan i kostek
      const el = $('hemGap'), dK = hemY - kneeY, dA = hemY - ankleY, dF = hemY - floor; el.textContent = ''; el.className = 'float';
      const num = (v) => Object.assign(document.createElement('b'), { textContent: f1(Math.abs(v)) + ' cm' });
      if (sil.lower === 'none') { if (sil.crop > 0) el.append('Dół kończy się ', num(sil.crop), ' nad talią'); else el.append('Dół kończy się w talii'); }
      else if (sil.top === 'corset') el.append('Talia w gorsecie ', num(sil.c.waist), ', redukcja ', num(sil.c.gr));
      else if (dF < -1) { el.className = 'float low'; el.append('Dół leży na podłodze, za długa o ', num(dF)); }
      else if (dF < 1.5) el.append('Dół sięga do ziemi');
      else if (Math.abs(dK) < 1) el.append('Dół wypada na wysokości kolan');
      else if (dK > 0) el.append('Dół wypada ', num(dK), ' nad kolanem');
      else if (dA < 2) el.append('Dół sięga do kostek');
      else if (-dK <= dA) el.append('Dół wypada ', num(dK), ' pod kolanem');
      else el.append('Dół wypada ', num(dA), ' nad kostką');
      if (sil.top !== 'corset' && sil.lower !== 'none') el.append(' · wzrost ' + Math.round(H) + ' cm');
    }
    const nBody = grp.children.length; // przy pustym projekcie wszystko dodane dalej jest zdejmowane: zostaje sam manekin
    // ubranie
    const yBot = sil.lower === 'none' ? (sil.crop > 0 ? sil.crop : -0.3) : -p.dl; // top kończy się w talii albo nad nią
    const er = (y) => {
      const yb = a.Dps - a.Wg, eg = sil.top === 'dress' ? p.luzG / m.og : p.luzT / m.ot, et = p.luzT / m.ot, eb = (sil.lower === 'circle' ? 4 : p.luzB) / m.ob;
      if (y >= yb) { const yp = a.Dts - a.Gp; return y <= yp ? eg : eg * (1 - 0.9 * sstep((y - yp) / Math.max(1, a.Dts - 3 - yp))); } // luz z biustu nie dochodzi do ramion: tam ubranie leży na ciele
      if (y >= 0) return et + (eg - et) * sstep(y / yb); if (y >= -m.wb) return et + (eb - et) * sstep(-y / m.wb); return eb;
    };
    // tkanina: sztywność i ciężar sterują tym, jak materiał odstaje albo opada w fałdy (model uproszczony, nie symulacja)
    const F = FAB[state.fabric] || FAB.bawelna, lift = F.st * (1 - 0.5 * F.wt), drape = 1 - lift, off = 0.4 + 0.8 * F.st;
    const fit = (y) => { const s = body(y), k = 1 + Math.max(-0.02, er(y)); return { a: s.a * k + off, b: s.b * k + off, z: s.z }; };
    const hipS = fit(-m.wb), L = Math.max(1, p.dl - m.wb), waistS = fit(0), Tw = m.ot + p.luzT, hipP = ellP(hipS.a, hipS.b);
    const hipK = sil.lower === 'trapez' ? sil.hipC / (m.ob + p.luzB) : 1, hemK = sil.lower === 'trapez' ? sil.hemC / (m.ob + p.luzB) : 1;
    const circ = sil.lower === 'circle', nBase = circ ? (sil.frac === 2 ? 14 : sil.frac === 1 ? 10 : 7) : 6;
    const nF = Math.round(nBase * (0.8 + 0.7 * drape)), nG = Math.round(nF * 0.5) + 1, cap = 0.14 + 0.2 * drape;
    const tb = (sil.frac === 2 ? 0.46 : sil.frac === 1 ? 0.36 : 0.22) * (0.45 + 0.95 * lift);
    const waveOf = (target, s) => { const r = target / ellP(s.a, s.b); return Math.min(cap, Math.sqrt(Math.max(0, 2 * (r * r - 1))) / nF); };
    const eOf = (y) => Math.max(0.5, 0.3 + 0.5 * off + (Math.max(0, er(y)) * ellP(body(y).a, body(y).b)) / TAU); // luz w centymetrach promienia
    const sectRaw = (y, phi) => {
      let s, wave = 0, yo = y, fb = 0, ya = null, eX = 0;
      if (sil.lower === 'empire' && y < sil.yE) {
        ya = sil.yE; const sE = fit(sil.yE), t = (sil.yE - y) / (sil.yE + p.dl), kf = 1 + (sil.hemC / sil.seamC - 1) * t, k = 1 + (kf - 1) * (0.45 + 0.55 * lift), bs = fit(Math.max(y, -m.wb - 4));
        s = { a: Math.max(sE.a * k, y > -m.wb - 4 ? bs.a + 0.3 : 0), b: Math.max(sE.b * k, y > -m.wb - 4 ? bs.b + 0.3 : 0), z: bs.z };
        wave = waveOf(ellP(sE.a, sE.b) * kf, s) * sstep(t * 4);
      } else if (sil.lower === 'mermaid' && y < -sil.kn) {
        const dk = (sil.kn - m.wb) / Math.max(1, sil.kn - m.wb), sK = { a: Math.max(4, hipS.a + Math.min(p.flare, 2) * dk * 0.9), b: Math.max(4, hipS.b + Math.min(p.flare, 2) * dk * 0.4) };
        const d = -sil.kn - y, gr = sil.grow || TAU, tm = 0.4 * Math.pow(gr / TAU, 0.7) * (0.45 + 0.95 * lift);
        s = { a: sK.a + d * tm, b: sK.b + d * tm * 0.92, z: hipS.z };
        wave = waveOf(ellP(sK.a, sK.b) + gr * d, s) * sstep(d / 8);
      } else if (circ && y < 0) {
        ya = 0; const d = -y, bs = fit(Math.max(y, -m.wb)), ca = waistS.a + d * tb, cb = waistS.b + d * tb * 0.92;
        s = { a: Math.max(ca, d <= m.wb + 2 ? bs.a : hipS.a), b: Math.max(cb, d <= m.wb + 2 ? bs.b : hipS.b), z: bs.z };
        wave = waveOf(Tw + TAU * sil.frac * d, s) * sstep(d / (m.wb * 0.8));
        yo = y - 3 * drape * F.wt * (d / p.dl) * (1 - Math.cos(4 * phi)) / 2; // skos wyciąga się pod własnym ciężarem
      } else if (y >= -m.wb) { s = fit(y); fb = 1; if (hipK !== 1 && y < 0) { const k = 1 + (hipK - 1) * (-y / m.wb); eX = (k - 1) * (s.a + s.b) / 2; s = { a: s.a * k, b: s.b * k, z: s.z }; } }
      else {
        ya = -m.wb;
        const Le = sil.lower === 'mermaid' ? Math.max(1, sil.kn - m.wb) : L, d = (-m.wb - y) / Le, hold = 0.35 + 0.65 * lift;
        if (sil.lower === 'trapez') {
          const kf = hipK + (hemK - hipK) * d, k = hipK + (hemK - hipK) * d * hold;
          s = { a: hipS.a * k, b: hipS.b * Math.pow(k, 1.1), z: hipS.z * (1 - d) };
          wave = waveOf(hipP * kf, s) * sstep(d * 3);
        } else {
          const fl = (sil.lower === 'mermaid' ? Math.min(p.flare, 2) : p.flare * (sil.flareK || 1)) * d;
          s = { a: Math.max(4, hipS.a + fl * 0.9 * (fl > 0 ? hold : 1)), b: Math.max(4, hipS.b + fl * 0.4 * (fl > 0 ? hold : 1)), z: hipS.z };
          if (fl > 0) wave = waveOf(hipP + 4 * fl, s) * sstep(d * 3);
        }
      }
      // fałdy tylko na zewnątrz od bryły podstawowej, żeby tkanina nie wchodziła w ciało
      const k = 1 + wave * (0.9 * (1 + Math.cos(nF * phi + 0.6)) + 0.25 * drape * (1 + Math.cos(nG * phi + 2.1)));
      const gx = s.a * Math.cos(phi) * k, gs = Math.sin(phi);
      const q = [gx, yo, s.z + s.b * gs * k + body.bump(gx, y, gs, true) * (state.bust ? 1 : 0.6) - body.butt(gx, Math.max(y, -m.wb - 6), gs, hipS.a) * 1.05];
      if (figFit) { // przy sylwetce część dopasowana leży na ciele z luzem z wykroju, a część swobodna zaczyna się płynnie od tego miejsca
        if (fb) figFit(q, eOf(y) + eX, 1);
        else if (ya !== null) { const fd = 1 - sstep((ya - y) / 10); if (fd > 0) { const sA = fit(ya), ax0 = sA.a * Math.cos(phi), qa = [ax0, ya, sA.z + sA.b * gs + body.bump(ax0, ya, gs, true) * (state.bust ? 1 : 0.6) - body.butt(ax0, Math.max(ya, -m.wb - 6), gs, hipS.a) * 1.05], z0 = qa[2]; figFit(qa, eOf(ya), 1); q[0] += (qa[0] - ax0) * fd; q[2] += (qa[2] - z0) * fd; } }
      }
      if (figClear) { figClear(q); if (figDrape) figDrape(q, eOf(y)); }
      return q;
    };
    const topOk = useFig && !!figCol && !!g3.sdf && state.sim && !!window.Cloth && sil.top === 'dress' && model.d.pieces.some((q) => q.id === 'przod' && q.ed) && model.d.pieces.some((q) => q.id === 'tyl' && q.ed);
    const topFull = topOk && (sil.lower === 'straight' || sil.lower === 'trapez') && !sil.tren && p.dl >= m.wb + 1; // sukienka i top z jednego kawałka: całość układa się jako zszyta tkanina
    // symulacja: poniżej linii przypięcia (talia, biodra, odcięcie) położenie tkaniny bierze się z symulacji, nie z reguł
    let simRef = null; $('simS').textContent = '';
    {
      const stiffTop = sil.top === 'corset' || sil.lower === 'none' || state.style === 'su_rybka_kliny';
      let spec = null;
      if (!state.sim || stiffTop || sil.tren || topFull) spec = null;
      else if (sil.lower === 'circle') spec = { yPin: 0, L: p.dl, C: sil.pleat ? (d) => Tw + (sil.hemC - Tw) * Math.min(1, d / 3) : (d) => Tw + TAU * sil.frac * d };
      else if (sil.lower === 'mermaid') spec = { yPin: -sil.kn, L: p.dl - sil.kn, C: (d) => sil.kneeC + (sil.grow || TAU) * d };
      else if (sil.lower === 'empire') { const Le = sil.yE + p.dl; spec = { yPin: sil.yE, L: Le, C: sil.frac ? (d) => sil.seamC + TAU * sil.frac * d : (d) => sil.seamC + ((sil.hemC - sil.seamC) * d) / Le }; }
      else if (sil.hemC && p.dl - m.wb > 6) { const c0 = sil.hipC || m.ob + p.luzB, Ls = p.dl - m.wb; spec = { yPin: -m.wb, L: Ls, C: (d) => c0 + ((sil.hemC - c0) * d) / Ls }; }
      if (!spec) g3.sim = null;
      else {
        const key = JSON.stringify([state.style, p, m, state.fabric, state.figure]);
        if (!g3.sim || g3.sim.key !== key) {
          const manClear = (q) => { // manekin: elipsa tułowia na danej wysokości, poniżej tułowia nic nie ma
            // pod dolną krawędzią manekina zostaje niewidoczna, lekko zwężona bryła, żeby tkanina nie zawijała się pod korpus
            const under = q[1] < body.bottom, s = body(Math.max(body.bottom, Math.min(q[1], a.Dts))), dz = q[2] - s.z, r = Math.hypot(q[0], dz) || 1e-6, cs = q[0] / r, sn = dz / r;
            const R = ((s.a * s.b) / Math.hypot(s.b * cs, s.a * sn)) * (under ? Math.max(0.6, 0.94 - (body.bottom - q[1]) * 0.006) : 1) + 0.35 + (sn < 0 && !under ? body.butt(q[0], q[1], sn, hipS.a) : 0); if (r < R) { q[0] = cs * R; q[2] = s.z + sn * R; } return q;
          };
          const sim = makeSim(spec, key, sectRaw, figClear || manClear, floor, F); g3.sim = sim;
          clearTimeout(g3.simT); g3.simT = setTimeout(() => simRun(sim), 220);
        }
        if (g3.sim.ready) simRef = g3.sim;
        if (!g3.sim.done) $('simS').textContent = 'Układam tkaninę…';
      }
    }
    let topLook = null; // powierzchnia zszytej góry do rysowania dodatków (kołnierz, falbanka, linie)
    const sect = (y, phi) => (simRef && y < simRef.yPin - 1e-4 ? simRef.sample(phi, simRef.yPin - y) : topLook ? topLook(y, phi) : sectRaw(y, phi));
    // góra zszyta z elementów wykroju: przód, tył i rękawy jako tkanina ułożona na sylwetce (na razie tylko góry z ramionami, na sylwetce)
    let topSim = null;
    {
      const D = model.d, ok = topOk;
      if (!ok) g3.top = null;
      else {
        const toHip = sil.lower !== 'circle' && sil.lower !== 'none' && sil.lower !== 'empire', longEnough = p.dl >= m.wb + 1;
        const cutY = toHip && longEnough && !topFull ? m.wb : null, pinned = topFull ? false : toHip ? longEnough : !(sil.crop > 0), yPinW = cutY != null ? -cutY : 0, hasSl = !!sil.sleeve && !!figArmP;
        const pk = Object.assign({}, p, { extras: 0, saSzew: 0, saDol: 0, saTalia: 0, fac: 0, facW: 0, kol: 0, kolW: 0, falN: 0, falR: 0, sciag: 0 }); if (!topFull && cutY == null && pinned) Object.assign(pk, { dl: 0, flare: 0, kn: 0, gf: 0, ff: 0, zakK: 0, tren: 0, rozp: 0, pasT: 0, luzB: 0 }); else if (cutY != null) Object.assign(pk, { dl: 0, flare: 0, kn: 0, gf: 0, ff: 0, tren: 0, rozp: 0 });
        const key = 'top' + JSON.stringify([state.style, pk, m, state.fabric]);
        if (!g3.top || g3.top.key !== key) {
          const hh = topFull ? Math.max(1.7, Math.min(3, Math.sqrt(((m.ob + 8) * (a.Dts + p.dl) + (hasSl ? 70 * sil.sleeve.L : 0)) / 3300))) : 1.6; // gęstość siatki dobrana do wielkości ubrania
          let g = null; try { g = window.Cloth.build(D, { h: hh, sleeve: hasSl, cutY }); } catch (e) { g = null; }
          if (!g) g3.top = { key, fail: true };
          else {
            const stl = p.gora === 'bez', yTopW = a.Dts - 0.3, FI = g.info.F, BI = g.info.B, SB = g.info.S ? g.info.S.box : null, SL = sil.sleeve, rr = SB ? (SB[2] - SB[0]) / TAU : 0;
            const phiOf = (mt, sFr) => (mt.pk === 'F' ? Math.PI / 2 - mt.sx * sFr * Math.PI / 2 : 1.5 * Math.PI + mt.sx * sFr * Math.PI / 2);
            const init = (mt) => {
              if (mt.pk === 'S') {
                const tP = figArmP.tPit, t = mt.v >= SL.H ? tP + (mt.v - SL.H) : tP * Math.max(0, mt.v / SL.H), A = figArmAt(mt.sx, t), th = mt.u / rr, r0 = Math.max(rr * 0.9, A.r + 1.2), cu = Math.cos(th), su = Math.sin(th);
                return [A.c[0] + r0 * cu * mt.sx * A.ca, A.c[1] + r0 * cu * A.sa, A.c[2] + r0 * su];
              }
              const I = mt.pk === 'F' ? FI : BI, yw = mt.v < 0 && !stl ? (-mt.v * yTopW) / -I.top : -mt.v, Wd = I.sideX ? I.sideX(Math.max(mt.v, I.sideTop)) : 20, q = sectRaw(Math.min(yw, yTopW), phiOf(mt, Math.min(1, Math.abs(mt.u) / Math.max(4, Wd))));
              return [q[0], q[1], q[2]];
            };
            const pinPos = (mt, sFr) => { const q = sectRaw(yPinW, phiOf(mt, sFr)); return [q[0], yPinW, q[2]]; };
            const eB = 0.5 + 0.25 * F.st, collide = (q, kind) => figCol(q, kind ? eB + 0.1 : eB, true);
            // tkanina: sztywność steruje oporem przy zginaniu (skala logarytmiczna jak w seamer-studio), dżersej jest rozciągliwy
            const bendC = Math.exp(Math.log(6e-5) + (Math.log(2e-7) - Math.log(6e-5)) * F.st), knit = state.fabric === 'dzersej';
            const S = window.Cloth.sim(g, { selfContact: !window.__noSelf, init, pinPos, pinned, collide, hold: stl, holdSlack: 0.4, steps: 150, subSteps: 14, stretchCompliance: knit ? 4e-7 : 2e-8, compressCompliance: 4e-7, bendCompliance: bendC, friction: 0.4, damping: 0.03 });
            // lico na zewnątrz: orientacja trójkątów każdego elementu względem środka bryły, którą okrywa
            const X = S.X, cen = (pred) => { let cx = 0, cy = 0, cz2 = 0, c = 0; for (let i = 0; i < g.ns; i++) if (pred(g.meta[i])) { cx += X[i * 3]; cy += X[i * 3 + 1]; cz2 += X[i * 3 + 2]; c++; } return [cx / c, cy / c, cz2 / c]; };
            const cb = cen((mt) => mt.pk !== 'S');
            for (const gr of g.grp) {
              const c0 = gr.pk === 'S' ? cen((mt) => mt.pk === 'S' && mt.sx === gr.sx) : cb; let sum = 0;
              for (let t = gr.t0; t < gr.t1; t++) { const i0 = g.rmap[g.tri[t * 3]] * 3, i1 = g.rmap[g.tri[t * 3 + 1]] * 3, i2 = g.rmap[g.tri[t * 3 + 2]] * 3, ux = X[i1] - X[i0], uy = X[i1 + 1] - X[i0 + 1], uz = X[i1 + 2] - X[i0 + 2], vx = X[i2] - X[i0], vy = X[i2 + 1] - X[i0 + 1], vz = X[i2 + 2] - X[i0 + 2];
                const nx = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz = ux * vy - uy * vx, mx = (X[i0] + X[i1] + X[i2]) / 3 - c0[0], my = gr.pk === 'S' ? (X[i0 + 1] + X[i1 + 1] + X[i2 + 1]) / 3 - c0[1] : 0, mz = (X[i0 + 2] + X[i1 + 2] + X[i2 + 2]) / 3 - c0[2]; sum += nx * mx + ny2 * my + nz * mz; }
              if (sum < 0) for (let t = gr.t0; t < gr.t1; t++) { const k = g.tri[t * 3 + 1]; g.tri[t * 3 + 1] = g.tri[t * 3 + 2]; g.tri[t * 3 + 2] = k; }
            }
            g3.top = { key, g, S, yPinW, pinned, hasSl, ready: false, done: false, prev: g3.top && !g3.top.fail ? (g3.top.ready ? g3.top : g3.top.prev) : null };
            clearTimeout(g3.topT); const tp = g3.top; g3.topT = setTimeout(() => topRun(tp), 260);
          }
        }
        if (g3.top && !g3.top.fail && !g3.top.done && !g3.top.run && g3.top.S.steps > 0) { const tp = g3.top; clearTimeout(g3.topT); g3.topT = setTimeout(() => topRun(tp), 60); }
        if (g3.top && !g3.top.fail) { if (g3.top.ready) { topSim = g3.top; g3.top.prev = null; } else if (g3.top.prev && g3.top.prev.pinned === pinned && g3.top.prev.yPinW === yPinW) topSim = g3.top.prev;
          if (topSim) { // mapa promieni ułożonej tkaniny: z niej biorą położenie dodatki rysowane na górze
            const g = topSim.g, X = topSim.S.X, yA = Math.floor(topSim.pinned ? topSim.yPinW : -p.dl) - 1, nyG = Math.ceil(a.Dts + 4 - yA) + 1, NG = 120, Gm = new Float32Array(nyG * NG), czG = new Float32Array(nyG);
            for (let i = 0; i < nyG; i++) czG[i] = body(Math.max(-m.wb, Math.min(a.Dts, yA + i))).z;
            for (const gr of g.grp) { if (gr.pk === 'S') continue; for (let t = gr.t0; t < gr.t1; t++) { const i0 = g.rmap[g.tri[t * 3]] * 3, i1 = g.rmap[g.tri[t * 3 + 1]] * 3, i2 = g.rmap[g.tri[t * 3 + 2]] * 3;
              for (let u = 0; u <= 4; u++) for (let v = 0; u + v <= 4; v++) { const b1 = u / 4, b2 = v / 4, b0 = 1 - b1 - b2, x = X[i0] * b0 + X[i1] * b1 + X[i2] * b2, y = X[i0 + 1] * b0 + X[i1 + 1] * b1 + X[i2 + 1] * b2, z = X[i0 + 2] * b0 + X[i1 + 2] * b1 + X[i2 + 2] * b2, iy = Math.round(y - yA); if (iy < 0 || iy >= nyG) continue; const dz = z - czG[iy]; let ph = Math.atan2(dz, x); if (ph < 0) ph += TAU; const k = iy * NG + Math.min(NG - 1, Math.floor((ph / TAU) * NG)), r = Math.hypot(x, dz); if (r > Gm[k]) Gm[k] = r; } } }
            topLook = (y, phi) => {
              const q = sectRaw(y, phi), fy = y - yA, iy = Math.round(fy); if (iy < 0 || iy >= nyG) return q; const dz = q[2] - czG[iy], r = Math.hypot(q[0], dz); if (r < 1e-6) return q; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
              const fp = (ph / TAU) * NG - 0.5, ip = Math.floor(fp), tp = fp - ip, g0 = Gm[iy * NG + ((ip + NG) % NG)], g1 = Gm[iy * NG + ((ip + 1) % NG)]; if (!(g0 > 0) || !(g1 > 0)) return q;
              const k = (g0 * (1 - tp) + g1 * tp + 0.12) / r; q[0] *= k; q[2] = czG[iy] + dz * k; return q;
            };
          } if (!g3.top.done) $('simS').textContent = 'Układam tkaninę…'; }
      }
    }
    let tx;
    const wx = fabTex(FAB[state.fabric] ? state.fabric : 'bawelna'), ps = state.print !== 'gladka' ? printTex(wx) : null;
    if (ps) tx = { tile: ps.tile * state.pscale / 100, rough: wx.rough, metal: wx.metal, bump: wx.bump, opacity: wx.opacity, map: ps.map, bumpMap: ps.bumpT, alpha: ps.alpha };
    else tx = Object.assign({ bumpMap: wx.bump ? wx.map : null }, wx);
    const gm = new T3.MeshStandardMaterial({ color: ps ? 0xffffff : new T3.Color(state.color), roughness: tx.rough, metalness: tx.metal, side: T3.DoubleSide, map: tx.map, bumpMap: tx.bumpMap, bumpScale: tx.bump });
    if (tx.alpha) { gm.alphaMap = tx.alpha; gm.transparent = true; gm.depthWrite = false; }
    else if (tx.opacity && tx.opacity < 1) { gm.transparent = true; gm.opacity = tx.opacity; }
    // tkaniny prześwitujące: najpierw lewa strona, potem prawa, żeby warstwy nie migotały
    const addG = (mesh) => {
      if (!gm.transparent) { grp.add(mesh); return; }
      const bk = gm.clone(); bk.side = T3.BackSide; bk.depthWrite = false; const fr = gm.clone(); fr.side = T3.FrontSide; fr.depthWrite = false;
      mesh.material = bk; mesh.renderOrder = 1; const top = new T3.Mesh(mesh.geometry, fr); top.renderOrder = 2; grp.add(mesh, top);
    };
    const Pm = circ ? (sil.top === 'dress' ? m.og + p.luzG : Tw) : (m.ob + p.luzB), uN = Math.max(1, Math.round(Pm / tx.tile)), r0 = circ ? Tw / (TAU * sil.frac) : 0;
    const uvOf = (u, phi, y, top) => (circ && y < 0 ? [((r0 - y) * Math.cos(phi * sil.frac)) / tx.tile, ((r0 - y) * Math.sin(phi * sil.frac)) / tx.tile] : [u * uN, (top - y) / tx.tile]);
    const uOf = (phi) => { let d = Math.abs(((phi - Math.PI / 2) % TAU + TAU) % TAU); if (d > Math.PI) d = TAU - d; return d / Math.PI; }; // 0 = środek przodu, 1 = środek tyłu
    if (sil.top === 'corset') {
      // gorset: pas od górnej do dolnej krawędzi, z odstępem sznurowania na środku tyłu (ściśnięcia talii podgląd nie pokazuje)
      const C = sil.c;
      addG(surface(192, 36, (u, v) => { const phi = u * TAU, uu = uOf(phi), T = C.T(uu), y = T + (-C.B(uu) - T) * v, q = sect(y, phi); q.push(uu > 1 - C.gap ? 1 : 0, u * uN, (T - y) / tx.tile); return q; }, gm));
    } else if (sil.top !== 'dress') {
      const y0 = p.pasek > 0 ? 0.3 : 0;
      addG(surface(144, 90, (u, v) => { const y = y0 + (-p.dl - y0) * v, q = sect(y, u * TAU); const t = uvOf(u, u * TAU, y, y0); q.push(0, t[0], t[1]); return q; }, gm));
    } else {
      // góra: pełna powłoka od punktu szyjnego, z wyciętym dekoltem i pachami (krawędzie dociągane do linii wycięcia)
      const yNP = a.Dts - 0.2 - p.nw * 0.38, Xn = (a.os / 5 + p.nw * 0.9) * 0.95;
      const nkF = sil.wrap ? 'v' : p.nk; // przód kopertowy daje w podglądzie dekolt V do miejsca skrzyżowania
      const yCf = sil.wrap ? Math.min(yNP - 1, -sil.wrap.yCross) : Math.min(yNP - 1, a.Dts - a.os / 5 - p.nd - 1), yCb = Math.min(yNP - 1, a.Dt - 0.3 - p.nb);
      const prof = (shape, t, r) => shape === 'v' ? t : shape === 'karo' ? (t < 0.8 ? 0 : (t - 0.8) / 0.2) : shape === 'lodka' ? t * t
        : shape === 'serce' ? (t < 0.8 ? r * (t + 0.4 * Math.sin((Math.PI * t) / 0.8)) : 0.8 * r + (1 - 0.8 * r) * Math.pow((t - 0.8) / 0.2, 1.5)) : Math.pow(t, 2.6);
      // przy sylwetce pacha jest wycięta odrobinę szerzej, żeby ramię nie przecinało krawędzi tkaniny
      const yArm = a.Dts - a.Gp - sil.lowerArm - (useFig ? 1.2 : 0), yTip = a.Dts - 4.8 + (useFig ? 2.2 : 0) + (sil.bok > 0 ? Math.max(0, 1 - sil.bok / 9) * 3.4 : 0), yc = (yArm + yTip) / 2, hy = (yTip - yArm) / 2, bokS = sil.bok > 0 ? Math.max(0, 1 - sil.bok / 9) : 0, wz = 5.4 + sil.lowerArm * 0.3 + (useFig ? 2 : 0) + bokS * 1.8;
      const yArmN = yArm, yTipN = a.Dts - 4.8 + (useFig ? 2.2 : 0), ycN = (yArmN + yTipN) / 2, hyN = (yTipN - yArmN) / 2, wzN = 5.4 + sil.lowerArm * 0.3 + (useFig ? 2 : 0), xsN = (useFig && figShX ? Math.min(a.Sb / 2 - 0.3, figShX + 2.5) : a.Sb / 2 - 0.3) - (sil.bok || 0);
      const bez = p.gora === 'bez', yU = a.Dts - a.Gp - sil.lowerArm, ybL = a.Dps - a.Wg, bhh = Math.max(2, Math.min(12, p.bh || 6));
      // bez ramiączek: górna krawędź biegnie nad biustem z przodu, pod pachą z boku i odrobinę niżej z tyłu
      const topS = (phi, yy) => {
        const sn = Math.sin(phi), ac = Math.abs(Math.cos(phi)); if (sn <= 0) return yU - 1.5 * (1 - ac);
        if (sil.strap || p.bk === 'luk') { // z ramiączkami: poziomo między ramiączkami (albo łukiem w dół), za nimi w dół pod pachę
          const aa = fit(yy).a, x = aa * ac, xq = a.Rg / 2, top = ybL + bhh; if (x <= xq) return Math.max(top - (p.bk === 'luk' ? 2.5 * (1 - (x / xq) * (x / xq)) : 0), Math.min(yU, ybL + 1.5));
          const uu = Math.min(1, (x - xq) / Math.max(1, aa - xq)); return Math.max(top + (yU - top) * uu * uu * (3 - 2 * uu), Math.min(yU, ybL + 1.5));
        }
        const w = 1 - Math.pow(ac, 2.2); let t = yU + (ybL + bhh - yU) * w;
        if (p.bk === 'serce') t += w - 4.5 * Math.pow(Math.max(0, 1 - (fit(yy).a * ac) / (a.Rg / 2)), 1.3);
        return Math.max(t, Math.min(yU, ybL + 1.5));
      };
      const yTop0 = topSim ? topSim.yPinW : bez ? Math.max(yU, ybL + bhh) + 1.5 : yNP, yMid = topSim ? topSim.yPinW + (yBot - topSim.yPinW) * 0.42 : bez ? ybL - 3 : Math.min(yArm, yCf, yCb) - 1.5;
      if (!topSim || (topSim.pinned && topSim.yPinW - yBot > 0.6)) addG(surface(200, 140, (u, v) => {
        let phi = u * TAU, cut = 0;
        const yBt = sil.tren ? yBot - sil.tren * Math.pow(Math.max(0, -Math.sin(phi)), 1.3) : yBot; // tren wydłuża dół z tyłu
        let y = v < 0.42 ? yTop0 + (yMid - yTop0) * (v / 0.42) : yMid + (yBt - yMid) * ((v - 0.42) / 0.58);
        const sn = Math.sin(phi), cs = Math.cos(phi);
        if (bez) { const lim = topS(phi, Math.min(y, ybL + bhh)); if (y > lim) { y = lim; cut = 1; } }
        else if (y > Math.min(yArm, yCf, yCb) - 0.5) {
          // dekolt
          const yC = sn > 0 ? yCf : yCb, shp = sn > 0 ? nkF : p.nkb, f = (yy) => { const x = Math.abs(fit(yy).a * cs); return x >= Xn ? yNP : yC + (yNP - yC) * prof(shp, x / Xn, Math.min(0.3, (0.5 * Xn) / Math.max(1, yNP - yC))); };
          let lim = f(y);
          if (y > lim) { let lo = yC - 1, hi = y; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (mid > f(mid)) hi = mid; else lo = mid; } y = lo; cut = 1; }
          // pacha
          if (!sil.sleeve && y > yArmN) { // z rękawem pacha jest zaszyta, więc powłoka zostaje pełna
            // krawędź pachy widziana z przodu: na dole owal wycięty w boku, u góry dochodzi do końca ramienia (węższego przy odsłoniętych ramionach)
            const s0 = fit(y), tA = (y - ycN) / hyN, tau = (y - yArmN) / (2 * hyN), ov = tA >= 1 ? s0.a : s0.a * Math.sqrt(Math.max(0, 1 - Math.pow(wzN / s0.b, 2) * (1 - tA * tA)));
            const Xa = y < ycN ? ov : Math.min(xsN, Math.max(ov, xsN - 14 * Math.pow(Math.max(0, 1 - tau), 1.2)));
            if (Xa < s0.a - 1e-3 && Math.abs(s0.a * cs) > Xa) { const ph = Math.acos(Math.max(0, Xa) / s0.a); phi = sn >= 0 ? (cs >= 0 ? ph : Math.PI - ph) : (cs >= 0 ? TAU - ph : Math.PI + ph); cut = 1; }
          }
        }
        let over = 0; if (sil.tren && y < floor + 0.5) { over = floor + 0.5 - y; y = floor + 0.5; } // nadmiar trenu kładzie się na podłodze za sylwetką
        let pt = sect(y, phi);
        if (!bez && !sil.sleeve && y > ycN && Math.abs(pt[0]) > xsN) { // koniec ramienia liczony na gotowej bryle: tkanina nie wychodzi poza szerokość ramienia z wykroju
          let lo = sn >= 0 ? Math.PI / 2 : 1.5 * Math.PI, hi = phi; for (let it = 0; it < 11; it++) { const mid = (lo + hi) / 2; if (Math.abs(sect(y, mid)[0]) > xsN) hi = mid; else lo = mid; }
          phi = lo; pt = sect(y, phi); cut = 1;
        }
        if (over) { pt[0] += Math.cos(phi) * over * 0.9; pt[2] += Math.sin(phi) * over * 0.9; }
        const t = uvOf(u, phi, y, yNP); pt.push(cut, t[0], t[1]); return pt;
      }, gm));
      // wysokość linii dekoltu dla danego kąta (ta sama reguła co wycięcie w powłoce)
      const neckY = (phi) => {
        const sn = Math.sin(phi), cs = Math.cos(phi), yC = sn > 0 ? yCf : yCb, shp = sn > 0 ? nkF : p.nkb;
        const f = (yy) => { const x = Math.abs(fit(yy).a * cs); return x >= Xn ? yNP : yC + (yNP - yC) * prof(shp, x / Xn, Math.min(0.3, (0.5 * Xn) / Math.max(1, yNP - yC))); };
        let lo = yC - 1, hi = yNP; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (mid > f(mid)) hi = mid; else lo = mid; } return lo;
      };
      if (topSim) { // zszyta góra: siatka z elementów wykroju w położeniu z symulacji
        const g = topSim.g, X = topSim.S.X, pos = new Float32Array(g.nr * 3), uv = new Float32Array(g.nr * 2), nrm = new Float32Array(g.ns * 3), nr = new Float32Array(g.nr * 3);
        for (let r = 0; r < g.nr; r++) { const k = g.rmap[r] * 3; pos[r * 3] = X[k]; pos[r * 3 + 1] = X[k + 1]; pos[r * 3 + 2] = X[k + 2]; uv[r * 2] = g.ruv[r * 2] / tx.tile; uv[r * 2 + 1] = -g.ruv[r * 2 + 1] / tx.tile; }
        for (let t = 0; t < g.tri.length; t += 3) { const s0 = g.rmap[g.tri[t]] * 3, s1 = g.rmap[g.tri[t + 1]] * 3, s2 = g.rmap[g.tri[t + 2]] * 3, ux = X[s1] - X[s0], uy = X[s1 + 1] - X[s0 + 1], uz = X[s1 + 2] - X[s0 + 2], vx = X[s2] - X[s0], vy = X[s2 + 1] - X[s0 + 1], vz = X[s2 + 2] - X[s0 + 2], nx = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [s0, s1, s2]) { nrm[k] += nx; nrm[k + 1] += ny2; nrm[k + 2] += nz; } }
        for (let i = 0; i < g.ns; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
        for (let r = 0; r < g.nr; r++) { const k = g.rmap[r] * 3; nr[r * 3] = nrm[k]; nr[r * 3 + 1] = nrm[k + 1]; nr[r * 3 + 2] = nrm[k + 2]; }
        const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T3.BufferAttribute(uv, 2)); geo.setAttribute('normal', new T3.BufferAttribute(nr, 3)); geo.setIndex(new T3.BufferAttribute(Uint32Array.from(g.tri), 1));
        addG(new T3.Mesh(geo, gm));
        if (state.seams) for (const ch of g.seams) { const pts = ch.map((i) => new T3.Vector3(X[i * 3] + nrm[i * 3] * 0.12, X[i * 3 + 1] + nrm[i * 3 + 1] * 0.12, X[i * 3 + 2] + nrm[i * 3 + 2] * 0.12)); grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }))); }
      }
      if (sil.sleeve && !bez && !(topSim && topSim.hasSl)) { // rękaw: rura wzdłuż ręki sylwetki, a na manekinie pod stałym kątem od barku
        const SL = sil.sleeve, rB = SL.bic / TAU, rH = SL.hem / TAU, ang = 0.42, cA = Math.cos(ang), sA = Math.sin(ang), z0s = fit(yc).z + 0.4;
        for (const sx of [1, -1]) addG(surface(28, 26, (u, v) => {
          const t = v * (SL.L - 2) - (figArmAt ? 6 * (1 - v) * (1 - v) * Math.pow(Math.max(0, -sx * Math.cos(u * TAU)), 2) : 0), A = figArmAt ? figArmAt(sx, t) : { c: [sx * (a.Sb / 2 - 2.5 + sA * t), a.Dts - 3.2 - cA * t, z0s], r: 0 };
          const rFull = Math.max(rB + (rH - rB) * v, A.r + 1), r = (figArmAt && !SL.puff ? A.r + 0.9 + (rFull - A.r - 0.9) * sstep(Math.max(0, t) / 8) : rFull) * (SL.puff ? 1 + 0.5 * Math.sin(Math.PI * Math.min(1, v * 1.04)) : 1), th = u * TAU, c2 = A.ca == null ? cA : A.ca, s2 = A.sa == null ? sA : A.sa;
          return [A.c[0] + r * Math.cos(th) * c2, A.c[1] + sx * r * Math.cos(th) * s2, A.c[2] + r * Math.sin(th), 0, u * 4, (v * SL.L) / tx.tile];
        }, gm));
      }
      if (sil.sleeve && sil.sleeve.ruf && !bez) { // falbanka przy dole rękawa: rozszerzający się, pofalowany pierścień
        const SL = sil.sleeve, rH = SL.hem / TAU, cA = Math.cos(0.42), sA = Math.sin(0.42), z0s = fit(yc).z + 0.4;
        for (const sx of [1, -1]) addG(surface(40, 5, (u, v) => {
          const t = SL.L - 2 + v * SL.ruf, A = figArmAt ? figArmAt(sx, t) : { c: [sx * (a.Sb / 2 - 2.5 + sA * t), a.Dts - 3.2 - cA * t, z0s], r: 0 }, th = u * TAU;
          const r = Math.max(rH, A.r + 1) * (1 + v * (0.45 + 0.14 * Math.sin(th * 9))), c2 = A.ca == null ? cA : A.ca, s2 = A.sa == null ? sA : A.sa;
          return [A.c[0] + r * Math.cos(th) * c2, A.c[1] + sx * r * Math.cos(th) * s2, A.c[2] + r * Math.sin(th), 0, u * 4, v];
        }, gm));
      }
      if (topSim && topSim.g.neck.length > 8 && (sil.collar || sil.ruffN)) { // kołnierz i falbanka idą po prawdziwej krawędzi dekoltu zszytej góry
        const g = topSim.g, X = topSim.S.X, NL = g.neck.map((i) => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]]), nN = NL.length, zN = body(a.Dts).z; let yLo = 1e9, yHi = -1e9; for (const q of NL) { yLo = Math.min(yLo, q[1]); yHi = Math.max(yHi, q[1]); }
        const at = (u) => { const f = ((u % 1) + 1) % 1 * nN, i = Math.floor(f) % nN, t = f - Math.floor(f), A = NL[i], B = NL[(i + 1) % nN]; return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
        const out = (q) => { const dx = q[0], dz = q[2] - zN, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
        if (sil.collar) {
          const gk = gm.clone(); if (!ps) gk.color = new T3.Color(state.color).lerp(new T3.Color(0xffffff), 0.25); const wC = sil.collar.w, st = sil.collar.type === 'stojka', szal = sil.collar.type === 'szal';
          const cpt = (u, v) => { const q = at(u), o = out(q); if (st) return [q[0] - o[0] * v * wC * 0.22, q[1] + v * wC * 0.97, q[2] - o[1] * v * wC * 0.22];
            const tpr = szal ? Math.max(0, Math.min(1, 0.15 + (1.3 * (q[1] - yLo)) / Math.max(1, yHi - yLo))) : 1, d = v * wC * tpr; return [q[0] + o[0] * (0.35 + d * 0.8), q[1] - d * 0.55 + 0.12, q[2] + o[1] * (0.35 + d * 0.8)]; };
          const cm = surface(Math.min(160, nN * 3), 6, (u, v) => { const q = cpt(u, v); q.push(0, u * uN, (v * wC) / tx.tile); return q; }, gk); cm.renderOrder = 2; grp.add(cm);
          const ep = []; for (let i = 0; i <= 160; i++) { const q = cpt(i / 160, 1); ep.push(new T3.Vector3(q[0], q[1], q[2])); } grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(ep), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
        }
        if (sil.ruffN) { const wR = sil.ruffN; const rm = surface(Math.min(220, nN * 5), 6, (u, v) => { const q = at(u), o = out(q), lift = 0.4 + v * wR * (0.55 + 0.22 * Math.sin(u * nN * 2.4)); return [q[0] + o[0] * lift, q[1] - v * wR * 0.6 + 0.15, q[2] + o[1] * lift, 0, u * uN, v]; }, gm.clone()); rm.renderOrder = 2; grp.add(rm); }
      }
      if (sil.ruffN && !bez && !topSim) { // falbanka przy dekolcie: pofalowany pas leżący wzdłuż krawędzi
        const zN2 = body(a.Dts).z, wR = sil.ruffN;
        const rm = surface(220, 6, (u, v) => { const phi = u * TAU, y0 = neckY(phi), q = sect(y0 - v * wR * 0.75, phi), l = Math.hypot(q[0], q[2] - zN2) || 1, lift = 0.45 + v * (1.3 + 0.9 * Math.sin(phi * 38)); return [q[0] * (1 + lift / l), q[1] + 0.15, zN2 + (q[2] - zN2) * (1 + lift / l), Math.abs(phi - 1.5 * Math.PI) < 0.04 ? 1 : 0, u * uN, v]; }, gm.clone());
        rm.renderOrder = 2; grp.add(rm);
      }
      if (sil.sciag) { // ściągacz pod biustem: ciemna linia dookoła na wysokości tunelu
        const pts = []; for (let i = 0; i <= 120; i++) { const q = sect(sil.sciag, (i / 120) * TAU), l = Math.hypot(q[0], q[2]) || 1; pts.push(new T3.Vector3(q[0] * (1 + 0.25 / l), q[1], q[2] * (1 + 0.25 / l))); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })));
      }
      if (sil.collar && !bez && !topSim) { // kołnierz: stójka stoi przy szyi, bebe leży płasko na dekolcie
        const gk = gm.clone(); if (!ps) gk.color = new T3.Color(state.color).lerp(new T3.Color(0xffffff), 0.25);
        const nrr = (a.os / (2 * Math.PI)) * 1.08, zN = body(a.Dts).z, wC = sil.collar.w, st = sil.collar.type === 'stojka';
        const cpt = (phi, v) => {
          const y0 = neckY(phi);
          if (st) { const q = sect(y0, phi), k = 0.55 * v; return [q[0] + (nrr * Math.cos(phi) - q[0]) * k, y0 + v * wC, q[2] + (zN + nrr * Math.sin(phi) - q[2]) * k]; }
          const tpr = sil.collar.type === 'szal' ? Math.max(0, Math.min(1, 0.15 + (1.3 * (y0 - yCf)) / Math.max(1, yNP - yCf))) : 1; // szalowy zwęża się ku dołowi
          const q = sect(y0 - v * wC * tpr * (1 - 0.35 * Math.abs(Math.cos(phi))), phi), l = Math.hypot(q[0], q[2] - zN) || 1;
          return [q[0] * (1 + 0.4 / l), q[1] + 0.1, zN + (q[2] - zN) * (1 + 0.4 / l)];
        };
        const cm = surface(160, 8, (u, v) => { const phi = u * TAU, q = cpt(phi, v); q.push((!st && Math.abs(phi - Math.PI / 2) < 0.035) || Math.abs(phi - 1.5 * Math.PI) < 0.04 ? 1 : 0, u * uN, (v * wC) / tx.tile); return q; }, gk);
        cm.renderOrder = 2; grp.add(cm);
        const ep = []; for (let i = 0; i <= 160; i++) { const q = cpt((i / 160) * TAU, 1); ep.push(new T3.Vector3(q[0] * 1.004, q[1], q[2] * 1.004)); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(ep), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
      }
      if (sil.wrap) { // linia zakładu: od skrzyżowania na środku przodu do talii po boku
        const yX = Math.min(yNP - 1, -sil.wrap.yCross), pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, y = yX * (1 - t) + 0.3, x = -sil.wrap.ext * t, q = sect(y, Math.acos(Math.max(-0.98, Math.min(0.98, x / fit(y).a)))), l = Math.hypot(q[0], q[2]) || 1; pts.push(new T3.Vector3(q[0] * (1 + 0.3 / l), q[1], q[2] * (1 + 0.3 / l))); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })));
      }
      if (sil.zp && state.seams && !bez && !topSim) { // zaszewka piersiowa: linia od szczytu biustu do miejsca, z którego wychodzi
        const yb2 = a.Dps - a.Wg, phA = (y, x) => Math.acos(Math.max(-0.98, Math.min(0.98, x / fit(y).a)));
        const tg = sil.zp === 'pacha' ? [yArm + (yTip - yArm) * 0.3, 0.42] : sil.zp === 'ramie' ? [yNP - 1.2, phA(yNP - 1.2, (Xn + a.Sb / 2) / 2)] : sil.zp === 'dekolt' ? [neckY(phA(yb2 + 6, Xn * 0.6)) - 0.2, phA(yb2 + 6, Xn * 0.6)] : [yArm - 5, 0.04];
        const p0 = phA(yb2, a.Rg / 2);
        for (const sx of [1, -1]) { const pts = []; for (let i = 3; i <= 20; i++) { const t = i / 20, y = yb2 + (tg[0] - yb2) * t, ph = p0 + (tg[1] - p0) * t, q = sect(y, sx > 0 ? ph : Math.PI - ph), l = Math.hypot(q[0], q[2]) || 1; pts.push(new T3.Vector3(q[0] * (1 + 0.25 / l), q[1], q[2] * (1 + 0.25 / l))); } grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }))); }
      }
    }
    if (sil.strap) { // ramiączka: wąskie paski od górnej krawędzi nad biustem przez ramię do tyłu albo do szyi
      const yU2 = a.Dts - a.Gp - sil.lowerArm, yFc = a.Dps - a.Wg + Math.max(2, Math.min(12, p.bh || 6)), yB = yU2 - 1.2;
      let yF = yFc - 0.4; if (!(sil.strap || p.bk === 'luk') || p.bk === 'serce') for (let it = 0; it < 3; it++) { const wE = 1 - Math.pow(Math.min(1, (a.Rg / 2) / fit(yF).a), 2.2); yF = Math.max(yU2 + (yFc - yU2) * wE + (p.bk === 'serce' ? wE : 0), Math.min(yU2, yFc - 4.5)) - 0.4; } // początek ramiączka leży na górnej krawędzi
      const ySh = a.Dts - 1.6, x0 = a.Rg / 2, xn = (a.os / (2 * Math.PI)) * 1.02, hal = sil.strap.type === 'szyja';
      const ang = (x, y, front, sx) => { const t = Math.acos(Math.max(-0.98, Math.min(0.98, x / fit(y).a))), f = sx > 0 ? t : Math.PI - t; return front ? f : TAU - f; };
      for (const sx of [1, -1]) addG(surface(2, 48, (u, v) => {
        let y, phi, x = x0;
        if (hal) { y = yF + (a.Dts + 0.3 - yF) * v; x = x0 + (xn - x0) * sstep(v); phi = ang(x, y, true, sx); }
        else if (v < 0.5) { y = yF + (ySh - yF) * (v / 0.5); phi = ang(x, y, true, sx); }
        else { y = ySh + (yB - ySh) * ((v - 0.5) / 0.5); phi = ang(x, y, false, sx); }
        const q = sect(y, phi), q2 = sect(y, phi + 0.03), ex = q2[0] - q[0], ez = q2[2] - q[2], el2 = Math.hypot(ex, ez) || 1, o = (u - 0.5) * Math.max(0.6, sil.strap.w), l = Math.hypot(q[0], q[2]) || 1;
        return [(q[0] + (ex / el2) * o) * (1 + 0.25 / l), q[1], (q[2] + (ez / el2) * o) * (1 + 0.25 / l), 0, u, v * 8];
      }, gm.clone()));
    }
    if (sil.band) { // pasek w talii na sukience: gładki pierścień odrobinę nad powierzchnią
      const hb = sil.band, bm2 = gm.clone(); if (!ps) bm2.color = new T3.Color(state.color).multiplyScalar(0.82);
      const ring = surface(96, 3, (u, v) => { const phi = u * TAU, y = hb / 2 - hb * v, q = sect(Math.max(y, 0.01), phi), l = Math.hypot(q[0], q[2]) || 1; return [q[0] * (1 + 0.45 / l), y, q[2] * (1 + 0.45 / l), 0, u * uN, v]; }, bm2); ring.renderOrder = 2; grp.add(ring);
    }
    if (sil.top === 'waist' && p.pasek > 0) {
      addG(surface(96, 2, (u, v) => { const phi = u * TAU, y = p.pasek * (1 - v), s = fit(Math.min(y, 0)); return [(s.a + 0.25) * Math.cos(phi), y, s.z + (s.b + 0.25) * Math.sin(phi), 0, u * uN, y / tx.tile]; }, gm.clone()));
    }
    // szwy: cienkie paski na powierzchni ubrania, w miejscach wynikających z wykroju
    if (state.seams && sil.seams && !(topSim && !topSim.pinned)) {
      const S = sil.seams, sm2 = new T3.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, side: T3.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const dress = sil.top === 'dress', topSide = dress ? a.Dts - a.Gp - sil.lowerArm - 0.3 : 0, topCb = dress ? (p.gora === 'bez' ? a.Dts - a.Gp - sil.lowerArm - 1.7 : a.Dt - 0.6 - p.nb) : 0, yb0 = body.yb;
      const push = (q) => { const l = Math.hypot(q[0], q[2]) || 1; return [q[0] * (1 + 0.14 / l), q[1], q[2] * (1 + 0.14 / l)]; };
      const vrib = (phiOf, y1) => { const r = surface(1, 70, (u, v) => { const y = y1 + (yBot - y1) * v, rr = Math.max(4, fit(Math.max(y, -m.wb)).a); return push(sect(y, phiOf(y) + (u - 0.5) * (0.34 / rr))); }, sm2); r.renderOrder = 3; grp.add(r); };
      const ring = (y) => { const r = surface(160, 2, (u, v) => push(sect(y + (v - 0.5) * 0.3, u * TAU)), sm2); r.renderOrder = 3; grp.add(r); };
      if (S.corset) for (const uu of S.corset) for (const sx of [1, -1]) { const ph = Math.PI / 2 - sx * uu * Math.PI, T = sil.c.T(uu), B = sil.c.B(uu); const r = surface(1, 30, (u, v) => push(sect(T + (-B - T) * v, ph + (u - 0.5) * 0.035)), sm2); r.renderOrder = 3; grp.add(r); }
      if (S.side) { vrib(() => 0, topSide); vrib(() => Math.PI, topSide); }
      if (S.cb) vrib(() => 1.5 * Math.PI, topCb);
      if (S.cf) vrib(() => 0.5 * Math.PI, 0);
      for (const y of S.rings || []) ring(y);
      if (S.pr) {
        const y1 = yb0 + 8, ang = (x, y, back, sx) => { const s = fit(Math.max(y, -m.wb)), xx = y > yb0 ? x + ((y - yb0) / 8) * (s.a * 0.8 - x) : x, t = Math.acos(Math.max(-0.97, Math.min(0.97, xx / s.a))); const f = sx > 0 ? t : Math.PI - t; return back ? TAU - f : f; };
        for (const sx of [1, -1]) { vrib((y) => ang(S.pr[0], y, false, sx), y1); vrib((y) => ang(S.pr[1], y, true, sx), y1); }
      }
    }
    // zarys biustu: linia biustu, punkty szczytu i warstwice na manekinie
    $('gap').textContent = ''; $('gap').className = 'float';
    if (state.bust && (!useFig || sil.top === 'dress')) {
      const dress = sil.top === 'dress', ink = new T3.MeshBasicMaterial({ color: 0x17171c, side: T3.DoubleSide });
      const bodyPt = (y, phi, o) => { const s = body(y), x = (s.a + o) * Math.cos(phi), sn = Math.sin(phi); return [x, y, s.z + (s.b + o) * sn + body.bump(x, y, sn, false)]; };
      const outer = (y, phi) => { if (!dress) return bodyPt(y, phi, 0.15); const q = sect(y, phi), l = Math.hypot(q[0], q[2] - 0.5) || 1; return [q[0] * (1 + 0.2 / l), y, q[2] + (q[2] - 0.5) * (0.2 / l)]; };
      grp.add(surface(160, 2, (u, v) => outer(body.yb + (v - 0.5) * 0.28, u * TAU), ink));
      for (const sx of [-1, 1]) {
        const phi = Math.atan2(1, 0) - sx * Math.asin(Math.min(0.95, (a.Rg / 2) / (dress ? fit(body.yb).a : body(body.yb).a))), q = outer(body.yb, phi);
        const dot = new T3.Mesh(new T3.SphereGeometry(0.55, 14, 10), ink); dot.position.set(q[0], q[1], q[2] + 0.2); grp.add(dot);
      }
      const lm = new T3.LineBasicMaterial({ color: 0x8a8272 });
      for (let yy = body.yb - 6; yy <= body.yb + 10 && !useFig; yy += 2) {
        if (Math.abs(yy - body.yb) < 0.5 && !dress) continue;
        const pts = []; for (let i = 0; i <= 80; i++) { const ph = (i / 80) * Math.PI, q = bodyPt(yy, ph, 0.08); pts.push(new T3.Vector3(q[0], q[1], q[2])); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), lm));
      }
      if (dress) {
        const gpv = sil.neckGap, el = $('gap'), bz = p.gora === 'bez'; el.className = 'float' + (gpv < (bz ? 2 : 3) ? ' low' : '');
        el.append(bz ? 'Góra kończy się na środku ' : gpv >= 0 ? 'Dekolt kończy się ' : 'Dekolt schodzi ', Object.assign(document.createElement('b'), { textContent: f1(Math.abs(gpv)) + ' cm' }), gpv >= 0 ? ' nad linią biustu' : ' poniżej linii biustu');
      }
    }
    if (sil.empty) { while (grp.children.length > nBody) { const o = grp.children[grp.children.length - 1]; grp.remove(o); if (o.geometry) o.geometry.dispose(); } $('hemGap').textContent = ''; $('gap').textContent = ''; $('simS').textContent = ''; }
    g3.scene.add(grp); g3.group = grp;
    { // kadr: cała postać albo ubranie w obszarze między etykietami u góry a paskiem suwaków; przelicza się przy każdej zmianie rozmiaru
      const r = g3.canvas.getBoundingClientRect(), hgt = Math.max(200, r.height), asp = Math.max(0.3, r.width / hgt);
      const top = useFig ? a.Dts + headLen + 2 : a.Dts + 6, bot = useFig ? floor - 2 : Math.max(floor, -p.dl - 14);
      let hw = useFig ? 4.97 * fs + 4 : 26; for (let i = 0; i < 16; i++) hw = Math.max(hw, Math.abs(sect(-p.dl, (i / 16) * TAU)[0]) + 3);
      const padT = Math.min(0.2, 100 / hgt), padB = Math.min(0.4, ($('tune').offsetHeight + 24) / hgt), avail = 1 - padT - padB;
      const V = Math.max(((top - bot) * 1.06) / avail, (2 * hw * 1.1) / asp), fd = V / (2 * Math.tan((16 * Math.PI) / 180));
      const key = [state.style, p.dl, p.kn, state.figure, H, Math.round(hw), Math.round(hgt), Math.round(r.width), $('tune').offsetHeight].join('|');
      if (refit || g3.frameKey !== key) {
        const z = refit || !g3.frameKey ? 1 : Math.max(0.2, Math.min(8, fitDist / cam.dist));
        g3.frameKey = key; fitDist = fd; cam.dist = fd / z; g3.mid = (top + bot) / 2 + (padT + avail / 2 - 0.5) * V;
      }
    }
    paint3d(); showZoom();
  }

  // ---------- warstwy ----------
  const LYDEF = { podszewka: 'wiskoza', narzutka: 'szyfon', halka: 'tiul', usztywnienie: 'bawelna' };
  function renderLayers(d) {
    const dress = flags().dress, list = $('lyList'), add = $('lyAdd'), out = $('lyOut'); list.textContent = ''; add.textContent = ''; out.textContent = '';
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    state.layers.forEach((L, i) => {
      const row = el('div', null, 'ly'), hd = el('b', W.ROLES[L.role]);
      if (i) { const x = el('button', '✕', 'x'); x.setAttribute('aria-label', 'Usuń warstwę'); x.addEventListener('click', () => { state.layers.splice(i, 1); persist(); draw(true); }); hd.append(x); }
      row.append(hd);
      const fs = document.createElement('select'); fs.setAttribute('aria-label', 'Tkanina warstwy');
      for (const k in FAB) { const o = el('option', FAB[k].name); o.value = k; fs.append(o); }
      fs.value = i ? L.fabric : state.fabric;
      fs.addEventListener('change', () => { if (i) L.fabric = fs.value; else { state.fabric = fs.value; fillForm(); } persist(); draw(); });
      row.append(fs);
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

  // ---------- inspiracja: zdjęcie -> propozycja fasonu i parametrów (Claude) ----------
  let sampleFn = null, inBlob = null, inCtl = null, inLast = null;
  const NK = ['okragly', 'v', 'karo', 'serce', 'lodka'], NKN = { okragly: 'okrągły', v: 'V', karo: 'karo', serce: 'serce', lodka: 'łódka' };
  const LIM = { gr: [0, 15], gh: [5, 14], gd: [5, 16], dl: [25, 130], flare: [-6, 30], kn: [35, 90], gf: [2, 30], nd: [-4, 24], nw: [0, 9], nb: [0, 30], luzG: [-10, 16], luzT: [-8, 12], luzB: [-12, 16] };
  function inspPrompt() {
    const m = cur(), H = m.wzrost;
    return [
      'Jesteś konstruktorką odzieży. Na zdjęciu jest ubranie, które użytkowniczka chce odtworzyć w programie do wykrojów. Opisuj wyłącznie ubranie, nigdy osobę.',
      'Program umie tylko poniższe fasony (id: opis):',
      'sk_prosta: spódnica prosta z zaszewkami; sk_olowkowa: spódnica ołówkowa, zwężana; sk_trapez: spódnica trapezowa; sk_polkole: spódnica z półkola; sk_kolo: spódnica z koła; sk_2kola: spódnica z dwóch kół, bardzo obfita;',
      'su_dopasowana: sukienka dopasowana z zaszewkami; su_trapez: sukienka w literę A; su_princeska: sukienka z cięciami princeski; su_empire: sukienka odcinana pod biustem; su_rybka_kliny: rybka z klinów od kolan; su_rybka: rybka z falbaną z koła od kolan; su_polkole: sukienka odcinana w talii, dół z półkola; su_kolo: sukienka odcinana w talii, dół z koła; su_2kola: odcinana w talii, dół z dwóch kół; to_stanik: sam top dopasowany do talii.',
      'Każda sukienka może być z ramionami albo bez ramiączek (parametr gora: "ramiona" albo "bez"; przy "bez" bk = "prosta", "luk" (łagodnie zaokrąglona w dół) albo "serce" to kształt górnej krawędzi, bh = jej wysokość nad linią biustu 2-12). Sukienki i topy mają zamek w szwie tyłu. go_pod: gorset pod biust z paneli, sznurowany z tyłu (parametry: gr = redukcja talii 0-15, gh = wysokość nad talią 5-14, gd = długość pod talią z przodu 5-16). go_nad: gorset nad biust z paneli, bez osobnych miseczek (bk = "prosta" albo "serce" to kształt górnej krawędzi; gr, gd oraz bh = wysokość górnej krawędzi nad linią biustu 2-12). to_tshirt i to_tshirt_k: t-shirt z dzianiny z długim albo krótkim rękawem, bez zaszewek; parametr fit = "slim", "regular" albo "oversize". su_empire i su_princeska mogą mieć dół z koła zamiast własnego: parametr dol = "polkole", "kolo" albo "kolo2" (puste = dół własny). to_tshirt_s: dopasowany top z dzianiny bez rękawów ze stójką (kol = "stojka", kolW = wysokość stójki 2-12). T-shirty też mogą mieć kol = "stojka" (półgolf). Program nie ma gorsetów z miseczkami, rękawów raglanowych i kimonowych, drapowań, asymetrii, kieszeni wszywanych ani spodni.',
      'Parametry (cm): dl = długość od talii w dół (25-130, rybki od 50); flare = poszerzenie dołu na każdym szwie, ujemne zwęża (-6 do 30, tylko fasony bez koła); kn = wysokość kolan od talii dla rybek (35-90); gf = rozkloszowanie klina na szwie dla su_rybka_kliny (2-30);',
      'nk = kształt dekoltu z przodu: okragly, v, karo, serce, lodka; nd = głębokość dekoltu z przodu poniżej podstawy szyi (-4 do 24, podstawowy to 0, linia biustu wypada około 18); nw = poszerzenie dekoltu wzdłuż ramienia (0-9); nkb = kształt z tyłu: okragly albo v; nb = głębokość dekoltu z tyłu (0-30);',
      'luzG, luzT, luzB = luz w biuście, talii, biodrach (dopasowane 2-4, luźne 6-12, elastyczna dzianina ujemny).',
      'Modelka ma ' + H + ' cm wzrostu: kolano wypada przy dl około ' + Math.round(H * 0.335) + ', połowa łydki około ' + Math.round(H * 0.46) + ', kostka około ' + Math.round(H * 0.58) + ', podłoga ' + Math.round(H * 0.62) + '.',
      'Tkaniny (id): szyfon, wiskoza, dzersej, bawelna, welna, tafta, tiul. Wzory (id): gladka, ' + P.LIST.map((q) => q.id).join(', ') + '.',
      'Odpowiedz wyłącznie jednym obiektem JSON, po polsku, w tym kształcie:',
      '{"opis": "1-2 zdania o ubraniu ze zdjęcia", "propozycje": [{"fason": "id", "dopasowanie": 0-100, "dlaczego": "1-2 zdania", "parametry": {"gora": "", "bk": "", "bh": 0, "dl": 0, "flare": 0, "kn": 0, "gf": 0, "nk": "", "nd": 0, "nw": 0, "nkb": "", "nb": 0, "luzG": 0, "luzT": 0, "luzB": 0, "rek": "", "mank": false, "falR": false, "falN": false, "bok": 0, "ram": "", "sciag": false, "marsz": false, "tren": 0, "rozp": 0, "kop": false, "kol": "", "pasT": 0, "ff": 1}, "tkanina": "id", "wzor": "id", "kolor": "#rrggbb", "kolor2": "#rrggbb", "roznice": ["czego ten wykrój nie odda, krótko"]}], "braki": ["elementy ze zdjęcia, których program w ogóle nie obsługuje"]}',
      'Topy to_klasyczny, to_bokserka i to_ramiaczka mają dl od -10 do 70: 25 to długość do bioder, 0 to dół w talii, wartości ujemne to crop top kończący się nad talią. ' +
      'Dodatkowe parametry sukienek i topów: rek = "brak", "krotki", "34", "dlugi" albo "bufka" (rękawy wszywane, bufka to krótki bufiasty; tylko przy gora "ramiona"), mank = true (mankiet przy rękawie 3/4), falR = true (falbanka przy dole rękawa), falN = true (falbanka przy dekolcie), bok = o ile cm zwęzić ramię od strony barku, 0-12 (odsłonięte ramiona jak w bokserce, bez rękawów), ram = "brak", "cienkie" albo "szyja" (ramiączka przy gora "bez": zwykłe albo wiązane na szyi), sciag = true (ściągacz na gumce pod biustem), marsz = true (marszczony stanik zamiast zaszewek, tylko fasony odcinane w talii i to_stanik), tren = wydłużenie tyłu w cm 0-80 (tylko su_dopasowana, su_trapez, su_zakl), rozp = rozporek z tyłu w cm 0-40 (spódnice sk_prosta, sk_olowkowa, sk_trapez oraz su_dopasowana i su_trapez), ff = 0.5, 1 albo 2 (z ilu kół jest falbana w su_rybka), kop = true (przód kopertowy, tylko fasony odcinane w talii i to_stanik), kol = "brak", "stojka", "bebe" albo "szal" (szalowy tylko razem z kop), pasT = szerokość paska w talii w cm (tylko fasony odcinane w talii). Fason su_zakl to sukienka odcinana w talii z dołem z zakładek. Topy: to_klasyczny, to_bokserka, to_ramiaczka, to_tshirt, to_tshirt_k. ' +
      'Jeśli na zdjęciu jest element, który da się uszyć z prostokąta (falbana, pasek, szarfa, kokarda, wiązanie, lamówka, kieszeń nakładana, patka), a program go nie ma, podaj przepis w polu "dodatki": [{"nazwa": "krótka nazwa", "baza": "dekolt" | "talia" | "biust" | "biodra" | "dol" | "pacha" | "rekaw" | "stala", "mnoznik": od 0.2 do 4 (1.8 dla marszczonej falbany), "plus": centymetry dodane do długości, "szerokosc": gotowa szerokość w cm, "ile": liczba sztuk, "opis": "jedno zdanie, gdzie i jak przyszyć"}]. Długość elementu to baza razy mnoznik plus plus. Takich elementów nie wpisuj już do "braki". ' +
      'W polu "braki" wypisz każdy element konstrukcyjny widoczny na zdjęciu, którego program nie ma, krótko i w mianowniku, na przykład "rękawy 3/4 z mankietami", "kołnierz szalowy", "zakładki w talii". ' +
      'Podaj dokładnie jedną propozycję: fason, który jest najbliżej zdjęcia. Pomiń parametry, które danego fasonu nie dotyczą. "dopasowanie" oceń uczciwie: jeśli zdjęcie pokazuje coś, czego program nie umie (na przykład płaszcz albo spodnie), daj niską wartość i napisz to w "braki". Jeśli na zdjęciu nie ma ubrania, zwróć pustą listę propozycji.',
    ].join('\n');
  }
  function inspRender(res, fresh) {
    const box = $('inRes'); box.textContent = '';
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    if (res.opis) box.append(el('p', String(res.opis)));
    const props = Array.isArray(res.propozycje) ? res.propozycje.filter((q) => q && W.STYLES.some((s) => s.id === q.fason)).slice(0, 1) : []; // jedna propozycja: fason najbliższy zdjęciu
    if (!props.length) box.append(el('p', 'Nie znalazłam fasonu, który sensownie to odda.'));
    props.forEach((q, i) => {
      const st = W.STYLES.find((s) => s.id === q.fason), card = el('div', null, 'prop' + (i ? ' alt' : '')), hd = el('h4', GRP[st.group] + st.name);
      if (isFinite(q.dopasowanie)) hd.append(el('span', Math.round(Math.max(0, Math.min(100, q.dopasowanie))) + '%'));
      card.append(hd); if (q.dlaczego) card.append(el('p', String(q.dlaczego)));
      const pr = q.parametry || {}, tags = el('div', null, 'tags'), tag = (t) => tags.append(el('span', t));
      if (isFinite(pr.dl)) tag('długość ' + f1(+pr.dl) + ' cm');
      if (NK.includes(pr.nk) && st.group === 'Sukienki') tag('dekolt ' + NKN[pr.nk] + (isFinite(pr.nd) ? ' ' + f1(+pr.nd) + ' cm' : ''));
      if (isFinite(pr.nb) && +pr.nb > 2) tag('tył ' + f1(+pr.nb) + ' cm');
      const flv = Math.max(-6, Math.min(30, +pr.flare));
      if (isFinite(pr.flare) && flv && !/kol|polkole|kliny/.test(st.id)) tag((flv > 0 ? 'poszerzenie ' : 'zwężenie ') + f1(Math.abs(flv)) + ' cm');
      if (FAB[q.tkanina]) tag(FAB[q.tkanina].name.toLowerCase());
      const prn = P.LIST.find((x) => x.id === q.wzor); if (prn) tag(prn.name.toLowerCase());
      card.append(tags);
      if (Array.isArray(q.roznice) && q.roznice.length) { const ul = el('ul'); q.roznice.slice(0, 5).forEach((t) => ul.append(el('li', String(t)))); card.append(ul); }
      const b = el('button', 'Zastosuj na manekinie'); b.addEventListener('click', () => inspApply(q, st)); card.append(b); box.append(card);
    });
    const exs = inspExtras(res);
    if (exs.length) { // dodatki, które da się uszyć z prostokąta: trafią do projektu razem z propozycją
      const wrap = el('div', null, 'prop alt'); wrap.append(el('h4', 'Dodatki, które dołożę z prostokątów'));
      const ul = el('ul'); exs.forEach((ex) => ul.append(el('li', ex.name + ': ' + (ex.base === 'stala' ? 'długość ' + f1(ex.plus) + ' cm' : ex.k.toFixed(1).replace('.', ',') + ' × ' + EXB[ex.base] + (ex.plus ? ' + ' + f1(ex.plus) + ' cm' : '')) + ', szerokość ' + f1(ex.w) + ' cm' + (ex.note ? '. ' + ex.note : '')))); wrap.append(ul);
      wrap.append(el('p', 'Wejdą do projektu po kliknięciu „Zastosuj na manekinie”. Zmienisz je w Fasonie.')); box.append(wrap);
    }
    // brakujące elementy konstrukcyjne: z różnic najlepszej propozycji i z listy braków, z pytaniem o dopisanie do bazy
    const miss = [], seen = new Set(), take = (t) => { const c = wishClean(t); if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); miss.push(c); } };
    if (Array.isArray(res.braki)) res.braki.forEach(take);
    if (!miss.length && props[0] && Array.isArray(props[0].roznice)) props[0].roznice.filter((t) => /^\s*brak/i.test(String(t))).forEach(take);
    if (miss.length) {
      // świeża analiza sama dopisuje braki do listy, która trafia do Claude; przy otwarciu z historii tylko je pokazuje
      let added = 0; if (fresh) for (const t of miss.slice(0, 8)) if (!state.wish.some((w) => w.t.toLowerCase() === t.toLowerCase())) { state.wish.push({ t, at: Date.now() }); added++; }
      if (added) { persist(true); wishFill(); wishSync(); }
      const wrap = el('div', null, 'prop alt'); wrap.append(el('h4', 'Tych elementów program jeszcze nie ma'));
      const ul = el('ul'); miss.slice(0, 8).forEach((t) => ul.append(el('li', t))); wrap.append(ul);
      wrap.append(el('p', dbRef ? 'Program nie umie ich jeszcze narysować. Żeby je dostać, napisz w rozmowie z Claude o Wykrojniku: dodaj braki z listy.' : 'Program nie umie ich jeszcze narysować. Lista jest na dole tego panelu: skopiuj ją i wklej w rozmowie z Claude.'));
      box.append(wrap);
    }
    $('inMoreBox').hidden = false;
  }
  // lista elementów konstrukcyjnych do dodania do bazy: zbiera braki z Inspiracji, żeby można je było przekazać do zrobienia
  // brak, który da się uszyć z prostokąta, zamienia się w dodatek do projektu, zamiast czekać na liście
  function exFromText(t) {
    const c = String(t || '').trim().replace(/^brak\s+/i, '').replace(/[.;]+$/, ''), l = c.toLowerCase(); if (c.length < 3 || c.length > 90 || wishDone(c)) return null;
    const nm = c.length > 40 ? c.slice(0, 41).replace(/\s+\S*$/, '').replace(/\s+(i|oraz|z|ze)(\s+\S+)?$/, '') : c, mk = (base, k, plus, w, n, note) => exClean({ name: nm, base, k, plus, w, n, note });
    if (/falban|wolant/.test(l)) return mk(/dekol/.test(l) ? 'dekolt' : /rękaw|rekaw/.test(l) ? 'rekaw' : /tali/.test(l) ? 'talia' : 'dol', 1.8, 0, 10, 1, 'Zmarszcz i doszyj wzdłuż krawędzi.');
    if (/pasek|pas |szarf|kokard|wiąz|wiaz|troczk/.test(l)) { const tie = /kokard|wiąz|wiaz|szarf|troczk|długi/.test(l); return mk('talia', 1, tie ? (/długi/.test(l) ? 160 : 110) : 4, /szarf|szerok/.test(l) ? 8 : 5, 1, tie ? 'Zawiąż w talii na kokardę.' : 'Zapnij albo przyszyj w talii.'); }
    if (/lamówk|lamowk|wypustk/.test(l)) return mk(/pach/.test(l) ? 'pacha' : 'dekolt', 1, 3, 2, 1, 'Obszyj krawędź.');
    if (/kiesze\S* nakładan/.test(l)) return mk('stala', 1, 16, 17, 2, 'Naszyj na przodzie.');
    if (/patk/.test(l)) return mk('stala', 1, 14, 5, 2, 'Naszyj nad kieszenią albo na ramieniu.');
    return null;
  }
  // dodatki z analizy: przepisy od Claude i braki, które same zamieniły się w prostokąty
  function inspExtras(res) {
    const out = (res && Array.isArray(res.dodatki) ? res.dodatki : []).map(exClean).filter(Boolean), seen = new Set(out.map((x) => x.name.toLowerCase()));
    let br = res && Array.isArray(res.braki) ? res.braki : []; const p0 = res && Array.isArray(res.propozycje) ? res.propozycje[0] : null; if (p0 && Array.isArray(p0.roznice)) br = br.concat(p0.roznice.filter((t) => /^\s*brak/i.test(String(t))));
    for (const t of br) { const ex = exFromText(t); if (ex && !seen.has(ex.name.toLowerCase()) && !out.some((o) => o.base === ex.base && /pasek|szarf|kokard|wiąz/i.test(o.name) === /pasek|szarf|kokard|wiąz/i.test(ex.name))) { seen.add(ex.name.toLowerCase()); out.push(ex); } }
    return out.slice(0, 6);
  }
  // elementy, które program już ma, nie trafiają na listę braków, a stare wpisy znikają z niej same
  function wishDone(c) { return /bufiast|bufk|marszczon\w* stanik|falbank\w* przy (dekol|rękaw)|ściągacz|sciagacz|^tren\b|rozpor|ramiączk|crop|mankiet|kołnierz szalowy|stójk|kopert|zakładki/i.test(c); }
  function wishClean(t) { let c = String(t || '').trim().replace(/^brak\s+/i, '').replace(/[.;]+$/, ''); if (c.length < 3 || c.length > 90 || wishDone(c) || exFromText(c)) return ''; return c.charAt(0).toUpperCase() + c.slice(1); }
  // lista braków żyje też w bazie artefaktu (dokument wishes/list): stamtąd czyta ją Claude, a po dodaniu elementów czyści
  let dbRef = null, wishBusy = Promise.resolve();
  function wishSync() {
    if (!dbRef) return; const body = { items: state.wish.slice(0, 60).map((w) => ({ t: String(w.t).slice(0, 90), at: w.at || 0 })), updated: Date.now() };
    wishBusy = wishBusy.then(() => dbRef.doc('wishes/list').set(body)).catch(() => {}); wishFill();
  }
  async function wishPull() {
    try {
      const snapD = await dbRef.doc('wishes/list').get();
      if (snapD.exists) { const it = (snapD.data() || {}).items; if (Array.isArray(it)) { state.wish = it.filter((w) => w && typeof w.t === 'string' && wishClean(w.t)).map((w) => ({ t: wishClean(w.t), at: +w.at || 0 })); persist(true); if (state.wish.length !== it.length) wishSync(); } }
      else if (state.wish.length) wishSync();
    } catch (e) { /* bez bazy lista zostaje lokalna */ }
    wishFill();
  }
  function wishFill() {
    if (!Array.isArray(state.wish)) state.wish = [];
    { const n0 = state.wish.length; state.wish = state.wish.filter((w) => w && wishClean(w.t)); if (state.wish.length !== n0) persist(true); }
    const box = $('wish'); box.textContent = ''; $('wishBox').hidden = !state.wish.length || !!dbRef; // gdy lista zapisuje się sama, nie ma czym zarządzać, więc jej nie pokazuję
    state.wish.forEach((w, i) => { const row = document.createElement('div'), sp = document.createElement('span'), x = document.createElement('button'); row.className = 'wrow'; sp.textContent = w.t; x.textContent = 'Usuń'; x.addEventListener('click', () => { state.wish.splice(i, 1); persist(true); wishFill(); wishSync(); }); row.append(sp, x); box.append(row); });
    $('wishStat').textContent = dbRef ? 'Lista zapisuje się sama. W rozmowie z Claude wystarczy napisać: dodaj braki z listy.' : 'Lista jest zapisana tylko w tej aplikacji. Skopiuj ją i wklej w rozmowie z Claude.'; $('wishCopy').hidden = !!dbRef;
    $('wishTxt').value = state.wish.length ? 'Elementy do dodania do Wykrojnika:\n' + state.wish.map((w) => '- ' + w.t).join('\n') : '';
  }
  $('wishCopy').addEventListener('click', async () => {
    const ta = $('wishTxt'); ta.hidden = false; ta.focus(); ta.select();
    try { await navigator.clipboard.writeText(ta.value); say('Lista skopiowana. Wklej ją w rozmowie z Claude.'); ta.hidden = true; }
    catch (e) { try { if (document.execCommand('copy')) { say('Lista skopiowana. Wklej ją w rozmowie z Claude.'); ta.hidden = true; return; } } catch (e2) {} say('Zaznaczyłam listę, skopiuj ją skrótem ⌘C.'); }
  });
  function inspApply(q, st) {
    const p = state.p, pr = q.parametry || {};
    state.sel = {}; state.style = st.id; p.flare = st.flare || 0; if (st.dl) p.dl = st.dl; else if (dlMin() >= 25 && !(p.dl >= 25)) p.dl = 58;
    Object.assign(p, { tren: 0, rozp: 0, pasT: 0, falN: false, falR: false, marsz: false, sciag: false, kop: false, mank: false, bok: 0, rek: 'brak', kol: 'brak', ram: 'brak', gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 0, nw: 0, nb: 0, ff: 1, bk: 'prosta', luzG: 4, luzT: 1, luzB: 2 }, st.preset || {});
    for (const k in LIM) if (isFinite(pr[k]) && pr[k] !== null && pr[k] !== '') p[k] = Math.round(Math.max(LIM[k][0], Math.min(LIM[k][1], +pr[k])) * 2) / 2;
    if (dlMin() < 0 && isFinite(pr.dl) && pr.dl !== null && pr.dl !== '') p.dl = Math.round(Math.max(-10, Math.min(70, +pr.dl)) * 2) / 2;
    if (['serce', 'luk', 'prosta'].includes(pr.bk)) p.bk = pr.bk;
    p.dol = ['polkole', 'kolo', 'kolo2'].includes(pr.dol) && (st.id === 'su_empire' || st.id === 'su_princeska') ? pr.dol : '';
    if (st.id.indexOf('to_tshirt') === 0) { const f = st.id === 'to_tshirt_s' ? 'slim' : ['slim', 'regular', 'oversize'].includes(pr.fit) ? pr.fit : 'regular'; p.fit = f; if (!isFinite(pr.luzG) || pr.luzG === null) Object.assign(p, f === 'slim' ? { luzG: -4, luzT: 0, luzB: -4 } : f === 'oversize' ? { luzG: 16, luzT: 12, luzB: 14 } : { luzG: 6, luzT: 8, luzB: 4 }); state.fabric = 'dzersej'; }
    p.extras = inspExtras(inLast);
    const bool = (v) => v === true || v === 'true', cm = (v, lo, hi) => (isFinite(v) && v !== null && v !== '' ? Math.round(Math.max(lo, Math.min(hi, +v)) * 2) / 2 : 0), fl0 = flags();
    if (st.id === 'to_ramiaczka') p.gora = 'bez'; else if (pr.gora === 'bez' || pr.gora === 'ramiona') p.gora = fl0.dress ? pr.gora : 'ramiona';
    if (p.gora === 'bez') { if (['brak', 'cienkie', 'szyja'].includes(pr.ram)) p.ram = pr.ram; if (st.id === 'to_ramiaczka' && p.ram === 'brak') p.ram = 'cienkie'; if (p.luzG > 0) p.luzG = 0; }
    else { p.ram = 'brak'; if (fl0.dress && ['krotki', '34', 'dlugi', 'bufka'].includes(String(pr.rek))) p.rek = String(pr.rek); p.rekL = ['krotki', '34', 'dlugi'].includes(p.rek) ? rekDef(p.rek) : 0; p.mank = bool(pr.mank) && p.rek === '34'; if (p.rek === 'brak') p.bok = Math.max(p.bok, cm(pr.bok, 0, 12)); else p.bok = 0; p.falN = bool(pr.falN) && fl0.dress; p.falR = bool(pr.falR) && p.rek !== 'brak'; }
    p.sciag = bool(pr.sciag) && fl0.dress; p.marsz = bool(pr.marsz) && (ODC.includes(st.id) || st.id === 'to_stanik') && p.gora !== 'bez'; if (fl0.tren) p.tren = cm(pr.tren, 0, 80); if (fl0.rozp) p.rozp = cm(pr.rozp, 0, 40); if ([0.5, 1, 2].includes(+pr.ff)) p.ff = +pr.ff;
    p.kop = pr.kop === true && p.gora !== 'bez' && (ODC.includes(st.id) || st.id === 'to_stanik'); p.kol = p.kop ? (pr.kol === 'szal' ? 'szal' : 'brak') : (pr.kol === 'stojka' || pr.kol === 'bebe' ? pr.kol : 'brak'); p.kolW = p.kol === 'szal' ? 7 : p.kol === 'bebe' ? 6 : 3; p.pasT = ODC.includes(st.id) && isFinite(pr.pasT) && +pr.pasT >= 2 ? Math.min(12, Math.round(+pr.pasT * 2) / 2) : 0; if (isFinite(pr.bh) && +pr.bh >= 2) p.bh = Math.min(12, Math.round(+pr.bh * 2) / 2);
    if (NK.includes(pr.nk)) p.nk = pr.nk; if (pr.nkb === 'v' || pr.nkb === 'okragly') p.nkb = pr.nkb;
    if (FAB[q.tkanina]) state.fabric = q.tkanina;
    state.print = P.LIST.some((x) => x.id === q.wzor) ? q.wzor : 'gladka';
    const hx = /^#[0-9a-f]{6}$/i; if (hx.test(q.kolor || '')) state.color = q.kolor.toLowerCase(); if (hx.test(q.kolor2 || '')) state.color2 = q.kolor2.toLowerCase();
    fillForm(); persist(); if (state.view !== '3d') setView('3d'); else draw(true);
    say('Ustawiłam fason i parametry z propozycji. Dopracuj je suwakami.');
  }
  const INERR = { not_granted: 'Bez zgody na użycie Claude nie mogę przeanalizować zdjęcia.', rate_limited: 'Limit zapytań do Claude jest chwilowo wyczerpany. Spróbuj za jakiś czas.', image_rejected: 'Tego pliku nie da się wysłać. Wybierz zdjęcie JPG, PNG albo WebP.', images_unavailable: 'W tym widoku nie można wysyłać zdjęć do Claude.', refused: 'Claude odmówił analizy tego zdjęcia. Spróbuj z innym.', session_expired: 'Sesja wygasła. Zaloguj się ponownie w Claude.', invalid_json: 'Odpowiedź przyszła w złym formacie. Spróbuj jeszcze raz.' };
  async function inspRun(more) {
    if (!sampleFn || !inBlob) return;
    inCtl = new AbortController(); $('inGo').disabled = true; $('inMoreGo').disabled = true; $('inStop').hidden = false; $('inStat').textContent = ''; const bz = busyOn('Claude analizuje zdjęcie. To zwykle trwa od kilkunastu sekund do minuty.');
    const note = $('inNote').value.trim(), first = inspPrompt() + (note ? '\n\nUwaga użytkowniczki: ' + note : '');
    const input = more && inLast ? [{ role: 'user', content: first }, { role: 'assistant', content: JSON.stringify(inLast) }, { role: 'user', content: 'Popraw propozycje według tej uwagi i odpowiedz znowu samym obiektem JSON w tym samym kształcie: ' + more }] : first;
    try {
      const res = await sampleFn.json(input, { images: [inBlob], signal: inCtl.signal, cache: more ? false : true });
      inLast = res && typeof res === 'object' ? res : {}; inspRender(inLast, true); $('inStat').textContent = ''; inspSave();
    } catch (e) {
      $('inStat').textContent = e && e.code === 'cancelled' ? '' : (e && INERR[e.code]) || 'Nie udało się połączyć z Claude. Spróbuj jeszcze raz.';
    } finally { busyOff(bz); $('inGo').disabled = false; $('inMoreGo').disabled = false; $('inStop').hidden = true; }
  }
  // historia inspiracji: pomniejszone zdjęcie, uwaga i ostatnia propozycja; wspólna dla wszystkich projektów
  let inCur = null;
  async function inspSave() {
    try {
      const bmp = await createImageBitmap(inBlob), k = Math.min(1, 640 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      if (!Array.isArray(state.inspH)) state.inspH = [];
      let e = state.inspH.find((x) => x.id === inCur); if (!e) { e = { id: 'i' + Date.now() }; inCur = e.id; state.inspH.unshift(e); }
      e.at = Date.now(); e.img = c.toDataURL('image/jpeg', 0.8); e.note = $('inNote').value.trim(); e.res = inLast; state.inspH = state.inspH.slice(0, 10); persist(true); inspHist();
    } catch (err) { /* bez historii, analiza i tak się udała */ }
  }
  const inspOk = (e) => e && typeof e.img === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(e.img) && e.res && typeof e.res === 'object';
  function inspHist() {
    if (!Array.isArray(state.inspH)) state.inspH = [];
    state.inspH = state.inspH.filter(inspOk); const box = $('inHist'); box.textContent = ''; $('inHistBox').hidden = !state.inspH.length;
    for (const e of state.inspH) {
      const cell = document.createElement('div'), b = document.createElement('button'), im = document.createElement('img'), x = document.createElement('button'); cell.className = 'hcell';
      const st = e.res.propozycje && e.res.propozycje[0] && W.STYLES.find((s) => s.id === e.res.propozycje[0].fason), nm = st ? GRP[st.group] + st.name.toLowerCase() : 'bez propozycji';
      im.src = e.img; im.alt = ''; b.className = 'hbtn'; b.setAttribute('aria-label', 'Otwórz inspirację: ' + nm + ', ' + new Date(e.at).toLocaleDateString('pl-PL')); b.title = nm; b.setAttribute('aria-pressed', e.id === inCur); b.append(im);
      b.addEventListener('click', () => inspOpen(e));
      x.className = 'hx'; x.textContent = '✕'; x.setAttribute('aria-label', 'Usuń z historii'); x.addEventListener('click', () => { state.inspH = state.inspH.filter((q) => q !== e); if (inCur === e.id) inCur = null; persist(true); inspHist(); });
      cell.append(b, x); box.append(cell);
    }
  }
  function inspOpen(e) {
    const bin = atob(e.img.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    inBlob = new Blob([u8], { type: 'image/jpeg' }); inCur = e.id; inLast = e.res; $('inNote').value = e.note || ''; $('inMore').value = '';
    const img = $('inPrev'); if (img.src && img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src); img.src = e.img; img.hidden = false; $('dropT').hidden = true; $('inGo').disabled = !sampleFn; $('inStat').textContent = '';
    inspRender(e.res); inspHist(); document.querySelector('#panel .body').scrollTop = 0;
  }
  function inspSet(f) {
    if (!f || !/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { $('inStat').textContent = 'Wybierz zdjęcie JPG, PNG albo WebP.'; return; }
    inBlob = f; inLast = null; inCur = null; $('inRes').textContent = ''; $('inMoreBox').hidden = true; $('inStat').textContent = sampleFn ? '' : 'Analiza zdjęć działa po otwarciu Wykrojnika w Claude.';
    const img = $('inPrev'); if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(f); img.hidden = false; $('dropT').hidden = true; $('inGo').disabled = !sampleFn;
  }
  $('inImg').addEventListener('change', () => inspSet($('inImg').files[0]));
  const dz = $('drop');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); inspSet(e.dataTransfer.files[0]); });
  document.addEventListener('paste', (e) => { if (state.panel !== 'insp') return; const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.indexOf('image/') === 0); if (f) { e.preventDefault(); inspSet(f); } });
  $('inGo').addEventListener('click', () => inspRun(''));
  $('inMoreGo').addEventListener('click', () => { const t = $('inMore').value.trim(); if (t) inspRun(t); });
  $('inStop').addEventListener('click', () => inCtl && inCtl.abort());

  // ---------- PDF ----------
  let msgT = 0;
  function say(t, keep) { $('msg').textContent = t; clearTimeout(msgT); if (!keep) msgT = setTimeout(() => ($('msg').textContent = ''), 7000); }
  function buildPdf() {
    const { d, lay, tl } = compute(), m = cur(), p = state.p, fl = flags();
    const rows = [['Modelka', 'biust ' + f1(m.og) + ', talia ' + f1(m.ot) + ', biodra ' + f1(m.ob) + ', wysokość bioder ' + f1(m.wb) + ' cm']];
    rows.push(['Długość od talii', f1(p.dl) + ' cm']);
    rows.push(['Luz', (fl.dress ? 'biust ' + f1(p.luzG) + ', ' : '') + 'talia ' + f1(p.luzT) + (fl.hip ? ', biodra ' + f1(p.luzB) : '') + ' cm']);
    rows.push(['Zapasy na szwy', 'szwy ' + f1(p.saSzew) + ', talia i wykończenia ' + f1(p.saTalia) + ', dół ' + f1(p.saDol) + ' cm']);
    rows.push(['Do wycięcia', d.info.cut.map((c) => c[0].toLowerCase() + ' ' + c[1]).join('; ')]);
    rows.push(['Tkanina (bela ' + state.fabW + ' cm)', fabricRows(d).map((r) => r[0].toLowerCase() + ': ' + r[1] + ', ' + r[2]).join('; ')]);
    rows.push(['Dodatki', (d.notions || []).map((r) => r[0].toLowerCase() + ' ' + r[1]).join('; ')]);
    for (const r of d.info.rows) rows.push([r[0], f1(r[1]) + ' cm']);
    const howto = [
      '1. Drukuj w skali 100% („rozmiar rzeczywisty”), bez dopasowywania do strony.',
      '2. Na pierwszej kartce zmierz odcinek kontrolny. Ma mieć dokładnie 10 cm.',
      '3. Przytnij kartki wzdłuż ramek i sklej je według schematu poniżej. Romby na krawędziach muszą się zejść.',
      'Linia ciągła to linia cięcia (z zapasem), przerywana to linia szycia.',
    ];
    const extra = d.layers ? [{ title: 'Warstwy i kolejność szycia', blocks: d.layers.cut.map((c) => ({ h: c.name + ' · ' + c.fabric + (c.scope ? ' · ' + c.scope : ''), lines: c.items.map((t) => '• ' + t).concat(c.notes) })).concat([{ h: 'Kolejność szycia', lines: d.layers.steps.map((t, i) => (i + 1) + '. ' + t) }]) }] : [];
    const buf = W.makePdf(window.jspdf.jsPDF, window.WYKROJ_FONT, lay, tl, { extra, labels: state.labels, title: d.title, sub: (projCur().name ? projCur().name + ' · ' : '') + (m.name || 'Bez imienia') + ' · ' + new Date().toLocaleDateString('pl-PL') + ' · Wykrojnik', rows, howto });
    const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return { buf, name: slug(d.title) + '-' + (slug(m.name || '') || 'modelka') + '.pdf' };
  }
  // zapis pliku: w aplikacji do Dokumenty/Wykrojnik, w przeglądarce zwykłe pobieranie
  async function saveFile(name, bytes, mime, open, okDisk, okDl) {
    if (desktop && desktop.fs) {
      try {
        await desktop.fs.mkdir('~/Documents/Wykrojnik', { recursive: true });
        const path = '~/Documents/Wykrojnik/' + name;
        await desktop.fs.writeFile(path, bytes);
        if (!fileOk) { fileOk = true; persist(true); showStore(); }
        if (open) await desktop.shell.openPath(path).catch(() => {});
        say(okDisk); return true;
      } catch (e) { /* brak zgody na pliki: zwykłe pobieranie */ }
    }
    if (downloads) {
      try { await downloads.save({ filename: name, data: new Blob([bytes], { type: mime }) }); say(okDl); return true; }
      catch (e) { if (!e || e.code !== 'declined') say('Nie udało się zapisać pliku. Zainstaluj Wykrojnik jako aplikację albo otwórz go w Claude.'); }
      return;
    }
    try { const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([bytes], { type: mime })); el.download = name; el.click(); return true; }
    catch (e) { say('W tym widoku nie mogę zapisać pliku. Zainstaluj Wykrojnik jako aplikację.'); }
  }
  $('pdf').addEventListener('click', async () => {
    let out; const bz = busyOn('Składam PDF z wykrojem.'); await paintTick();
    try { out = buildPdf(); } catch (e) { say('Nie udało się zbudować PDF: ' + e.message); return; } finally { busyOff(bz); }
    saveFile(out.name, new Uint8Array(out.buf), 'application/pdf', true, 'Zapisałam wykrój w Dokumenty/Wykrojnik/' + out.name + '. Drukuj w skali 100%.', 'Wykrój pobrany. Drukuj w skali 100%.')
      .then((ok) => { const pr = projCur(); if (ok && pr) { persist(true); pr.exported = Date.now(); pr.expV = 2; pr.expKey = snapKey(pr.snap); persist(true); } });
  });
  $('bkOut').addEventListener('click', () => {
    persist(true); const name = 'wykrojnik-kopia-' + new Date().toISOString().slice(0, 10) + '.json';
    saveFile(name, new TextEncoder().encode(JSON.stringify(state)), 'application/json', false, 'Kopia zapisana w Dokumenty/Wykrojnik/' + name + '.', 'Kopia pobrana.');
  });
  $('bkIn').addEventListener('change', async () => {
    const f = $('bkIn').files[0]; $('bkIn').value = ''; if (!f) return;
    let ok = false; try { ok = adopt(await f.text()); } catch (e) {}
    if (!ok) { say('To nie jest plik kopii Wykrojnika.'); return; }
    ensureProjects(); loadSnap(projCur().snap); histReset(); fillForm(); layoutUi(); persist(true); draw(true); say('Wczytałam projekty i modelki z kopii.');
  });

  // ---------- analizator wykrojów PDF ----------
  // Kod czyta z pliku linie, warstwy i napisy; Claude opisuje ich znaczenie (nazwy elementów, ile wyciąć, nitka, zapas, tabela rozmiarów).
  // Linie i wymiary zawsze pochodzą z pliku, nigdy z odpowiedzi analizatora.
  let anSt = null, anCtl = null;
  const AN_ERR = {
    not_granted: 'Bez zgody na użycie Claude nie przeanalizuję wykroju. Możesz go wczytać bez analizy.',
    rate_limited: 'Limit zapytań do Claude jest chwilowo wyczerpany. Spróbuj za jakiś czas albo wczytaj wykrój bez analizy.',
    images_unavailable: 'W tym widoku nie mogę wysłać stron wykroju do Claude. Możesz wczytać wykrój bez analizy.',
    image_rejected: 'Stron tego pliku nie udało się wysłać do Claude. Możesz wczytać wykrój bez analizy.',
    refused: 'Claude odmówił analizy tego pliku. Możesz wczytać wykrój bez analizy.',
    session_expired: 'Sesja wygasła. Zaloguj się ponownie w Claude.',
    invalid_json: 'Odpowiedź analizatora była nieczytelna. Spróbuj jeszcze raz.',
    no_channel: 'Poza Claude analiza potrzebuje klucza API. Wklej go wyżej albo wczytaj wykrój bez analizy.',
    key_rejected: 'Klucz API został odrzucony. Sprawdź, czy jest wklejony w całości i czy jest aktywny.',
    key_model: 'Ten klucz nie ma dostępu do modelu, którego używa analiza.',
    key_network: 'Nie udało się połączyć z API Claude. Sprawdź połączenie z internetem.',
    key_overloaded: 'API Claude jest chwilowo przeciążone. Spróbuj za kilka minut.',
  };
  // własny klucz API: tylko poza Claude, trzymany wyłącznie w tej przeglądarce, poza stanem aplikacji i kopiami zapasowymi
  const AN_KEY = 'wykrojnik.apikey', AN_MODEL = 'claude-sonnet-5-5';
  const anKey = () => { try { return (localStorage.getItem(AN_KEY) || '').trim(); } catch (e) { return ''; } };
  const anModel = () => { try { return (localStorage.getItem('wykrojnik.apimodel') || '').trim() || AN_MODEL; } catch (e) { return AN_MODEL; } };
  const anB64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(new Error('Nie udało się przygotować obrazu.')); r.readAsDataURL(blob); });
  async function anApi(prompt, blobs, signal) {
    const content = []; for (const b of blobs) content.push({ type: 'image', source: { type: 'base64', media_type: b.type || 'image/jpeg', data: await anB64(b) } });
    content.push({ type: 'text', text: prompt });
    let res;
    try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-api-key': anKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: anModel(), max_tokens: 16000, messages: [{ role: 'user', content }] }) }); }
    catch (e) { throw { code: signal && signal.aborted ? 'cancelled' : 'key_network' }; }
    let data = null; try { data = await res.json(); } catch (e) { /* odpowiedź bez JSON-u obsługuje kod statusu */ }
    if (!res.ok) { const ty = data && data.error && data.error.type; throw { code: res.status === 401 || res.status === 403 ? 'key_rejected' : res.status === 404 || ty === 'not_found_error' ? 'key_model' : res.status === 429 ? 'rate_limited' : res.status === 529 || ty === 'overloaded_error' ? 'key_overloaded' : 'upstream_error' }; }
    const text = ((data && data.content) || []).filter((c) => c && c.type === 'text').map((c) => c.text).join(''), i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i < 0 || j <= i || (data && data.stop_reason === 'max_tokens')) throw { code: 'invalid_json' };
    try { return JSON.parse(text.slice(i, j + 1)); } catch (e) { throw { code: 'invalid_json' }; }
  }
  // jedno miejsce, przez które idzie każde pytanie do Claude; reszta analizatora nie wie, którą drogą
  async function anLimit() { if (window.__anFake) return 8; if (!sampleFn) return anKey() ? 12 : 0; const l = await sampleFn.limits().catch(() => null); return l && l.images ? l.images.maxCount : 0; }
  async function anAsk(prompt, blobs, signal) {
    if (window.__anFake) return window.__anFake(prompt, blobs);
    if (!sampleFn) { if (!anKey()) throw { code: 'no_channel' }; return anApi(prompt, blobs, signal); }
    return sampleFn.json(prompt, { images: blobs, signal, modelTier: 'complex' });
  }
  const anLoadLib = () => new Promise((r) => { if (window.PatImport) r(undefined); else { const sc = document.createElement('script'); sc.src = 'importer.js'; sc.onload = r; sc.onerror = r; document.head.appendChild(sc); } });
  function anPrompt(st, shots) {
    const d = st.data, ok = (t) => /[0-9A-Za-zÀ-ž]/.test(t.s), uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
    const cons = st.pieces.map((pc, i) => {
      const b = pc.box, tx = uniq(d.all.filter((t) => ok(t) && t.s.length > 2 && pc.marks.some((k) => k.pn === t.pn && t.x > k.box[0] && t.x < k.box[2] && t.y > k.box[1] && t.y < k.box[3])).sort((a, c) => c.h - a.h).map((t) => t.s)).slice(0, 12).map((s) => '"' + s + '"');
      return 'k' + (i + 1) + ': strona ' + uniq(pc.marks.map((m) => m.pn)).join(' i ') + ', ' + Math.round(b.x1 - b.x0) + ' × ' + Math.round(b.y1 - b.y0) + ' cm, większe napisy w obrębie: ' + (tx.length ? tx.join(' | ') : 'brak');
    });
    const rest = {}; d.all.forEach((t) => { if (ok(t)) (rest[t.pn] = rest[t.pn] || []).push(t); });
    const outside = Object.keys(rest).map((pn) => 'strona ' + pn + ': ' + rest[pn].sort((a, c) => Math.round(a.y / 0.6) - Math.round(c.y / 0.6) || a.x - c.x).map((t) => t.s).filter((x, i, a) => x !== a[i - 1]).join(' | ').slice(0, 3200));
    return [
      'Jesteś analizatorem wykrojów krawieckich. Dostajesz arkusz wykroju z pliku PDF: obrazy stron, listę konturów, które program znalazł w pliku, i napisy wyciągnięte z pliku. Na obrazach każdy kontur ma czerwoną etykietę z identyfikatorem (k1, k2, ...), postawioną tuż pod najwyższym widocznym punktem jego linii; kontur widoczny na dwóch stronach ma etykietę na obu. Na arkuszu widać naraz linie wszystkich rozmiarów; kontury z listy dotyczą rozmiaru „' + (st.size || 'jedyny') + '”.',
      'Opisz znaczenie, nie geometrię. Niczego nie mierz na obrazie; liczby bierz tylko z napisów i tabel. Napisy pisane po łuku bywają w wyciągu pocięte, wtedy czytaj je z obrazu.',
      'Obrazy po kolei: ' + shots.map((s, i) => (i + 1) + ') strona ' + s.pn + (s.part ? ', ' + s.part : '')).join('; ') + '.' + (st.cut ? ' Plik ma więcej stron, niż mogę wysłać; pozostałe znasz tylko z listy konturów i napisów.' : ''),
      'Kontury:\n' + cons.join('\n'),
      'Wszystkie napisy z pliku, wierszami od góry strony:\n' + (outside.join('\n') || 'brak'),
      'Warstwy PDF: ' + (d.layers.join(', ') || 'brak'),
      st.instrText ? 'Instrukcja szycia dołączona przez użytkowniczkę (sam tekst):\n' + st.instrText : 'Instrukcji szycia nie dołączono.',
      'Odpowiedz samym obiektem JSON w tym kształcie:\n{"nazwa":"nazwa wykroju","marka":"","typ":"sukienka|top|spodnica|gorset|spodnie|okrycie|inne","opis":"jedno zdanie po polsku","ze_skosu":false,"czytelnosc":"dobra|czesciowa|slaba","zapas":{"wliczony":true,"cm":0.7,"wyjatki":[{"gdzie":"szwy boczne","cm":1.3}]},"rozmiary":[{"nazwa":"M","biust":88,"talia":68,"biodra":94,"wzrost":null,"warstwa":"Size M"}],"elementy":[{"nazwa":"FRONT BODY","nazwa_pl":"Przód","kontury":["k1"],"ile":1,"ze_zlozenia":false,"para":false,"odbij":false,"nitka":"prosta|skos|poprzeczna|brak","material":"","podszewka_ile":0,"znaki":["zaszewka piersiowa"]}],"nie_elementy":["k2"],"pasmanteria":["zamek kryty 40-50 cm"],"instrukcja":{"potrzebna":false,"po_co":[]},"niepewne":[]}',
      'Zasady:\n- Jeden element wykroju może składać się z kilku konturów, gdy przechodzi przez dwie strony albo dwa arkusze: wpisz wszystkie identyfikatory. Każdy kontur należy najwyżej do jednego elementu.\n- Kontury, które na pewno nie są elementami wykroju (strzałka nitki prostej, ramka strony, legenda, test wydruku, tabela), wpisz do \"nie_elementy\". Konturu, co do którego nie masz pewności, nie wpisuj nigdzie.\n- "ile": ile razy wyciąć z tkaniny głównej. "ze_zlozenia": krawędź elementu leży na złożeniu tkaniny. "para": elementy tnie się w lustrzanej parze. "odbij": narysowana jest połowa elementu i trzeba ją odbić wzdłuż linii środka, żeby wyciąć cały element z pojedynczej warstwy.\n- "podszewka_ile": ile razy ten sam element wyciąć dodatkowo z podszewki, 0 gdy wcale.\n- "nazwa_pl": krótka polska nazwa krawiecka. "material": rodzaj tkaniny, jeśli arkusz go podaje, po polsku.\n- "rozmiary": tabela wymiarów ciała w centymetrach; "warstwa" to nazwa warstwy PDF z listy wyżej, która zawiera linie tego rozmiaru, albo null.\n- "zapas.wliczony": true, false albo null, gdy arkusz o tym milczy. "zapas.cm": null, gdy liczba nie pada.\n- "czytelnosc": "slaba", gdy nazw większości elementów nie da się odczytać; "czesciowa", gdy brakuje części opisów.\n- "instrukcja.potrzebna": true, gdy z tego, co masz, nie da się ustalić czegoś potrzebnego do cięcia: wielkości zapasu na szwy, liczby elementów do wycięcia, nazw elementów albo tabeli rozmiarów, oraz zawsze gdy czytelność jest słaba. W "po_co" wypisz po polsku, w mianowniku, czego brakuje, na przykład "wielkość zapasu na szwy". Gdy instrukcja jest dołączona, a czegoś nadal brakuje, też to wypisz i zostaw true.\n- Czego nie da się odczytać, wpisz jako null i dodaj do "niepewne" jedno krótkie zdanie po polsku. Niczego nie zgaduj.',
    ].join('\n\n');
  }
  // odpowiedź analizatora to dane z zewnątrz: zostają tylko pola o oczekiwanym typie i kontury, które naprawdę istnieją
  function anClean(r, n, layers) {
    r = r && typeof r === 'object' ? r : {};
    const S = (v, m) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, m || 80) : ''), N = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 && v < 1000 ? Math.round(v * 10) / 10 : null), B = (v) => v === true, L = (v, m, k) => (Array.isArray(v) ? v.map((x) => S(x, m)).filter(Boolean).slice(0, k || 12) : []);
    const z = r.zapas && typeof r.zapas === 'object' ? r.zapas : {}, ins = r.instrukcja && typeof r.instrukcja === 'object' ? r.instrukcja : {}, seen = new Set();
    const out = {
      nazwa: S(r.nazwa, 60), marka: S(r.marka, 40), typ: S(r.typ, 20), opis: S(r.opis, 240), ze_skosu: B(r.ze_skosu), czytelnosc: ['dobra', 'czesciowa', 'slaba'].includes(r.czytelnosc) ? r.czytelnosc : 'czesciowa',
      zapas: { wliczony: z.wliczony === true ? true : z.wliczony === false ? false : null, cm: N(z.cm), wyjatki: (Array.isArray(z.wyjatki) ? z.wyjatki : []).map((w) => ({ gdzie: S(w && w.gdzie, 60), cm: N(w && w.cm) })).filter((w) => w.gdzie && w.cm !== null).slice(0, 6) },
      rozmiary: (Array.isArray(r.rozmiary) ? r.rozmiary : []).map((x) => ({ nazwa: S(x && x.nazwa, 12), biust: N(x && x.biust), talia: N(x && x.talia), biodra: N(x && x.biodra), wzrost: N(x && x.wzrost), warstwa: layers.includes(x && x.warstwa) ? x.warstwa : null })).filter((x) => x.nazwa).slice(0, 30),
      elementy: [], skip: [], pasmanteria: L(r.pasmanteria, 80, 10), instrukcja: { potrzebna: B(ins.potrzebna), po_co: L(ins.po_co, 80, 8) }, niepewne: L(r.niepewne, 200, 10),
    };
    for (const e of Array.isArray(r.elementy) ? r.elementy.slice(0, 60) : []) {
      if (!e || typeof e !== 'object') continue;
      const ks = (Array.isArray(e.kontury) ? e.kontury : []).map((k) => +String(k).replace(/^k/i, '')).filter((k) => Number.isInteger(k) && k >= 1 && k <= n && !seen.has(k)); ks.forEach((k) => seen.add(k));
      const nm = S(e.nazwa_pl, 40) || S(e.nazwa, 40); if (!nm || !ks.length) continue;
      out.elementy.push({ nazwa: S(e.nazwa, 60), pl: nm, k: ks, ile: Math.max(1, Math.min(40, Math.round(+e.ile) || 1)), fold: B(e.ze_zlozenia), para: B(e.para), odbij: B(e.odbij), nitka: ['prosta', 'skos', 'poprzeczna'].includes(e.nitka) ? e.nitka : '', mat: S(e.material, 30), pod: Math.max(0, Math.min(40, Math.round(+e.podszewka_ile) || 0)), znaki: L(e.znaki, 60, 8) });
    }
    out.skip = (Array.isArray(r.nie_elementy) ? r.nie_elementy : []).map((k) => +String(k).replace(/^k/i, '')).filter((k) => Number.isInteger(k) && k >= 1 && k <= n && !seen.has(k));
    if (out.czytelnosc === 'slaba') out.instrukcja.potrzebna = true;
    return out;
  }
  // rozmiar najbliższy modelce: zwykłe porównanie z tabelą, bez AI
  function anSize(rozm, m) {
    let best = null, bs = 1e9;
    for (const r of rozm) { let s = 0, c = 0; for (const [a, b] of [[r.biust, m.og], [r.talia, m.ot], [r.biodra, m.ob]]) if (a && b) { s += ((a - b) / b) ** 2; c++; } if (c && s / c < bs) { bs = s / c; best = r; } }
    return best;
  }
  const anLayer = (r, sizes) => (r ? r.warstwa || sizes.find((z) => z.replace(/size|rozmiar/gi, '').trim().toLowerCase() === r.nazwa.toLowerCase()) || null : null);
  const anCut = (e) => 'wytnij ' + e.ile + '×' + (e.fold ? ' ze złożenia' : '') + (e.para ? ' w lustrzanej parze' : '') + (e.odbij ? ' jako cały element, odbijając połowę' : '') + (e.nitka === 'skos' ? ', ze skosu' : e.nitka === 'poprzeczna' ? ', w poprzek' : '') + (e.mat ? ' (' + e.mat + ')' : '') + (e.pod ? ' i ' + e.pod + '× z podszewki' : '');
  // nazwy i opisy z analizy trafiają na kontury wybranego rozmiaru; dopasowanie po położeniu, bo numeracja konturów zależy od rozmiaru
  function anApply(pieces, an) {
    if (!an || !an.el) return pieces;
    const ctr = (pc) => [(pc.box.x0 + pc.box.x1) / 2, (pc.box.y0 + pc.box.y1) / 2], gone = pieces.map((pc) => (an.skip || []).some((a) => Math.hypot(a[0] - ctr(pc)[0], a[1] - ctr(pc)[1]) < 3));
    if (gone.some(Boolean)) {
      pieces = pieces.map((pc) => Object.assign({}, pc, { prims: pc.prims.slice() }));
      pieces.forEach((pc, i) => { if (!gone[i]) return; const c = ctr(pc), host = pieces.find((q, j) => !gone[j] && c[0] > q.box.x0 && c[0] < q.box.x1 && c[1] > q.box.y0 && c[1] < q.box.y1); if (host) host.prims = host.prims.concat(pc.prims.filter((q) => q.t === 'poly').map((q) => Object.assign({}, q, { s: 'aux' }))); });
      pieces = pieces.filter((_, i) => !gone[i]);
    }
    const hit = pieces.map((pc) => { const b = pc.box; let best = null, bd = 1e9; an.el.forEach((e) => (e.at || []).forEach((a) => { if (a[0] > b.x0 - 2 && a[0] < b.x1 + 2 && a[1] > b.y0 - 2 && a[1] < b.y1 + 2) { const dd = Math.hypot(a[0] - (b.x0 + b.x1) / 2, a[1] - (b.y0 + b.y1) / 2); if (dd < bd) { bd = dd; best = e; } } })); return best; });
    return pieces.map((pc, i) => {
      const e = hit[i]; if (!e) return pc;
      const parts = hit.filter((h) => h === e).length, idx = hit.slice(0, i + 1).filter((h) => h === e).length, name = e.pl.toUpperCase() + (parts > 1 ? ' (część ' + idx + ' z ' + parts + ')' : '');
      const prims = pc.prims.filter((q) => q.t !== 'text'), cx = (pc.box.x0 + pc.box.x1) / 2, cy = (pc.box.y0 + pc.box.y1) / 2;
      prims.push({ t: 'text', x: cx, y: cy, text: name, size: 'M', anchor: 'middle' }, { t: 'text', x: cx, y: cy + 1.6, text: e.cut, size: 'S', anchor: 'middle' });
      return Object.assign({}, pc, { name, cut: e.cut, prims });
    });
  }
  function anOpen() { anSt = { sheet: null, instr: null }; $('anSheet').value = ''; $('anInstr').value = ''; $('anSheetN').textContent = ''; $('anInstrN').textContent = ''; $('anRes').hidden = true; $('anStat').textContent = ''; $('anGo').disabled = true; $('anRaw').disabled = true; $('anStop').hidden = true; $('anKeyBox').hidden = !!sampleFn; $('anKeyIn').value = anKey(); $('anBox').hidden = false; }
  function anClose() { if (anCtl) anCtl.abort(); $('anBox').hidden = true; anSt = null; }
  async function anRun() {
    const st = anSt; if (!st || !st.sheet) return;
    const stat = (t) => { if (anSt === st) $('anStat').textContent = t; }, bz = busyOn('Sprawdzam połączenie z Claude.');
    anCtl = new AbortController(); $('anGo').disabled = true; $('anRaw').disabled = true; $('anStop').hidden = false; $('anRes').hidden = true;
    try {
      const max = await anLimit(); if (!max) throw { code: 'no_channel' };
      stat(''); busySet(bz, 'Czytam linie i napisy z arkusza (krok 1 z 3).'); await paintTick();
      await anLoadLib(); if (!window.PatImport) throw new Error('Nie udało się wczytać modułu importu.');
      if (!st.data) { st.data = await window.PatImport.load(st.sheet); st.size = st.data.sizes[Math.floor(st.data.sizes.length / 2)] || ''; st.pieces = window.PatImport.pick(st.data, st.size); }
      if (!st.pieces.length) throw new Error('Nie znalazłam w tym pliku elementów wykroju.');
      st.instrText = st.instr ? await window.PatImport.text(st.instr, 14000).catch(() => '') : '';
      busySet(bz, 'Przygotowuję obrazy stron (krok 2 z 3).'); await paintTick();
      const marks = st.pieces.reduce((a, pc, i) => a.concat(pc.marks.map((m) => ({ id: 'k' + (i + 1), pn: m.pn, x: m.x, y: m.y }))), []);
      // budżet obrazów: strony z elementami idą w dwóch połówkach, strony z samym tekstem w całości; gdy to za dużo, najpierw rezygnuję z połówek, potem ze stron bez elementów
      const pns = st.data.pages.map((p) => p.pn), withEl = new Set(marks.map((m) => m.pn)), nW = pns.filter((p) => withEl.has(p)).length, nO = pns.length - nW;
      const plan = 2 * nW + nO <= max ? (p) => (withEl.has(p) ? 2 : 1) : nW + nO <= max ? () => 1 : (p) => (withEl.has(p) ? 1 : 0);
      let shots = await window.PatImport.shots(st.sheet, marks, plan); st.cut = shots.length > max || (nW + nO > max && nO > 0); shots = shots.slice(0, max);
      if (anCtl.signal.aborted) throw { code: 'cancelled' };
      busySet(bz, 'Claude ogląda arkusz i opisuje elementy (krok 3 z 3). To zwykle trwa od pół minuty do dwóch minut.'); // obrazy mogą iść dwiema drogami: wbudowanym kanałem Claude albo przez API z kluczem użytkownika
      const raw = await anAsk(anPrompt(st, shots), shots.map((s) => s.blob), anCtl.signal);
      if (anSt !== st) return;
      st.res = anClean(raw, st.pieces.length, st.data.sizes); stat(''); anShow();
    } catch (e) {
      stat(e && e.code === 'cancelled' ? '' : (e && AN_ERR[e.code]) || (e && !e.code && e.message) || 'Nie udało się połączyć z Claude. Spróbuj jeszcze raz.');
    } finally { busyOff(bz); if (anSt === st) { $('anGo').disabled = false; $('anRaw').disabled = false; $('anStop').hidden = true; } }
  }
  function anShow() {
    const st = anSt, r = st.res, m = cur(), box = $('anRes'); box.hidden = false;
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    $('anName').value = r.nazwa || st.data.name; $('anDesc').textContent = [r.marka, r.opis].filter(Boolean).join(' · ');
    const need = $('anNeed'); need.textContent = r.instrukcja.potrzebna ? (st.instr ? 'Mimo instrukcji nie udało się ustalić: ' : 'Z samego arkusza nie da się odczytać: ') + (r.instrukcja.po_co.join(', ') || 'części opisów') + '. ' + (st.instr ? 'Uzupełnij te pola ręcznie.' : 'Dołącz instrukcję szycia i przeanalizuj jeszcze raz albo uzupełnij te pola ręcznie.') : '';
    // rozmiar
    const sel = $('anSize'); sel.textContent = ''; const rec = anSize(r.rozmiary, m), recL = anLayer(rec, st.data.sizes);
    for (const z of st.data.sizes) { const o = mkEl('option'); o.value = z; o.textContent = z; sel.appendChild(o); } sel.disabled = !st.data.sizes.length; sel.value = recL || st.size || '';
    const dif = rec ? /** @type {any[][]} */ ([['biust modelki jest', rec.biust, m.og, 'większy', 'mniejszy'], ['talia jest', rec.talia, m.ot, 'większa', 'mniejsza'], ['biodra są', rec.biodra, m.ob, 'większe', 'mniejsze']]).filter((x) => x[1] && x[2] && Math.abs(x[1] - x[2]) >= 3).map((x) => x[0] + ' o ' + f1(Math.abs(x[1] - x[2])) + ' cm ' + (x[2] > x[1] ? x[3] : x[4])) : [];
    const one = !st.data.sizes.length; $('anSizeRow').hidden = one;
    $('anSizeN').textContent = (one ? 'Ten plik zawiera jeden rozmiar. ' : '') + (rec ? (one ? 'Według tabeli dla modelki „' : 'Dla modelki „') + m.name + '” najbliżej jest rozmiar ' + rec.nazwa + (dif.length ? ', ale ' + dif.join(', ') + '.' : '.') + (recL || one ? '' : ' Nie umiem wskazać jego warstwy w pliku, wybierz ją z listy.') : r.rozmiary.length ? '' : 'Nie znalazłam tabeli rozmiarów.');
    // zapas
    $('anSa').value = r.zapas.cm === null ? '' : String(r.zapas.cm).replace('.', ','); $('anSaIn').checked = r.zapas.wliczony !== false;
    $('anSaN').textContent = r.zapas.wyjatki.map((w) => w.gdzie + ': ' + f1(w.cm) + ' cm').join(', ');
    // elementy
    const tb = $('anEl'); tb.textContent = '';
    r.elementy.forEach((e) => {
      const row = el('div', null, 'anRow'), k = el('span', e.k.map((x) => 'k' + x).join(' '), 'anK'), nm = mkEl('input'), il = mkEl('input'), fo = mkEl('input'), ni = mkEl('select'), mt = el('span', [e.mat, e.pod ? 'podszewka ' + e.pod + '×' : '', e.odbij ? 'odbij połowę' : '', e.para ? 'para' : ''].concat(e.znaki).filter(Boolean).join(', '), 'anM');
      nm.value = e.pl; nm.maxLength = 40; nm.setAttribute('aria-label', 'Nazwa elementu'); nm.addEventListener('input', () => { e.pl = nm.value.trim() || e.pl; });
      il.type = 'number'; il.min = 1; il.max = 40; il.value = e.ile; il.setAttribute('aria-label', 'Ile wyciąć'); il.addEventListener('input', () => { e.ile = Math.max(1, Math.min(40, Math.round(+il.value) || 1)); });
      fo.type = 'checkbox'; fo.checked = e.fold; fo.setAttribute('aria-label', 'Ze złożenia'); fo.addEventListener('change', () => { e.fold = fo.checked; });
      for (const [v, t] of [['', 'nie podano'], ['prosta', 'prosta'], ['skos', 'ze skosu'], ['poprzeczna', 'w poprzek']]) { const o = mkEl('option'); o.value = v; o.textContent = t; ni.appendChild(o); } ni.value = e.nitka; ni.setAttribute('aria-label', 'Nitka'); ni.addEventListener('change', () => { e.nitka = ni.value; });
      row.append(k, nm, il, fo, ni, mt); tb.appendChild(row);
    });
    const left = st.pieces.length - r.skip.length - r.elementy.reduce((s, e) => s + e.k.length, 0);
    $('anElN').textContent = r.elementy.length ? (left > 0 ? (left === 1 ? 'Jeden kontur został bez opisu.' : 'Bez opisu zostało konturów: ' + left + '.') + ' Wczytam je jako elementy bez nazwy.' : '') : 'Analizator nie rozpoznał żadnego elementu. Wczytam same kontury.';
    const un = $('anUn'); un.textContent = ''; r.niepewne.concat(r.pasmanteria.map((x) => 'Pasmanteria: ' + x)).forEach((t) => un.appendChild(el('li', t))); $('anUnH').hidden = !un.childElementCount; $('anUnH').textContent = r.niepewne.length ? 'Do sprawdzenia' : 'Dodatki';
  }
  function anSave() {
    const st = anSt; if (!st || !st.res) return; const r = st.res, d = st.data, size = $('anSize').value || st.size;
    const cmv = parseFloat(String($('anSa').value).replace(',', '.')), at = (k) => { const pc = st.pieces[k - 1]; return [[(pc.box.x0 + pc.box.x1) / 2, (pc.box.y0 + pc.box.y1) / 2]]; };
    const rs = r.rozmiary.find((x) => anLayer(x, d.sizes) === size) || (d.sizes.length ? null : anSize(r.rozmiary, cur()));
    const an = {
      el: r.elementy.map((e) => ({ pl: e.pl, cut: anCut(e), at: e.k.reduce((a, k) => a.concat(at(k)), []) })),
      skip: r.skip.map((k) => at(k)[0]),
      sa: { inc: $('anSaIn').checked, cm: isFinite(cmv) && cmv >= 0 && cmv < 10 ? cmv : null, ex: r.zapas.wyjatki }, skos: r.ze_skosu, pasm: r.pasmanteria, marka: r.marka,
      rozm: r.rozmiary.map((x) => ({ w: anLayer(x, d.sizes), n: x.nazwa, b: x.biust, t: x.talia, h: x.biodra })).filter((x) => x.w), body: rs ? { n: rs.nazwa, b: rs.biust, t: rs.talia, h: rs.biodra } : null,
    };
    const name = ($('anName').value.trim() || d.name).slice(0, 60), pieces = anApply(window.PatImport.pick(d, size), an);
    const sn = snap(); sn.style = 'import'; sn.imp = { name, sizes: d.sizes, size, pieces, an }; sn.sel = {}; sn.layers = [{ role: 'wierzch' }];
    addProj(name, sn); impCache[state.proj] = d; impFill(); $('anBox').hidden = true; anSt = null; homeShow(false); if (state.view !== '2d') setView('2d'); goPanel('fason');
    say('Zapisałam wykrój jako projekt: ' + pieces.length + ' elementów' + (size ? ', rozmiar ' + size : '') + '.');
  }
  function anRaw() { const f = anSt && anSt.sheet; if (!f) return; $('anBox').hidden = true; anSt = null; homeShow(false); impLoad(f); }
  const anPick = (inp, lab, key) => inp.addEventListener('change', () => { const f = inp.files[0] || null; if (!anSt) return; anSt[key] = f; lab.textContent = f ? f.name : ''; if (key === 'sheet') { anSt.data = null; anSt.res = null; $('anRes').hidden = true; $('anGo').disabled = !f; $('anRaw').disabled = !f; $('anKeyBox').hidden = !!sampleFn; $('anStat').textContent = f && !sampleFn && !anKey() && !window.__anFake ? AN_ERR.no_channel : ''; } else if (anSt.res) $('anStat').textContent = f ? 'Instrukcja dołączona. Przeanalizuj wykrój jeszcze raz, żeby ją uwzględnić.' : ''; });
  anPick($('anSheet'), $('anSheetN'), 'sheet'); anPick($('anInstr'), $('anInstrN'), 'instr');
  $('anGo').addEventListener('click', anRun); $('anRaw').addEventListener('click', anRaw); $('anStop').addEventListener('click', () => { if (anCtl) anCtl.abort(); });
  $('anSaveB').addEventListener('click', anSave); $('anX').addEventListener('click', anClose); $('anPrz').addEventListener('click', () => { anClose(); przOpen(); });
  $('anKeyIn').addEventListener('input', () => { const v = $('anKeyIn').value.trim(); try { if (v) localStorage.setItem(AN_KEY, v); else localStorage.removeItem(AN_KEY); } catch (e) {} if (v && $('anStat').textContent === AN_ERR.no_channel) $('anStat').textContent = ''; });
  $('hPdf').addEventListener('click', anOpen);
  // ---------- paleta poleceń (⌘K) ----------
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  let cmdSel = 0, cmdItems = [];
  function cmdAll() {
    const L = [], add = (t, g, run) => L.push({ t, g, run });
    for (const k of ['proj', 'modelka', 'fason', 'wymiary', 'tkanina', 'warstwy', 'szwy', 'druk', 'insp']) add(PT[k], 'Panel', () => goPanel(k));
    add('Pulpit', 'Widok', () => homeShow(true)); add('Nowy projekt z inspiracji', 'Akcja', () => newFromInsp(null));
    add('Zapisz PDF', 'Akcja', () => $('pdf').click()); add('Cofnij', 'Akcja', () => histGo(-1)); add('Ponów', 'Akcja', () => histGo(1));
    add('Nowy projekt', 'Akcja', () => { goPanel('proj'); $('prNew').click(); }); add('Duplikuj projekt', 'Akcja', () => { goPanel('proj'); $('prDup').click(); });
    add('Pokaż wykrój', 'Widok', () => setView('2d')); add('Pokaż podgląd 3D', 'Widok', () => setView('3d'));
    add(state.theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw', 'Widok', () => $('theme').click());
    add(state.figure ? 'Schowaj sylwetkę' : 'Pokaż sylwetkę', 'Widok', () => { if (state.view !== '3d') setView('3d'); $('tFig').click(); });
    add(state.card ? 'Schowaj kontrolę wymiarów' : 'Pokaż kontrolę wymiarów', 'Widok', () => (state.card ? $('cardX') : $('cardBtn')).click());
    if (flags().dress) add(state.p.gora === 'bez' ? 'Góra z ramionami' : 'Góra bez ramiączek', 'Fason', () => $('gora').querySelector(state.p.gora === 'bez' ? '[data-g=ramiona]' : '[data-g=bez]').click());
    if (flags().straps) for (const [k, t] of [['stojka', 'Kołnierz: stójka'], ['bebe', 'Kołnierz: bebe'], ['brak', 'Bez kołnierza']]) if ((state.p.kol || 'brak') !== k) add(t, 'Fason', () => { goPanel('wymiary'); $('kol').querySelector('[data-k=' + k + ']').click(); $('kol').scrollIntoView({ block: 'center' }); });
    for (const st of W.STYLES) add(GRP[st.group] + st.name.toLowerCase(), 'Fason', () => pickStyle(st));
    for (const pr of state.projects) if (pr.id !== state.proj) add(pr.name || 'Bez nazwy', 'Projekt', () => openProj(pr.id));
    for (const mo of state.profiles) if (mo.id !== state.active) add(mo.name || 'Bez imienia', 'Modelka', () => { state.active = mo.id; fillForm(); persist(); draw(true); });
    return L;
  }
  function cmdFill() {
    const q = norm($('cmdIn').value.trim()), box = $('cmdList'); box.textContent = '';
    cmdItems = cmdAll().filter((c) => !q || q.split(/\s+/).every((w) => norm(c.t + ' ' + c.g).includes(w))).slice(0, 40); cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
    if (!cmdItems.length) { const p0 = document.createElement('p'); p0.textContent = 'Nie mam takiego polecenia.'; box.append(p0); return; }
    cmdItems.forEach((c, i) => { const b = document.createElement('button'), s2 = document.createElement('small'); b.textContent = c.t; s2.textContent = c.g; b.append(s2); b.setAttribute('role', 'option'); b.setAttribute('aria-selected', i === cmdSel); b.addEventListener('click', () => cmdRun(i)); box.append(b); });
    const cur2 = box.children[cmdSel]; if (cur2 && cur2.scrollIntoView) cur2.scrollIntoView({ block: 'nearest' });
  }
  function cmdOpen() { $('cmd').hidden = false; $('cmdIn').value = ''; cmdSel = 0; cmdFill(); $('cmdIn').focus(); }
  function cmdClose() { $('cmd').hidden = true; }
  function cmdRun(i) { const c = cmdItems[i]; cmdClose(); if (c) c.run(); }
  $('cmdBtn').addEventListener('click', cmdOpen);
  $('cmd').addEventListener('pointerdown', (e) => { if (e.target === $('cmd')) cmdClose(); });
  $('cmdIn').addEventListener('input', () => { cmdSel = 0; cmdFill(); });
  $('cmdIn').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); cmdFill(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); cmdFill(); }
    else if (e.key === 'Enter') { e.preventDefault(); cmdRun(cmdSel); }
    else if (e.key === 'Escape') { e.preventDefault(); cmdClose(); }
  });
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('cmd').hidden) cmdOpen(); else cmdClose(); } });

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
    $('hInstNote').hidden = ok || instState === 'installed' || !instState; $('hInstNote').textContent = 'Żeby zainstalować Wykrojnik jako aplikację, otwórz go w aplikacji Claude na komputerze.';
  }
  function homeFill() {
    instFill();
    $('hFoot').textContent = 'Wykrojnik ' + BUILD.v + ' (build ' + BUILD.n + '), ' + BUILD.date;
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    const list = state.projects.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)), done = list.filter(projDone), open = list.filter((x) => !projDone(x));
    const card = (pr) => {
      const w = el('div', null, 'hcard'), b = el('button', null, 'hgo'), th = el('div', null, 'hth'), body = el('div', null, 'hb'), t = projThumb(pr.snap);
      if (t && pr.thumb && pr.thumbKey === pr.key && String(pr.thumb).indexOf('data:image/') === 0) { const im = document.createElement('img'); im.src = pr.thumb; im.alt = ''; th.append(im); }
      if (t) th.append(t.svg);
      body.append(el('b', pr.name || 'Bez nazwy'), el('small', t ? t.title + ' · ' + t.model : ''), el('small', projDone(pr) ? 'PDF zapisany ' + ago(pr.exported) : 'Zmieniany ' + ago(pr.updated)));
      body.append(projDone(pr) ? el('span', 'Gotowy do szycia', 'hchip ok') : pr.exported ? el('span', 'Zmieniony po zapisie PDF', 'hchip ch') : el('span', 'W toku', 'hchip'));
      b.append(th, body); b.addEventListener('click', () => { if (pr.id !== state.proj) openProj(pr.id); homeShow(false); }); w.append(b);
      if (state.projects.length > 1) {
        const x = el('button', 'Usuń', 'hdel');
        x.addEventListener('click', () => { if (!x.classList.contains('sure')) { x.classList.add('sure'); x.textContent = 'Na pewno usunąć?'; setTimeout(() => { x.classList.remove('sure'); x.textContent = 'Usuń'; }, 3000); return; } delProj(pr.id); });
        w.append(x);
      }
      return w;
    };
    $('hOpen').textContent = ''; open.forEach((pr) => $('hOpen').append(card(pr))); $('hOpenS').hidden = !open.length;
    $('hDone').textContent = ''; done.forEach((pr) => $('hDone').append(card(pr))); $('hDoneS').hidden = !done.length;
    $('hMod').textContent = ''; for (const mo of state.profiles) { const b = el('button'); b.append(el('b', mo.name || 'Bez imienia'), el('small', [mo.og, mo.ot, mo.ob].map((v) => f1(v)).join(' / ') + (mo.wzrost ? ' · ' + Math.round(mo.wzrost) + ' cm' : ''))); b.addEventListener('click', () => { state.active = mo.id; fillForm(); persist(); homeShow(false); goPanel('modelka'); }); $('hMod').append(b); }
    $('hIn').textContent = ''; const hi = (state.inspH || []).filter(inspOk).slice(0, 5);
    if (!hi.length) $('hIn').append(el('p', 'Tu pojawią się zdjęcia, z których dobierałaś wykrój.', 'hempty'));
    for (const e of hi) { const b = el('button'), im = document.createElement('img'); im.src = e.img; im.alt = ''; b.setAttribute('aria-label', 'Nowy projekt z tej inspiracji'); b.title = 'Nowy projekt z tej inspiracji'; b.append(im); b.addEventListener('click', () => newFromInsp(e)); $('hIn').append(b); }
  }
  function delProj(id) {
    if (state.projects.length < 2) return;
    const wasCur = id === state.proj; state.projects = state.projects.filter((x) => x.id !== id);
    if (wasCur) { state.proj = state.projects[state.projects.length - 1].id; loadSnap(projCur().snap); histReset(); fillForm(); persist(true); draw(true); } else { persist(true); fillProj(); }
    homeFill();
  }
  // miniatura projektu: zdjęcie podglądu 3D z ustalonego kąta, robione chwilę po ostatniej zmianie i przy wyjściu na pulpit
  let shotT = 0, shotN = 0;
  function shotPlan() { clearTimeout(shotT); shotN = 0; shotT = setTimeout(() => projShot(false), 2500); }
  function projShot(now) {
    const pr = projCur(); if (!pr || !g3 || state.view !== '3d' || state.style === 'pusty' || state.style === 'import' || !$('home').hidden) return;
    if (pr.thumb && pr.thumbKey === pr.key) return;
    if (!now && g3.top && !g3.top.ready && !g3.top.fail && shotN++ < 8) { shotT = setTimeout(() => projShot(false), 1500); return; } // tkanina jeszcze się układa
    try {
      const keep = Object.assign({}, cam); Object.assign(cam, { yaw: 0.45, pitch: 0.1 }); paint3d();
      const src = g3.canvas, c = document.createElement('canvas'); c.width = 200; c.height = 264;
      const sw = Math.min(src.width, (src.height * c.width) / c.height), sx = (src.width - sw) / 2;
      c.getContext('2d').drawImage(src, sx, 0, sw, src.height, 0, 0, c.width, c.height);
      Object.assign(cam, keep); paint3d();
      pr.thumb = c.toDataURL('image/webp', 0.82); pr.thumbKey = pr.key; persist(true);
    } catch (e) {}
  }
  function homeShow(on) { if (on && $('home').hidden) projShot(true); $('home').hidden = !on; if (on) { homeFill(); $('home').scrollTop = 0; } uiMark(); }
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

  // ---------- aplikacja desktopowa ----------
  function drawIcon() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.scale(8, 8);
    const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#ffa48c'); gr.addColorStop(0.55, '#ffa48c'); gr.addColorStop(1, '#ffa48c');
    g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, 64, 64, 15); g.fill();
    g.strokeStyle = '#12302a'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(14, 22); g.lineTo(22.5, 44); g.lineTo(32, 26); g.lineTo(41.5, 44); g.lineTo(50, 22); g.stroke();
    g.globalAlpha = 0.85; g.lineWidth = 2.6; g.setLineDash([4.5, 5]); g.beginPath(); g.moveTo(14, 52); g.lineTo(50, 52); g.stroke();
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(50, 14, 3.2, 0, 7); g.fill();
    return c.toDataURL('image/png');
  }
  function showStore() { $('store').textContent = fileOk ? 'Projekty i modelki zapisują się same w Dokumenty/Wykrojnik.' : 'Projekty i modelki zapisują się same w tej przeglądarce. Po zainstalowaniu aplikacji trafią do Dokumenty/Wykrojnik.'; }
  async function boot() {
    const back = uiResume(); loadPrintImg(); histReset();
    fillForm(); layoutUi(); setView(state.view === '3d' ? '3d' : '2d'); showStore(); uiReady = true; homeShow(!back);
    if (!window.claude || !window.claude.use) return;
    claude.use('downloads').then((d) => (downloads = d)).catch(() => {});
    claude.use('db').then((d) => { if (d) { dbRef = d; wishPull(); } }).catch(() => {});
    claude.use('sample').then((s) => { sampleFn = s; if (s && inBlob) { $('inGo').disabled = false; $('inStat').textContent = ''; } }).catch(() => {});
    try { desktop = await claude.use('desktop'); } catch (e) { desktop = null; }
    if (!desktop) { instState = 'none'; instFill(); return; }
    if (desktop.fs) {
      instState = 'installed'; instFill();
      desktop.app.dock.setIcon(drawIcon()).catch(() => {});
      try {
        if ((await desktop.permissions.state('full-access')) === 'granted') {
          fileOk = true;
          const raw = await desktop.fs.readFile(FILE, 'utf8').catch(() => null);
          if (raw && adopt(raw)) { ensureProjects(); loadPrintImg(); histReset(); fillForm(); layoutUi(); setView(state.view); if (!$('home').hidden) homeFill(); }
          showStore();
        }
      } catch (e) {}
    } else if (desktop.install) {
      try {
        const stI = await desktop.install.state(); instState = stI;
        if (stI === 'available') { const go = () => desktop.install.request().catch(() => say('Instalacja się nie rozpoczęła. Spróbuj jeszcze raz z aplikacji Claude na komputerze.')); $('install').hidden = false; $('install').addEventListener('click', go); $('hInst').addEventListener('click', go); }
        instFill();
      } catch (e) {}
    }
  }
  boot();
})();
