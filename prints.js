/* Wykrojnik: poglądowe wzory tkanin rysowane w locie. Kafelek powtarzalny N x N, kolory: A tło, B wzór, C ciemny odcień A. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const bg = (g, N, c) => { g.fillStyle = c; g.fillRect(0, 0, N, N); };
  const wrap = (g, N, fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const ell = (g, x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); };
  const mod = (a, n) => ((a % n) + n) % n;

  // draw(g, N, [A, B, C]) rysuje kształtami; px(x, y) zwraca 0..2 (0 = A, 1 = B, 2 = C, ułamki mieszają sąsiednie)
  const LIST = [
    { id: 'pin', name: 'Prążki', tile: 12, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let x = 0; x < N; x += 32) g.fillRect(x, 0, 6, N); } },
    { id: 'pasy', name: 'Pasy', tile: 14, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let x = 0; x < N; x += 128) g.fillRect(x, 0, 64, N); } },
    { id: 'bret', name: 'Marynarskie', tile: 14, draw: (g, N, c) => { bg(g, N, c[1]); g.fillStyle = c[0]; for (let y = 0; y < N; y += 128) g.fillRect(0, y, N, 38); } },
    { id: 'skos', name: 'Paski skośne', tile: 10, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let k = -N; k < 2 * N; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 28, 0); g.lineTo(k + 28 - N, N); g.lineTo(k - N, N); g.fill(); } } },
    { id: 'gro1', name: 'Groszki', tile: 13, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let i = -1; i <= N / 64; i++) for (let j = -1; j <= N / 64; j++) { dot(g, i * 64, j * 64, 10); dot(g, i * 64 + 32, j * 64 + 32, 10); } } },
    { id: 'gro2', name: 'Grochy', tile: 16, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let i = -1; i <= N / 128; i++) for (let j = -1; j <= N / 128; j++) { dot(g, i * 128, j * 128, 30); dot(g, i * 128 + 64, j * 128 + 64, 30); } } },
    { id: 'vichy', name: 'Kratka vichy', tile: 9, draw: (g, N, c) => { bg(g, N, c[1]); g.fillStyle = c[0]; g.globalAlpha = 0.5; for (let x = 0; x < N; x += 64) { g.fillRect(x, 0, 32, N); g.fillRect(0, x, N, 32); } g.globalAlpha = 1; } },
    { id: 'tartan', name: 'Krata szkocka', tile: 18, draw: (g, N, c) => {
      bg(g, N, c[0]); g.globalAlpha = 0.5; g.fillStyle = c[2];
      for (const o of [0, 256]) { g.fillRect(o, 0, 96, N); g.fillRect(0, o, N, 96); }
      g.globalAlpha = 0.9; g.fillStyle = c[1]; for (const o of [176, 432]) { g.fillRect(o, 0, 5, N); g.fillRect(0, o, N, 5); }
      g.globalAlpha = 0.55; g.fillStyle = '#101014'; for (const o of [46, 302]) { g.fillRect(o, 0, 4, N); g.fillRect(0, o, N, 4); } g.globalAlpha = 1;
    } },
    { id: 'pepitka', name: 'Pepitka', tile: 10, px: (x, y) => { const i = x >> 3, j = y >> 3, wc = (i % 8) < 4, fc = (j % 8) < 4; return (((i + j) % 4) < 2 ? wc : fc) ? 0 : 1; } },
    { id: 'okienna', name: 'Krata okienna', tile: 14, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let x = 0; x < N; x += 128) { g.fillRect(x, 0, 4, N); g.fillRect(0, x, N, 4); } } },
    { id: 'jodelka', name: 'Jodełka', tile: 15, px: (x, y) => (mod(y + ((x >> 6) % 2 ? x : -x), 16) < 8 ? 0 : 2) },
    { id: 'zygzak', name: 'Zygzak', tile: 12, px: (x, y) => (mod(y + Math.abs((x % 128) - 64), 64) < 32 ? 0 : 1) },
    { id: 'romby', name: 'Romby', tile: 12, px: (x, y) => { const u = x / 128 + y / 256, v = x / 128 - y / 256 + 16, fu = Math.abs(mod(u + 0.5, 1) - 0.5), fv = Math.abs(mod(v + 0.5, 1) - 0.5); if (Math.abs(fu - 0.5) < 0.025 || Math.abs(fv - 0.5) < 0.025) return 1; return (Math.floor(u) + Math.floor(v)) % 2 ? 0 : 2; } },
    { id: 'luski', name: 'Łuski', tile: 12, draw: (g, N, c) => {
      bg(g, N, c[0]); g.strokeStyle = c[1]; g.lineWidth = 5;
      for (let j = -1; j <= N / 64 + 1; j++) for (let i = -1; i <= N / 128 + 1; i++) { g.fillStyle = j % 2 ? c[0] : mix(c[0], c[2], 0.35); g.beginPath(); g.arc(i * 128 + (mod(j, 2) ? 64 : 0), j * 64, 64, 0, TAU); g.fill(); g.stroke(); }
    } },
    { id: 'trojkaty', name: 'Trójkąty', tile: 10, draw: (g, N, c) => { bg(g, N, c[0]); g.fillStyle = c[1]; for (let j = 0; j < N / 64; j++) for (let i = -1; i <= N / 64; i++) { const x = i * 64 + (j % 2 ? 32 : 0), y = j * 64; g.beginPath(); g.moveTo(x + 6, y + 58); g.lineTo(x + 32, y + 8); g.lineTo(x + 58, y + 58); g.fill(); } } },
    { id: 'kwiatki', name: 'Łączka', tile: 17, draw: (g, N, c) => {
      bg(g, N, c[0]); const r = rng(7);
      wrap(g, N, () => { const q = rng(7); for (let k = 0; k < 44; k++) { const x = q() * N, y = q() * N, a0 = q() * TAU; g.fillStyle = c[1]; for (let p = 0; p < 5; p++) dot(g, x + 7 * Math.cos(a0 + (p * TAU) / 5), y + 7 * Math.sin(a0 + (p * TAU) / 5), 5.5); g.fillStyle = c[2]; dot(g, x, y, 3.6); } });
      void r;
    } },
    { id: 'kwiaty', name: 'Duże kwiaty', tile: 26, draw: (g, N, c) => {
      bg(g, N, c[0]);
      wrap(g, N, () => { const q = rng(21); for (let k = 0; k < 8; k++) {
        const x = q() * N, y = q() * N, a0 = q() * TAU, s = 0.8 + q() * 0.5;
        g.fillStyle = mix(c[0], c[2], 0.7); ell(g, x + 52 * s * Math.cos(a0 + 0.4), y + 52 * s * Math.sin(a0 + 0.4), 26 * s, 10 * s, a0 + 0.4); ell(g, x + 50 * s * Math.cos(a0 + 3.3), y + 50 * s * Math.sin(a0 + 3.3), 24 * s, 9 * s, a0 + 3.3);
        g.fillStyle = c[1]; for (let p = 0; p < 6; p++) { const a = a0 + (p * TAU) / 6; ell(g, x + 24 * s * Math.cos(a), y + 24 * s * Math.sin(a), 24 * s, 14 * s, a); }
        g.fillStyle = mix(c[1], c[0], 0.35); for (let p = 0; p < 6; p++) { const a = a0 + ((p + 0.5) * TAU) / 6; ell(g, x + 13 * s * Math.cos(a), y + 13 * s * Math.sin(a), 13 * s, 7 * s, a); }
        g.fillStyle = c[2]; dot(g, x, y, 9 * s);
      } });
    } },
    { id: 'pantera', name: 'Panterka', tile: 22, draw: (g, N, c) => {
      bg(g, N, c[0]); g.lineCap = 'round';
      wrap(g, N, () => { const q = rng(5); for (let k = 0; k < 58; k++) {
        const x = q() * N, y = q() * N, r = 9 + q() * 8, rot = q() * TAU;
        g.fillStyle = mix(c[0], c[2], 0.4); ell(g, x, y, r, r * 0.75, rot);
        g.strokeStyle = c[2]; g.lineWidth = 6 + q() * 3; const n = 2 + (q() > 0.5 ? 1 : 0); for (let p = 0; p < n; p++) { const a = rot + (p * TAU) / n + q(); g.beginPath(); g.ellipse(x, y, r + 3, r * 0.75 + 3, rot, a, a + 1.2 + q() * 0.5); g.stroke(); }
      } });
    } },
    { id: 'zebra', name: 'Zebra', tile: 22, px: (x, y) => (Math.sin(TAU * (y * 8) / 512 + 1.6 * Math.sin((TAU * x * 2) / 512 + 1) + 0.9 * Math.sin((TAU * (x + y) * 3) / 512)) > 0 ? 1 : 2) },
    { id: 'batik', name: 'Batik', tile: 30, px: (x, y) => 1 + 0.5 * Math.sin((TAU * (x + 2 * y)) / 512 + 2 * Math.sin((TAU * y) / 512)) + 0.5 * Math.sin((TAU * (3 * x - y)) / 512 + 1.7 * Math.sin((TAU * 2 * x) / 512)) },
  ];

  function render(id, colA, colB, N) {
    const p = LIST.find((q) => q.id === id), c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), cols = [colA, colB, mix(colA, '#0b0b12', 0.55)];
    if (!p) { bg(g, N, colA); return c; }
    if (p.draw) p.draw(g, N, cols);
    else {
      const im = g.createImageData(N, N), k = 512 / N, C = cols.map(rgb);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = Math.max(0, Math.min(2, p.px(Math.floor(x * k), Math.floor(y * k)))), i = Math.min(1, Math.floor(v)), t = v - i, q = (y * N + x) * 4;
        for (let ch = 0; ch < 3; ch++) im.data[q + ch] = C[i][ch] + (C[i + 1][ch] - C[i][ch]) * t;
        im.data[q + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    }
    return c;
  }
  root.WykrojPrints = { LIST, render };
})(window);
