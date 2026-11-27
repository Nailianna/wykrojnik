  // ---------- inspiracja: zdjęcie -> propozycja fasonu i parametrów (Claude) ----------
  let sampleFn = null, inBlob = null, inCtl = null, inLast = null;
  const NK = ['okragly', 'v', 'karo', 'serce', 'lodka'], NKN = { okragly: 'okrągły', v: 'V', karo: 'karo', serce: 'serce', lodka: 'łódka' };
  const LIM = { gr: [0, 15], gh: [5, 14], gd: [5, 16], dl: [25, 130], flare: [-6, 30], kn: [35, 90], gf: [2, 30], nd: [-4, 24], nw: [0, 9], nb: [0, 30], luzG: [-10, 16], luzT: [-8, 12], luzB: [-12, 16] };
  function inspPrompt() {
    const m = cur(), H = m.wzrost;
    return [
      'Jesteś konstruktorką odzieży. Na zdjęciu jest ubranie, które użytkowniczka chce odtworzyć w programie do wykrojów. Opisuj wyłącznie ubranie, nigdy osobę.',
      'Program umie tylko poniższe fasony (id: opis):',
      'sk_prosta: spódnica prosta z zaszewkami; sk_olowkowa: spódnica ołówkowa, zwężana; sk_trapez: spódnica trapezowa; sk_polkole: spódnica z półkola; sk_kolo: spódnica z koła; sk_2kola: spódnica z dwóch kół, bardzo obfita;',
      'su_dopasowana: sukienka dopasowana z zaszewkami; su_trapez: sukienka w literę A; su_princeska: sukienka z cięciami princeski; su_empire: sukienka odcinana pod biustem; su_rybka_kliny: rybka z klinów od kolan; su_rybka: rybka z falbaną z koła od kolan; su_polkole: sukienka odcinana w talii, dół z półkola; su_kolo: sukienka odcinana w talii, dół z koła; su_2kola: odcinana w talii, dół z dwóch kół; to_stanik: sam top dopasowany do talii.',
      'Każda sukienka może być z ramionami albo bez ramiączek (parametr gora: "ramiona" albo "bez"; przy "bez" bk = "prosta", "luk" (łagodnie zaokrąglona w dół) albo "serce" to kształt górnej krawędzi, bh = jej wysokość nad linią biustu 2-12). Sukienki i topy mają zamek w szwie tyłu. go_pod: gorset pod biust z paneli, sznurowany z tyłu (parametry: gr = redukcja talii 0-15, gh = wysokość nad talią 5-14, gd = długość pod talią z przodu 5-16). go_nad: gorset nad biust z paneli, bez osobnych miseczek (bk = "prosta" albo "serce" to kształt górnej krawędzi; gr, gd oraz bh = wysokość górnej krawędzi nad linią biustu 2-12). to_tshirt i to_tshirt_k: t-shirt z dzianiny z długim albo krótkim rękawem, bez zaszewek; parametr fit = "slim", "regular" albo "oversize". su_empire i su_princeska mogą mieć dół z koła zamiast własnego: parametr dol = "polkole", "kolo" albo "kolo2" (puste = dół własny). to_tshirt_s: dopasowany top z dzianiny bez rękawów ze stójką (kol = "stojka", kolW = wysokość stójki 2-12). T-shirty też mogą mieć kol = "stojka" (półgolf). Program nie ma gorsetów z miseczkami, rękawów raglanowych i kimonowych, drapowań, asymetrii, kieszeni wszywanych ani spodni.',
      'Parametry (cm): dl = długość od talii w dół (25-130, rybki od 50); flare = poszerzenie dołu na każdym szwie, ujemne zwęża (-6 do 30, tylko fasony bez koła); kn = wysokość kolan od talii dla rybek (35-90); gf = rozkloszowanie klina na szwie dla su_rybka_kliny (2-30);',
      'nk = kształt dekoltu z przodu: okragly, v, karo, serce, lodka; nd = głębokość dekoltu z przodu poniżej podstawy szyi (-4 do 24, podstawowy to 0, linia biustu wypada około 18); nw = poszerzenie dekoltu wzdłuż ramienia (0-9); nkb = kształt z tyłu: okragly albo v; nb = głębokość dekoltu z tyłu (0-30);',
      'luzG, luzT, luzB = luz w biuście, talii, biodrach (dopasowane 2-4, luźne 6-12, elastyczna dzianina ujemny).',
      'Modelka ma ' + H + ' cm wzrostu: kolano wypada przy dl około ' + Math.round(H * 0.335) + ', połowa łydki około ' + Math.round(H * 0.46) + ', kostka około ' + Math.round(H * 0.58) + ', podłoga ' + Math.round(H * 0.62) + '.',
      'Tkaniny (id): szyfon, wiskoza, dzersej, bawelna, welna, tafta, tiul. Wzory (id): gladka, ' + P.LIST.map((q) => q.id).join(', ') + '.',
      'Odpowiedz wyłącznie jednym obiektem JSON, po polsku, w tym kształcie:',
      '{"opis": "1-2 zdania o ubraniu ze zdjęcia", "propozycje": [{"fason": "id", "dopasowanie": 0-100, "dlaczego": "1-2 zdania", "parametry": {"gora": "", "bk": "", "bh": 0, "dl": 0, "flare": 0, "kn": 0, "gf": 0, "nk": "", "nd": 0, "nw": 0, "nkb": "", "nb": 0, "luzG": 0, "luzT": 0, "luzB": 0, "rek": "", "mank": false, "falR": false, "falN": false, "bok": 0, "ram": "", "sciag": false, "marsz": false, "tren": 0, "rozp": 0, "kop": false, "kol": "", "pasT": 0, "ff": 1}, "tkanina": "id", "wzor": "id", "kolor": "#rrggbb", "kolor2": "#rrggbb", "roznice": ["czego ten wykrój nie odda, krótko"]}], "braki": ["elementy ze zdjęcia, których program w ogóle nie obsługuje"]}',
      'Topy to_klasyczny, to_bokserka i to_ramiaczka mają dl od -10 do 70: 25 to długość do bioder, 0 to dół w talii, wartości ujemne to crop top kończący się nad talią. ' +
      'Dodatkowe parametry sukienek i topów: rek = "brak", "krotki", "34", "dlugi" albo "bufka" (rękawy wszywane, bufka to krótki bufiasty; tylko przy gora "ramiona"), mank = true (mankiet przy rękawie 3/4), falR = true (falbanka przy dole rękawa), falN = true (falbanka przy dekolcie), bok = o ile cm zwęzić ramię od strony barku, 0-12 (odsłonięte ramiona jak w bokserce, bez rękawów), ram = "brak", "cienkie" albo "szyja" (ramiączka przy gora "bez": zwykłe albo wiązane na szyi), sciag = true (ściągacz na gumce pod biustem), marsz = true (marszczony stanik zamiast zaszewek, tylko fasony odcinane w talii i to_stanik), tren = wydłużenie tyłu w cm 0-80 (tylko su_dopasowana, su_trapez, su_zakl), rozp = rozporek z tyłu w cm 0-40 (spódnice sk_prosta, sk_olowkowa, sk_trapez oraz su_dopasowana i su_trapez), ff = 0.5, 1 albo 2 (z ilu kół jest falbana w su_rybka), kop = true (przód kopertowy, tylko fasony odcinane w talii i to_stanik), kol = "brak", "stojka", "bebe" albo "szal" (szalowy tylko razem z kop), pasT = szerokość paska w talii w cm (tylko fasony odcinane w talii). Fason su_zakl to sukienka odcinana w talii z dołem z zakładek. Topy: to_klasyczny, to_bokserka, to_ramiaczka, to_tshirt, to_tshirt_k. ' +
      'Jeśli na zdjęciu jest element, który da się uszyć z prostokąta (falbana, pasek, szarfa, kokarda, wiązanie, lamówka, kieszeń nakładana, patka), a program go nie ma, podaj przepis w polu "dodatki": [{"nazwa": "krótka nazwa", "baza": "dekolt" | "talia" | "biust" | "biodra" | "dol" | "pacha" | "rekaw" | "stala", "mnoznik": od 0.2 do 4 (1.8 dla marszczonej falbany), "plus": centymetry dodane do długości, "szerokosc": gotowa szerokość w cm, "ile": liczba sztuk, "opis": "jedno zdanie, gdzie i jak przyszyć"}]. Długość elementu to baza razy mnoznik plus plus. Takich elementów nie wpisuj już do "braki". ' +
      'W polu "braki" wypisz każdy element konstrukcyjny widoczny na zdjęciu, którego program nie ma, krótko i w mianowniku, na przykład "rękawy 3/4 z mankietami", "kołnierz szalowy", "zakładki w talii". ' +
      'Podaj dokładnie jedną propozycję: fason, który jest najbliżej zdjęcia. Pomiń parametry, które danego fasonu nie dotyczą. "dopasowanie" oceń uczciwie: jeśli zdjęcie pokazuje coś, czego program nie umie (na przykład płaszcz albo spodnie), daj niską wartość i napisz to w "braki". Jeśli na zdjęciu nie ma ubrania, zwróć pustą listę propozycji.',
    ].join('\n');
  }
  function inspRender(res, fresh) {
    const box = $('inRes'); box.textContent = '';
    const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
    if (res.opis) box.append(el('p', String(res.opis)));
    const props = Array.isArray(res.propozycje) ? res.propozycje.filter((q) => q && W.STYLES.some((s) => s.id === q.fason)).slice(0, 1) : []; // jedna propozycja: fason najbliższy zdjęciu
    if (!props.length) box.append(el('p', 'Nie znalazłam fasonu, który sensownie to odda.'));
    props.forEach((q, i) => {
      const st = W.STYLES.find((s) => s.id === q.fason), card = el('div', null, 'prop' + (i ? ' alt' : '')), hd = el('h4', GRP[st.group] + st.name);
      if (isFinite(q.dopasowanie)) hd.append(el('span', Math.round(Math.max(0, Math.min(100, q.dopasowanie))) + '%'));
      card.append(hd); if (q.dlaczego) card.append(el('p', String(q.dlaczego)));
      const pr = q.parametry || {}, tags = el('div', null, 'tags'), tag = (t) => tags.append(el('span', t));
      if (isFinite(pr.dl)) tag('długość ' + f1(+pr.dl) + ' cm');
      if (NK.includes(pr.nk) && st.group === 'Sukienki') tag('dekolt ' + NKN[pr.nk] + (isFinite(pr.nd) ? ' ' + f1(+pr.nd) + ' cm' : ''));
      if (isFinite(pr.nb) && +pr.nb > 2) tag('tył ' + f1(+pr.nb) + ' cm');
      const flv = Math.max(-6, Math.min(30, +pr.flare));
      if (isFinite(pr.flare) && flv && !/kol|polkole|kliny/.test(st.id)) tag((flv > 0 ? 'poszerzenie ' : 'zwężenie ') + f1(Math.abs(flv)) + ' cm');
      if (FAB[q.tkanina]) tag(FAB[q.tkanina].name.toLowerCase());
      const prn = P.LIST.find((x) => x.id === q.wzor); if (prn) tag(prn.name.toLowerCase());
      card.append(tags);
      if (Array.isArray(q.roznice) && q.roznice.length) { const ul = el('ul'); q.roznice.slice(0, 5).forEach((t) => ul.append(el('li', String(t)))); card.append(ul); }
      const b = el('button', 'Zastosuj na manekinie'); b.addEventListener('click', () => inspApply(q, st)); card.append(b); box.append(card);
    });
    const exs = inspExtras(res);
    if (exs.length) { // dodatki, które da się uszyć z prostokąta: trafią do projektu razem z propozycją
      const wrap = el('div', null, 'prop alt'); wrap.append(el('h4', 'Dodatki, które dołożę z prostokątów'));
      const ul = el('ul'); exs.forEach((ex) => ul.append(el('li', ex.name + ': ' + (ex.base === 'stala' ? 'długość ' + f1(ex.plus) + ' cm' : ex.k.toFixed(1).replace('.', ',') + ' × ' + EXB[ex.base] + (ex.plus ? ' + ' + f1(ex.plus) + ' cm' : '')) + ', szerokość ' + f1(ex.w) + ' cm' + (ex.note ? '. ' + ex.note : '')))); wrap.append(ul);
      wrap.append(el('p', 'Wejdą do projektu po kliknięciu „Zastosuj na manekinie”. Zmienisz je w Fasonie.')); box.append(wrap);
    }
    // brakujące elementy konstrukcyjne: z różnic najlepszej propozycji i z listy braków, z pytaniem o dopisanie do bazy
    const miss = [], seen = new Set(), take = (t) => { const c = wishClean(t); if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); miss.push(c); } };
    if (Array.isArray(res.braki)) res.braki.forEach(take);
    if (!miss.length && props[0] && Array.isArray(props[0].roznice)) props[0].roznice.filter((t) => /^\s*brak/i.test(String(t))).forEach(take);
    if (miss.length) {
      // świeża analiza sama dopisuje braki do listy, która trafia do Claude; przy otwarciu z historii tylko je pokazuje
      let added = 0; if (fresh) for (const t of miss.slice(0, 8)) if (!state.wish.some((w) => w.t.toLowerCase() === t.toLowerCase())) { state.wish.push({ t, at: Date.now() }); added++; }
      if (added) { persist(true); wishFill(); wishSync(); }
      const wrap = el('div', null, 'prop alt'); wrap.append(el('h4', 'Tych elementów program jeszcze nie ma'));
      const ul = el('ul'); miss.slice(0, 8).forEach((t) => ul.append(el('li', t))); wrap.append(ul);
      wrap.append(el('p', dbRef ? 'Program nie umie ich jeszcze narysować. Żeby je dostać, napisz w rozmowie z Claude o Wykrojniku: dodaj braki z listy.' : 'Program nie umie ich jeszcze narysować. Lista jest na dole tego panelu: skopiuj ją i wklej w rozmowie z Claude.'));
      box.append(wrap);
    }
    $('inMoreBox').hidden = false;
  }
  // lista elementów konstrukcyjnych do dodania do bazy: zbiera braki z Inspiracji, żeby można je było przekazać do zrobienia
  // brak, który da się uszyć z prostokąta, zamienia się w dodatek do projektu, zamiast czekać na liście
  function exFromText(t) {
    const c = String(t || '').trim().replace(/^brak\s+/i, '').replace(/[.;]+$/, ''), l = c.toLowerCase(); if (c.length < 3 || c.length > 90 || wishDone(c)) return null;
    const nm = c.length > 40 ? c.slice(0, 41).replace(/\s+\S*$/, '').replace(/\s+(i|oraz|z|ze)(\s+\S+)?$/, '') : c, mk = (base, k, plus, w, n, note) => exClean({ name: nm, base, k, plus, w, n, note });
    if (/falban|wolant/.test(l)) return mk(/dekol/.test(l) ? 'dekolt' : /rękaw|rekaw/.test(l) ? 'rekaw' : /tali/.test(l) ? 'talia' : 'dol', 1.8, 0, 10, 1, 'Zmarszcz i doszyj wzdłuż krawędzi.');
    if (/pasek|pas |szarf|kokard|wiąz|wiaz|troczk/.test(l)) { const tie = /kokard|wiąz|wiaz|szarf|troczk|długi/.test(l); return mk('talia', 1, tie ? (/długi/.test(l) ? 160 : 110) : 4, /szarf|szerok/.test(l) ? 8 : 5, 1, tie ? 'Zawiąż w talii na kokardę.' : 'Zapnij albo przyszyj w talii.'); }
    if (/lamówk|lamowk|wypustk/.test(l)) return mk(/pach/.test(l) ? 'pacha' : 'dekolt', 1, 3, 2, 1, 'Obszyj krawędź.');
    if (/kiesze\S* nakładan/.test(l)) return mk('stala', 1, 16, 17, 2, 'Naszyj na przodzie.');
    if (/patk/.test(l)) return mk('stala', 1, 14, 5, 2, 'Naszyj nad kieszenią albo na ramieniu.');
    return null;
  }
  // dodatki z analizy: przepisy od Claude i braki, które same zamieniły się w prostokąty
  function inspExtras(res) {
    const out = (res && Array.isArray(res.dodatki) ? res.dodatki : []).map(exClean).filter(Boolean), seen = new Set(out.map((x) => x.name.toLowerCase()));
    let br = res && Array.isArray(res.braki) ? res.braki : []; const p0 = res && Array.isArray(res.propozycje) ? res.propozycje[0] : null; if (p0 && Array.isArray(p0.roznice)) br = br.concat(p0.roznice.filter((t) => /^\s*brak/i.test(String(t))));
    for (const t of br) { const ex = exFromText(t); if (ex && !seen.has(ex.name.toLowerCase()) && !out.some((o) => o.base === ex.base && /pasek|szarf|kokard|wiąz/i.test(o.name) === /pasek|szarf|kokard|wiąz/i.test(ex.name))) { seen.add(ex.name.toLowerCase()); out.push(ex); } }
    return out.slice(0, 6);
  }
  // elementy, które program już ma, nie trafiają na listę braków, a stare wpisy znikają z niej same
  function wishDone(c) { return /bufiast|bufk|marszczon\w* stanik|falbank\w* przy (dekol|rękaw)|ściągacz|sciagacz|^tren\b|rozpor|ramiączk|crop|mankiet|kołnierz szalowy|stójk|kopert|zakładki/i.test(c); }
  function wishClean(t) { let c = String(t || '').trim().replace(/^brak\s+/i, '').replace(/[.;]+$/, ''); if (c.length < 3 || c.length > 90 || wishDone(c) || exFromText(c)) return ''; return c.charAt(0).toUpperCase() + c.slice(1); }
  // lista braków żyje też w bazie artefaktu (dokument wishes/list): stamtąd czyta ją Claude, a po dodaniu elementów czyści
  let dbRef = null, wishBusy = Promise.resolve();
  function wishSync() {
    if (!dbRef) return; const body = { items: state.wish.slice(0, 60).map((w) => ({ t: String(w.t).slice(0, 90), at: w.at || 0 })), updated: Date.now() };
    wishBusy = wishBusy.then(() => dbRef.doc('wishes/list').set(body)).catch(() => {}); wishFill();
  }
  async function wishPull() {
    try {
      const snapD = await dbRef.doc('wishes/list').get();
      if (snapD.exists) { const it = (snapD.data() || {}).items; if (Array.isArray(it)) { state.wish = it.filter((w) => w && typeof w.t === 'string' && wishClean(w.t)).map((w) => ({ t: wishClean(w.t), at: +w.at || 0 })); persist(true); if (state.wish.length !== it.length) wishSync(); } }
      else if (state.wish.length) wishSync();
    } catch (e) { /* bez bazy lista zostaje lokalna */ }
    wishFill();
  }
  function wishFill() {
    if (!Array.isArray(state.wish)) state.wish = [];
    { const n0 = state.wish.length; state.wish = state.wish.filter((w) => w && wishClean(w.t)); if (state.wish.length !== n0) persist(true); }
    const box = $('wish'); box.textContent = ''; $('wishBox').hidden = !state.wish.length || !!dbRef; // gdy lista zapisuje się sama, nie ma czym zarządzać, więc jej nie pokazuję
    state.wish.forEach((w, i) => { const row = document.createElement('div'), sp = document.createElement('span'), x = document.createElement('button'); row.className = 'wrow'; sp.textContent = w.t; x.textContent = 'Usuń'; x.addEventListener('click', () => { state.wish.splice(i, 1); persist(true); wishFill(); wishSync(); }); row.append(sp, x); box.append(row); });
    $('wishStat').textContent = dbRef ? 'Lista zapisuje się sama. W rozmowie z Claude wystarczy napisać: dodaj braki z listy.' : 'Lista jest zapisana tylko w tej aplikacji. Skopiuj ją i wklej w rozmowie z Claude.'; $('wishCopy').hidden = !!dbRef;
    $('wishTxt').value = state.wish.length ? 'Elementy do dodania do Wykrojnika:\n' + state.wish.map((w) => '- ' + w.t).join('\n') : '';
  }
  $('wishCopy').addEventListener('click', async () => {
    const ta = $('wishTxt'); ta.hidden = false; ta.focus(); ta.select();
    try { await navigator.clipboard.writeText(ta.value); say('Lista skopiowana. Wklej ją w rozmowie z Claude.'); ta.hidden = true; }
    catch (e) { try { if (document.execCommand('copy')) { say('Lista skopiowana. Wklej ją w rozmowie z Claude.'); ta.hidden = true; return; } } catch (e2) {} say('Zaznaczyłam listę, skopiuj ją skrótem ⌘C.'); }
  });
  function inspApply(q, st) {
    const p = state.p, pr = q.parametry || {};
    state.sel = {}; state.style = st.id; p.flare = st.flare || 0; if (st.dl) p.dl = st.dl; else if (dlMin() >= 25 && !(p.dl >= 25)) p.dl = 58;
    Object.assign(p, { tren: 0, rozp: 0, pasT: 0, falN: false, falR: false, marsz: false, sciag: false, kop: false, mank: false, bok: 0, rek: 'brak', kol: 'brak', ram: 'brak', gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 0, nw: 0, nb: 0, ff: 1, bk: 'prosta', luzG: 4, luzT: 1, luzB: 2 }, st.preset || {});
    for (const k in LIM) if (isFinite(pr[k]) && pr[k] !== null && pr[k] !== '') p[k] = Math.round(Math.max(LIM[k][0], Math.min(LIM[k][1], +pr[k])) * 2) / 2;
    if (dlMin() < 0 && isFinite(pr.dl) && pr.dl !== null && pr.dl !== '') p.dl = Math.round(Math.max(-10, Math.min(70, +pr.dl)) * 2) / 2;
    if (['serce', 'luk', 'prosta'].includes(pr.bk)) p.bk = pr.bk;
    p.dol = ['polkole', 'kolo', 'kolo2'].includes(pr.dol) && (st.id === 'su_empire' || st.id === 'su_princeska') ? pr.dol : '';
    if (st.id.indexOf('to_tshirt') === 0) { const f = st.id === 'to_tshirt_s' ? 'slim' : ['slim', 'regular', 'oversize'].includes(pr.fit) ? pr.fit : 'regular'; p.fit = f; if (!isFinite(pr.luzG) || pr.luzG === null) Object.assign(p, f === 'slim' ? { luzG: -4, luzT: 0, luzB: -4 } : f === 'oversize' ? { luzG: 16, luzT: 12, luzB: 14 } : { luzG: 6, luzT: 8, luzB: 4 }); state.fabric = 'dzersej'; }
    p.extras = inspExtras(inLast);
    const bool = (v) => v === true || v === 'true', cm = (v, lo, hi) => (isFinite(v) && v !== null && v !== '' ? Math.round(Math.max(lo, Math.min(hi, +v)) * 2) / 2 : 0), fl0 = flags();
    if (st.id === 'to_ramiaczka') p.gora = 'bez'; else if (pr.gora === 'bez' || pr.gora === 'ramiona') p.gora = fl0.dress ? pr.gora : 'ramiona';
    if (p.gora === 'bez') { if (['brak', 'cienkie', 'szyja'].includes(pr.ram)) p.ram = pr.ram; if (st.id === 'to_ramiaczka' && p.ram === 'brak') p.ram = 'cienkie'; if (p.luzG > 0) p.luzG = 0; }
    else { p.ram = 'brak'; if (fl0.dress && ['krotki', '34', 'dlugi', 'bufka'].includes(String(pr.rek))) p.rek = String(pr.rek); p.rekL = ['krotki', '34', 'dlugi'].includes(p.rek) ? rekDef(p.rek) : 0; p.mank = bool(pr.mank) && p.rek === '34'; if (p.rek === 'brak') p.bok = Math.max(p.bok, cm(pr.bok, 0, 12)); else p.bok = 0; p.falN = bool(pr.falN) && fl0.dress; p.falR = bool(pr.falR) && p.rek !== 'brak'; }
    p.sciag = bool(pr.sciag) && fl0.dress; p.marsz = bool(pr.marsz) && (ODC.includes(st.id) || st.id === 'to_stanik') && p.gora !== 'bez'; if (fl0.tren) p.tren = cm(pr.tren, 0, 80); if (fl0.rozp) p.rozp = cm(pr.rozp, 0, 40); if ([0.5, 1, 2].includes(+pr.ff)) p.ff = +pr.ff;
    p.kop = pr.kop === true && p.gora !== 'bez' && (ODC.includes(st.id) || st.id === 'to_stanik'); p.kol = p.kop ? (pr.kol === 'szal' ? 'szal' : 'brak') : (pr.kol === 'stojka' || pr.kol === 'bebe' ? pr.kol : 'brak'); p.kolW = p.kol === 'szal' ? 7 : p.kol === 'bebe' ? 6 : 3; p.pasT = ODC.includes(st.id) && isFinite(pr.pasT) && +pr.pasT >= 2 ? Math.min(12, Math.round(+pr.pasT * 2) / 2) : 0; if (isFinite(pr.bh) && +pr.bh >= 2) p.bh = Math.min(12, Math.round(+pr.bh * 2) / 2);
    if (NK.includes(pr.nk)) p.nk = pr.nk; if (pr.nkb === 'v' || pr.nkb === 'okragly') p.nkb = pr.nkb;
    if (FAB[q.tkanina]) state.fabric = q.tkanina;
    state.print = P.LIST.some((x) => x.id === q.wzor) ? q.wzor : 'gladka';
    const hx = /^#[0-9a-f]{6}$/i; if (hx.test(q.kolor || '')) state.color = q.kolor.toLowerCase(); if (hx.test(q.kolor2 || '')) state.color2 = q.kolor2.toLowerCase();
    fillForm(); persist(); if (state.view !== '3d') setView('3d'); else draw(true);
    say('Ustawiłam fason i parametry z propozycji. Dopracuj je suwakami.');
  }
  const INERR = { not_granted: 'Bez zgody na użycie Claude nie mogę przeanalizować zdjęcia.', rate_limited: 'Limit zapytań do Claude jest chwilowo wyczerpany. Spróbuj za jakiś czas.', image_rejected: 'Tego pliku nie da się wysłać. Wybierz zdjęcie JPG, PNG albo WebP.', images_unavailable: 'W tym widoku nie można wysyłać zdjęć do Claude.', refused: 'Claude odmówił analizy tego zdjęcia. Spróbuj z innym.', session_expired: 'Sesja wygasła. Zaloguj się ponownie w Claude.', invalid_json: 'Odpowiedź przyszła w złym formacie. Spróbuj jeszcze raz.' };
  // to samo pytanie własnym kluczem: zdjęcie idzie w pierwszej wiadomości, poprawki jako dalszy ciąg rozmowy
  async function inspKey(input, blob, signal) {
    const img = { type: 'image', source: { type: 'base64', media_type: blob.type || 'image/jpeg', data: await anB64(blob) } };
    const msgs = typeof input === 'string' ? [{ role: 'user', content: [img, { type: 'text', text: input }] }] : input.map((m, i) => (i === 0 ? { role: 'user', content: [img, { type: 'text', text: m.content }] } : m));
    return anMsgs(msgs, signal, 4000);
  }
  async function inspRun(more) {
    if (!inBlob) return;
    if (!sampleFn && !anKey()) { anKeyAt('inKeySlot'); anKeyForm(); return; } // bez wbudowanego Claude'a potrzebny jest własny klucz; po podłączeniu nic nie rusza samo
    inCtl = new AbortController(); $('inGo').disabled = true; $('inMoreGo').disabled = true; $('inStop').hidden = false; $('inStat').textContent = ''; const bz = busyOn('Claude analizuje zdjęcie. To zwykle trwa od kilkunastu sekund do minuty.');
    const note = $('inNote').value.trim(), first = inspPrompt() + (note ? '\n\nUwaga użytkowniczki: ' + note : '');
    const input = more && inLast ? [{ role: 'user', content: first }, { role: 'assistant', content: JSON.stringify(inLast) }, { role: 'user', content: 'Popraw propozycje według tej uwagi i odpowiedz znowu samym obiektem JSON w tym samym kształcie: ' + more }] : first;
    try {
      const res = sampleFn ? await sampleFn.json(input, { images: [inBlob], signal: inCtl.signal, cache: more ? false : true }) : await inspKey(input, inBlob, inCtl.signal);
      inLast = res && typeof res === 'object' ? res : {}; inspRender(inLast, true); $('inStat').textContent = ''; inspSave();
    } catch (e) {
      $('inStat').textContent = e && e.code === 'cancelled' ? '' : (e && INERR[e.code]) || (e && /^(key_|no_proxy)/.test(e.code || '') && AN_ERR[e.code]) || 'Nie udało się połączyć z Claude. Spróbuj jeszcze raz.'; if (!sampleFn) anKeyUi('');
    } finally { busyOff(bz); $('inGo').disabled = false; $('inMoreGo').disabled = false; $('inStop').hidden = true; }
  }
  // historia inspiracji: pomniejszone zdjęcie, uwaga i ostatnia propozycja; wspólna dla wszystkich projektów
  let inCur = null;
  async function inspSave() {
    try {
      const bmp = await createImageBitmap(inBlob), k = Math.min(1, 640 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      if (!Array.isArray(state.inspH)) state.inspH = [];
      let e = state.inspH.find((x) => x.id === inCur); if (!e) { e = { id: 'i' + Date.now() }; inCur = e.id; state.inspH.unshift(e); }
      e.at = Date.now(); e.img = c.toDataURL('image/jpeg', 0.8); e.note = $('inNote').value.trim(); e.res = inLast; state.inspH = state.inspH.slice(0, 10); persist(true); inspHist();
    } catch (err) { /* bez historii, analiza i tak się udała */ }
  }
  const inspOk = (e) => e && typeof e.img === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(e.img) && e.res && typeof e.res === 'object';
  function inspHist() {
    if (!Array.isArray(state.inspH)) state.inspH = [];
    state.inspH = state.inspH.filter(inspOk); const box = $('inHist'); box.textContent = ''; $('inHistBox').hidden = !state.inspH.length;
    for (const e of state.inspH) {
      const cell = document.createElement('div'), b = document.createElement('button'), im = document.createElement('img'), x = document.createElement('button'); cell.className = 'hcell';
      const st = e.res.propozycje && e.res.propozycje[0] && W.STYLES.find((s) => s.id === e.res.propozycje[0].fason), nm = st ? GRP[st.group] + st.name.toLowerCase() : 'bez propozycji';
      im.src = e.img; im.alt = ''; b.className = 'hbtn'; b.setAttribute('aria-label', 'Otwórz inspirację: ' + nm + ', ' + new Date(e.at).toLocaleDateString('pl-PL')); b.title = nm; b.setAttribute('aria-pressed', e.id === inCur); b.append(im);
      b.addEventListener('click', () => inspOpen(e));
      x.className = 'hx'; x.textContent = '✕'; x.setAttribute('aria-label', 'Usuń z historii'); x.addEventListener('click', () => { state.inspH = state.inspH.filter((q) => q !== e); if (inCur === e.id) inCur = null; persist(true); inspHist(); });
      cell.append(b, x); box.append(cell);
    }
  }
  function inspOpen(e) {
    const bin = atob(e.img.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    inBlob = new Blob([u8], { type: 'image/jpeg' }); inCur = e.id; inLast = e.res; $('inNote').value = e.note || ''; $('inMore').value = '';
    const img = $('inPrev'); if (img.src && img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src); img.src = e.img; img.hidden = false; $('dropT').hidden = true; $('inGo').disabled = false; $('inStat').textContent = ''; if (!sampleFn) anKeyAt('inKeySlot');
    inspRender(e.res); inspHist(); document.querySelector('#panel .body').scrollTop = 0;
  }
  function inspSet(f) {
    if (!f || !/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { $('inStat').textContent = 'Wybierz zdjęcie JPG, PNG albo WebP.'; return; }
    inBlob = f; inLast = null; inCur = null; $('inRes').textContent = ''; $('inMoreBox').hidden = true; $('inStat').textContent = ''; if (!sampleFn) anKeyAt('inKeySlot');
    const img = $('inPrev'); if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(f); img.hidden = false; $('dropT').hidden = true; $('inGo').disabled = false;
  }
  $('inImg').addEventListener('change', () => inspSet($('inImg').files[0]));
  const dz = $('drop');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); inspSet(e.dataTransfer.files[0]); });
  document.addEventListener('paste', (e) => { if (state.panel !== 'insp') return; const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.indexOf('image/') === 0); if (f) { e.preventDefault(); inspSet(f); } });
  $('inGo').addEventListener('click', () => inspRun(''));
  $('inMoreGo').addEventListener('click', () => { const t = $('inMore').value.trim(); if (t) inspRun(t); });
  $('inStop').addEventListener('click', () => inCtl && inCtl.abort());

