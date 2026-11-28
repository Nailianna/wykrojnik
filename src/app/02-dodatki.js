  // ---------- dodatki opisowe: prostokąty liczone z wykroju, dodawane ręcznie albo z analizy zdjęcia ----------
  const EXB = { dekolt: 'długości dekoltu', talia: 'obwodu talii', biust: 'obwodu biustu', biodra: 'obwodu bioder', dol: 'obwodu dołu', pacha: 'obwodu pachy', rekaw: 'dołu rękawa', stala: 'wpisana w centymetrach' };
  function exClean(o) {
    if (!o || typeof o !== 'object') return null; const name = String(o.name || o.nazwa || '').replace(/[<>]/g, '').trim().slice(0, 40), base = String(o.base || o.baza || '');
    if (!name || !(base in EXB)) return null; const num = (v, lo, hi, df) => (isFinite(+v) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, +v)) : df);
    return { name: name.charAt(0).toUpperCase() + name.slice(1), base, k: num(o.k != null ? o.k : o.mnoznik, 0.2, 4, 1), plus: num(o.plus, 0, 300, 0), w: num(o.w != null ? o.w : o.szerokosc, 1, 60, 5), n: Math.round(num(o.n != null ? o.n : o.ile, 1, 8, 1)), note: String(o.note || o.opis || '').replace(/[<>]/g, '').slice(0, 140) };
  }
  for (const k of ['stala'].concat(Object.keys(EXB).filter((x) => x !== 'stala'))) { const o = document.createElement('option'); o.value = k; o.textContent = k === 'stala' ? EXB[k] : 'liczona z ' + EXB[k]; $('exBase').append(o); }
  const exBaseUi = () => { const fix = $('exBase').value === 'stala'; $('exK').closest('label').hidden = fix; $('exPlus').closest('label').querySelector('span').textContent = fix ? 'Długość (cm)' : 'Dodatkowa długość'; }; $('exBase').value = 'stala'; $('exBase').addEventListener('change', exBaseUi); exBaseUi();
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
