  // ---------- wykroje z bazy ----------
  // Wykrój z bazy to prywatny plik użytkowniczki: gotowe elementy w kilku rozmiarach z opisem krawędzi, nacinków i fałd.
  // Geometria nie jest częścią aplikacji. Plik zostaje w przeglądarce (IndexedDB) na tym komputerze.
  const WZ = { list: /** @type {any[]} */ ([]) };
  const wzOn = () => WZ_ON || (TEST && !!window['__wzOn']);
  const wzGet = (id) => WZ.list.find((k) => k.id === id) || null;
  const wzDb = () => new Promise((res, rej) => { const q = indexedDB.open('wykrojnik-wzory', 1); q.onupgradeneeded = () => q.result.createObjectStore('wzory', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  function wzValid(o) { return !!o && o.format === 'wykrojnik-wzor' && typeof o.id === 'string' && typeof o.nazwa === 'string' && Array.isArray(o.el) && o.el.length > 0 && o.tabela && Array.isArray(o.tabela[o.klucz]) && o.el.every((e) => Array.isArray(e.pkt) && e.pkt.length === o.rozmiary.length && Array.isArray(e.kraw)); }
  function wzAdopt(o) { const i = WZ.list.findIndex((k) => k.id === o.id); if (i >= 0) WZ.list[i] = o; else WZ.list.push(o); }
  function wzBoot() { if (!wzOn()) return; wzDb().then((db) => { const q = db.transaction('wzory').objectStore('wzory').getAll(); q.onsuccess = () => { for (const o of q.result || []) if (wzValid(o)) wzAdopt(o); wzFill(); if (state.style === 'import' && state.imp && state.imp.wz) draw(true); }; }).catch(() => {}); }
  function wzAdd(text) {
    let o = null; try { o = JSON.parse(text); } catch (e) { o = null; }
    if (!wzValid(o)) { say('To nie jest plik wykroju z bazy Wykrojnika.', true); return; }
    wzAdopt(o); wzDb().then((db) => { db.transaction('wzory', 'readwrite').objectStore('wzory').put(o); }).catch(() => say('Wykrój działa, ale nie udało się go zapamiętać na tym komputerze.', true));
    wzFill(); say('Dodałam wykrój „' + o.nazwa + '” do Twojej bazy.');
  }
  // ułamkowy numer rozmiaru dla wymiaru, który steruje wykrojem; najwyżej pół rozmiaru poza tabelą
  function wzT(k, m) { const tab = k.tabela[k.klucz], v = k.klucz === 'talia' ? m.ot : k.klucz === 'biodra' ? m.ob : m.og, n = tab.length; if (n < 2) return 0; if (v <= tab[0]) return Math.max(-0.5, (v - tab[0]) / (tab[1] - tab[0])); for (let i = 1; i < n; i++) if (v <= tab[i]) return i - 1 + (v - tab[i - 1]) / (tab[i] - tab[i - 1]); return Math.min(n - 0.5, n - 1 + (v - tab[n - 1]) / (tab[n - 1] - tab[n - 2])); }
  const wzL = (arr, t) => { const n = arr.length, i = Math.max(0, Math.min(n - 2, Math.floor(t))), f = t - i; return arr[i] + (arr[i + 1] - arr[i]) * f; };
  const wzPts = (el, t) => { const n = el.pkt.length, i = Math.max(0, Math.min(n - 2, Math.floor(t))), f = t - i, A = el.pkt[i], B = el.pkt[i + 1]; return A.map((p, j) => [p[0] + (B[j][0] - p[0]) * f, p[1] + (B[j][1] - p[1]) * f]); };
  function wzSizeName(k, t) { const n = k.rozmiary.length, i = Math.max(0, Math.min(n - 1, Math.round(t))), d = t - i; return Math.abs(d) < 0.06 ? 'rozmiar ' + k.rozmiary[i] : t < 0 ? 'mniejszy niż ' + k.rozmiary[0] : t > n - 1 ? 'większy niż ' + k.rozmiary[n - 1] : 'między ' + k.rozmiary[Math.floor(t)] + ' a ' + k.rozmiary[Math.floor(t) + 1]; }
  // punkt na krawędzi w odległości d od początku (ujemne d: od końca) i kierunek krawędzi w tym miejscu
  function wzAt(pts, d) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); let s = d < 0 ? L + d : d; s = Math.max(0, Math.min(L, s)); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= l || i === pts.length - 1) { const f = l ? s / l : 0; return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], u: l ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0] }; } s -= l; } return { p: pts[0], u: [1, 0] }; }
  function wzPiece(k, el, t) {
    const P = wzPts(el, t), sa = k.zapas || { szew: 1, dol: 2 }, edges = []; let o = 0, A2 = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; A2 += a[0] * b[1] - b[0] * a[1]; } const sg = A2 > 0 ? 1 : -1; // znak obiegu: z niego wynika, która strona krawędzi jest wnętrzem
    el.kraw.forEach((kr, ei) => { const pts = []; for (let j = 0; j <= kr.n; j++) pts.push(P[(o + j) % P.length]); o += kr.n; const fold = kr.typ === 'zlozenie' || el.zloz === ei; edges.push({ pts, sa: fold ? 0 : kr.typ === 'dol' ? sa.dol : sa.szew, fold, lab: kr.lab || '', typ: kr.typ }); });
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), extra = [];
    const inn = (u) => [-sg * u[1], sg * u[0]], line = (pts, s) => ({ t: 'poly', s: s || 'aux', pts }), txt = (x, y, text, anchor) => ({ t: 'text', x, y, text, size: 'S', anchor: anchor || 'middle' });
    const notch = (e, d) => { const q = wzAt(e.pts, d), n = inn(q.u), len = Math.min(0.7, e.sa || 0.7); return { t: 'poly', s: 'notch', pts: [q.p, [q.p[0] - n[0] * len, q.p[1] - n[1] * len]] }; };
    for (const nc of el.nac || []) { const e = edges[nc.k], d = wzL(nc.t, t); extra.push(notch(e, d)); if (nc.opis && d !== 0) { const q = wzAt(e.pts, d), n = inn(q.u); extra.push(txt(q.p[0] + n[0] * 1.2, q.p[1] + n[1] * 1.2 + 0.3, nc.opis, n[0] > 0.5 ? 'start' : n[0] < -0.5 ? 'end' : 'middle')); } }
    for (const fd of el.faldy || []) { // kontrafałda: nacinki brzegów schodzą się na nacinku środkowym
      const e = edges[fd.k], a = wzL(fd.a, t), mm = wzL(fd.m, t), b = wzL(fd.b, t), qm = wzAt(e.pts, mm), n = inn(qm.u), apex = [qm.p[0] + n[0] * 4, qm.p[1] + n[1] * 4];
      if (!fd.pol) { extra.push(notch(e, a), notch(e, mm), notch(e, b), line([wzAt(e.pts, a).p, apex, wzAt(e.pts, b).p]), txt(apex[0], apex[1] + 1.1, 'kontrafałda: złóż brzegi do środka')); }
      else { const qb = wzAt(e.pts, b); extra.push(notch(e, b), line([qb.p, apex]), txt(apex[0] + qb.u[0] * 0.6, apex[1] + 1.1, 'pół kontrafałdy: złóż do środka', 'start')); }
    }
    const fe = edges.find((e) => e.fold), cut = 'wytnij ' + el.ile + '×' + (el.tryb === 'zlozenie' ? ' ze złożenia' : ''), name = String(el.nazwa).toUpperCase();
    const vert = fe && Math.abs(fe.pts[0][0] - fe.pts[fe.pts.length - 1][0]) < 0.01, gx = fe && vert ? fe.pts[0][0] + (x1 - x0) * 0.22 : x0 + (x1 - x0) * 0.22;
    if (fe && !vert) extra.push(txt((fe.pts[0][0] + fe.pts[fe.pts.length - 1][0]) / 2, fe.pts[0][1] + sg * 0 + 1.1, 'złożenie tkaniny'));
    const pc = W.mkPiece({ id: 'wz-' + el.id, name, lines: [cut], edges, extra, small: !!el.waski, labelRot: el.waski ? -90 : 0, label: el.waski ? [(x0 + x1) / 2 - 0.5, (y0 + y1) / 2] : [(x0 + x1) / 2 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.5],
      grain: y1 - y0 > 12 ? { x: el.waski ? x0 + (x1 - x0) * 0.8 : gx, y0: y0 + (y1 - y0) * 0.2, y1: y1 - (y1 - y0) * 0.2 } : null, foldText: fe && vert ? [fe.pts[0][0] + 1.1, (y0 + y1) / 2] : null });
    pc.wz = el.id; return pc;
  }
  function wzDraft(imp, m) {
    const k = wzGet(imp.wz);
    if (!k) { const d = emptyDraft(m); d.info.warn = 'Ten projekt korzysta z wykroju z Twojej bazy, a nie ma go na tym komputerze. Dodaj plik wykroju w panelu Fason.'; d.title = imp.name || 'wykrój z bazy'; d.empty = false; d.wz = true; return d; }
    const t = wzT(k, m), pieces = k.el.map((el) => wzPiece(k, el, t)), F = k.el.find((e) => e.rola === 'F'), B = k.el.find((e) => e.rola === 'B'), rows = [], waist = wzL(k.talia, t), a = W.full(m);
    const edge = (el, typ) => { const P = wzPts(el, t); let o = 0; for (const kr of el.kraw) { if (kr.typ === typ) { let L = 0; for (let j = 0; j < kr.n; j++) { const p = P[(o + j) % P.length], q = P[(o + j + 1) % P.length]; L += Math.hypot(q[0] - p[0], q[1] - p[1]); } return L; } o += kr.n; } return 0; };
    const fold = (el) => (el.faldy || []).reduce((s, fd) => s + (wzL(fd.b, t) - wzL(fd.a, t)), 0), mul = (el) => (el.tryb === 'zlozenie' ? 2 : el.ile);
    const top = mul(F) * (edge(F, 'gora') - fold(F)) + mul(B) * (edge(B, 'gora') - fold(B)), hemC = mul(F) * edge(F, 'dol') + mul(B) * edge(B, 'dol'), Pf = wzPts(F, t), H = Math.max(...Pf.map((p) => p[1])) - Math.min(...Pf.map((p) => p[1])), dl = H + (k.pasekH || 0);
    rows.push(['Pasek w talii', waist, m.ot], ['Talia po złożeniu fałd', top, null], ['Obwód dołu', hemC, null], ['Długość z paskiem', dl, null], ['Szew boczny: przód i tył', edge(F, 'bok'), edge(B, 'bok')]);
    const sa = k.zapas || { szew: 1, dol: 2 }, sz = wzSizeName(k, t), tab = k.tabela[k.klucz], out = m.ot < tab[0] - 0.5 * (tab[1] - tab[0]) || m.ot > tab[tab.length - 1] + 0.5 * (tab[1] - tab[0]);
    const warn = 'Wykrój z Twojej bazy, ' + sz + ' według obwodu talii. ' + (out ? 'Talia modelki wypada poza zakres tego wykroju, więc pasek nie będzie pasował. ' : '') + 'Dodałam zapasy: ' + f1(sa.szew) + ' cm na szwy i ' + f1(sa.dol) + ' cm na dole, na złożeniu bez zapasu. ' + (k.cechy || '') + (F.faldy.some((fd) => fd.wyliczona) ? ' Środkową kontrafałdę przodu wyliczyłam z długości paska, na arkuszu ma tylko nacinek środka.' : '');
    const intake = mul(F) * fold(F) + mul(B) * fold(B), p3 = Object.assign({}, DEF_P, { dl: H, kn: 0, gf: 0, ff: 1, flare: 0, tren: 0, rozp: 0, pasek: k.pasekH || 0, pasT: 0, zakK: 0, luzT: waist - m.ot, luzB: 4, fac: 'brak', extras: [], kol: 'brak' });
    return { pieces, info: { rows, darts: [], cut: pieces.map((q) => [q.name, q.cut.replace(/^wytnij /, '')]), warn }, wz: true, cover: [['Wykrój', k.nazwa + ', ' + sz], ['Zapasy na szwy', 'szwy ' + f1(sa.szew) + ' cm, dół ' + f1(sa.dol) + ' cm, na złożeniu bez zapasu']],
      sil: { top: 'waist', lower: 'circle', pleat: true, pleatOpen: hemC - 0.6 * intake, frac: Math.max(0.08, (hemC - 0.6 * intake - waist) / (2 * Math.PI * H)), hemC, seams: { side: true, cb: true }, approxP: p3, a, neckGap: 99, lowerArm: 0 }, title: (imp.name || k.nazwa) + ' · ' + sz, notions: (k.dodatki || []).map((x) => [x[0], x[1]]), bases: {} };
  }
  function wzOpen(id) {
    const k = wzGet(id); if (!k) return; const name = k.nazwa.slice(0, 60), sn = snap(); sn.style = 'import'; sn.imp = { name, sizes: [], size: '', pieces: [], an: null, lib: true, wz: id }; sn.sel = {}; sn.layers = [{ role: 'wierzch' }];
    addProj(name, sn); state.fTab = k.typ === 'spodnica' ? 'doly' : 'gory'; fillForm(); homeShow(false); goPanel('fason'); say('Otworzyłam wykrój „' + k.nazwa + '” dla modelki „' + (cur().name || 'bez imienia') + '”.');
  }
  function wzFill() {
    const box = $('wzBox'); if (!box) return; box.hidden = !wzOn(); if (!wzOn()) return; const gal = $('wzGal'); gal.textContent = '';
    for (const k of WZ.list) { const b = document.createElement('button'); b.setAttribute('aria-pressed', state.style === 'import' && !!state.imp && state.imp.wz === k.id ? 'true' : 'false'); let svg = '';
      try { const lay = W.layout(k.el.map((el) => wzPiece(k, el, wzT(k, cur()))), 3); svg = `<svg viewBox="0 0 ${lay.w} ${lay.h}" aria-hidden="true">` + lay.prims.filter((q) => q.t === 'poly' && q.s === 'cut').map((q) => `<path d="M${q.pts.map((a) => a[0].toFixed(1) + ' ' + a[1].toFixed(1)).join('L')}Z"/>`).join('') + '</svg>'; } catch (e) {}
      const th = document.createElement('span'); th.className = 'th'; th.style.setProperty('--tint', TINTS[WZ.list.indexOf(k) % TINTS.length]); th.innerHTML = svg; const s = document.createElement('span'); s.className = 'nm'; s.textContent = k.nazwa; b.append(th, s); b.addEventListener('click', () => { if (state.style === 'import' && state.imp && state.imp.wz === k.id) return; wzOpen(k.id); }); gal.appendChild(b); }
    $('wzNone').hidden = WZ.list.length > 0;
  }
  if ($('wzFile')) $('wzFile').addEventListener('change', () => { const f = $('wzFile').files[0]; if (!f) return; f.text().then(wzAdd); $('wzFile').value = ''; });
  if (TEST) window['__wz'] = { WZ, wzAdd, wzOpen, wzBoot };
  setTimeout(wzBoot, 0);
