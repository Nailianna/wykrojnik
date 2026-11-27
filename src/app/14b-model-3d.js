  // ---------- gotowy model 3D (GLB) jako wizualizacja referencyjna ----------
  // Plik zostaje w przeglądarce (IndexedDB), w projekcie zapisuje się tylko jego nazwa. Model pokazuje się na manekinie bez dopasowania do wymiarów.
  const REF = /** @type {any} */ ({ proj: '', parts: null, box: null, main: null, loading: '' });
  function refDb() { return new Promise((res, rej) => { const q = indexedDB.open('wykrojnik-modele', 1); q.onupgradeneeded = () => q.result.createObjectStore('glb'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function refPut(id, bytes) { const db = await refDb(); return new Promise((res, rej) => { const t = db.transaction('glb', 'readwrite'); t.objectStore('glb').put(bytes, id); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); }
  function refDrop(id) { refDb().then((db) => { db.transaction('glb', 'readwrite').objectStore('glb').delete(id); }).catch(() => {}); }
  async function refGet(id) { const db = await refDb(); return new Promise((res, rej) => { const q = db.transaction('glb').objectStore('glb').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
  function refParse(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('To nie jest plik GLB.');
    const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jl))), b0 = 20 + jl + 8, bin = u8.subarray(b0, b0 + dv.getUint32(20 + jl, true));
    if ((json.extensionsRequired || []).length) throw new Error('Ten plik GLB używa kompresji, której Wykrojnik nie czyta. Zapisz go bez kompresji.');
    const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const acc = (i) => { const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = CT[a.componentType], nc = NC[a.type], off = (bv.byteOffset || 0) + (a.byteOffset || 0), st = bv.byteStride || 0, out = new T(a.count * nc), d = new DataView(bin.buffer, bin.byteOffset + off);
      const rd = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType], sz = T.BYTES_PER_ELEMENT, step = st || sz * nc;
      for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) out[k * nc + c] = d[rd](k * step + c * sz, true); return out; };
    const parts = [], M = new T3.Matrix4(), v = new T3.Vector3(), walk = (ni, parent) => {
      const nd = json.nodes[ni], m = new T3.Matrix4(); if (nd.matrix) m.fromArray(nd.matrix); else m.compose(new T3.Vector3().fromArray(nd.translation || [0, 0, 0]), new T3.Quaternion().fromArray(nd.rotation || [0, 0, 0, 1]), new T3.Vector3().fromArray(nd.scale || [1, 1, 1]));
      const w = new T3.Matrix4().multiplyMatrices(parent, m);
      if (nd.mesh != null) for (const pr of json.meshes[nd.mesh].primitives) { if (pr.mode != null && pr.mode !== 4) continue; const P = acc(pr.attributes.POSITION), pos = new Float32Array(P.length);
        for (let i = 0; i < P.length; i += 3) { v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(w); pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; }
        const idx = pr.indices != null ? Uint32Array.from(acc(pr.indices)) : Uint32Array.from({ length: P.length / 3 }, (_, i) => i), mt = json.materials && pr.material != null ? json.materials[pr.material] : {}, pbr = mt.pbrMetallicRoughness || {}, c = pbr.baseColorFactor || [0.8, 0.8, 0.8, 1];
        parts.push({ name: nd.name || json.meshes[nd.mesh].name || '', pos, idx, mat: pr.material == null ? -1 : pr.material, col: [c[0], c[1], c[2]], alpha: mt.alphaMode === 'BLEND' ? c[3] : 1, rough: pbr.roughnessFactor == null ? 0.8 : pbr.roughnessFactor, metal: pbr.metallicFactor == null ? 0 : pbr.metallicFactor }); }
      for (const ch of nd.children || []) walk(ch, w);
    };
    for (const ni of (json.scenes && json.scenes[json.scene || 0] ? json.scenes[json.scene || 0].nodes : json.nodes.map((_, i) => i))) walk(ni, M);
    if (!parts.length) throw new Error('W tym pliku GLB nie ma żadnej bryły.');
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of parts) for (let i = 0; i < p.pos.length; i++) { lo[i % 3] = Math.min(lo[i % 3], p.pos[i]); hi[i % 3] = Math.max(hi[i % 3], p.pos[i]); }
    const k = hi[1] - lo[1] < 4 ? 100 : hi[1] - lo[1] < 400 ? 1 : 0.1; // metry, centymetry albo milimetry: po wysokości bryły
    for (const p of parts) for (let i = 0; i < p.pos.length; i++) p.pos[i] = (p.pos[i] - (i % 3 === 1 ? lo[1] : 0)) * k;
    // materiał o największej powierzchni wyznacza kolor główny: od niego liczy się zmiana koloru całego ubrania
    const area = new Map(); for (const p of parts) { let s = 0; for (let t = 0; t < p.idx.length; t += 3) { const a = p.idx[t] * 3, b = p.idx[t + 1] * 3, c = p.idx[t + 2] * 3, ux = p.pos[b] - p.pos[a], uy = p.pos[b + 1] - p.pos[a + 1], uz = p.pos[b + 2] - p.pos[a + 2], vx = p.pos[c] - p.pos[a], vy = p.pos[c + 1] - p.pos[a + 1], vz = p.pos[c + 2] - p.pos[a + 2]; s += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); } area.set(p.mat, (area.get(p.mat) || 0) + s); }
    let best = parts[0]; for (const p of parts) if (area.get(p.mat) > area.get(best.mat)) best = p;
    return { parts, main: best.col.slice(), box: { hw: Math.max(Math.abs(lo[0]), Math.abs(hi[0]), Math.abs(lo[2]), Math.abs(hi[2])) * k, h: (hi[1] - lo[1]) * k }, mats: new Set(parts.map((p) => p.mat)).size };
  }
  const refS2L = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)), refL2S = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  // dodaje model do sceny; kolor projektu przebarwia wszystkie materiały z zachowaniem różnic między nimi (jaśniejszy szyfon zostaje jaśniejszy)
  function refAdd(grp, floor) {
    const note = $('refN'); if (note) note.hidden = !state.ref;
    if (!state.ref) return null;
    if (REF.proj !== state.proj || !REF.parts) { if (REF.loading !== state.proj) { REF.loading = state.proj; const id = state.proj; refGet(id).then((b) => { if (state.proj !== id) return; if (!b) { say('Nie mam już pliku tego modelu 3D w tej przeglądarce. Wgraj go jeszcze raz.'); return; } const r = refParse(new Uint8Array(b)); Object.assign(REF, r, { proj: id }); render3d(true); }).catch(() => {}).then(() => { REF.loading = ''; }); } return null; }
    const tc = new T3.Color(state.color), tl = [refS2L(tc.r), refS2L(tc.g), refS2L(tc.b)], mats = new Map();
    for (const p of REF.parts) {
      let mt = mats.get(p.mat);
      if (!mt) { const c = p.col.map((x, i) => refL2S(Math.max(0, Math.min(1, tl[i] * (x / Math.max(0.02, REF.main[i])))))); mt = new T3.MeshStandardMaterial({ color: new T3.Color(c[0], c[1], c[2]), roughness: p.rough, metalness: p.metal, side: T3.DoubleSide }); if (p.alpha < 1) { mt.transparent = true; mt.opacity = p.alpha; mt.depthWrite = false; } mt.userData.part = p.name; mats.set(p.mat, mt); }
      const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(p.pos, 3)); geo.setIndex(new T3.BufferAttribute(p.idx, 1)); geo.computeVertexNormals();
      const me = new T3.Mesh(geo, mt); me.position.y = floor; me.name = p.name; if (p.alpha < 1) me.renderOrder = 2; grp.add(me);
    }
    grp.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.body) o.scale.set(0.86, 1, 0.8); }); // manekin jest tu tylko stojakiem: zwężony, żeby nie przebijał gotowego modelu
    return { hw: REF.box.hw, top: floor + REF.box.h };
  }
  async function refLoad(file) {
    let r; const u8 = new Uint8Array(await file.arrayBuffer());
    try { r = refParse(u8.slice()); } catch (e) { say(String((e && e.message) || 'Nie udało się wczytać tego pliku.')); return; }
    homeShow(false); newProj(); const id = state.proj;
    try { await refPut(id, u8.buffer); } catch (e) { say('Przeglądarka nie pozwoliła zapisać modelu, więc zniknie po zamknięciu strony.'); }
    const hx = (x) => ('0' + Math.round(refL2S(x) * 255).toString(16)).slice(-2);
    state.ref = { name: file.name.replace(/\.glb$/i, '').slice(0, 60), n: r.parts.length, mats: r.mats }; state.color = '#' + hx(r.main[0]) + hx(r.main[1]) + hx(r.main[2]); Object.assign(REF, r, { proj: id });
    const pr = state.projects.find((q) => q.id === id); if (pr) pr.name = state.ref.name; $('prName').value = state.ref.name;
    fillForm(); persist(true); goPanel(''); setView('3d'); render3d(true);
  }
  $('hGlb').addEventListener('click', () => $('glbFile').click());
  $('glbFile').addEventListener('change', (e) => { const f = /** @type {HTMLInputElement} */ (e.target).files[0]; /** @type {HTMLInputElement} */ (e.target).value = ''; if (f) refLoad(f); });
