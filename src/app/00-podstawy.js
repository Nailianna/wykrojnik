/* Wykrojnik: interfejs */
(function () {
  'use strict';
  const BUILD = { v: '0.73.0', n: 75, date: '2026-11-27' }; // wersja: główna.funkcje.poprawki; build rośnie przy każdej publikacji
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
    p: /** @type {WParams} */ ({ dl: 58, kn: 55, gf: 9, fac: 'laczone', facW: 5, flare: 0, gora: 'ramiona', bk: 'prosta', bh: 6, gr: 5, gh: 9, gd: 11, gg: 5, gp: 6, ram: 'brak', ramW: 1, rekL: 0, fit: 'regular', baza: 'wlasna', extras: [], falN: false, falR: false, marsz: false, sciag: false, tren: 0, kop: false, pasT: 0, zakK: 2.5, rek: 'brak', mank: false, bok: 0, ff: 1, zp: 'bok', kol: 'brak', kolW: 3, rozp: 0, nk: 'okragly', nkb: 'okragly', nd: 0, nw: 0, nb: 0, luzG: 4, luzB: 2, luzT: 1, saSzew: 1.5, saTalia: 1, saDol: 4, pasek: 3 }),
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
    const kliny = s === 'su_rybka_kliny', bez = dress && state.p.gora === 'bez'; return { rekOn: dress && !bez && !!state.p.rek && state.p.rek !== 'brak' && !(state.p.bok > 0), tren: ['su_dopasowana', 'su_trapez', 'su_zakl'].includes(s), odcTop: dress && !bez && (ODC.includes(s) || s === 'to_stanik'), odc: ODC.includes(s), zakl: s === 'su_zakl', rek34: dress && !bez && state.p.rek === '34', dolsel: ODC.includes(s) || s === 'su_rybka', kol: dress && !bez && (state.p.kol === 'stojka' || state.p.kol === 'bebe'), zpok: dress && !bez && !/princeska|kliny|tshirt/.test(s), corsetU: s === 'go_pod', bez, tee: s.indexOf('to_tshirt') === 0 && s !== 'to_tshirt_s', rozp: ['sk_prosta', 'sk_olowkowa', 'sk_trapez', 'su_dopasowana', 'su_trapez'].includes(s), ram: bez && (state.p.ram === 'cienkie' || state.p.ram === 'szyja'), rekLen: dress && !bez && !!state.p.rek && state.p.rek !== 'brak' && state.p.rek !== 'bufka' && !(state.p.bok > 0), corset, len: !corset && !top, waist: !corset && !(s.indexOf('to_tshirt') === 0 && state.p.fit !== 'slim'), facw: dress && !bez && state.p.fac === 'osobne', straps: dress && !bez, nostraps: bez || s === 'go_nad', dress, circ, flare: !circ && !kliny && !corset && !top, hip: !circ && !corset && !top, pasek: !dress && !corset, rybka: s === 'su_rybka' || kliny, kliny };
  };

