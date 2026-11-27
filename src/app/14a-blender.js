  // ---------- render w Blenderze: gotowy obraz w miejscu podglądu 3D ----------
  // Działa w Wykrojniku zainstalowanym jako aplikacja. Blender chodzi w tle jako jeden proces: dostaje scenę z podglądu (plik GLB) i kamerę,
  // odsyła obraz z przezroczystym tłem, który przykrywa podgląd, dopóki nie ruszysz widoku. Bez Blendera zostaje zwykły podgląd.
  const BL = /** @type {any} */ ({ on: false, path: '', dir: '', proc: null, ready: false, buf: '', job: 0, busy: false, busyId: 0, pend: null, outFile: '', outKey: '', sent: '', t: 0, shown: '', want: '', why: '', starting: false });
  const BL_PY = [
    'import bpy, sys, json, math, os',
    'from mathutils import Vector',
    'def conv(p): return Vector((p[0], -p[2], p[1]))',
    'st = {"geo": None}',
    'def engine(sc):',
    '    for e in (os.environ.get("WK_ENGINE", ""), "BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):',
    '        if not e: continue',
    '        try:',
    '            sc.render.engine = e; return',
    '        except Exception: pass',
    'def base():',
    '    sc = bpy.context.scene; engine(sc)',
    '    sc.render.film_transparent = True; sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"',
    '    try: sc.view_settings.view_transform = "Standard"',
    '    except Exception: pass',
    '    try: sc.eevee.taa_render_samples = 48',
    '    except Exception: pass',
    '    w = bpy.data.worlds.new("wk"); w.use_nodes = True; bg = w.node_tree.nodes.get("Background")',
    '    if bg: bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 0.4',
    '    sc.world = w',
    '    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)',
    'def load(job):',
    '    if st["geo"] == job["geo"]: return',
    '    for o in [o for o in bpy.data.objects if o.type == "MESH" or o.type == "EMPTY"]: bpy.data.objects.remove(o, do_unlink=True)',
    '    bpy.ops.import_scene.gltf(filepath=job["glb"])',
    '    for o in bpy.data.objects:',
    '        if o.type == "MESH":',
    '            for p in o.data.polygons: p.use_smooth = True',
    '    st["geo"] = job["geo"]',
    'def aim(o, loc, to):',
    '    o.location = loc; o.rotation_euler = (to - loc).to_track_quat("-Z", "Y").to_euler()',
    'def named(name, make):',
    '    o = bpy.data.objects.get(name)',
    '    if o is None:',
    '        o = make(); o.name = name; bpy.context.scene.collection.objects.link(o)',
    '    return o',
    'def frame(job):',
    '    sc = bpy.context.scene; c = job["cam"]; pos = conv(c["pos"]); tgt = conv(c["target"])',
    '    cam = named("wk_cam", lambda: bpy.data.objects.new("wk_cam", bpy.data.cameras.new("wk_cam")))',
    '    cam.data.sensor_fit = "VERTICAL"; cam.data.angle_y = math.radians(c["fov"]); cam.data.clip_start = 1; cam.data.clip_end = 100000',
    '    aim(cam, pos, tgt); sc.camera = cam',
    '    sc.render.resolution_x = int(job["w"]); sc.render.resolution_y = int(job["h"]); sc.render.resolution_percentage = 100',
    '    fwd = (tgt - pos).normalized(); up = Vector((0, 0, 1)); right = fwd.cross(up).normalized(); d = (tgt - pos).length',
    '    for name, off, power in (("wk_key", right * -0.7 + up * 0.8 - fwd * 0.6, 3.0), ("wk_fill", right * 0.9 + up * 0.25 - fwd * 0.5, 1.0), ("wk_rim", right * 0.3 + up * 0.7 + fwd * 0.9, 1.4)):',
    '        L = named(name, lambda: bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN")))',
    '        L.data.energy = power; L.data.angle = 0.35; aim(L, tgt + off.normalized() * d, tgt)',
    'base(); print("WK READY", flush=True)',
    'for line in sys.stdin:',
    '    line = line.strip()',
    '    if not line: continue',
    '    jid = "?"',
    '    try:',
    '        job = json.loads(line); jid = job["id"]',
    '        if job.get("quit"): break',
    '        load(job); frame(job); bpy.context.scene.render.filepath = job["out"]; bpy.ops.render.render(write_still=True)',
    '        print("WK DONE %s" % jid, flush=True)',
    '    except Exception as e:',
    '        print("WK FAIL %s %s" % (jid, str(e).replace("\\n", " ")[:300]), flush=True)',
    '',
  ].join('\n');
  const blHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // scena podglądu jako GLB: siatki tak, jak stoją w świecie, z kolorem, chropowatością i wzorem tkaniny
  function blGlb() {
    const meshes = []; g3.scene.updateMatrixWorld(true);
    g3.scene.traverse((o) => { if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return; const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (!mt || mt.side === T3.BackSide || (mt.transparent && mt.opacity < 0.6 && !mt.map)) return; for (let p = o.parent; p; p = p.parent) if (!p.visible) return; meshes.push([o, mt]); });
    const chunks = [], views = [], acc = [], gm = [], mats = [], imgs = [], texs = [], nodes = []; let off = 0, sig = 2166136261;
    const push = (arr, target) => { const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - (b.byteLength % 4)) % 4; chunks.push(b); if (pad) chunks.push(new Uint8Array(pad)); views.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: b.byteLength }, target ? { target } : {})); off += b.byteLength + pad; return views.length - 1; };
    const matIx = new Map(), texIx = new Map();
    for (const [o, mt] of meshes) {
      const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, n = P.count, pos = new Float32Array(n * 3), nor = N ? new Float32Array(n * 3) : null, v = new T3.Vector3(), nm = new T3.Matrix3().getNormalMatrix(o.matrixWorld);
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; mn = [Math.min(mn[0], v.x), Math.min(mn[1], v.y), Math.min(mn[2], v.z)]; mx = [Math.max(mx[0], v.x), Math.max(mx[1], v.y), Math.max(mx[2], v.z)]; if (nor) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z; } if (i % 37 === 0) { sig ^= Math.round(pos[i * 3] * 20) + Math.round(pos[i * 3 + 1] * 20) * 131 + Math.round(pos[i * 3 + 2] * 20) * 17161; sig = Math.imul(sig, 16777619); } }
      if (!isFinite(mn[0])) continue;
      const map = mt.map && mt.map.image ? mt.map : null; let uv = null;
      if (UV && map) { uv = new Float32Array(n * 2); const rp = map.repeat, of = map.offset; for (let i = 0; i < n; i++) { uv[i * 2] = UV.getX(i) * rp.x + of.x; uv[i * 2 + 1] = 1 - (UV.getY(i) * rp.y + of.y); } }
      const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i), attr = {};
      acc.push({ bufferView: push(pos, 34962), componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx }); attr.POSITION = acc.length - 1;
      if (nor) { acc.push({ bufferView: push(nor, 34962), componentType: 5126, count: n, type: 'VEC3' }); attr.NORMAL = acc.length - 1; }
      if (uv) { acc.push({ bufferView: push(uv, 34962), componentType: 5126, count: n, type: 'VEC2' }); attr.TEXCOORD_0 = acc.length - 1; }
      acc.push({ bufferView: push(idx, 34963), componentType: 5125, count: idx.length, type: 'SCALAR' }); const iAcc = acc.length - 1;
      if (!matIx.has(mt)) {
        const c = mt.color || { r: 0.8, g: 0.8, b: 0.8 }, lin = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)), pbr = { baseColorFactor: [lin(c.r), lin(c.g), lin(c.b), 1], roughnessFactor: mt.roughness == null ? 0.8 : mt.roughness, metallicFactor: mt.metalness || 0 };
        if (map && uv) { if (!texIx.has(map)) { let url = ''; try { const im = map.image, cv = im.toDataURL ? im : (() => { const q = document.createElement('canvas'); q.width = im.width; q.height = im.height; q.getContext('2d').drawImage(im, 0, 0); return q; })(); url = cv.toDataURL('image/png'); } catch (e) { url = ''; } if (url) { const bin = atob(url.split(',')[1]), by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i); imgs.push({ bufferView: push(by), mimeType: 'image/png' }); texs.push({ source: imgs.length - 1, sampler: 0 }); texIx.set(map, texs.length - 1); sig ^= by.length; sig = Math.imul(sig, 16777619); } else texIx.set(map, -1); } if (texIx.get(map) >= 0) pbr.baseColorTexture = { index: texIx.get(map) }; }
        mats.push({ pbrMetallicRoughness: pbr, doubleSided: mt.side === T3.DoubleSide }); matIx.set(mt, mats.length - 1); sig ^= Math.round(c.r * 255) + Math.round(c.g * 255) * 256 + Math.round(c.b * 255) * 65536; sig = Math.imul(sig, 16777619);
      }
      gm.push({ primitives: [{ attributes: attr, indices: iAcc, material: matIx.get(mt) }] }); nodes.push({ mesh: gm.length - 1 }); sig ^= n; sig = Math.imul(sig, 16777619);
    }
    if (!nodes.length) return null;
    const json = { asset: { version: '2.0', generator: 'Wykrojnik' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gm, materials: mats, accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] };
    if (texs.length) { json.textures = texs; json.images = imgs; json.samplers = [{ wrapS: 10497, wrapT: 10497 }]; }
    let js = new TextEncoder().encode(JSON.stringify(json)); const jp = (4 - (js.length % 4)) % 4; if (jp) { const t = new Uint8Array(js.length + jp).fill(32); t.set(js); js = t; }
    const total = 12 + 8 + js.length + 8 + off, out = new Uint8Array(total), dv = new DataView(out.buffer); dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true); dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
    let p = 20 + js.length; dv.setUint32(p, off, true); dv.setUint32(p + 4, 0x004e4942, true); p += 8; for (const c of chunks) { out.set(c, p); p += c.length; }
    return { bytes: out, sig: (sig >>> 0).toString(36) + '-' + nodes.length };
  }
  const blStat = (t) => { const e = $('blS'); if (e) e.textContent = t || ''; };
  function blNote() {
    const e = $('blStat'); if (!e) return; const inApp = !!(desktop && desktop.childProcess);
    e.textContent = !inApp ? 'Render w Blenderze działa w Wykrojniku zainstalowanym jako aplikacja na komputerze.' : BL.on ? 'Blender jest podłączony. Gotowy obraz pojawia się w podglądzie 3D sekundę po zatrzymaniu widoku.' : BL.why || 'Szukam Blendera…';
    $('blPathRow').hidden = !inApp || BL.on || !BL.why;
  }
  async function blInit(custom) {
    if (!desktop || !desktop.childProcess || !desktop.fs) { blNote(); return; }
    BL.on = false; BL.why = ''; blNote();
    try {
      const home = await desktop.os.homedir(), saved = (() => { try { return localStorage.getItem('wykrojnik.blender') || ''; } catch (e) { return ''; } })();
      const cands = [custom, saved, '/Applications/Blender.app/Contents/MacOS/Blender', home + '/Applications/Blender.app/Contents/MacOS/Blender'].filter(Boolean).map((p) => (/\.app\/?$/.test(p) ? p.replace(/\/$/, '') + '/Contents/MacOS/Blender' : p));
      let found = ''; for (const p of cands) if (await desktop.fs.exists(p).catch(() => false)) { found = p; break; }
      if (!found) { const r = await desktop.childProcess.exec("mdfind \"kMDItemCFBundleIdentifier == 'org.blenderfoundation.blender'\" | head -1", { timeout: 8000 }).catch(() => null), app = r && r.stdout ? r.stdout.trim().split('\n')[0] : ''; if (app && (await desktop.fs.exists(app + '/Contents/MacOS/Blender').catch(() => false))) found = app + '/Contents/MacOS/Blender'; }
      if (!found) { BL.why = custom ? 'Pod tą ścieżką nie ma Blendera. Wskaż plik Blender.app.' : 'Nie znalazłam Blendera na tym komputerze. Jeśli jest zainstalowany w nietypowym miejscu, podaj ścieżkę do Blender.app.'; blNote(); return; }
      if (custom) { try { localStorage.setItem('wykrojnik.blender', found); } catch (e) { /* ścieżka zostanie tylko na tę sesję */ } }
      BL.path = found; BL.dir = home + '/Documents/Wykrojnik/render'; await desktop.fs.mkdir(BL.dir, { recursive: true }); await desktop.fs.writeFile(BL.dir + '/wykrojnik_render.py', BL_PY, 'utf8');
      BL.on = true; blNote(); blTouch();
    } catch (e) { BL.why = 'Nie udało się przygotować Blendera: ' + String((e && e.message) || e).slice(0, 140); blNote(); }
  }
  function blStart() {
    if (BL.proc || BL.starting) return; BL.starting = true; BL.ready = false; BL.buf = '';
    const pr = desktop.childProcess.spawn(BL.path, ['-b', '--factory-startup', '-P', BL.dir + '/wykrojnik_render.py']); BL.proc = pr;
    pr.stdout.on('data', (ch) => { BL.buf += ch; let k; while ((k = BL.buf.indexOf('\n')) >= 0) { const ln = BL.buf.slice(0, k).trim(); BL.buf = BL.buf.slice(k + 1); if (ln.indexOf('WK ') === 0) blLine(ln); } });
    const gone = (why) => { if (BL.proc !== pr) return; BL.proc = null; BL.ready = false; BL.starting = false; BL.sent = ''; if (BL.busy) { BL.busy = false; blStat(''); } if (why) { BL.on = false; BL.why = why; blNote(); } };
    pr.on('error', (e) => gone('Blender się nie uruchomił: ' + String((e && e.message) || e).slice(0, 140)));
    pr.on('exit', (code) => gone(code ? 'Blender zakończył pracę z błędem (kod ' + code + '). Podgląd zostaje bez gotowego renderu.' : ''));
  }
  function blLine(ln) {
    const p = ln.split(' ');
    if (p[1] === 'READY') { BL.ready = true; BL.starting = false; if (BL.want) blGo(); return; }
    const id = +p[2]; if (id !== BL.job) { if (BL.busy && id === BL.busyId) { BL.busy = false; if (BL.want) blGo(); } return; } // spóźniony wynik starszego zadania nie zastępuje widoku
    BL.busy = false;
    if (p[1] === 'DONE') blShow(BL.outFile, BL.outKey); else { blStat(''); BL.why = 'Blender nie wyrenderował tego widoku: ' + p.slice(3).join(' ').slice(0, 160); blNote(); }
    if (BL.want && BL.want !== BL.outKey) blGo();
  }
  async function blShow(file, key) {
    try { const b64 = await desktop.fs.readFile(file, 'base64'); if (key !== BL.want) return; const im = $('blImg'); im.onload = () => { if (key !== BL.want) return; const cs = g3.canvas.style; im.style.left = cs.left || '0'; im.style.top = '0'; im.style.width = cs.width || '100%'; im.style.height = '100%'; im.hidden = false; g3.canvas.style.opacity = '0'; BL.shown = key; blStat(''); }; im.src = 'data:image/png;base64,' + b64; }
    catch (e) { blStat(''); }
  }
  function blHide() { const im = $('blImg'); if (im && !im.hidden) { im.hidden = true; } if (g3 && g3.canvas) g3.canvas.style.opacity = ''; BL.shown = ''; }
  // wywoływane po każdym odświeżeniu podglądu: chowa gotowy obraz, gdy widok się zmienił, i zamawia nowy po sekundzie spokoju
  function blTouch() {
    if (!BL.on || !g3 || state.view !== '3d' || !$('home').hidden) { blHide(); clearTimeout(BL.t); return; }
    const r = g3.canvas.getBoundingClientRect(), ck = [cam.yaw.toFixed(3), cam.pitch.toFixed(3), cam.dist.toFixed(1), Math.round(r.width), Math.round(r.height), g3.mid.toFixed(1)].join('|');
    if (BL.shown && BL.shown.indexOf(ck + '#') !== 0) blHide(); else if (BL.shown) return;
    clearTimeout(BL.t); BL.t = setTimeout(() => blAsk(ck), 1000);
  }
  async function blAsk(ck) {
    if (!BL.on || state.view !== '3d' || !g3) return;
    if ((g3.top && !g3.top.fail && !g3.top.done) || (g3.sim && !g3.sim.done) || !$('busy').hidden) { clearTimeout(BL.t); BL.t = setTimeout(() => blAsk(ck), 600); return; } // tkanina jeszcze się układa
    let glb; try { glb = blGlb(); } catch (e) { glb = null; } if (!glb) return;
    const r = g3.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), sc = Math.min(1, 2000 / (Math.max(r.width, r.height) * dpr)), w = Math.round(r.width * dpr * sc), h = Math.round(r.height * dpr * sc);
    const key = ck + '#' + glb.sig, file = BL.dir + '/' + blHash(key + '|' + w + 'x' + h) + '.png'; BL.want = key; BL.pend = { glb, key, file, w, h };
    if (await desktop.fs.exists(file).catch(() => false)) { blShow(file, key); return; } // ten sam projekt i kadr: zapisany wynik
    blStat('Dopracowywanie podglądu…'); blGo();
  }
  async function blGo() {
    const q = BL.pend; if (!q || q.key !== BL.want) return; if (!BL.proc) { blStart(); return; } if (!BL.ready || BL.busy) return;
    BL.busy = true; BL.job++; BL.busyId = BL.job; const id = BL.job, geoFile = BL.dir + '/scena.glb';
    try {
      if (BL.sent !== q.glb.sig) { await desktop.fs.writeFile(geoFile, q.glb.bytes); BL.sent = q.glb.sig; }
      if (q.key !== BL.want) { BL.busy = false; blGo(); return; }
      const p = g3.camera.position; BL.outFile = q.file; BL.outKey = q.key;
      await BL.proc.stdin.write(JSON.stringify({ id, glb: geoFile, geo: q.glb.sig, out: q.file, w: q.w, h: q.h, cam: { pos: [p.x, p.y, p.z], target: [0, g3.mid, 0], fov: g3.camera.fov } }) + '\n');
    } catch (e) { BL.busy = false; blStat(''); BL.why = 'Nie udało się przekazać sceny do Blendera: ' + String((e && e.message) || e).slice(0, 140); blNote(); }
  }
  $('blPathGo').addEventListener('click', () => { const v = $('blPath').value.trim(); if (v) blInit(v); });
  window.__bl = { BL, blGlb, blInit }; // tylko do testów
