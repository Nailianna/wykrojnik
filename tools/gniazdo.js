/* Rozmiary narysowane jeden w drugim, w jednej warstwie pliku (arkusze z CorelDRAW).
   Linia rozmiaru bywa urwana tam, gdzie pokrywa się z linią innego rozmiaru albo z linią wspólną (złożenie, talia).
   Czytnik zamyka każdą długą linię najkrótszą drogą po pozostałych liniach tego samego elementu, a zamknięte obrysy porządkuje według pola: najmniejszy to najmniejszy rozmiar.
   Wejście: ścieżki z PatImport.load (pts w centymetrach, ds: wzór kreski, c: kolor, w: grubość). */
(function (root) {
  'use strict';
  const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
  const bbox = (p) => { const b = [1e9, 1e9, -1e9, -1e9]; for (const v of p) { if (v[0] < b[0]) b[0] = v[0]; if (v[1] < b[1]) b[1] = v[1]; if (v[0] > b[2]) b[2] = v[0]; if (v[1] > b[3]) b[3] = v[1]; } return b; };
  const sarea = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const bbNear = (a, b, t) => a[0] <= b[2] + t && b[0] <= a[2] + t && a[1] <= b[3] + t && b[1] <= a[3] + t;
  const pip = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  // najbliższy punkt łamanej: odległość, numer odcinka, położenie na odcinku
  function nearestOn(pts, q) {
    let best = { d: 1e9, seg: -1, t: 0, pt: null };
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 > 1e-12 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const x = a[0] + dx * t, y = a[1] + dy * t, d = Math.hypot(q[0] - x, q[1] - y); if (d < best.d) best = { d, seg: i - 1, t, pt: [x, y] }; }
    return best;
  }
  // kopiec do najkrótszej drogi
  function Heap() { const h = []; return { push(k, v) { h.push([k, v]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }, pop() { const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return top; }, get size() { return h.length; } }; }

  function read(paths, opts) {
    opts = opts || {}; const MIN = opts.minLen || 10, TOL = opts.tol || 0.3;
    const P = paths.map((p, i) => ({ i, pts: p.pts, ds: p.ds || '', c: p.c || '', w: p.w || 0, len: plen(p.pts), bb: bbox(p.pts) }));
    for (const p of P) p.closed = p.pts.length > 3 && Math.hypot(p.pts[0][0] - p.pts[p.pts.length - 1][0], p.pts[0][1] - p.pts[p.pts.length - 1][1]) < 0.15;
    const long = P.filter((p) => p.len >= MIN);
    // --- elementy: długie linie połączone końcami (koniec jednej leży na drugiej) należą do jednego elementu
    const par = long.map((_, i) => i), find = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
    const ends = (p) => [p.pts[0], p.pts[p.pts.length - 1]];
    for (let i = 0; i < long.length; i++) for (let j = i + 1; j < long.length; j++) { const a = long[i], b = long[j]; if (!bbNear(a.bb, b.bb, TOL) || find(i) === find(j)) continue; if (ends(a).some((e) => nearestOn(b.pts, e).d < TOL) || ends(b).some((e) => nearestOn(a.pts, e).d < TOL)) par[find(i)] = find(j); }
    let groups = new Map(); long.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
    let cl = Array.from(groups.values()).map((ls) => { const b = [1e9, 1e9, -1e9, -1e9]; for (const p of ls) { b[0] = Math.min(b[0], p.bb[0]); b[1] = Math.min(b[1], p.bb[1]); b[2] = Math.max(b[2], p.bb[2]); b[3] = Math.max(b[3], p.bb[3]); } return { ls, bb: b }; });
    // obrysy zamknięte leżące w całości jeden w drugim (stopniowanie dookoła, bez wspólnej krawędzi) też są jednym elementem
    { const ar = (b) => (b[2] - b[0]) * (b[3] - b[1]); cl.sort((x, y) => ar(y.bb) - ar(x.bb)); const keep = [];
      for (const c of cl) { const host = keep.find((k) => c.bb[0] >= k.bb[0] - 0.5 && c.bb[1] >= k.bb[1] - 0.5 && c.bb[2] <= k.bb[2] + 0.5 && c.bb[3] <= k.bb[3] + 0.5 && ar(c.bb) > 0.3 * ar(k.bb) && c.ls.some((p) => p.closed) && k.ls.some((p) => p.closed)); if (host) host.ls = host.ls.concat(c.ls); else keep.push(c); } cl = keep; }
    const out = [];
    for (const g of cl) {
      const seeds = g.ls; if (seeds.length < 1) continue;
      // krótkie odcinki dotykające linii elementu są łącznikami: linia rozmiaru bywa pocięta na kawałki krótsze niż próg
      const Ls = seeds.slice(), inG = new Set(seeds.map((p) => p.i));
      for (let pass = 0; pass < 3; pass++) { let added = false; for (const p of P) { if (inG.has(p.i) || p.len < 0.3 || p.len >= MIN || !bbNear(p.bb, g.bb, TOL)) continue; if (ends(p).some((e) => Ls.some((o) => bbNear([e[0], e[1], e[0], e[1]], o.bb, TOL) && nearestOn(o.pts, e).d < TOL))) { Ls.push(p); inG.add(p.i); added = true; } } if (!added) break; }
      // --- graf: wierzchołki linii, a do tego punkty, w których koniec jednej linii dotyka środka innej
      const nodes = [], grid = new Map(), adj = [];
      const node = (pt) => { const kx = Math.round(pt[0] / 0.1), ky = Math.round(pt[1] / 0.1); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const lst = grid.get((kx + dx) + ':' + (ky + dy)); if (lst) for (const id of lst) if (Math.hypot(nodes[id][0] - pt[0], nodes[id][1] - pt[1]) < 0.04) return id; } const id = nodes.length; nodes.push(pt); adj.push([]); const k = kx + ':' + ky; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(id); return id; };
      const link = (a, b, w, own) => { if (a === b) return; adj[a].push([b, w, own]); adj[b].push([a, w, own]); };
      const ins = Ls.map((p) => p.pts.map(() => [])), bridges = [];
      Ls.forEach((p, pi) => { for (const e of ends(p)) Ls.forEach((o, oi) => { if (oi === pi || !bbNear([e[0], e[1], e[0], e[1]], o.bb, TOL)) return; const n = nearestOn(o.pts, e); if (n.d >= TOL) return; ins[oi][n.seg].push({ t: n.t, pt: n.pt }); bridges.push([e, n.pt, n.d]); }); });
      Ls.forEach((p, pi) => { let prev = node(p.pts[0]); for (let s = 0; s < p.pts.length - 1; s++) { const extra = ins[pi][s].slice().sort((x, y) => x.t - y.t); for (const x of extra) { const id = node(x.pt); link(prev, id, Math.hypot(nodes[prev][0] - x.pt[0], nodes[prev][1] - x.pt[1]), p.i); prev = id; } const id = node(p.pts[s + 1]); link(prev, id, Math.hypot(nodes[prev][0] - p.pts[s + 1][0], nodes[prev][1] - p.pts[s + 1][1]), p.i); prev = id; } });
      for (const b of bridges) link(node(b[0]), node(b[1]), b[2] + 1e-4, -1);
      // droga domknięcia: najchętniej po liniach tego samego wzoru kreski (pozostałe kawałki tego samego rozmiaru), potem po liniach ciągłych (wspólnych), najmniej chętnie po liniach innych rozmiarów
      const dsOf = new Map(Ls.map((p) => [p.i, p.ds]));
      const route = (from, to, ban, ds, bias) => { const dist = new Float64Array(nodes.length).fill(1e18), prev = new Int32Array(nodes.length).fill(-1), real = new Float64Array(nodes.length), h = Heap(); dist[from] = 0; h.push(0, from);
        while (h.size) { const [d, u] = h.pop(); if (d > dist[u]) continue; if (u === to) break; for (const [v, w, own] of adj[u]) { if (own === ban) continue; const o = own < 0 ? null : dsOf.get(own), k = !bias || own < 0 ? 1 : o === ds ? 0.3 : o === '' ? 1 : 3, nd = d + w * k; if (nd < dist[v]) { dist[v] = nd; real[v] = real[u] + w; prev[v] = u; h.push(nd, v); } } }
        if (dist[to] > 1e17) return null; const pts = []; for (let u = to; u !== -1; u = prev[u]) pts.push(nodes[u]); return { pts: pts.reverse(), len: real[to] }; };
      // --- każda linia zamknięta drogą po pozostałych, na dwa sposoby: najkrótszą oraz taką, która trzyma się tego samego wzoru kreski
      const cyc = [];
      const addCyc = (p, pts, extra) => { const cleaned = []; for (const v of pts) { const l = cleaned[cleaned.length - 1]; if (!l || Math.hypot(l[0] - v[0], l[1] - v[1]) > 0.005) cleaned.push(v); } const A = sarea(cleaned); if (Math.abs(A) < 4) return; cyc.push({ pts: A < 0 ? cleaned.reverse() : cleaned, area: Math.abs(A), per: plen(cleaned.concat([cleaned[0]])), own: p.len, extra, ds: p.ds, c: p.c, src: p.i, bb: bbox(cleaned) }); };
      for (const p of seeds) {
        if (p.closed) { addCyc(p, p.pts.slice(0, -1), 0); continue; }
        for (const bias of [false, true]) { const r = route(node(p.pts[p.pts.length - 1]), node(p.pts[0]), p.i, p.ds, bias); if (r) addCyc(p, p.pts.concat(r.pts.slice(1, -1)), r.len); }
      }
      if (!cyc.length) continue;
      cyc.sort((a, b) => a.area - b.area);
      // ten sam obrys zamknięty z dwóch swoich części liczy się raz; zostaje ten, który ma najwięcej własnej linii
      const uniq = []; for (const c of cyc) { const k = uniq.findIndex((u) => Math.abs(u.area - c.area) < 0.004 * c.area + 0.3 && Math.abs(u.bb[0] - c.bb[0]) + Math.abs(u.bb[1] - c.bb[1]) + Math.abs(u.bb[2] - c.bb[2]) + Math.abs(u.bb[3] - c.bb[3]) < 0.4); if (k < 0) uniq.push(c); else if (c.extra < uniq[k].extra) uniq[k] = c; }
      const amax = uniq[uniq.length - 1].area, pool = uniq.filter((c) => c.area >= (opts.minShare || 0.35) * amax);
      // --- rodzina rozmiarów: najdłuższy ciąg rosnących pól, w którym wzory kreski powtarzają się cyklicznie; przy remisie wygrywa ciąg z najkrótszymi domknięciami
      let sizes = pool;
      { const firm = pool.filter((c) => c.extra < 0.25 * c.per), order = []; for (const c of firm) if (!order.includes(c.ds)) order.push(c.ds); const Lc = order.length;
        if (Lc > 1 && Lc <= 4) { let bestSeq = null;
          for (let rot = 0; rot < Lc; rot++) { // dp[i]: najlepszy ciąg kończący się na i
            const dp = pool.map(() => null);
            for (let i = 0; i < pool.length; i++) { const ci = pool[i], si = order.indexOf(ci.ds); if (si < 0) continue; let best = si === rot ? { n: 1, ex: ci.extra, prev: -1, pos: 0 } : null;
              for (let j = 0; j < i; j++) { const d = dp[j]; if (!d || pool[i].area < pool[j].area * 1.004) continue; if (si !== (order.indexOf(pool[j].ds) + 1) % Lc) continue; const cand = { n: d.n + 1, ex: d.ex + ci.extra, prev: j, pos: d.pos + 1 }; if (!best || cand.n > best.n || (cand.n === best.n && cand.ex < best.ex)) best = cand; }
              dp[i] = best; }
            let end = -1; for (let i = 0; i < pool.length; i++) if (dp[i] && (end < 0 || dp[i].n > dp[end].n || (dp[i].n === dp[end].n && dp[i].ex < dp[end].ex))) end = i;
            if (end < 0) continue; const seq = []; for (let i = end; i >= 0; i = dp[i].prev) { seq.push(pool[i]); if (dp[i].prev < 0) break; } seq.reverse();
            const ex = seq.reduce((t, c) => t + c.extra, 0); if (!bestSeq || seq.length > bestSeq.seq.length || (seq.length === bestSeq.seq.length && ex < bestSeq.ex)) bestSeq = { seq, ex };
          }
          // ciąg według wzorów kreski wygrywa, chyba że zwykłe uporządkowanie według pola daje dokładnie oczekiwaną liczbę rozmiarów (rysunek z pomyłką we wzorze kreski)
          const plain = pool.filter((c) => !pool.some((o) => o !== c && o.src === c.src && o.extra < c.extra));
          if (bestSeq && !(opts.n && plain.length === opts.n && bestSeq.seq.length < opts.n)) sizes = bestSeq.seq; else sizes = plain;
        } else sizes = pool.filter((c) => !pool.some((o) => o !== c && o.src === c.src && o.extra < c.extra));
      }
      // pozostałe linie w obrębie największego obrysu: znaki, zaszewki, nitka prosta, zakładki
      const big = sizes[sizes.length - 1].pts, used = new Set(seeds.map((p) => p.i));
      const inner = P.filter((p) => !used.has(p.i) && p.len > 0.2 && bbNear(p.bb, g.bb, 0.5) && pip((p.bb[0] + p.bb[2]) / 2, (p.bb[1] + p.bb[3]) / 2, big)).map((p) => ({ pts: p.pts, ds: p.ds, c: p.c, w: p.w, len: p.len, closed: p.closed }));
      const lines = seeds.filter((p) => !sizes.some((s) => s.src === p.i)).map((p) => ({ pts: p.pts, ds: p.ds, c: p.c, w: p.w, len: p.len, closed: p.closed }));
      out.push({ bb: g.bb, sizes, inner, lines, nLines: seeds.length });
    }
    out.sort((a, b) => a.bb[0] - b.bb[0] || a.bb[1] - b.bb[1]);
    return out;
  }
  root.PatNest = { read, plen, bbox, sarea, nearestOn, pip };
})(typeof globalThis !== 'undefined' ? globalThis : this);
