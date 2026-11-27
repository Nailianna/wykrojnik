  // ---------- wczytany wykrój w 3D: z obrysów na arkuszu do zszytych elementów ----------
  // Na razie układ przód + tył (+ rękaw), każdy narysowany jako połowa od linii środka. Krawędzie rozpoznaje geometria:
  // narożniki obrysu wyznaczają ramię, pachę, bok i dół. Role elementów (przód, tył, rękaw) pochodzą z analizy arkusza albo z nazwy.
  const swLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  const swArea = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  // linia szycia elementu: zamknięty obrys; gdy są dwa prawie jednakowe (cięcie i szycie), bierze wewnętrzny
  function swRing(pc) {
    const cl = pc.prims.filter((q) => q.t === 'poly' && q.s === 'cut' && q.pts.length > 3 && Math.hypot(q.pts[0][0] - q.pts[q.pts.length - 1][0], q.pts[0][1] - q.pts[q.pts.length - 1][1]) < 0.3).map((q) => ({ pts: q.pts.slice(0, -1), ar: Math.abs(swArea(q.pts)) })).sort((a, b) => b.ar - a.ar);
    if (!cl.length) { // obrys z kilku otwartych linii: łączę je końcami w łańcuch; brakujący bok (element „ze złożenia”) domyka prosta, która jest wtedy linią środka
      const op = pc.prims.filter((q) => q.t === 'poly' && q.s === 'cut' && q.pts.length > 1).map((q) => ({ pts: q.pts, len: swLen(q.pts), used: false })).sort((a, b) => b.len - a.len);
      if (!op.length) return null;
      const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;
      // ta sama linia narysowana w pliku dwa razy (dwie warstwy jednego rozmiaru) liczy się raz, inaczej łańcuch wraca po własnym śladzie
      op.forEach((o, k) => { const a0 = o.pts[0], a1 = o.pts[o.pts.length - 1]; for (let q = 0; q < k; q++) { const e = op[q]; if (e.used || Math.abs(e.len - o.len) > 0.01 * o.len + 0.05) continue; const b0 = e.pts[0], b1 = e.pts[e.pts.length - 1]; if ((near(a0, b0) && near(a1, b1)) || (near(a0, b1) && near(a1, b0))) { o.used = true; break; } } });
      const first = op.find((o) => !o.used); if (!first) return null;
      let chain = first.pts.slice(); first.used = true;
      for (let guard = 0; guard < 40; guard++) {
        const end = chain[chain.length - 1], start = chain[0]; let done = true;
        for (const o of op) { if (o.used || o.len < 3) continue; const a = o.pts[0], b = o.pts[o.pts.length - 1];
          if (near(end, a)) chain = chain.concat(o.pts.slice(1)); else if (near(end, b)) chain = chain.concat(o.pts.slice(0, -1).reverse()); else if (near(start, b)) chain = o.pts.slice(0, -1).concat(chain); else if (near(start, a)) chain = o.pts.slice(1).reverse().concat(chain); else continue;
          o.used = true; done = false; break; }
        if (done) break;
      }
      const b = pc.box, per = 2 * (b.x1 - b.x0 + b.y1 - b.y0); if (swLen(chain) < per * 0.45 || chain.length < 6) return null;
      if (near(chain[0], chain[chain.length - 1])) chain.pop();
      return { pts: chain, sa: false };
    }
    const out = cl[0], inn = cl.find((c) => c !== out && c.ar > out.ar * 0.6 && c.ar < out.ar * 0.995);
    return { pts: (inn || out).pts, sa: !!inn };
  }
  // narożniki: wierzchołki, w których kierunek linii zmienia się skokowo (łuk pachy czy główki zmienia go stopniowo)
  function swCorners(pts) {
    const n = pts.length, cum = [0]; for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i % n][0] - pts[i - 1][0], pts[i % n][1] - pts[i - 1][1]));
    const L = cum[n], at = (s) => { s = ((s % L) + L) % L; let i = 0; while (i < n - 1 && cum[i + 1] < s) i++; const a = pts[i], b = pts[(i + 1) % n], t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    const turn = (i, w) => { const p = pts[i], a = at(cum[i] - w), b = at(cum[i] + w), ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1]; return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)); };
    const w = Math.max(0.8, Math.min(1.5, L / 120)), sc = pts.map((_, i) => Math.min(turn(i, w), turn(i, w * 2.2))), out = [];
    for (let i = 0; i < n; i++) { if (sc[i] < 0.6) continue; let top = true; for (let j = 0; j < n; j++) { if (j === i) continue; let d = Math.abs(cum[j] - cum[i]); d = Math.min(d, L - d); if (d < 2.5 && (sc[j] > sc[i] || (sc[j] === sc[i] && j < i))) { top = false; break; } } if (top) out.push(i); }
    return { idx: out, cum, L };
  }
  const swSub = (pts, i, j) => { const n = pts.length, out = [pts[i]]; let k = i; while (k !== j) { k = (k + 1) % n; out.push(pts[k]); } return out; };
  // przód albo tył: połowa elementu od linii środka. Zwraca krawędzie w układzie silnika tkaniny (x od środka w bok, y w dół, punkt szyjny na wysokości -top)
  function swBodice(pc, top, pit, want) {
    const R = swRing(pc); if (!R) return { err: 'nie ma zamkniętego obrysu' };
    const pts = R.pts, C = swCorners(pts); if (C.idx.length < 4) return { err: 'obrys ma za mało narożników' };
    // linia środka: najdłuższy prosty odcinek obrysu, po którego jednej stronie leży cały element (dekolt może do niej dochodzić łagodnie, bez narożnika)
    const n = pts.length; let iA = -1, iB = -1, bl = 0;
    for (let i = 0; i < n; i++) {
      for (let s = 1; s < n; s++) {
        const j = (i + s) % n, a = pts[i], b = pts[j], ch = Math.hypot(b[0] - a[0], b[1] - a[1]); if (ch < 1e-6) break;
        let ok = true; for (let q = 1; q < s && ok; q++) { const p = pts[(i + q) % n]; if (Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / ch > 0.12) ok = false; }
        if (!ok) break;
        if (ch > bl) { let sg = 0, one = true; for (const p of pts) { const d = ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / ch; if (Math.abs(d) < 0.3) continue; if (!sg) sg = Math.sign(d); else if (Math.sign(d) !== sg) { one = false; break; } } if (one) { bl = ch; iA = i; iB = j; } }
      }
    }
    if (iA < 0 || bl < 8) return { err: 'nie znalazłam prostej linii środka' };
    const inRun = (q) => (iA <= iB ? q > iA && q < iB : q > iA || q < iB), cset = C.idx.filter((q) => !inRun(q) && q !== iA && q !== iB);
    // obrót: linia środka pionowo na x = 0
    const A = pts[iA], B = pts[iB], ang = Math.atan2(B[0] - A[0], B[1] - A[1]), ca = Math.cos(ang), sa = Math.sin(ang), rot = (p) => [(p[0] - A[0]) * ca - (p[1] - A[1]) * sa, (p[0] - A[0]) * sa + (p[1] - A[1]) * ca];
    let Q = pts.map(rot); const cx = Q.reduce((s, p) => s + p[0], 0) / n; if (cx < 0) Q = Q.map((p) => [-p[0], p[1]]);
    // pierwszy narożnik za każdym końcem linii środka (idąc od niej): przy dole leży daleko w bok, przy dekolcie blisko
    const nextC = (from, step) => { let c = from; for (let s = 0; s < n; s++) { c = (c + step) % n; if (cset.includes(c)) return c; } return from; }, nxt = nextC(iB, 1), prv = nextC(iA, n - 1);
    // który koniec linii środka jest przy dekolcie: przy dole sąsiednia krawędź jest szeroka i biegnie w poprzek
    const wB = Math.abs(Q[nxt][0] - Q[iB][0]), wA = Math.abs(Q[prv][0] - Q[iA][0]);
    let iTop = wA < wB ? iA : iB, iBot = wA < wB ? iB : iA, ys = 1; if (Q[iTop][1] > Q[iBot][1]) { Q = Q.map((p) => [p[0], -p[1]]); ys = -1; }
    const ax0 = { o: A, dir: [ys * sa, ys * ca] }; // oś długości w układzie arkusza: od dekoltu w stronę dołu
    // obejście od dekoltu do dołu z pominięciem linii środka (ta leży między narożnikami iA i iB w kierunku rosnących numerów)
    const order = []; { const step = iTop === iB ? 1 : n - 1; let c = iTop; for (let s = 0; s <= n; s++) { order.push(c); if (c === iBot) break; c = (c + step) % n; } }
    const W = order.map((i) => Q[i]), isC = new Set(cset), cor = []; order.forEach((i, t) => { if (isC.has(i) && t > 0 && t < order.length - 1) cor.push(t); });
    { const K = swKimono(W, cor, top, ax0, R.sa); if (K) return K; }
    if (cor.length < 4) { const St = pit != null ? swStrap(W, cor, pit, ax0, R.sa, want) : null; return St || { err: 'nie umiem wskazać ramienia i pachy', ax0, top: W[0][1], bot: W[W.length - 1][1] }; }
    // narożnik dołu przy boku: najdalej od środka wśród narożników na wysokości dołu
    const yB = W[W.length - 1][1], hgt = yB - Math.min(...W.map((p) => p[1])); let hc = -1;
    for (const t of cor) if (W[t][1] > yB - 0.15 * hgt && (hc < 0 || W[t][0] > W[hc][0])) hc = t;
    const ci = cor.indexOf(hc); if (hc < 0 || ci < 3) { const St = pit != null ? swStrap(W, cor, pit, ax0, R.sa, want) : null; return St || { err: 'nie umiem wskazać ramienia i pachy', ax0, top: W[0][1], bot: W[W.length - 1][1] }; }
    const ua = cor[ci - 1], sp = cor[ci - 2], np = cor[ci - 3], sh = W.slice(np, sp + 1), shL = swLen(sh);
    const nkL = swLen(W.slice(0, np + 1)), arL = swLen(W.slice(sp, ua + 1));
    if (shL < 3 || shL > 30 || W[ua][1] < W[sp][1] || arL < 12 || nkL > 48 || W[np][0] < 3 || W[np][0] > 16) { const St = pit != null ? swStrap(W, cor, pit, ax0, R.sa, want) : null; return St || { err: 'kształt nie przypomina przodu ani tyłu z ramieniem i pachą', ax0, top: W[0][1], bot: W[W.length - 1][1] }; }
    const dy = -top - W[np][1], T = (a) => a.map((p) => [Math.max(0, p[0]), p[1] + dy]);
    const ed = [{ pts: T(W.slice(0, np + 1)), tag: 'neck' }, { pts: T(sh), tag: 'shoulder' }, { pts: T(W.slice(sp, ua + 1)), tag: 'arm' }, { pts: T(W.slice(ua, hc + 1)), tag: 'side' }, { pts: T(W.slice(hc)), tag: 'bottom' }];
    ed.push({ pts: [[0, ed[4].pts[ed[4].pts.length - 1][1]], [0, ed[0].pts[0][1]]], tag: 'center' }); ed[4].pts[ed[4].pts.length - 1][0] = 0; ed[0].pts[0][0] = 0;
    return { ax: { o: ax0.o, dir: ax0.dir, ua: W[ua][1], hem: Math.min(...W.slice(hc).map((p) => p[1])) }, cb: W[W.length - 1][1] - W[0][1], ed, sh: shL, arm: swLen(ed[2].pts), side: swLen(ed[3].pts), hem: W[hc][0], bot: Math.max(...ed.map((e) => Math.max(...e.pts.map((p) => p[1])))), sa: R.sa };
  }
  // przód albo tył bez ramienia: góra na ramiączkach albo bez ramiączek. Od środka biegnie górna krawędź (dekolt, czasem ze szczytem pod ramiączko,
  // potem podkrój pachy), za nią szew boczny i dół. Szczyt boku to najszerszy narożnik w górnej części elementu; staje na wysokości pachy sylwetki.
  function swStrap(W, cor, pit, ax0, sa, want) {
    const n = W.length; if (!cor.length) return null;
    const yT = Math.min(...W.map((p) => p[1])), yB = W[n - 1][1], hgt = yB - yT; if (hgt < 20) return null;
    let hc = -1; for (const t of cor) if (W[t][1] > yB - 0.15 * hgt && (hc < 0 || W[t][0] > W[hc][0])) hc = t;
    if (hc < 0) return null;
    // kandydaci na szczyt boku: narożniki oraz miejsca, w których element jest lokalnie najszerszy (linia biustu nad wcięciem talii).
    // Który jest właściwy, rozstrzyga długość szwu bocznego drugiego elementu (want), bo przód i tył zszywa się na całej długości boku.
    const arc = [0]; for (let t = 1; t < n; t++) arc.push(arc[t - 1] + Math.hypot(W[t][0] - W[t - 1][0], W[t][1] - W[t - 1][1]));
    const cands = [];
    for (let t = 1; t < hc; t++) {
      if (W[t][1] > yT + 0.6 * hgt || W[t][0] < 8) continue;
      let isMax = true, drop = false; for (let q = 1; q < hc && isMax; q++) { const da = arc[q] - arc[t]; if (Math.abs(da) < 5 && W[q][0] > W[t][0] + 1e-6) isMax = false; if (da > 4 && da < 30 && W[q][0] < W[t][0] - 0.8) drop = true; }
      if (cor.includes(t) || (isMax && drop)) cands.push({ t, L: arc[hc] - arc[t], mx: isMax && drop });
    }
    if (!cands.length) return null;
    let pickC = null; if (want > 0) { for (const c of cands) if (!pickC || Math.abs(c.L - want) < Math.abs(pickC.L - want)) pickC = c; } else { for (const c of cands) if (c.mx) pickC = c; if (!pickC) pickC = cands[cands.length - 1]; }
    const ua = pickC.t;
    let pk = -1; for (const t of cor) if (t < ua && W[t][0] > 3 && W[t][1] < W[ua][1] - 3 && (pk < 0 || W[t][1] < W[pk][1])) pk = t;
    const side = W.slice(ua, hc + 1); if (swLen(side) < 12) return null;
    const dy = -(pit - 1.5) - W[ua][1], T = (a) => a.map((p) => [Math.max(0, p[0]), p[1] + dy]);
    const ed = pk > 0 ? [{ pts: T(W.slice(0, pk + 1)), tag: 'neck' }, { pts: T(W.slice(pk, ua + 1)), tag: 'arm' }] : [{ pts: T(W.slice(0, ua + 1)), tag: 'neck' }];
    ed.push({ pts: T(side), tag: 'side' }, { pts: T(W.slice(hc)), tag: 'bottom' });
    const bt = ed[ed.length - 1]; ed.push({ pts: [[0, bt.pts[bt.pts.length - 1][1]], [0, ed[0].pts[0][1]]], tag: 'center' }); bt.pts[bt.pts.length - 1][0] = 0; ed[0].pts[0][0] = 0;
    return { strap: { pk: pk > 0 ? T([W[pk]])[0] : null, cands: cands.map((c) => ({ L: c.L, mx: c.mx })) }, ax: { o: ax0.o, dir: ax0.dir, ua: W[ua][1], hem: Math.min(...W.slice(hc).map((p) => p[1])) }, cb: W[n - 1][1] - W[0][1], ed, sh: 0, arm: 0, side: swLen(side), hem: W[hc][0], bot: Math.max(...ed.map((q) => Math.max(...q.pts.map((p) => p[1])))), sa };
  }
  // przód albo tył skrojony razem z rękawem (kimono, nietoperz, rękaw „anielski”): od punktu szyjnego biegnie długi szew wierzchu rękawa,
  // potem otwarty dół rękawa, szew spodu rękawa do pachy i szew boczny. Pacha jest zaokrąglona, więc szukam jej jako najwyższego punktu za rękawem.
  function swKimono(W, cor, top, ax0, sa) {
    if (cor.length < 2) return null;
    const n = W.length, np = cor[0], se = cor[1], sh = W.slice(np, se + 1), shL = swLen(sh), chord = Math.hypot(W[se][0] - W[np][0], W[se][1] - W[np][1]);
    if (shL < 18 || chord < 0.96 * shL || W[np][0] < 3 || W[np][0] > 16 || W[se][0] < W[np][0] + 12) return null;
    const yB = W[n - 1][1], hgt = yB - Math.min(...W.map((p) => p[1])); let hc = -1;
    for (const t of cor) if (t > se && W[t][1] > yB - 0.15 * hgt && (hc < 0 || W[t][0] > W[hc][0])) hc = t;
    if (hc < 0) return null;
    let far = se; for (let i = se; i < hc; i++) if (W[i][0] > W[far][0]) far = i;
    let ua = far; for (let i = far; i < hc; i++) if (W[i][1] < W[ua][1]) ua = i;
    if (ua <= far || ua >= hc || W[ua][1] < W[np][1] + 8) return null;
    let tip = -1; for (const t of cor) if (t > far && t < ua) tip = t;
    if (tip < 0) { tip = far; for (let i = far; i < ua; i++) if (W[i][1] > W[tip][1]) tip = i; }
    if (tip <= se || swLen(W.slice(tip, ua + 1)) < 5 || swLen(W.slice(ua, hc + 1)) < 8) return null;
    const dy = -top - W[np][1], T = (a) => a.map((p) => [Math.max(0, p[0]), p[1] + dy]);
    const ed = [{ pts: T(W.slice(0, np + 1)), tag: 'neck' }, { pts: T(sh), tag: 'shoulder' }, { pts: T(W.slice(se, tip + 1)), tag: 'cuff' }, { pts: T(W.slice(tip, ua + 1)), tag: 'under' }, { pts: T(W.slice(ua, hc + 1)), tag: 'side' }, { pts: T(W.slice(hc)), tag: 'bottom' }];
    ed.push({ pts: [[0, ed[5].pts[ed[5].pts.length - 1][1]], [0, ed[0].pts[0][1]]], tag: 'center' }); ed[5].pts[ed[5].pts.length - 1][0] = 0; ed[0].pts[0][0] = 0;
    // układ rękawa: początek na szwie wierzchnim nad pachą, oś wzdłuż tego szwu; tabela mówi, jak szeroki jest rękaw (od szwu wierzchniego w dół) w kolejnych odległościach od barku
    const S0 = ed[1].pts, e0 = [W[se][0] - W[np][0], W[se][1] - W[np][1]], el = Math.hypot(e0[0], e0[1]), e = [e0[0] / el, e0[1] / el], nn = [-e[1], e[0]], xa = W[ua][0];
    let sp = S0[S0.length - 1]; for (let i = 1; i < S0.length; i++) if (S0[i][0] >= xa) { const a = S0[i - 1], b = S0[i], k = (xa - a[0]) / (b[0] - a[0] || 1); sp = [a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, k)), a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, k))]; break; }
    const tab = [], ring = T(W.slice(se, ua + 1)); for (let i = 1; i < ring.length; i++) { const a = ring[i - 1], b = ring[i], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let k = 0; k <= m; k++) { const x = a[0] + (b[0] - a[0]) * k / m - sp[0], y = a[1] + (b[1] - a[1]) * k / m - sp[1], t = x * e[0] + y * e[1], d = x * nn[0] + y * nn[1], bi = Math.max(0, Math.round(t / 2)); tab[bi] = Math.max(tab[bi] || 0, d); } }
    for (let i = 0; i < tab.length; i++) if (!tab[i]) tab[i] = tab[i - 1] || 4;
    const Ls = (S0[S0.length - 1][0] - sp[0]) * e[0] + (S0[S0.length - 1][1] - sp[1]) * e[1];
    return { kim: { sp, e, n: nn, tab, L: Ls, xa }, ax: { o: ax0.o, dir: ax0.dir, ua: W[ua][1], hem: Math.min(...W.slice(hc).map((p) => p[1])) }, cb: W[n - 1][1] - W[0][1], ed, sh: shL, arm: 0, under: swLen(ed[3].pts), side: swLen(ed[4].pts), hem: W[hc][0], bot: Math.max(...ed.map((q) => Math.max(...q.pts.map((p) => p[1])))), sa };
  }
  // rękaw: główka u góry (środek na x = 0, szczyt na y = 0), szwy rękawa po bokach, dół na dole
  function swSleeve(pc) {
    const R = swRing(pc); if (!R) return { err: 'nie ma zamkniętego obrysu' };
    const pts = R.pts, C = swCorners(pts), k = C.idx.length, n = pts.length; if (k < 4) return { err: 'obrys ma za mało narożników' };
    // główka: krawędź najmocniej wygięta ponad swoją cięciwę
    let best = -1, bb = 0;
    for (let e = 0; e < k; e++) { const i = C.idx[e], j = C.idx[(e + 1) % k], seg = swSub(pts, i, j), a = pts[i], b = pts[j], ch = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; let mx = 0; for (const p of seg) mx = Math.max(mx, Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / ch); if (mx > bb && ch > 15) { bb = mx; best = e; } }
    if (best < 0 || bb < 4) return { err: 'nie znalazłam główki rękawa' };
    const i0 = C.idx[best], i1 = C.idx[(best + 1) % k], A = pts[i0], B = pts[i1], ang = -Math.atan2(B[1] - A[1], B[0] - A[0]), ca = Math.cos(ang), sa = Math.sin(ang);
    let Q = pts.map((p, i) => [(p[0] - A[0]) * ca - (p[1] - A[1]) * sa, (p[0] - A[0]) * sa + (p[1] - A[1]) * ca, C.idx.includes(i) ? 1 : 0]); // trzecia liczba: czy punkt jest narożnikiem
    let ys = 1; const cap0 = swSub(Q, i0, i1); if (cap0.reduce((s, p) => s + p[1], 0) > 0) { Q = Q.map((p) => [p[0], -p[1], p[2]]); ys = -1; } // główka ma być nad cięciwą
    let cap = swSub(Q, i0, i1), rest = swSub(Q, i1, i0); if (cap[0][0] > cap[cap.length - 1][0]) { cap = cap.slice().reverse(); rest = rest.slice().reverse(); } // obejście: tył pachy, szczyt, przód pachy, szew, dół, szew
    let ti = 0; cap.forEach((p, t) => { if (p[1] < cap[ti][1]) ti = t; }); const ox = cap[ti][0], oy = cap[ti][1], T = (a) => a.map((p) => [p[0] - ox, p[1] - oy, p[2]]);
    cap = T(cap); rest = T(rest); // rest: od przodu pachy przez dół do tyłu pachy
    const H = (cap[0][1] + cap[cap.length - 1][1]) / 2; let h1 = -1, h2 = -1; rest.forEach((p, t) => { if (!p[2] || t === 0 || t === rest.length - 1) return; if (h1 < 0 || p[1] + p[0] * 0.25 > rest[h1][1] + rest[h1][0] * 0.25) h1 = t; if (h2 < 0 || p[1] - p[0] * 0.25 > rest[h2][1] - rest[h2][0] * 0.25) h2 = t; }); // narożniki dołu: najniżej z przodu i najniżej z tyłu
    if (h1 >= h2 || h1 < 1 || h2 > rest.length - 2) return { err: 'nie umiem wskazać dołu rękawa' };
    const Lb = Math.max(...rest.map((p) => p[1]));
    const cl = (arr) => arr.map((p) => [p[0], p[1]]);
    const ed = [{ pts: cap.slice(0, ti + 1), tag: 'capB' }, { pts: cap.slice(ti), tag: 'capF' }, { pts: rest.slice(0, h1 + 1), tag: 'underF' }, { pts: rest.slice(h1, h2 + 1), tag: 'bottom' }, { pts: rest.slice(h2), tag: 'underB' }].map((e) => ({ pts: cl(e.pts), tag: e.tag }));
    return { ax: { o: A, dir: [ys * sa, ys * ca], ua: 0, hem: Math.min(rest[h1][1], rest[h2][1]) + oy }, ed, H, L: Lb, bic: cap[cap.length - 1][0] - cap[0][0], hem: Math.hypot(rest[h2][0] - rest[h1][0], rest[h2][1] - rest[h1][1]), cap: swLen(cap), sa: R.sa };
  }
  const SW_ROLE = [{ r: 'F', re: /prz[oó]d|front/i }, { r: 'B', re: /ty[lł]|back/i }, { r: 'S', re: /r[eę]kaw|sleeve/i }], SW_NOT = /odszyci|facing|podszew|lining|mankiet|cuff|lam[oó]w|binding|d[oó][lł]|skirt|falban|ko[lł]nierz|collar|rami[aą]cz|strap|pas|band|klin|godet|tren|train|skrzyd/i;
  // zszyte elementy wczytanego wykroju albo powód, dla którego podglądu nie będzie
  // kontrola wyniku: zszyte ubranie musi pasować do sylwetki i do tego, co analiza mówi o wykroju; inaczej lepiej nic nie pokazać
  function swSane(circ, dl, m, an) {
    if (circ > 0 && (circ < 0.7 * m.og || circ > 1.75 * m.og)) return 'Zszyte elementy nie pasują do sylwetki: w biuście wychodzi ' + Math.round(circ) + ' cm przy ' + Math.round(m.og) + ' cm modelki. Sprawdź na liście elementów, który jest przodem, a który tyłem, albo wybierz inny rozmiar.';
    if (an && an.typ === 'sukienka' && dl < 22) return 'Według analizy to sukienka, a zszyte elementy kończą się na biodrach. Sprawdź na liście elementów, który jest przodem, a który tyłem.';
    return '';
  }
  function impSew(imp, m) {
    const r = /** @type {any} */ (impSew0(imp, m)); if (r.err) return r;
    const top = (id) => { const pc = r.pieces.find((q) => q.id === id), e = pc && pc.ed.find((q) => q.tag === 'side'); return e ? e.pts[0][0] : 0; }, xf = top('przod'), xb = top('tyl');
    const bad = swSane(xf && xb ? 2 * (xf + xb) : 0, r.dl, m, imp && imp.an); if (bad) return { err: bad };
    // duże elementy, których nie umiem doszyć (spódnica z paneli, kliny, tren): sama góra udawałaby całe ubranie, więc podglądu nie ma
    const pcs = (imp && imp.pieces) || [], nm = (pc) => String(pc.name || ''), usedA = pcs.filter((pc) => r.used.includes(nm(pc))).reduce((s, pc) => s + pc.w * pc.h, 0);
    const lost = pcs.filter((pc) => !r.used.includes(nm(pc)) && !(r.sleeve && /r[eę]kaw|sleeve/i.test(nm(pc))) && !/odszyci|facing|podszew|lining|lam[oó]w|binding|rami[aą]cz|strap|mankiet|cuff|ko[lł]nierz|collar|pasek|^element \d/i.test(nm(pc)) && pc.w * pc.h > 400);
    if (usedA > 0 && lost.reduce((s, pc) => s + pc.w * pc.h, 0) > 0.5 * usedA) return { err: 'Tego wykroju nie umiem jeszcze zszyć w całości. Poza przodem i tyłem ma duże elementy, których nie doszywam: ' + lost.map((pc) => nm(pc).replace(/ \(część.*$/, '').toLowerCase()).filter((x, i, arr) => arr.indexOf(x) === i).join(', ') + '. Sam przód z tyłem udawałby całe ubranie, więc podglądu nie pokazuję.' };
    return r;
  }
  function impSew0(imp, m) {
    const a = W.full(m), pcs = (imp && imp.pieces) || [], pick = {}, skip = [];
    // rola z analizy ma pierwszeństwo przed nazwą elementu
    for (const pc of pcs) { const nm = String(pc.name || ''), r0 = pc.role ? (/^[FBS]$/.test(pc.role) ? pc.role : null) : (SW_NOT.test(nm) ? null : (SW_ROLE.find((x) => x.re.test(nm)) || { r: null }).r), r = r0; if (r && (!pick[r] || pc.w * pc.h > pick[r].w * pick[r].h)) { if (pick[r]) skip.push(String(pick[r].name || '').replace(/ \(część.*$/, '')); pick[r] = pc; } else skip.push(nm.replace(/ \(część.*$/, '')); } // gdy rolę ma kilka elementów, liczy się największy (odszycia i lamówki są małe)
    if (!pick.F || !pick.B) return { err: 'Podgląd 3D potrzebuje przodu i tyłu, a na liście elementów ich nie rozpoznałam.' };
    const pit = a.Dts - a.Gp - 1; let F = /** @type {any} */ (swBodice(pick.F, a.Dts, pit)), B = /** @type {any} */ (swBodice(pick.B, a.Dts, pit));
    if (F.strap && B.strap && Math.abs(F.side - B.side) > Math.max(2.5, 0.05 * F.side)) { // boki nie pasują: szukam pary szczytów boku, przy której szwy boczne mają tę samą długość
      let best = null; for (const cf of F.strap.cands) for (const cb of B.strap.cands) { const dd = Math.abs(cf.L - cb.L); if (dd > Math.max(2.5, 0.04 * cf.L)) continue; const sc = (cf.mx ? 1 : 0) + (cb.mx ? 1 : 0); if (!best || sc > best[3] || (sc === best[3] && dd < best[0])) best = [dd, cf.L, cb.L, sc]; } // pierwszeństwo ma para, w której szczyt boku wypada na linii biustu
      if (best) { F = /** @type {any} */ (swBodice(pick.F, a.Dts, pit, best[1])); B = /** @type {any} */ (swBodice(pick.B, a.Dts, pit, best[2])); }
    }
    if (F.err || B.err) return { err: 'Tego fasonu nie umiem jeszcze pokazać w 3D (' + (F.err ? 'przód: ' + F.err : 'tył: ' + B.err) + '). Na razie działa układ przód, tył i rękaw z ramieniem i pachą.' };
    // przód i tył muszą do siebie pasować: te same ramiona i szwy boczne; inaczej krawędzie zostały rozpoznane źle
    if (Math.abs(F.sh - B.sh) > 1.5 || Math.abs(F.side - B.side) > Math.max(2, 0.08 * F.side)) return { err: 'Tego fasonu nie umiem jeszcze pokazać w 3D (ramiona albo boki przodu i tyłu nie pasują do siebie).' };
    if (!!F.strap !== !!B.strap) return { err: 'Tego fasonu nie umiem jeszcze pokazać w 3D (przód i tył mają różny układ góry).' };
    if (F.strap) { // góra bez ramion: zszywane są tylko boki, górną krawędź trzymają ramiączka
      if (Math.abs(F.side - B.side) > Math.max(2.5, 0.1 * F.side)) return { err: 'Tego fasonu nie umiem jeszcze pokazać w 3D (szwy boczne przodu i tyłu nie pasują do siebie).' };
      for (const r of ['S']) if (pick[r]) skip.push(String(pick[r].name));
      const mk1 = (id, o) => ({ id, ed: o.ed, prims: [] });
      return { pieces: [mk1('przod', F), mk1('tyl', B)], dl: Math.max(F.bot, B.bot), hemC: 2 * (F.hem + B.hem), sleeve: null, strap: { F: F.strap.pk, B: B.strap.pk, yMax: pit + 8 }, gather: null, used: [String(pick.F.name || ''), String(pick.B.name || '')], skip: skip.filter((x, i, arr) => x && arr.indexOf(x) === i), slErr: '', sa: F.sa };
    }
    if (!!F.kim !== !!B.kim) return { err: 'Tego fasonu nie umiem jeszcze pokazać w 3D (przód i tył mają różny układ rękawa).' };
    if (F.kim) { // rękaw skrojony razem z przodem i tyłem: osobnego rękawa nie ma, zszywa się spód rękawa i bok
      if (Math.abs(F.under - B.under) > Math.max(2, 0.1 * F.under)) return { err: 'Tego fasonu nie umiem jeszcze pokazać w 3D (szwy spodu rękawa z przodu i z tyłu nie pasują do siebie).' };
      if (pick.S) skip.push(String(pick.S.name));
      const mk0 = (id, o) => ({ id, ed: o.ed, prims: [] }), wid = Math.max(...F.kim.tab);
      return { pieces: [mk0('przod', F), mk0('tyl', B)], dl: Math.max(F.bot, B.bot), hemC: 2 * (F.hem + B.hem), sleeve: { L: F.kim.L, bic: 2 * (F.kim.tab[1] || 12), hem: 2 * wid, H: 0, puff: false, ruf: 0, kim: true }, kim: { F: F.kim, B: B.kim }, gather: null, used: [String(pick.F.name || ''), String(pick.B.name || '')], skip: skip.filter((x, i, arr) => x && arr.indexOf(x) === i), slErr: '', sa: F.sa };
    }
    const S = pick.S ? swSleeve(pick.S) : null, slOk = S && !S.err;
    if (pick.S && !slOk) skip.push(String(pick.S.name));
    // mankiet: dół rękawa jest do niego zmarszczony; długość mankietu to dłuższy bok prostokąta bez zapasów
    const cuff = pcs.find((pc) => pc.role === 'C' || /mankiet|cuff/i.test(String(pc.name || ''))), cuffL = cuff ? Math.max(cuff.w, cuff.h) - 2 : 0, gather = slOk && cuffL > 8 && cuffL < S.hem * 0.87 ? { S: Math.max(0.2, cuffL / S.hem) } : null;
    const mk = (id, o) => ({ id, ed: o.ed, prims: [] }), pieces = [mk('przod', F), mk('tyl', B)]; if (slOk) pieces.push(mk('stanik-rekaw', S));
    return { pieces, dl: Math.max(F.bot, B.bot), hemC: 2 * (F.hem + B.hem), sleeve: slOk ? { L: S.L, bic: S.bic, hem: S.hem, H: S.H, puff: false, ruf: 0 } : null, gather, used: [String(pick.F.name || ''), String(pick.B.name || '')], skip: skip.filter((x, i, arr) => x && arr.indexOf(x) === i), slErr: pick.S && !slOk ? S.err : '', sa: F.sa };
  }
  // ---------- długość wczytanego wykroju ----------
  // Element jest rozcinany w poprzek pod pachą i rozsuwany (albo zsuwany) wzdłuż własnej osi, tak jak na linii „tu wydłuż albo skróć”.
  // Dół, szerokość dołu i wszystko nad pachą zostają bez zmian, szew boczny się prostuje.
  function swAxis(pc, role) {
    let r; try { r = role === 'S' ? swSleeve(pc) : swBodice(pc, 0); } catch (e) { return null; }
    if (r && r.ax) { const cut = r.ax.ua + 0.15 * (r.ax.hem - r.ax.ua), room = r.ax.hem - cut; return room > 2 ? { o: r.ax.o, dir: r.ax.dir, cut, room } : null; }
    // fason bez ramienia i pachy (np. na ramiączkach): wystarczy linia środka; tnę w dolnej połowie
    if (r && r.ax0 && r.bot - r.top > 12) { const len = r.bot - r.top, cut = r.top + 0.6 * len; return { o: r.ax0.o, dir: r.ax0.dir, cut, room: 0.35 * len, loose: true }; }
    // ostatnia deska: wydłużony element bez rozpoznanej linii środka. Oś biegnie wzdłuż dłuższego boku, a dół jest tam, gdzie element jest szerszy
    if (role !== 'S') {
      const pts = []; for (const q of pc.prims) if (q.pts && q.s === 'cut') for (const p of q.pts) pts.push(p); if (pts.length < 6) return null;
      const b = pc.box, w = b.x1 - b.x0, h = b.y1 - b.y0, vert = h >= w, len = vert ? h : w; if (len < 1.3 * Math.min(w, h) || len < 20) return null;
      const tOf = (p) => (vert ? p[1] - b.y0 : p[0] - b.x0), sOf = (p) => (vert ? p[0] : p[1]), span = (lo, hi) => { let a = 1e9, c = -1e9; for (const p of pts) { const t = tOf(p); if (t >= lo && t <= hi) { a = Math.min(a, sOf(p)); c = Math.max(c, sOf(p)); } } return c > a ? c - a : 0; };
      const wA = span(0, 0.2 * len), wB = span(0.8 * len, len), down = wB >= wA, dir = vert ? [0, down ? 1 : -1] : [down ? 1 : -1, 0], o = down ? [b.x0, b.y0] : [b.x1, b.y1];
      return { o, dir, cut: 0.6 * len, room: 0.35 * len, loose: true };
    }
    return null;
  }
  function swStretch(pc, ax, d) {
    const mv = (x, y) => { const t = (x - ax.o[0]) * ax.dir[0] + (y - ax.o[1]) * ax.dir[1]; if (t <= ax.cut) return [x, y]; const s = d >= 0 ? d : Math.max(ax.cut - t, d); return [x + ax.dir[0] * s, y + ax.dir[1] * s]; };
    // przy skracaniu punkty z wyciętego pasa znikają, a linia łączy się prosto nad nim i pod nim (zsunięte na linię cięcia robiłyby schodek na skośnym szwie)
    const gone = (p) => { if (d >= 0) return false; const t = (p[0] - ax.o[0]) * ax.dir[0] + (p[1] - ax.o[1]) * ax.dir[1]; return t > ax.cut && t < ax.cut - d; };
    const line = (pts) => { const n = pts.length, closed = n > 3 && Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) < 0.3, keep = pts.filter((p) => !gone(p)).map((p) => mv(p[0], p[1])); if (keep.length < 2 || (closed && keep.length < 4)) return pts.map((p) => mv(p[0], p[1])); if (closed && Math.hypot(keep[0][0] - keep[keep.length - 1][0], keep[0][1] - keep[keep.length - 1][1]) > 0.3) keep.push([keep[0][0], keep[0][1]]); return keep; };
    const prims = pc.prims.map((q) => (q.pts ? Object.assign({}, q, { pts: line(q.pts) }) : typeof q.x === 'number' ? (() => { const m = mv(q.x, q.y); return Object.assign({}, q, { x: m[0], y: m[1] }); })() : q));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of prims) if (q.pts && q.s === 'cut') for (const p of q.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    if (x1 < x0) return pc;
    return Object.assign({}, pc, { prims, box: { x0, y0, x1, y1 }, w: x1 - x0, h: y1 - y0 });
  }
  const swRoleOf = (pc) => { const nm = String(pc.name || ''); return pc.role ? pc.role : SW_NOT.test(nm) ? '' : (SW_ROLE.find((x) => x.re.test(nm)) || { r: '' }).r; };
  // elementy po zmianie długości oraz to, co panel ma pokazać: czy korpus i rękaw dają się zmieniać i w jakich granicach
  function impAdj(imp) {
    const pcs = (imp && imp.pieces) || [], adj = (imp && imp.adj) || {}, out = { pieces: pcs, body: null, sleeve: null };
    const grp = (roles) => { const g = pcs.map((pc, i) => ({ i, pc, r: swRoleOf(pc) })).filter((x) => roles.includes(x.r)).map((x) => Object.assign(x, { ax: swAxis(x.pc, x.r) })); return g.length && g.every((x) => x.ax) ? g : null; };
    const res = pcs.slice();
    for (const [key, roles, val] of /** @type {any[][]} */ ([['body', ['F', 'B'], +adj.b || 0], ['sleeve', ['S'], +adj.s || 0]])) {
      const g = grp(roles); if (!g || (key === 'body' && !(g.some((x) => x.r === 'F') && g.some((x) => x.r === 'B')))) continue;
      const min = -Math.floor(Math.min(...g.map((x) => x.ax.room)) * 0.85 * 2) / 2, d = Math.max(min, val);
      out[key] = { min, d, loose: g.some((x) => x.ax.loose), n: g.length };
      if (d) for (const x of g) res[x.i] = swStretch(x.pc, x.ax, d);
    }
    out.pieces = res; return out;
  }
  window.__sw = { impAdj, swAxis, impSew, swBodice, swSleeve, swCorners, swRing }; // tylko do testów
