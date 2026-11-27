/* Import wykrojów z plików PDF (własne, kupione wykroje do użytku własnego).
   Czyta rysunek wektorowy i warstwy: każda warstwa z rozmiarem daje osobny zestaw linii, warstwy wspólne (opisy, nitka prosta) idą do każdego rozmiaru.
   Biblioteka pdf.js jest doczytywana dopiero przy pierwszym imporcie. */
(function (root) {
  'use strict';
  let libP = null;
  const addScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Nie udało się wczytać ' + src)); document.head.appendChild(s); });
  function lib() {
    if (!libP) libP = addScript('vendor/pdf.worker.min.js').then(() => addScript('vendor/pdf.min.js')).then(() => { const L = root.pdfjsLib; L.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; return L; });
    return libP;
  }
  const COMMON = /all\s*sizes|info|label|registr|mark|text|grid|common|legend|wsp[oó]ln|opis/i;
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  function simplify(pts, tol) { // Douglas-Peucker
    if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; let st = [[0, pts.length - 1]];
    if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) { // zamknięty obrys: dzielony w punkcie najdalszym od początku
      let mi = 0, md = 0; for (let i = 1; i < pts.length - 1; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > md) { md = d; mi = i; } }
      if (mi) { keep[mi] = 1; st = [[0, mi], [mi, pts.length - 1]]; }
    }
    while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / l; if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return pts.filter((_, i) => keep[i]);
  }
  // opts.pages: tylko te strony; opts.soft: bez odmowy przy długim pliku i bez rysunku wektorowego (dokumenty dodatkowe)
  async function load(file, onStep, opts) {
    opts = opts || {};
    const L = await lib(), buf = new Uint8Array(await file.arrayBuffer()), doc = await L.getDocument({ data: buf, disableFontFace: true, isEvalSupported: false }).promise;
    const occ = await doc.getOptionalContentConfig(), groups = (occ && occ.getGroups && occ.getGroups()) || {}, OPS = L.OPS, K = 2.54 / 72;
    const paths = [], texts = [], all = [], pages = []; let offX = 0; const counts = {};
    if (doc.numPages > 12 && !opts.soft) throw new Error('Ten plik ma ' + doc.numPages + ' stron. Wczytaj wersję na duży arkusz (A0), nie pociętą na A4.');
    for (let pn = 1; pn <= doc.numPages; pn++) {
      if (opts.pages && !opts.pages.includes(pn)) continue;
      if (onStep) onStep(pn, doc.numPages);
      const page = await doc.getPage(pn), vp = page.getViewport({ scale: 1 }), H = vp.height, Kp = K * (page.userUnit || 1), ops = await page.getOperatorList(); // UserUnit: arkusze zapisane w skali 1:10 (duży obszar roboczy Illustratora) mają punkt dziesięć razy większy
      let ctm = [1, 0, 0, 1, 0, 0], dash = false, pend = []; const stack = [], mc = [];
      const layer = () => { for (let i = mc.length - 1; i >= 0; i--) if (mc[i]) return mc[i]; return null; };
      const P = (x, y) => [offX + (ctm[0] * x + ctm[2] * y + ctm[4]) * Kp, (H - (ctm[1] * x + ctm[3] * y + ctm[5])) * Kp];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i], a = ops.argsArray[i];
        if (fn === OPS.save) stack.push([ctm, dash]); else if (fn === OPS.restore) { const s = stack.pop(); if (s) { ctm = s[0]; dash = s[1]; } }
        else if (fn === OPS.transform) ctm = mul(ctm, a);
        else if (fn === OPS.setDash) dash = !!(a && a[0] && a[0].length);
        else if (fn === OPS.beginMarkedContentProps) { let nm = null; if (a && a[0] === 'OC' && a[1]) { const g = groups[a[1].id] || (a[1].ids && groups[a[1].ids[0]]); nm = g ? String(g.name || '').trim() : null; } mc.push(nm); }
        else if (fn === OPS.beginMarkedContent) mc.push(null); else if (fn === OPS.endMarkedContent) mc.pop();
        else if (fn === OPS.constructPath) {
          const sub = a[0], c = a[1]; let j = 0, cur = null, last = [0, 0];
          const flush = () => { if (cur && cur.length > 1) pend.push(cur); cur = null; };
          for (const op of sub) {
            if (op === OPS.moveTo) { flush(); last = [c[j], c[j + 1]]; j += 2; cur = [P(last[0], last[1])]; }
            else if (op === OPS.lineTo) { last = [c[j], c[j + 1]]; j += 2; if (cur) cur.push(P(last[0], last[1])); }
            else if (op === OPS.curveTo || op === OPS.curveTo2 || op === OPS.curveTo3) {
              let x1, y1, x2, y2, x3, y3;
              if (op === OPS.curveTo) { x1 = c[j]; y1 = c[j + 1]; x2 = c[j + 2]; y2 = c[j + 3]; x3 = c[j + 4]; y3 = c[j + 5]; j += 6; }
              else if (op === OPS.curveTo2) { x1 = last[0]; y1 = last[1]; x2 = c[j]; y2 = c[j + 1]; x3 = c[j + 2]; y3 = c[j + 3]; j += 4; }
              else { x1 = c[j]; y1 = c[j + 1]; x2 = c[j + 2]; y2 = c[j + 3]; x3 = x2; y3 = y2; j += 4; }
              if (cur) for (let t = 1; t <= 14; t++) { const u = t / 14, v = 1 - u; cur.push(P(v * v * v * last[0] + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3, v * v * v * last[1] + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3)); }
              last = [x3, y3];
            }
            else if (op === OPS.rectangle) { flush(); const x = c[j], y = c[j + 1], w = c[j + 2], h = c[j + 3]; j += 4; pend.push([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h), P(x, y)]); }
            else if (op === OPS.closePath) { if (cur && cur.length > 1) cur.push(cur[0].slice()); flush(); }
          }
          flush();
        }
        else if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
          const l = layer(); for (const p of pend) { const s = simplify(p, 0.02).map((q) => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]); if (s.length > 1) { paths.push({ l, d: dash ? 1 : 0, pn, pts: s }); counts[l || ''] = (counts[l || ''] || 0) + 1; } } pend = [];
        }
        else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.endPath || fn === OPS.clip || fn === OPS.eoClip) { if (fn !== OPS.clip && fn !== OPS.eoClip) pend = []; }
      }
      try { const tc = await page.getTextContent(); for (const it of tc.items) { const s = String(it.str || '').replace(/\s+/g, ' ').trim(); if (!s) continue; const t = it.transform, o = { s, x: offX + t[4] * Kp, y: (H - t[5]) * Kp, h: Math.hypot(t[2], t[3]) * Kp }; if (s.length <= 160) all.push(Object.assign({ pn }, o)); if (s.length < 3 || s.length > 40) continue; texts.push(o); } } catch (e) { /* bez tekstu też się da */ }
      pages.push({ pn, x0: offX, w: vp.width * Kp, h: H * Kp });
      offX += vp.width * Kp + 3;
    }
    const names = Object.keys(counts).filter((n) => n), sizes = names.filter((n) => !COMMON.test(n));
    if (!paths.length && !opts.soft) throw new Error('W tym pliku nie ma rysunku wektorowego. To pewnie skan, a takiego wykroju nie umiem wczytać.');
    const nm = String(file.name || 'Wykrój').replace(/\.pdf$/i, '').replace(/^[0-9a-f]{8}-/, '').replace(/[_-]+/g, ' ').replace(/print|din\s*a\d|\bA[0-4]\b|us\s*letter|letter|[\d.]+\s*x\s*[\d.]+\s*inch|size\s*\w+\s*\w*/gi, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    return { name: (nm || 'Wykrój z pliku').slice(0, 60), sizes, paths, texts, all, pages, layers: names };
  }
  const bb = (pts, b) => { b = b || [1e9, 1e9, -1e9, -1e9]; for (const p of pts) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; } return b; };
  // linie jednego rozmiaru razem z warstwami wspólnymi, pogrupowane w elementy wykroju
  function pick(data, size) {
    const mine = [], common = [];
    for (const p of data.paths) { if (p.l && data.sizes.includes(p.l)) { if (p.l === size || !data.sizes.length) mine.push(p); } else common.push(p); }
    const src = data.sizes.length ? mine : common.splice(0), B = src.map((p) => bb(p.pts)), diag = (b) => Math.hypot(b[2] - b[0], b[3] - b[1]);
    // ramka arkusza (linia obejmująca prawie całą stronę) nie jest elementem i nie może wciągnąć do siebie wszystkiego, co leży w środku
    // ramką jest tylko to, co mieści się na stronie: element większy od strony (spódnica rozrysowana na kilka arkuszy) ramką nie jest
    const pgOf = (pn) => (data.pages || []).find((q) => q.pn === pn), frame = (p, b) => { const pg = pgOf(p.pn); if (!pg) return false; const w = b[2] - b[0], h = b[3] - b[1]; return (w > pg.w * 0.8 && h > pg.h * 0.8 && w < pg.w * 1.03 && h < pg.h * 1.03 && (p.pts.length <= 8 || (w > pg.w * 0.93 && h > pg.h * 0.93))) || (p.pts.length === 2 && ((w < 0.3 && h > pg.h * 0.9) || (h < 0.3 && w > pg.w * 0.9))); }; // także pojedyncze proste linie przez cały arkusz: krawędzie stron i siatka sklejania
    const seeds = []; src.forEach((p, i) => { if (diag(B[i]) > 12 && !frame(p, B[i])) seeds.push(i); });
    const par = seeds.map((_, i) => i), find = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, ov = (a, b) => a[0] <= b[2] + 0.4 && b[0] <= a[2] + 0.4 && a[1] <= b[3] + 0.4 && b[1] <= a[3] + 0.4;
    // elementy leżą na arkuszu ciasno, więc same prostokąty otaczające nie wystarczą: linie należą do jednego elementu, gdy stykają się końcami albo jedna leży w całości w drugiej
    const ends = (p) => [p.pts[0], p.pts[p.pts.length - 1]], near = (p, q) => ends(p).some((a) => q.pts.some((b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.35)), within = (a, b) => a[0] >= b[0] - 0.3 && a[1] >= b[1] - 0.3 && a[2] <= b[2] + 0.3 && a[3] <= b[3] + 0.3;
    // linia w środku zamkniętego obrysu należy do niego, gdy jest prawie tej samej wielkości (linia szycia wewnątrz linii cięcia) albo mała (znak, zaszewka); w pozostałych przypadkach to osobny element
    const area = (b) => (b[2] - b[0]) * (b[3] - b[1]), nest = (inn, out) => area(inn) > 0.6 * area(out) || diag(inn) < 0.45 * diag(out);
    // sama ramka otaczająca nie wystarcza: mankiet może leżeć w pustym rogu ramki rękawa; liczy się, czy linia jest naprawdę wewnątrz obrysu
    const pip = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const inPoly = (inn, out) => { const k = Math.max(1, Math.floor(inn.pts.length / 5)); let n = 0, m = 0; for (let i = 0; i < inn.pts.length; i += k) { m++; if (pip(inn.pts[i][0], inn.pts[i][1], out.pts)) n++; } return n >= m * 0.6; };
    const closed = (p) => Math.hypot(p.pts[0][0] - p.pts[p.pts.length - 1][0], p.pts[0][1] - p.pts[p.pts.length - 1][1]) < 0.3;
    for (let i = 0; i < seeds.length; i++) for (let j = i + 1; j < seeds.length; j++) { const p = src[seeds[i]], q = src[seeds[j]], bi = B[seeds[i]], bj = B[seeds[j]]; if (p.pn !== q.pn || !ov(bi, bj)) continue; if ((!closed(p) && !closed(q) && (near(p, q) || near(q, p))) || (within(bi, bj) && closed(q) && nest(bi, bj) && inPoly(p, q)) || (within(bj, bi) && closed(p) && nest(bj, bi) && inPoly(q, p))) par[find(i)] = find(j); }
    const cl = new Map(); seeds.forEach((s, i) => { const r = find(i); if (!cl.has(r)) cl.set(r, { box: [1e9, 1e9, -1e9, -1e9], cut: [], aux: [], pn: src[s].pn }); const c = cl.get(r); c.cut.push(src[s]); bb(src[s].pts, c.box); });
    let list = Array.from(cl.values()); const inside0 = (b, c) => { const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return cx >= c.box[0] - 1 && cx <= c.box[2] + 1 && cy >= c.box[1] - 1 && cy <= c.box[3] + 1; };
    { const thin = list.filter((c) => Math.min(c.box[2] - c.box[0], c.box[3] - c.box[1]) < 1.5), fat = list.filter((c) => !thin.includes(c)); for (const t of thin) { const host = fat.filter((c) => c.pn === t.pn && inside0(t.box, c)).sort((x, y) => diag(x.box) - diag(y.box))[0]; if (host) host.cut = host.cut.concat(t.cut); } list = fat; } // pojedyncze proste linie (zakładki, linie pomocnicze) dołączają do elementu, w którym leżą
    const inside = (b, c) => { const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return cx >= c.box[0] - 1 && cx <= c.box[2] + 1 && cy >= c.box[1] - 1 && cy <= c.box[3] + 1; };
    src.forEach((p, i) => { if (seeds.includes(i) || frame(p, B[i])) return; const c = list.filter((q) => q.pn === p.pn && inside(B[i], q)).sort((x, y) => diag(x.box) - diag(y.box))[0]; if (c) c.cut.push(p); });
    for (const p of common) { const b = bb(p.pts), c = list.filter((q) => q.pn === p.pn && inside(b, q) && diag(b) < diag(q.box) * 0.9).sort((x, y) => diag(x.box) - diag(y.box))[0]; if (c) c.aux.push(p); }
    list.sort((a, b) => a.box[0] - b.box[0] || a.box[1] - b.box[1]);
    // punkt na etykietę: najwyższy wierzchołek konturu, który leży na jego stronie (rysunek bywa większy niż strona i jest przez nią przycięty)
    const plen = (c) => c.cut.reduce((s, p) => { for (let i = 1; i < p.pts.length; i++) s += Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]); return s; }, 0);
    for (const c of list) {
      const pg = (data.pages || []).find((q) => q.pn === c.pn); let m = null, all = 0, on = 0;
      if (pg) for (const p of c.cut) for (const v of p.pts) { all++; if (v[0] > pg.x0 + 2 && v[0] < pg.x0 + pg.w - 2 && v[1] > 1 && v[1] < pg.h - 4) { on++; if (!m || v[1] < m[1]) m = v; } }
      if (pg) { const ox = Math.max(0, Math.min(c.box[2], pg.x0 + pg.w) - Math.max(c.box[0], pg.x0)), oy = Math.max(0, Math.min(c.box[3], pg.h) - Math.max(c.box[1], 0)); const big = ox * oy >= 0.25 * (c.box[2] - c.box[0]) * (c.box[3] - c.box[1]); if (on < all * 0.3 && !big) m = null; else if (!m && big) m = [(Math.max(c.box[0], pg.x0) + Math.min(c.box[2], pg.x0 + pg.w)) / 2, Math.max(c.box[1], 0) + 3]; } // na tej stronie widać najwyżej skrawek elementu, etykieta tylko by myliła
      c.len = plen(c); c.main = c.cut.reduce((a, p) => (p.pts.length > a.length ? p.pts : a), []); c.marks = [{ pn: c.pn, x: m ? m[0] : (c.box[0] + c.box[2]) / 2, y: m ? m[1] : (c.box[1] + c.box[3]) / 2, seen: !!m, box: c.box.slice() }];
    }
    // ten sam element narysowany w całości na dwóch stronach (duże arkusze z jednego rysunku): zostaje jeden, z etykietami na obu stronach
    { const keep = []; for (const c of list) { const w = c.box[2] - c.box[0], h = c.box[3] - c.box[1], same = (k) => k.main.length === c.main.length && k.main.every((v, i) => Math.abs(v[0] - k.box[0] - (c.main[i][0] - c.box[0])) < 0.2 && Math.abs(v[1] - k.box[1] - (c.main[i][1] - c.box[1])) < 0.2), o = keep.find((k) => k.pn !== c.pn && Math.abs(k.box[2] - k.box[0] - w) < 1 && Math.abs(k.box[3] - k.box[1] - h) < 1 && same(k)); if (o) { o.marks = o.marks.concat(c.marks); o.copies.push({ box: c.box }); } else { c.copies = [{ box: c.box }]; keep.push(c); } } for (const c of keep) if (c.marks.some((m) => m.seen)) c.marks = c.marks.filter((m) => m.seen); list = keep; }
    // nazwa elementu: napis leżący w jego obrysie, na dowolnej stronie, na której element jest narysowany.
    // Elementy bywają rysowane jeden na drugim (duże spódnice), więc napis należący tylko do jednego obrysu ma pierwszeństwo.
    const PART = /front|back|sleeve|skirt|bodice|strap|godet|train|wing|panel|collar|cuff|facing|pocket|lining|yoke|band|binding|prz[oó]d|ty[lł]|r[eę]kaw/i;
    const cands = list.map((c) => { const out = []; for (const cp of c.copies || [{ box: c.box }]) { const dx = cp.box[0] - c.box[0], dy = cp.box[1] - c.box[1];
      for (const t of data.texts || []) { if (!(t.x > cp.box[0] && t.x < cp.box[2] && t.y > cp.box[1] && t.y < cp.box[3]) || !/[A-Za-z]{3}/.test(t.s) || !PART.test(t.s) || /cut|seam|line|allowance|place|fabric|measure|dart|size/i.test(t.s)) continue;
        if (c.main.length > 3 && closed({ pts: c.main }) && !pip(t.x - dx, t.y - dy, c.main)) continue; out.push(t); } } return out; });
    const owners = new Map(); cands.forEach((l) => { for (const k of new Set(l.map((t) => t.s.toUpperCase()))) owners.set(k, (owners.get(k) || 0) + 1); });
    return list.map((c, i) => {
      const prims = c.cut.map((p) => ({ t: 'poly', s: 'cut', pts: p.pts })).concat(c.aux.map((p) => ({ t: 'poly', s: p.d ? 'fold' : 'aux', pts: p.pts })));
      const tx = cands[i].slice().sort((a, b) => (owners.get(a.s.toUpperCase()) === 1 ? 0 : 1) - (owners.get(b.s.toUpperCase()) === 1 ? 0 : 1) || b.h - a.h)[0];
      const name = tx ? tx.s.toUpperCase() : 'ELEMENT ' + (i + 1);
      prims.push({ t: 'text', x: (c.box[0] + c.box[2]) / 2, y: (c.box[1] + c.box[3]) / 2, text: name, size: 'M', anchor: 'middle' });
      return { id: 'imp-' + (i + 1), name, cut: '', hemIn: [], prims, box: { x0: c.box[0], y0: c.box[1], x1: c.box[2], y1: c.box[3] }, noteAt: null, w: c.box[2] - c.box[0], h: c.box[3] - c.box[1], marks: c.marks };
    });
  }
  // obrazy stron dla analizatora: każda strona w całości albo w dwóch połówkach (tiles = 2), z czerwonymi etykietami konturów
  // marks: [{ id, x, y }] w centymetrach, w tym samym układzie co kontury z load()
  async function shots(file, marks, tiles) {
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise, K = 2.54 / 72, out = []; let offX = 0;
    for (let pn = 1; pn <= doc.numPages; pn++) {
      const page = await doc.getPage(pn), v1 = page.getViewport({ scale: 1 }), Kp = K * (page.userUnit || 1), nt = typeof tiles === 'function' ? tiles(pn) : tiles; // tiles: liczba albo funkcja strona -> 0 (pomiń), 1 (cała), 2 (dwie połówki)
      if (!nt) { offX += v1.width * Kp + 3; continue; }
      const sc = Math.sqrt((1.1e6 * (nt === 2 ? 1.85 : 1)) / (v1.width * v1.height)), vp = page.getViewport({ scale: sc });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const px = sc / Kp, fs = Math.max(15, Math.round(c.width / 80)); g.font = '700 ' + fs + 'px Arial, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
      for (const m of marks || []) { if (m.pn && m.pn !== pn) continue; const x = (m.x - offX) * px, y = m.y * px; if (x < 0 || x > c.width || y < 0 || y > c.height) continue;
        // etykieta krawędzi: mniejsza, niebieska, dokładnie na środku krawędzi
        if (m.e) { const fe = Math.round(fs * 0.8), we = g.measureText(m.id).width * 0.8 + fe * 0.6; g.font = '700 ' + fe + 'px Arial, sans-serif'; g.fillStyle = '#0b5fd8'; g.fillRect(x - we / 2, y - fe * 0.65, we, fe * 1.3); g.fillStyle = '#fff'; g.fillText(m.id, x, y + 1); g.font = '700 ' + fs + 'px Arial, sans-serif'; continue; }
        const w = g.measureText(m.id).width + fs * 0.7, yy = Math.min(c.height - fs, y + fs * 1.1), xx = Math.max(w / 2 + 2, Math.min(c.width - w / 2 - 2, x)); g.fillStyle = '#d0021b'; g.fillRect(xx - w / 2, yy - fs * 0.7, w, fs * 1.4); g.fillStyle = '#fff'; g.fillText(m.id, xx, yy + 1); }
      const land = c.width >= c.height, long = land ? c.width : c.height, n = nt === 2 ? 2 : 1, len = n === 1 ? long : Math.round(long * 0.54);
      for (let t = 0; t < n; t++) {
        const st = t === 0 ? 0 : long - len, q = document.createElement('canvas'); q.width = land ? len : c.width; q.height = land ? c.height : len;
        q.getContext('2d').drawImage(c, land ? st : 0, land ? 0 : st, q.width, q.height, 0, 0, q.width, q.height);
        const blob = await new Promise((ok) => q.toBlob(ok, 'image/jpeg', 0.9));
        out.push({ blob, pn, part: n === 1 ? '' : land ? (t ? 'prawa połowa' : 'lewa połowa') : (t ? 'dolna połowa' : 'górna połowa') });
      }
      offX += v1.width * Kp + 3;
    }
    return out;
  }
  // sam tekst pliku (instrukcja szycia), strona po stronie, przycięty do limitu znaków
  async function text(file, max) {
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, isEvalSupported: false }).promise; let out = '';
    for (let pn = 1; pn <= doc.numPages && out.length < max; pn++) { const tc = await (await doc.getPage(pn)).getTextContent(); let line = '', ly = null; for (const it of tc.items) { const y = Math.round(it.transform[5]); if (ly !== null && Math.abs(y - ly) > 3) { out += line.trim() + '\n'; line = ''; } ly = y; line += it.str + ' '; } out += line.trim() + '\n'; }
    return out.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').slice(0, max);
  }
  // podstawowe dane pliku: liczba stron i największy bok strony w centymetrach (do rozpoznania, czy to arkusz, czy instrukcja)
  async function info(file) {
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, isEvalSupported: false }).promise, K = 2.54 / 72; let mx = 0;
    for (let pn = 1; pn <= Math.min(doc.numPages, 40); pn++) { const pg = await doc.getPage(pn), v = pg.getViewport({ scale: 1 }), Kp = K * (pg.userUnit || 1); mx = Math.max(mx, v.width * Kp, v.height * Kp); }
    return { n: doc.numPages, maxCm: mx };
  }
  // tekst każdej strony osobno, żeby analizator mógł wskazać, z której strony pochodzi informacja
  async function pagesText(file, perPage, maxPages) {
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, isEvalSupported: false }).promise, out = [];
    for (let pn = 1; pn <= Math.min(doc.numPages, maxPages || 60); pn++) { const tc = await (await doc.getPage(pn)).getTextContent(); let t = '', line = '', ly = null; for (const it of tc.items) { const y = Math.round(it.transform[5]); if (ly !== null && Math.abs(y - ly) > 3) { t += line.trim() + '\n'; line = ''; } ly = y; line += it.str + ' '; } t += line.trim(); out.push({ pn, text: t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').slice(0, perPage) }); }
    return { n: doc.numPages, pages: out };
  }
  // kwadraty kontrolne wydruku: pary współśrodkowych kwadratów w rysunku wektorowym; zwraca boki w milimetrach dla każdej strony
  function squares(paths) {
    const by = {};
    for (const p of paths) { const q = p.pts; if (q.length < 5 || q.length > 8 || Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) > 0.05) continue; const b = bb(q), w = b[2] - b[0], h = b[3] - b[1]; if (w < 1 || w > 15 || Math.abs(w - h) > 0.03) continue; if (q.some((v) => Math.min(Math.abs(v[0] - b[0]), Math.abs(v[0] - b[2])) > 0.03 || Math.min(Math.abs(v[1] - b[1]), Math.abs(v[1] - b[3])) > 0.03)) continue; (by[p.pn] = by[p.pn] || []).push(b); }
    const out = {};
    for (const pn in by) { const B = by[pn].slice(0, 100), pr = []; for (const a of B) for (const b of B) { const wa = a[2] - a[0], wb = b[2] - b[0]; if (wa < wb + 0.2 || Math.abs(a[0] + a[2] - b[0] - b[2]) > 0.06 || Math.abs(a[1] + a[3] - b[1] - b[3]) > 0.06) continue; const pair = [Math.round(wa * 100) / 10, Math.round(wb * 100) / 10]; if (!pr.some((x) => x[0] === pair[0] && x[1] === pair[1])) pr.push(pair); } if (pr.length) out[pn] = pr.slice(0, 4); }
    return out;
  }
  root.PatImport = { load, pick, shots, text, info, pagesText, squares };
})(typeof globalThis !== 'undefined' ? globalThis : this);
