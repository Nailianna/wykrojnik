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
    $('rozpOn').addEventListener('change', () => { state.p.rozp = $('rozpOn').checked ? 15 : 0; fillForm(); persist(); draw(true); });
    { // krótkie objaśnienia przy polach, których nazwa sama nie wystarcza
      const TIPS = { 'Wysokość bioder': 'Odległość w pionie od talii do najszerszego miejsca bioder. Zwykle 18 do 22 cm.', 'Podwinięcie dołu': 'Ile centymetrów tkaniny zawijasz pod spód na dole.', 'Układ ciasny': 'Elementy leżą bliżej siebie, więc wydruk ma mniej stron, ale trudniej je rozciąć.', 'Szerokość odszycia': 'Szerokość paska tkaniny, który wykańcza dekolt i pachy od środka.', 'Dekolt głębokość przód': 'Mierzona w dół od dołka między obojczykami.', 'Przy kolanie': 'Obwód spódnicy na wysokości kolan. Im mniejszy, tym krótszy krok.' };
      document.querySelectorAll('label.f > span:first-child, .f2 > span:first-child, label.chk').forEach((sp) => { const t = TIPS[(sp.textContent || '').trim()]; if (!t) return; const q = mkEl('span'); q.className = 'tip'; q.tabIndex = 0; q.textContent = '?'; q.dataset.tip = t; q.setAttribute('aria-label', t); sp.appendChild(q); }); }
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
    SL.push(['rekL', 'Długość rękawa', 12, 75, 'rekLen'], ['bok', 'Zwężenie ramienia', 0, 12, 'straps'], ['ramW', 'Szerokość ramiączka', 0.5, 4, 'ram'], ['kolW', 'Szerokość kołnierza', 2, 12, 'kol']);
    for (const [k, name, mn, mx, cond] of /** @type {any[][]} */ (SL)) {
      // suwak siedzi w panelu Dopasowanie pod polem z liczbą; wartość bez własnego pola dostaje cały wiersz
      const num = $('p_' + k), host = num ? num.closest('label') : null, o = mkEl('output'), i = mkEl('input');
      o.id = 'o_' + k; i.type = 'range'; i.min = mn; i.max = mx; i.step = 0.5; i.id = 's_' + k; i.setAttribute('aria-label', name);
      if (host) { i.className = 'rg'; o.hidden = true; host.append(i, o); } else { const l = mkEl('label'), top = mkEl('span'); l.className = 'sl'; top.append(name, o); l.append(top, i); $('zakSl').appendChild(l); }
      i.addEventListener('input', () => { state.p[k] = parseFloat(i.value); { const num = $('p_' + k); if (num) num.value = state.p[k]; } o.textContent = f1(state.p[k]) + ' cm';
        if (k === 'bok' && state.p.bok > 0 && state.p.rek && state.p.rek !== 'brak') { state.p.rek = 'brak'; state.p.falR = false; fillForm(); } // odsłonięte ramiona wykluczają rękawy
        persist(); drawSoon(); });
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
    for (const [lab, std] of [['Rozmiary standardowe', true], ['Własne modelki', false]]) { const list = state.profiles.filter((x) => !!x.std === std); if (!list.length) continue; const g = document.createElement('optgroup'); g.label = String(lab); for (const pr of list) { const o = document.createElement('option'); o.value = pr.id; o.textContent = pr.name || 'Bez imienia'; g.appendChild(o); } sel.appendChild(g); }
    sel.value = cur().id; fillGallery();
    { const lock = !!cur().std; document.querySelectorAll('[data-sec=modelka] input, #braB, #braC').forEach((e) => { /** @type {HTMLInputElement} */ (e).disabled = lock; }); $('stdNote').hidden = !lock; setTimeout(() => document.querySelectorAll('#adv input').forEach((e) => { /** @type {HTMLInputElement} */ (e).disabled = !!cur().std; }), 0); }
    $('m_name').value = cur().name;
    MF.forEach((k) => ($('m_' + k).value = cur()[k]));
    { const mn = dlMin(); if (!(state.p.dl >= mn)) state.p.dl = Math.max(mn, 58); $('p_dl').min = mn; $('s_dl').min = mn; $('s_dl').max = mn < 0 ? Math.max(70, state.p.dl) : 130; } // top może kończyć się nad talią, rybka potrzebuje długości
    if (['krotki', '34', 'dlugi'].includes(state.p.rek) && !(state.p.rekL >= 12)) state.p.rekL = rekDef(state.p.rek); // starsze projekty: długość rękawa z rodzaju
    PF.forEach((k) => { $('p_' + k).value = state.p[k]; syncSl(k); });
    fillAdv();
    $('delP').hidden = !!cur().std; $('delP').textContent = 'Usuń';
    const fl = state.style === 'pusty' ? {} : flags();
    document.querySelectorAll('[data-if]').forEach((el) => (el.hidden = !fl[el.dataset.if]));
    $('dolSec').textContent = state.style.indexOf('to_') === 0 ? 'Długość' : 'Dół'; $('dopEmpty').hidden = state.style !== 'pusty'; $('szwyBox').hidden = state.style === 'pusty' || state.style === 'import';
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
      $('fOpts').hidden = state.style === 'pusty' || state.style === 'import';
      const s = state.style, ryb = s === 'su_rybka', emp = s === 'su_empire', pri = s === 'su_princeska', dk = state.p.dol;
      const cur = ryb ? String(state.p.ff === 0.5 || state.p.ff === 2 ? state.p.ff : 1) : emp || pri ? (dk === 'kolo2' ? '2' : dk === 'kolo' ? '1' : dk === 'polkole' ? '0.5' : emp ? 't' : 'p') : s === 'su_zakl' ? 'z' : s === 'su_2kola' ? '2' : s === 'su_kolo' ? '1' : s === 'su_polkole' ? '0.5' : s === 'su_trapez' ? 't' : 'p';
      $('dolK').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === cur));
      $('dolZ').hidden = ryb || emp || pri; $('dolP').hidden = ryb || emp; $('dolT').hidden = ryb || pri; $('dolP').textContent = pri ? 'Z paneli' : 'Prosty'; $('dolH').textContent = ryb ? 'Krój falbany' : 'Krój dołu';
    }
    impFill(); // na końcu: wykrój z pliku chowa galerie fasonów, które blok wyżej właśnie pokazał
    document.querySelectorAll('[data-pb]').forEach((c) => (c.checked = !!state.p[c.dataset.pb]));
    { // ściągacz pod biustem ma sens tylko w topie na ramiączkach; rozporek jest przełącznikiem z długością
      const sc = /** @type {HTMLElement} */ (document.querySelector('[data-pb=sciag]').closest('label')), okS = state.style === 'to_ramiaczka'; sc.hidden = !okS; if (!okS && state.p.sciag) state.p.sciag = false;
      $('rozpOn').checked = state.p.rozp > 0; /** @type {HTMLElement} */ ($('p_rozp').closest('label')).hidden = !(state.p.rozp > 0) || $('rozpOn').closest('label').hidden; }
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
