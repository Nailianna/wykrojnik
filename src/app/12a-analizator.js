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
    no_channel: 'Analiza działa po otwarciu Wykrojnika w Claude. Tutaj możesz wczytać wykrój bez analizy.',
  };
  // jedno miejsce, przez które idzie każde pytanie do Claude; reszta analizatora nie wie, którą drogą
  async function anLimit() { if (window.__anFake) return 8; if (!sampleFn) return 0; const l = await sampleFn.limits().catch(() => null); return l && l.images ? l.images.maxCount : 0; }
  async function anAsk(prompt, blobs, signal) {
    if (window.__anFake) return window.__anFake(prompt, blobs);
    if (!sampleFn) throw { code: 'no_channel' };
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
      'Obrazy po kolei: ' + shots.map((s, i) => (i + 1) + ') strona ' + s.pn + (s.part ? ', ' + s.part : '')).join('; ') + '.' + (st.cut ? ' Plik ma więcej stron, niż mogę wysłać; dalsze strony znasz tylko z listy konturów i napisów.' : ''),
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
  function anOpen() { anSt = { sheet: null, instr: null }; $('anSheet').value = ''; $('anInstr').value = ''; $('anSheetN').textContent = ''; $('anInstrN').textContent = ''; $('anRes').hidden = true; $('anStat').textContent = ''; $('anGo').disabled = true; $('anRaw').disabled = true; $('anStop').hidden = true; $('anBox').hidden = false; }
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
      const np = st.data.pages.length, tiles = np * 2 <= max ? 2 : 1, marks = st.pieces.reduce((a, pc, i) => a.concat(pc.marks.map((m) => ({ id: 'k' + (i + 1), pn: m.pn, x: m.x, y: m.y }))), []);
      let shots = await window.PatImport.shots(st.sheet, marks, tiles); st.cut = shots.length > max; shots = shots.slice(0, max);
      if (anCtl.signal.aborted) throw { code: 'cancelled' };
      busySet(bz, 'Claude ogląda arkusz i opisuje elementy (krok 3 z 3). To zwykle trwa od pół minuty do dwóch minut.');
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
  const anPick = (inp, lab, key) => inp.addEventListener('change', () => { const f = inp.files[0] || null; if (!anSt) return; anSt[key] = f; lab.textContent = f ? f.name : ''; if (key === 'sheet') { anSt.data = null; anSt.res = null; $('anRes').hidden = true; $('anGo').disabled = !f; $('anRaw').disabled = !f; $('anStat').textContent = f && !sampleFn && !window.__anFake ? AN_ERR.no_channel : ''; } else if (anSt.res) $('anStat').textContent = f ? 'Instrukcja dołączona. Przeanalizuj wykrój jeszcze raz, żeby ją uwzględnić.' : ''; });
  anPick($('anSheet'), $('anSheetN'), 'sheet'); anPick($('anInstr'), $('anInstrN'), 'instr');
  $('anGo').addEventListener('click', anRun); $('anRaw').addEventListener('click', anRaw); $('anStop').addEventListener('click', () => { if (anCtl) anCtl.abort(); });
  $('anSaveB').addEventListener('click', anSave); $('anX').addEventListener('click', anClose); $('anPrz').addEventListener('click', () => { anClose(); przOpen(); });
  $('hPdf').addEventListener('click', anOpen);
