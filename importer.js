/* Import wykrojów z plików PDF, JPG i PNG (własne, kupione wykroje do użytku własnego).
   Czyta rysunek wektorowy i warstwy: każda warstwa z rozmiarem daje osobny zestaw linii, warstwy wspólne (opisy, nitka prosta) idą do każdego rozmiaru.
   Obraz (JPG, PNG) jest dokumentem o jednej stronie: linie arkusza powstają z obrysu elementów, a skala z podanej szerokości arkusza.
   Biblioteka pdf.js jest doczytywana dopiero przy pierwszym imporcie pliku PDF. */
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
  function nameOf(file) {
    const nm = String(file.name || 'Wykrój').replace(/\.(pdf|jpe?g|png)$/i, '').replace(/^[0-9a-f]{8}-/, '').replace(/[_-]+/g, ' ').replace(/print|din\s*a\d|\bA[0-4]\b|us\s*letter|letter|[\d.]+\s*x\s*[\d.]+\s*inch|size\s*\w+\s*\w*/gi, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    return (nm || 'Wykrój z pliku').slice(0, 60);
  }
  // opts.pages: tylko te strony; opts.soft: bez odmowy przy długim pliku i bez rysunku wektorowego (dokumenty dodatkowe)
  async function load(file, onStep, opts) {
    opts = opts || {}; if (isImg(file)) return loadImg(file, opts);
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
    // PDF bez rysunku wektorowego to skan: jego strony są obrazami, więc obrysy czytam z nich tak samo jak z pliku JPG albo PNG. Skalę daje wymiar strony.
    let raster = false;
    if (!paths.length && !opts.soft) {
      for (const pg of pages) {
        const page = await doc.getPage(pg.pn), v1 = page.getViewport({ scale: 1 }), sc = Math.min(4, 3400 / Math.max(v1.width, v1.height)), vp = page.getViewport({ scale: sc }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); await page.render({ canvasContext: g, viewport: vp }).promise;
        const Kc = (K * (page.userUnit || 1)) / sc; for (const p of traceSrc(c, c.width, c.height).polys) paths.push({ l: null, d: 0, pn: pg.pn, pts: p.map((q) => [Math.round((pg.x0 + q[0] * Kc) * 100) / 100, Math.round(q[1] * Kc * 100) / 100]) });
      }
      raster = paths.length > 0;
    }
    const names = Object.keys(counts).filter((n) => n), sizes = names.filter((n) => !COMMON.test(n));
    if (!paths.length && !opts.soft) throw new Error('W tym pliku nie ma rysunku wektorowego, a na jego stronach nie znalazłam zamkniętych obrysów elementów.');
    return Object.assign({ name: nameOf(file), sizes, paths, texts, all, pages, layers: names }, raster ? { raster: true } : {});
  }
  const bb = (pts, b) => { b = b || [1e9, 1e9, -1e9, -1e9]; for (const p of pts) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; } return b; };
  // linie jednego rozmiaru razem z warstwami wspólnymi, pogrupowane w elementy wykroju
  function pick(data, size) {
    const mine = [], common = [];
    for (const p of data.paths) { if (p.l && data.sizes.includes(p.l)) { if (p.l === size || !data.sizes.length) mine.push(p); } else common.push(p); }
    const src = data.sizes.length ? mine : common.splice(0), B = src.map((p) => bb(p.pts)), diag = (b) => Math.hypot(b[2] - b[0], b[3] - b[1]);
    // ramka arkusza (linia obejmująca prawie całą stronę) nie jest elementem i nie może wciągnąć do siebie wszystkiego, co leży w środku
    // ramką jest tylko to, co mieści się na stronie: element większy od strony (spódnica rozrysowana na kilka arkuszy) ramką nie jest
    // w arkuszu odczytanym z obrazu ramkę zdejmuje już samo czytanie, więc element przycięty na styk nie może zostać za nią wzięty
    const pgOf = (pn) => (data.pages || []).find((q) => q.pn === pn), frame = (p, b) => { const pg = pgOf(p.pn); if (!pg || data.raster) return false; const w = b[2] - b[0], h = b[3] - b[1]; return (w > pg.w * 0.8 && h > pg.h * 0.8 && w < pg.w * 1.03 && h < pg.h * 1.03 && (p.pts.length <= 8 || (w > pg.w * 0.93 && h > pg.h * 0.93))) || (p.pts.length === 2 && ((w < 0.3 && h > pg.h * 0.9) || (h < 0.3 && w > pg.w * 0.9))); }; // także pojedyncze proste linie przez cały arkusz: krawędzie stron i siatka sklejania
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
  // czerwone etykiety konturów i niebieskie etykiety krawędzi na gotowym obrazie strony; px: piksele obrazu na centymetr arkusza
  function stamp(c, g, marks, pn, offX, px) {
    const fs = Math.max(15, Math.round(c.width / 80)); g.font = '700 ' + fs + 'px Arial, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    for (const m of marks || []) { if (m.pn && m.pn !== pn) continue; const x = (m.x - offX) * px, y = m.y * px; if (x < 0 || x > c.width || y < 0 || y > c.height) continue;
      // etykieta krawędzi: mniejsza, niebieska, dokładnie na środku krawędzi
      if (m.e) { const fe = Math.round(fs * 0.8), we = g.measureText(m.id).width * 0.8 + fe * 0.6; g.font = '700 ' + fe + 'px Arial, sans-serif'; g.fillStyle = '#0b5fd8'; g.fillRect(x - we / 2, y - fe * 0.65, we, fe * 1.3); g.fillStyle = '#fff'; g.fillText(m.id, x, y + 1); g.font = '700 ' + fs + 'px Arial, sans-serif'; continue; }
      const w = g.measureText(m.id).width + fs * 0.7, yy = Math.min(c.height - fs, y + fs * 1.1), xx = Math.max(w / 2 + 2, Math.min(c.width - w / 2 - 2, x)); g.fillStyle = '#d0021b'; g.fillRect(xx - w / 2, yy - fs * 0.7, w, fs * 1.4); g.fillStyle = '#fff'; g.fillText(m.id, xx, yy + 1); }
  }
  // strona w całości albo w dwóch zachodzących na siebie połówkach
  async function cut(c, nt, pn, out) {
    const land = c.width >= c.height, long = land ? c.width : c.height, n = nt === 2 ? 2 : 1, len = n === 1 ? long : Math.round(long * 0.54);
    for (let t = 0; t < n; t++) {
      const st = t === 0 ? 0 : long - len, q = document.createElement('canvas'); q.width = land ? len : c.width; q.height = land ? c.height : len;
      q.getContext('2d').drawImage(c, land ? st : 0, land ? 0 : st, q.width, q.height, 0, 0, q.width, q.height);
      const blob = await new Promise((ok) => q.toBlob(ok, 'image/jpeg', 0.9));
      out.push({ blob, pn, part: n === 1 ? '' : land ? (t ? 'prawa połowa' : 'lewa połowa') : (t ? 'dolna połowa' : 'górna połowa') });
    }
  }
  // obrazy stron dla analizatora: każda strona w całości albo w dwóch połówkach (tiles = 2), z czerwonymi etykietami konturów
  // marks: [{ id, x, y }] w centymetrach, w tym samym układzie co kontury z load()
  async function shots(file, marks, tiles) {
    if (isImg(file)) return shotsImg(file, marks, tiles);
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise, K = 2.54 / 72, out = []; let offX = 0;
    for (let pn = 1; pn <= doc.numPages; pn++) {
      const page = await doc.getPage(pn), v1 = page.getViewport({ scale: 1 }), Kp = K * (page.userUnit || 1), nt = typeof tiles === 'function' ? tiles(pn) : tiles; // tiles: liczba albo funkcja strona -> 0 (pomiń), 1 (cała), 2 (dwie połówki)
      if (!nt) { offX += v1.width * Kp + 3; continue; }
      const sc = Math.sqrt((1.1e6 * (nt === 2 ? 1.85 : 1)) / (v1.width * v1.height)), vp = page.getViewport({ scale: sc });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      stamp(c, g, marks, pn, offX, sc / Kp); await cut(c, nt, pn, out);
      offX += v1.width * Kp + 3;
    }
    return out;
  }
  // sam tekst pliku (instrukcja szycia), strona po stronie, przycięty do limitu znaków
  async function text(file, max) {
    if (isImg(file)) return '';
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, isEvalSupported: false }).promise; let out = '';
    for (let pn = 1; pn <= doc.numPages && out.length < max; pn++) { const tc = await (await doc.getPage(pn)).getTextContent(); let line = '', ly = null; for (const it of tc.items) { const y = Math.round(it.transform[5]); if (ly !== null && Math.abs(y - ly) > 3) { out += line.trim() + '\n'; line = ''; } ly = y; line += it.str + ' '; } out += line.trim() + '\n'; }
    return out.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').slice(0, max);
  }
  // podstawowe dane pliku: liczba stron i największy bok strony w centymetrach (do rozpoznania, czy to arkusz, czy instrukcja)
  async function info(file) {
    if (isImg(file)) return infoImg(file);
    const L = await lib(), doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, isEvalSupported: false }).promise, K = 2.54 / 72; let mx = 0;
    for (let pn = 1; pn <= Math.min(doc.numPages, 40); pn++) { const pg = await doc.getPage(pn), v = pg.getViewport({ scale: 1 }), Kp = K * (pg.userUnit || 1); mx = Math.max(mx, v.width * Kp, v.height * Kp); }
    return { n: doc.numPages, maxCm: mx };
  }
  // tekst każdej strony osobno, żeby analizator mógł wskazać, z której strony pochodzi informacja
  async function pagesText(file, perPage, maxPages) {
    if (isImg(file)) return { n: 1, pages: [{ pn: 1, text: '' }] };
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
  // ---------- arkusz, strona instrukcji albo ilustracja jako obraz (JPG, PNG) ----------
  const isImg = (f) => !!f && (/^image\/(jpeg|png)$/i.test(f.type || '') || (!f.type && /\.(jpe?g|png)$/i.test(f.name || '')));
  const imgC = new WeakMap(), imgCm = new WeakMap();
  // szerokość arkusza w centymetrach: obraz sam nie mówi wiarygodnie, w jakiej jest skali
  function scale(file, cm) { if (cm > 0 && isFinite(cm)) imgCm.set(file, +cm); else imgCm.delete(file); }
  // rozdzielczość zapisana w pliku (PNG: pHYs, JPEG: JFIF albo EXIF), w punktach na cal; 0, gdy jej nie ma
  function dpiOf(b) {
    const u16 = (o, le) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]), u32 = (o, le) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
    if (b[0] === 0x89 && b[1] === 0x50) {
      for (let o = 8; o + 12 <= b.length;) { const len = u32(o), tp = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]); if (tp === 'pHYs' && o + 17 <= b.length) return b[o + 16] === 1 ? u32(o + 8) * 0.0254 : 0; if (tp === 'IDAT' || tp === 'IEND') break; o += 12 + len; }
      return 0;
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let jf = 0, ex = 0;
      for (let o = 2; o + 4 <= b.length;) {
        if (b[o] !== 0xff) break; const mk = b[o + 1], len = u16(o + 2); if (mk === 0xda || mk === 0xd9) break;
        if (mk === 0xe0 && b[o + 4] === 0x4a && b[o + 5] === 0x46) { const un = b[o + 11], xd = u16(o + 12); jf = un === 1 ? xd : un === 2 ? xd * 2.54 : 0; }
        if (mk === 0xe1 && b[o + 4] === 0x45 && b[o + 5] === 0x78) {
          const t = o + 10, le = b[t] === 0x49, ifd = t + u32(t + 4, le), n = u16(ifd, le); let xr = 0, un = 2;
          for (let i = 0; i < n && i < 64; i++) { const e = ifd + 2 + i * 12, tag = u16(e, le); if (tag === 0x011a) { const q = t + u32(e + 8, le); xr = u32(q, le) / (u32(q + 4, le) || 1); } if (tag === 0x0128) un = u16(e + 8, le); }
          ex = un === 3 ? xr * 2.54 : xr;
        }
        o += 2 + len;
      }
      return ex || jf;
    }
    return 0;
  }
  // poszerzenie plamy o r pikseli w każdą stronę (kwadrat), dwoma przejściami: wierszami i kolumnami
  function dil(src, W, H, r) {
    const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const o = y * W; let n = 0; for (let x = 0; x < r && x < W; x++) n += src[o + x]; for (let x = 0; x < W; x++) { if (x + r < W) n += src[o + x + r]; if (x - r - 1 >= 0) n -= src[o + x - r - 1]; tmp[o + x] = n > 0 ? 1 : 0; } }
    for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < r && y < H; y++) n += tmp[y * W + x]; for (let y = 0; y < H; y++) { if (y + r < H) n += tmp[(y + r) * W + x]; if (y - r - 1 >= 0) n -= tmp[(y - r - 1) * W + x]; out[y * W + x] = n > 0 ? 1 : 0; } }
    return out;
  }
  const inv = (a) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] ? 0 : 1; return o; };
  const ero = (src, W, H, r) => inv(dil(inv(src), W, H, r));
  // obrys plamy po krawędziach pikseli: wnętrze zawsze po prawej ręce, start w lewym górnym rogu pierwszego piksela
  function outline(L, W, H, id, sx, sy) {
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && L[y * W + x] === id, DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], AL = [[0, -1], [0, 0], [-1, 0], [-1, -1]], AR = [[0, 0], [-1, 0], [-1, -1], [0, -1]];
    let x = sx, y = sy, d = 0; const pts = [[x, y]], lim = 4 * (W + H) * 40;
    do { x += DX[d]; y += DY[d]; pts.push([x, y]); if (at(x + AL[d][0], y + AL[d][1])) d = (d + 3) % 4; else if (!at(x + AR[d][0], y + AR[d][1])) d = (d + 1) % 4; } while (!(x === sx && y === sy && d === 0) && pts.length < lim);
    return pts;
  }
  // elementy na masce linii: wszystko, do czego nie da się dojść od brzegu obrazu bez przecięcia linii. Przerywane linie domyka poszerzenie o r; cienkie wąsy (napisy, strzałki, linie wymiarowe) znikają przy zwężeniu o t, które rośnie z rozdzielczością obrazu.
  function blobs(M, W, H, r) {
    const D = dil(M, W, H, r), N = W * H, out = new Uint8Array(N), st = new Int32Array(N); let sp = 0;
    const seed = (i) => { if (!D[i] && !out[i]) { out[i] = 1; st[sp++] = i; } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); } for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
    while (sp) { const i = st[--sp], x = i % W; if (x > 0) seed(i - 1); if (x < W - 1) seed(i + 1); if (i >= W) seed(i - W); if (i < N - W) seed(i + W); }
    const t = Math.max(2, Math.round(Math.max(W, H) / 1200)), G = dil(ero(inv(out), W, H, r + t), W, H, t), L = new Int32Array(N), comps = [], minA = Math.max(300, 0.0008 * N), minS = 0.012 * Math.max(W, H);
    for (let i0 = 0; i0 < N; i0++) {
      if (!G[i0] || L[i0]) continue; const id = comps.length + 1; let area = 0, ink = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; sp = 0; st[sp++] = i0; L[i0] = id;
      while (sp) { const i = st[--sp], x = i % W, y = (i - x) / W; area++; ink += M[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && G[i - 1] && !L[i - 1]) { L[i - 1] = id; st[sp++] = i - 1; } if (x < W - 1 && G[i + 1] && !L[i + 1]) { L[i + 1] = id; st[sp++] = i + 1; } if (i >= W && G[i - W] && !L[i - W]) { L[i - W] = id; st[sp++] = i - W; } if (i < N - W && G[i + W] && !L[i + W]) { L[i + W] = id; st[sp++] = i + W; } }
      const ok = area >= minA && x1 - x0 >= minS && y1 - y0 >= minS, frame = ok && x1 - x0 >= 0.92 * W && y1 - y0 >= 0.92 * H;
      comps.push({ id, area, ink, x0, y0, x1, y1, sx: i0 % W, sy: (i0 - (i0 % W)) / W, ok, frame });
    }
    const good = comps.filter((c) => c.ok && !c.frame);
    return { L, comps, good, score: good.reduce((s, c) => s + c.area, 0), frame: comps.find((c) => c.frame) || null, r };
  }
  // przebieg bez domykania wystarcza liniom ciągłym; szersze domknięcie wygrywa tylko wtedy, gdy wyraźnie przybywa elementów (linie przerywane)
  function best(M, W, H, first) { let b = first || null; for (const r of first ? [3, 6] : [1, 3, 6]) { const q = blobs(M, W, H, r); if (!b || q.score > b.score * 1.15) b = q; } return b; }
  // obraz -> obrysy elementów w pikselach obrazu; wynik jest pamiętany dla pliku
  async function trace(file) {
    if (imgC.has(file)) return imgC.get(file);
    let dpi = 0; try { dpi = dpiOf(new Uint8Array(await file.slice(0, 262144).arrayBuffer())) || 0; } catch (e) { dpi = 0; } if (!isFinite(dpi) || dpi < 20 || dpi > 2400) dpi = 0;
    const bmp = await createImageBitmap(file), out = Object.assign(traceSrc(bmp, bmp.width, bmp.height), { dpi }); bmp.close();
    imgC.set(file, out); return out;
  }
  // bmp: obraz albo płótno (strona skanu wyrenderowana z PDF)
  function traceSrc(bmp, w0, h0) {
    const ps = Math.min(1, 12000 / Math.max(w0, h0)), w = Math.round(w0 * ps), h = Math.round(h0 * ps);
    const k = Math.max(1, Math.ceil(Math.max(w, h) / 3400)), W = Math.ceil(w / k), H = Math.ceil(h / k);
    // kolor tła: mediana miniatury; linią jest wszystko, co wyraźnie od niego odbiega, także kolorowe linie rozmiarów
    const th = document.createElement('canvas'); th.width = th.height = 96; const tg = th.getContext('2d', { willReadFrequently: true }); tg.fillStyle = '#fff'; tg.fillRect(0, 0, 96, 96); tg.drawImage(bmp, 0, 0, 96, 96);
    const td = tg.getImageData(0, 0, 96, 96).data, med = (c) => { const a = []; for (let i = c; i < td.length; i += 4) a.push(td[i]); a.sort((p, q) => p - q); return a[a.length >> 1]; }, b0 = med(0), b1 = med(1), b2 = med(2);
    const M = new Uint8Array(W * H), S = k * Math.max(1, Math.floor(512 / k)), sc = document.createElement('canvas'); sc.width = w; sc.height = S; const sg = sc.getContext('2d', { willReadFrequently: true }); let inkN = 0;
    for (let y0 = 0; y0 < h; y0 += S) {
      const sh = Math.min(S, h - y0); sg.fillStyle = '#fff'; sg.fillRect(0, 0, w, S); sg.drawImage(bmp, 0, y0 / ps, w0, sh / ps, 0, 0, w, sh);
      const d = sg.getImageData(0, 0, w, sh).data;
      for (let yy = 0; yy < sh; yy++) { const ro = (((y0 + yy) / k) | 0) * W; for (let xx = 0, i = yy * w * 4; xx < w; xx++, i += 4) { let v = d[i] - b0; if (v < 0) v = -v; let u = d[i + 1] - b1; if (u < 0) u = -u; if (u > v) v = u; u = d[i + 2] - b2; if (u < 0) u = -u; if (u > v) v = u; if (v > 64) M[ro + ((xx / k) | 0)] = 1; } }
    }
    for (let i = 0; i < M.length; i++) inkN += M[i];
    // ramka arkusza zamyka w sobie wszystkie elementy: zdejmuję jej linię i szukam jeszcze raz (ramki bywają podwójne)
    const strip = (m, q) => { const C = new Uint8Array(W * H); for (let i = 0; i < C.length; i++) C[i] = q.L[i] === q.frame.id ? 1 : 0; const inner = ero(C, W, H, 8), m2 = m.slice(); for (let i = 0; i < C.length; i++) if (C[i] && !inner[i]) m2[i] = 0; return m2; };
    let cur = M, q1 = blobs(cur, W, H, 1), outer = null;
    for (let t = 0; t < 3 && q1.frame; t++) { if (!outer) outer = q1; cur = strip(cur, q1); q1 = blobs(cur, W, H, 1); }
    let res = best(cur, W, H, q1);
    if (res.frame && !res.good.length) { if (!outer) outer = res; cur = strip(cur, res); res = best(cur, W, H, null); }
    // w środku „ramki” nic nie ma: to nie ramka, tylko jeden element przycięty na styk
    if (outer && res.score < 0.02 * W * H) res = { L: outer.L, good: outer.good.concat([outer.frame]), r: outer.r };
    const list = res.good, f = k / ps, polys = [], hw = res.r > 1 ? res.r + 1 : 2, tol = res.r > 1 ? 0.6 : 0.45;
    for (const c of list) {
      // schodki pikseli: środki kolejnych krawędzi, lekkie wygładzenie i dopiero potem uproszczenie; inaczej skośne linie wychodzą ząbkowane i dłuższe niż w rzeczywistości
      const o = outline(res.L, W, H, c.id, c.sx, c.sy), n = o.length - 1; if (n < 8) continue;
      const m = new Float64Array(n * 2); for (let i = 0; i < n; i++) { m[i * 2] = (o[i][0] + o[i + 1][0]) / 2; m[i * 2 + 1] = (o[i][1] + o[i + 1][1]) / 2; }
      const sm = []; for (let i = 0; i < n; i++) { let x = 0, y = 0, ws = 0; for (let d = -hw; d <= hw; d++) { const j = ((i + d + n) % n) * 2, wg = hw + 1 - (d < 0 ? -d : d); x += m[j] * wg; y += m[j + 1] * wg; ws += wg; } sm.push([x / ws, y / ws]); }
      sm.push(sm[0].slice()); const sp = simplify(sm, tol); if (sp.length > 3) polys.push(sp.map((v) => [v[0] * f, v[1] * f]));
    }
    const area = list.reduce((s, c) => s + c.area, 0), ink = list.reduce((s, c) => s + c.ink, 0);
    // rysunek kreskowy: mało farby na obrazie i puste wnętrza elementów; zdjęcie ma wnętrza pełne
    return { w: w0, h: h0, dpi: 0, polys, art: polys.length > 0 && inkN / (W * H) < 0.25 && ink / Math.max(1, area) < 0.3 };
  }
  async function art(file) { try { return (await trace(file)).art; } catch (e) { return false; } }
  async function infoImg(file) {
    let dpi = 0; try { dpi = dpiOf(new Uint8Array(await file.slice(0, 262144).arrayBuffer())) || 0; } catch (e) { dpi = 0; } if (!isFinite(dpi) || dpi < 20 || dpi > 2400) dpi = 0;
    const bmp = await createImageBitmap(file), w = bmp.width, h = bmp.height; bmp.close();
    // 72, 96 i 144 punkty na cal wpisują programy z automatu (eksport „dla WWW”, zrzut ekranu), więc nic nie mówią o prawdziwej skali
    const ok = dpi && ![72, 96, 144].includes(Math.round(dpi));
    return { n: 1, maxCm: ok ? (Math.max(w, h) / dpi) * 2.54 : 0, img: true, px: [w, h], wcm: ok ? Math.round((w / dpi) * 25.4) / 10 : 0 };
  }
  async function loadImg(file, opts) {
    const R = await trace(file), wcm = imgCm.get(file) || 0;
    if (!wcm) throw new Error('Podaj szerokość tego arkusza w centymetrach.');
    const K = wcm / R.w, paths = R.polys.map((p) => ({ l: null, d: 0, pn: 1, pts: p.map((q) => [Math.round(q[0] * K * 100) / 100, Math.round(q[1] * K * 100) / 100]) }));
    if (!paths.length && !opts.soft) throw new Error('Na tym obrazie nie znalazłam zamkniętych obrysów elementów. Arkusz musi mieć wyraźne linie na jednolitym tle, a elementy nie mogą być przycięte brzegiem obrazu.');
    return { name: nameOf(file), sizes: [], paths, texts: [], all: [], pages: [{ pn: 1, x0: 0, w: R.w * K, h: R.h * K }], layers: [], raster: true };
  }
  // obraz dla analizatora. Arkusz (ma etykiety) jest zmniejszany tak, żeby cienkie linie nie zbladły: z każdego bloku pikseli zostaje najciemniejszy.
  async function shotsImg(file, marks, tiles) {
    const nt = typeof tiles === 'function' ? tiles(1) : tiles, out = []; if (!nt) return out;
    const bmp = await createImageBitmap(file), w0 = bmp.width, h0 = bmp.height, wcm = imgCm.get(file) || 0, own = (marks || []).some((m) => !m.pn || m.pn === 1);
    const sc = Math.min(1, Math.sqrt((1.1e6 * (nt === 2 ? 1.85 : 1)) / (w0 * h0))), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * sc)); c.height = Math.max(1, Math.round(h0 * sc));
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    if (own && sc < 0.67 && Math.max(w0, h0) <= 12000) {
      const W = c.width, H = c.height, im = g.createImageData(W, H), o = im.data, lum = new Uint16Array(W * H).fill(65535), S = 512, st = document.createElement('canvas'); st.width = w0; st.height = S; const sg = st.getContext('2d', { willReadFrequently: true }); o.fill(255);
      for (let y0 = 0; y0 < h0; y0 += S) {
        const sh = Math.min(S, h0 - y0); sg.fillStyle = '#fff'; sg.fillRect(0, 0, w0, S); sg.drawImage(bmp, 0, y0, w0, sh, 0, 0, w0, sh); const d = sg.getImageData(0, 0, w0, sh).data;
        for (let yy = 0; yy < sh; yy++) { const ro = Math.min(H - 1, ((y0 + yy) * sc) | 0) * W; for (let xx = 0, i = yy * w0 * 4; xx < w0; xx++, i += 4) { const l = d[i] * 2 + d[i + 1] * 3 + d[i + 2], q = ro + Math.min(W - 1, (xx * sc) | 0); if (l < lum[q]) { lum[q] = l; const j = q * 4; o[j] = d[i]; o[j + 1] = d[i + 1]; o[j + 2] = d[i + 2]; } } }
      }
      g.putImageData(im, 0, 0);
    } else { g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height); }
    bmp.close(); if (wcm && own) stamp(c, g, marks, 1, 0, c.width / wcm);
    await cut(c, nt, 1, out); return out;
  }
  root.PatImport = { load, pick, shots, text, info, pagesText, squares, isImg, scale, art };
})(typeof globalThis !== 'undefined' ? globalThis : this);
