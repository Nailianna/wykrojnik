  // ---------- render w Blenderze: gotowy obraz w miejscu podglądu 3D ----------
  // Działa w Wykrojniku zainstalowanym jako aplikacja. Blender chodzi w tle jako jeden proces: dostaje scenę z podglądu (plik GLB) i kamerę,
  // odsyła obraz z przezroczystym tłem, który przykrywa podgląd, dopóki nie ruszysz widoku. Bez Blendera zostaje zwykły podgląd.
  const BL = /** @type {any} */ ({ on: false, path: '', dir: '', proc: null, ready: false, buf: '', job: 0, busy: false, mode: '', lastC: '', cur: null, clothQ: null, killing: null, last: '', why2: '', whyC: '', pend: null, sent: '', t: 0, shown: '', want: '', why: '', starting: false });
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
    'def cyc(sc):',
    '    try:',
    '        sc.cycles.samples = int(os.environ.get("WK_SAMPLES", "48")); sc.cycles.use_denoising = True; sc.cycles.device = "CPU"',
    '    except Exception: pass',
    'def shoot(out):',
    '    sc = bpy.context.scene; sc.render.filepath = out',
    '    if os.path.exists(out): os.remove(out)',
    '    try: bpy.ops.render.render(write_still=True)',
    '    except Exception:',
    '        if sc.render.engine == "CYCLES": raise',
    '    if not os.path.exists(out) and sc.render.engine != "CYCLES":',
    '        sc.render.engine = "CYCLES"; cyc(sc); bpy.ops.render.render(write_still=True)',
    'def base():',
    '    sc = bpy.context.scene; engine(sc)',
    '    if sc.render.engine == "CYCLES": cyc(sc)',
    '    sc.render.film_transparent = True; sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"',
    '    try: sc.view_settings.view_transform = "Standard"',
    '    except Exception: pass',
    '    try: sc.eevee.taa_render_samples = 48',
    '    except Exception: pass',
    '    w = bpy.data.worlds.new("wk"); w.use_nodes = True; bg = w.node_tree.nodes.get("Background")',
    '    if bg: bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 0.4',
    '    sc.world = w',
    '    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)',
    'def purge():',
    '    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.images):',
    '        for d in [d for d in blk if d.users == 0]: blk.remove(d)',
    'def load(job):',
    '    if st["geo"] == job["geo"]: return',
    '    for o in [o for o in bpy.data.objects if o.type == "MESH" or o.type == "EMPTY"]: bpy.data.objects.remove(o, do_unlink=True)',
    '    purge(); bpy.ops.import_scene.gltf(filepath=job["glb"]); st["mats"] = {}',
    '    for m in bpy.data.materials:',
    '        if m.name.startswith("wk") and m.name[2:].split(".")[0].isdigit(): st["mats"][int(m.name[2:].split(".")[0])] = m',
    '    for o in bpy.data.objects:',
    '        if o.type == "MESH":',
    '            for p in o.data.polygons: p.use_smooth = True',
    '    st["geo"] = job["geo"]',
    'def paint(job):',
    '    for i, q in enumerate(job.get("mats") or []):',
    '        m = st.get("mats", {}).get(i)',
    '        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m and m.node_tree else None',
    '        if not b: continue',
    '        col = b.inputs["Base Color"]; al = b.inputs["Alpha"]',
    '        if not col.is_linked: col.default_value = (q["c"][0], q["c"][1], q["c"][2], 1.0)',
    '        if not al.is_linked: al.default_value = q["a"]',
    '        b.inputs["Roughness"].default_value = q["r"]; b.inputs["Metallic"].default_value = q["m"]',
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
    'def mk(name, verts, edges, faces):',
    '    old = bpy.data.objects.get(name)',
    '    if old: bpy.data.objects.remove(old, do_unlink=True)',
    '    me = bpy.data.meshes.new(name); me.from_pydata(verts, edges, faces); me.update()',
    '    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o',
    'def cloth(job):',
    '    import array',
    '    c = json.load(open(job["cloth"])); S = 0.01; sc = bpy.context.scene',
    '    for o in [o for o in bpy.data.objects if o.type == "MESH" or o.type == "EMPTY"]: bpy.data.objects.remove(o, do_unlink=True)',
    '    st["geo"] = None; purge()',
    '    cv = lambda a, i: (a[i] * S, -a[i + 2] * S, a[i + 1] * S)',
    '    bp = c["body"]["pos"]; bi = c["body"]["idx"]',
    '    body = mk("wk_body", [cv(bp, i) for i in range(0, len(bp), 3)], [], [tuple(bi[i:i + 3]) for i in range(0, len(bi), 3)])',
    '    body.modifiers.new("col", "COLLISION"); body.collision.thickness_outer = 0.004; body.collision.thickness_inner = 0.03; body.collision.cloth_friction = 12',
    '    fz = c["floor"] * S; fl = mk("wk_floor", [(-3, -3, fz), (3, -3, fz), (3, 3, fz), (-3, 3, fz)], [], [(0, 1, 2, 3)])',
    '    fl.modifiers.new("col", "COLLISION"); fl.collision.thickness_outer = 0.003; fl.collision.cloth_friction = 20',
    '    X = c["X"]; rmap = c["rmap"]; uv = c["uv"]; tri = c["tri"]; ns = c["ns"]; nr = len(rmap)',
    '    by = {}',
    '    for r, s in enumerate(rmap): by.setdefault(s, []).append(r)',
    '    sew = [(g[k], g[k + 1]) for g in by.values() for k in range(len(g) - 1)]',
    '    lift = lambda p: (p[0], p[1], max(p[2], fz + 0.006))',
    '    ob = mk("wk_cloth", [lift(cv(X, s * 3)) for s in rmap], sew, [tuple(tri[i:i + 3]) for i in range(0, len(tri), 3)])',
    '    ob.shape_key_add(name="Basis"); flat = ob.shape_key_add(name="flat"); flat.value = 0.0; ob.active_shape_key_index = 0',
    '    for i in range(nr): flat.data[i].co = (uv[i * 2] * S, uv[i * 2 + 1] * S, 0.0)',
    '    m = ob.modifiers.new("cloth", "CLOTH"); s = m.settings; k = float(c.get("st", 0.3)); knit = bool(c.get("knit"))',
    '    s.quality = 10; s.mass = 0.25; s.air_damping = 2.0; s.tension_stiffness = 6 if knit else 30; s.compression_stiffness = 6 if knit else 20; s.shear_stiffness = 3 if knit else 8',
    '    s.bending_stiffness = 0.03 * (200 ** k); s.tension_damping = 8; s.compression_damping = 8; s.shear_damping = 8; s.bending_damping = 0.6',
    '    s.use_sewing_springs = True; s.sewing_force_max = 0; s.rest_shape_key = flat',
    '    pins = set(c.get("pin", []))',
    '    if pins:',
    '        vg = ob.vertex_groups.new(name="pin"); vg.add([r for r in range(nr) if rmap[r] in pins], 1.0, "REPLACE"); s.vertex_group_mass = "pin"',
    '    cs = m.collision_settings; cs.use_collision = True; cs.distance_min = 0.004; cs.collision_quality = 3; cs.use_self_collision = True; cs.self_distance_min = 0.002; cs.self_friction = 5',
    '    n = int(c.get("frames", 45)); m.point_cache.frame_start = 1; m.point_cache.frame_end = n; sc.frame_start = 1; sc.frame_end = n',
    '    for f in range(1, n + 1): sc.frame_set(f)',
    '    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); vs = ev.data.vertices',
    '    gaps = sorted((vs[a].co - vs[b].co).length / S for a, b in sew) or [0.0]',
    '    if gaps[-1] > 8.0 or gaps[int(len(gaps) * 0.85)] > 1.5: raise Exception("szwy rozeszly sie o %.1f cm" % gaps[-1])',
    '    out = array.array("f", [0.0]) * (ns * 3); cnt = [0] * ns',
    '    for r in range(nr):',
    '        co = vs[r].co; s3 = rmap[r] * 3; out[s3] += co.x / S; out[s3 + 1] += co.z / S; out[s3 + 2] += -co.y / S; cnt[rmap[r]] += 1',
    '    for i in range(ns):',
    '        if cnt[i] > 1:',
    '            for q in range(3): out[i * 3 + q] /= cnt[i]',
    '    with open(job["out"], "wb") as fh: out.tofile(fh)',
    '    sc.frame_set(1)',
    '    for o in [o for o in bpy.data.objects if o.type == "MESH"]: bpy.data.objects.remove(o, do_unlink=True)',
    'base(); print("WK READY", flush=True)',
    'for line in sys.stdin:',
    '    line = line.strip()',
    '    if not line: continue',
    '    jid = "?"',
    '    try:',
    '        job = json.loads(line); jid = job["id"]',
    '        if job.get("quit"): break',
    '        if job.get("cloth"): cloth(job)',
    '        else:',
    '            load(job); paint(job); frame(job); shoot(job["out"])',
    '        print("WK DONE %s" % jid, flush=True)',
    '    except Exception as e:',
    '        print("WK FAIL %s %s" % (jid, str(e).replace("\\n", " ")[:300]), flush=True)',
    '',
  ].join('\n');
  const blHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // scena podglądu jako GLB: siatki tak, jak stoją w świecie, z kolorem, chropowatością i wzorem tkaniny
  function blGlb() {
    const meshes = []; g3.scene.updateMatrixWorld(true);
    g3.scene.traverse((o) => { if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return; const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (!mt || mt.side === T3.BackSide || (mt.userData && mt.userData.helper)) return; for (let p = o.parent; p; p = p.parent) if (!p.visible) return; meshes.push([o, mt]); });
    const chunks = [], views = [], acc = [], gm = [], mats = [], look = [], imgs = [], texs = [], nodes = []; let off = 0, sig = 2166136261, ms = 2166136261;
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
        const c = mt.color || { r: 0.8, g: 0.8, b: 0.8 }, lin = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)), op = mt.transparent && !mt.alphaMap && mt.opacity < 1 ? mt.opacity : 1, pbr = { baseColorFactor: [lin(c.r), lin(c.g), lin(c.b), op], roughnessFactor: mt.roughness == null ? 0.8 : mt.roughness, metallicFactor: mt.metalness || 0 };
        if (map && uv) { if (!texIx.has(map)) { let url = ''; try { const im = map.image, cv = im.toDataURL ? im : (() => { const q = document.createElement('canvas'); q.width = im.width; q.height = im.height; q.getContext('2d').drawImage(im, 0, 0); return q; })(); url = cv.toDataURL('image/png'); } catch (e) { url = ''; } if (url) { const bin = atob(url.split(',')[1]), by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i); imgs.push({ bufferView: push(by), mimeType: 'image/png' }); texs.push({ source: imgs.length - 1, sampler: 0 }); texIx.set(map, texs.length - 1); for (let i = 0; i < by.length; i += 997) { sig ^= by[i] + (i & 255) * 256; sig = Math.imul(sig, 16777619); } sig ^= by.length; sig = Math.imul(sig, 16777619); } else texIx.set(map, -1); } if (texIx.get(map) >= 0) pbr.baseColorTexture = { index: texIx.get(map) }; }
        // nazwa „wk<numer>” pozwala Blenderowi podmienić sam kolor i połysk bez wczytywania sceny od nowa; przezroczystość zmienia budowę sceny, więc liczy się do jej podpisu
        mats.push(Object.assign({ name: 'wk' + mats.length, pbrMetallicRoughness: pbr, doubleSided: op < 1 || mt.side === T3.DoubleSide }, op < 1 ? { alphaMode: 'BLEND' } : {}, mt.userData && mt.userData.part ? { extras: { part: mt.userData.part } } : {})); matIx.set(mt, mats.length - 1);
        look.push({ c: [+lin(c.r).toFixed(4), +lin(c.g).toFixed(4), +lin(c.b).toFixed(4)], a: +op.toFixed(3), r: +pbr.roughnessFactor.toFixed(3), m: +pbr.metallicFactor.toFixed(3) });
        sig ^= op < 1 ? 7 : 3; sig = Math.imul(sig, 16777619);
        for (const x of [c.r, c.g, c.b, op, pbr.roughnessFactor, pbr.metallicFactor]) { ms ^= Math.round(x * 1000) + 1; ms = Math.imul(ms, 16777619); }
      }
      gm.push({ primitives: [{ attributes: attr, indices: iAcc, material: matIx.get(mt) }] }); nodes.push({ mesh: gm.length - 1 }); sig ^= n; sig = Math.imul(sig, 16777619);
    }
    if (!nodes.length) return null;
    const json = { asset: { version: '2.0', generator: 'Wykrojnik' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gm, materials: mats, accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] };
    if (texs.length) { json.textures = texs; json.images = imgs; json.samplers = [{ wrapS: 10497, wrapT: 10497 }]; }
    let js = new TextEncoder().encode(JSON.stringify(json)); const jp = (4 - (js.length % 4)) % 4; if (jp) { const t = new Uint8Array(js.length + jp).fill(32); t.set(js); js = t; }
    const total = 12 + 8 + js.length + 8 + off, out = new Uint8Array(total), dv = new DataView(out.buffer); dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true); dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
    let p = 20 + js.length; dv.setUint32(p, off, true); dv.setUint32(p + 4, 0x004e4942, true); p += 8; for (const c of chunks) { out.set(c, p); p += c.length; }
    return { bytes: out, sig: (sig >>> 0).toString(36) + '-' + nodes.length, msig: (ms >>> 0).toString(36), mats: look };
  }
  // ---------- usługa renderująca na serwerze: te same zadania przez API, bez Blendera na komputerze ----------
  const SRV = /** @type {any} */ ({ api: '', client: '', rj: null, cj: null, imgs: new Map(), tries: 0, last: 0, why: '' });
  function srvHead() { let p = String(state.proj || 'projekt').replace(/[^A-Za-z0-9_-]/g, ''); while (p.length < 6) p += '0'; return { 'x-wk-client': SRV.client, 'x-wk-project': p.slice(0, 64) }; }
  async function srvCall(method, path, body, type) {
    const h = srvHead(); if (type) h['content-type'] = type;
    let r; try { r = await fetch(SRV.api + path, { method, headers: h, body, cache: 'no-store' }); } catch (e) { throw new Error('Usługa renderująca nie odpowiada.'); }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (e) { m = ''; } throw new Error(m || 'Usługa renderująca odpowiedziała błędem ' + r.status + '.'); }
    return r;
  }
  async function srvInit() {
    try { SRV.client = localStorage.getItem('wykrojnik.klient') || ''; if (!/^[A-Za-z0-9_-]{16,64}$/.test(SRV.client)) { const a = new Uint8Array(18); crypto.getRandomValues(a); SRV.client = Array.from(a, (x) => (x % 36).toString(36)).join(''); localStorage.setItem('wykrojnik.klient', SRV.client); } } catch (e) { SRV.client = 'sesja' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }
    let base = (TEST && window['__wkRender']) || ''; try { base = base || localStorage.getItem('wykrojnik.render') || ''; } catch (e) { /* zostaje adres domyślny */ }
    SRV.api = (base || 'api/render').replace(/\/$/, ''); SRV.last = Date.now();
    try { const r = await fetch(SRV.api + '/health', { cache: 'no-store' }); if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (e) { m = ''; } throw new Error(m && r.status === 503 ? m + ' adresem' : 'Usługa renderująca odpowiedziała błędem ' + r.status + '.'); } const j = await r.json(); if (!j || !j.ok) throw new Error('Pod tym adresem nie ma usługi renderującej.'); BL.mode = 'server'; BL.on = true; BL.why = ''; blNote(); blTouch(); return true; }
    catch (e) { const m = String((e && e.message) || ''); SRV.why = / adresem$/.test(m) ? m.replace(/ adresem$/, '') : /odpowiedziała|adresem/.test(m) ? m : 'Usługa renderująca nie odpowiada.'; blNote(); return false; }
  }
  // czeka na zadanie; fresh() mówi, czy wynik jest jeszcze potrzebny, a label(stan) ustawia napis
  async function srvWait(slot, id, fresh, label) {
    SRV[slot] = id; let fails = 0;
    for (;;) {
      if (!fresh() || SRV[slot] !== id) { srvCall('DELETE', '/jobs/' + id).catch(() => {}); if (SRV[slot] === id) SRV[slot] = null; return null; }
      let j; try { j = await (await srvCall('GET', '/jobs/' + id)).json(); fails = 0; } catch (e) { if (++fails > 4) { SRV[slot] = null; throw e; } await new Promise((r) => setTimeout(r, 800)); continue; }
      if (j.state === 'done') { const u8 = new Uint8Array(await (await srvCall('GET', '/jobs/' + id + '/result')).arrayBuffer()); if (SRV[slot] === id) SRV[slot] = null; return { u8, cached: !!j.cached }; }
      if (j.state === 'failed' || j.state === 'cancelled') { if (SRV[slot] === id) SRV[slot] = null; if (j.state === 'cancelled') return null; throw new Error(j.error || 'Blender nie dokończył zadania.'); }
      label(j.state === 'queued' ? (j.ahead > 0 ? 'W kolejce (' + j.ahead + ' przed Tobą)…' : 'W kolejce…') : null);
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  function srvImg(key, u8) { if (key !== BL.want) return; const url = URL.createObjectURL(new Blob([u8], { type: 'image/png' })); SRV.imgs.set(key, url); if (SRV.imgs.size > 40) { const k = SRV.imgs.keys().next().value; URL.revokeObjectURL(SRV.imgs.get(k)); SRV.imgs.delete(k); } blPut(url, key); }
  async function srvRender(q) {
    if (SRV.imgs.has(q.key)) { BL.last = 'nic, obraz z zapisu'; blNote(); blPut(SRV.imgs.get(q.key), q.key); return; }
    const p = g3.camera.position, job = JSON.stringify({ kind: 'render', key: q.key + '|' + q.w + 'x' + q.h, geo: q.glb.sig, mats: q.glb.mats, w: q.w, h: q.h, cam: { pos: [p.x, p.y, p.z], target: [0, g3.mid, 0], fov: g3.camera.fov } });
    try {
      BL.why2 = ''; blStat('Dopracowywanie podglądu…'); let fresh = false;
      let r = await (await srvCall('POST', '/jobs', job, 'application/json')).json();
      if (r.need === 'scene') { if (q.key !== BL.want) return; await srvCall('PUT', '/scenes/' + q.glb.sig, q.glb.bytes, 'model/gltf-binary'); fresh = true; r = await (await srvCall('POST', '/jobs', job, 'application/json')).json(); }
      if (!r.id) throw new Error('Usługa renderująca nie przyjęła zadania.');
      const out = await srvWait('rj', r.id, () => q.key === BL.want && state.view === '3d', (t) => { if (q.key === BL.want) blStat(t || 'Dopracowywanie podglądu…'); });
      if (!out) return; // spóźniony albo anulowany: nowszy widok ma pierwszeństwo
      BL.last = out.cached ? 'nic, obraz z zapisu' : fresh ? 'scena i obraz' : 'tylko obraz'; if (BL.lastC) { BL.last += ', ' + BL.lastC; BL.lastC = ''; } blNote(); srvImg(q.key, out.u8);
    } catch (e) { if (q.key === BL.want) { BL.why2 = String((e && e.message) || e).slice(0, 180); blStat(BL.why2 + ' Widzisz zwykły podgląd.'); blNote(); } }
  }
  async function srvCloth(tp) {
    tp.bl = 'run'; blStat('Układanie tkaniny…');
    try {
      const g = tp.g, body = blBody(); if (!body.idx.length) { tp.bl = 'fail'; blStat(''); return; }
      const r = await (await srvCall('POST', '/jobs', JSON.stringify({ kind: 'cloth', key: tp.key + '|c1|' + g.ns, data: blClothData(tp, body) }), 'application/json')).json();
      if (!r.id) throw new Error('Usługa renderująca nie przyjęła zadania.');
      const out = await srvWait('cj', r.id, () => g3 && g3.top === tp, (t) => blStat(t || 'Układanie tkaniny…'));
      blStat(''); if (!out) { if (tp.bl === 'run') tp.bl = 'fail'; return; }
      if (!blClothApply(tp, out.u8)) throw new Error('wynik nie przeszedł kontroli');
      BL.lastC = out.cached ? 'tkanina z zapisu' : 'tkanina ułożona w Blenderze'; BL.whyC = ''; if (g3 && g3.top === tp && state.view === '3d') render3d();
    } catch (e) { blStat(''); tp.bl = 'fail'; BL.whyC = 'Blender nie ułożył tkaniny (' + String((e && e.message) || e).slice(0, 140) + '). Widzisz ułożenie z podglądu.'; blNote(); }
  }
  // etykieta przy podglądzie: skąd wziął się kształt, który widać, i czy obraz jest już dopracowany
  function seeFill() {
    const e = $('seeN'); let t = '';
    if (g3 && state.view === '3d' && $('home').hidden) {
      const tp = g3.top && !g3.top.fail && (g3.top.ready || g3.top.prev) ? g3.top : null;
      t = state.ref ? 'Oglądasz gotowy model 3D, bez dopasowania do wymiarów modelki.' : state.style === 'pusty' ? '' : model && model.d && model.d.approx ? 'Oglądasz przybliżoną bryłę policzoną z elementów wykroju, bez zszywania.' : tp ? (tp.bl === 'done' ? 'Oglądasz ubranie zszyte z elementów wykroju i ułożone w Blenderze.' : 'Oglądasz ubranie zszyte z elementów wykroju.') : 'Oglądasz bryłę policzoną z wymiarów.';
      if (t && BL.shown) t += ' Obraz jest dopracowany.';
    }
    const d = model && model.d, why = d && d.approx && d.sewErr ? 'Elementy nie są zszyte. ' + String(d.sewErr).replace(/Tego fasonu nie umiem jeszcze pokazać w 3D/g, 'Nie umiem jeszcze zszyć tego fasonu').replace(/ Na razie działa układ przód, tył i rękaw z ramieniem i pachą\./, '') : '';
    $('seeWhy').textContent = why; $('seeWhy').hidden = !why; $('seeCopyRow').hidden = !(state.style === 'import' && state.imp && state.imp.an);
    if (e.textContent !== t) e.textContent = t; e.hidden = !t; if (!t) { $('seeBox').hidden = true; e.setAttribute('aria-expanded', 'false'); }
  }
  // dane analizy do schowka: to, co analiza zwróciła dla tego wykroju, i powód, dla którego elementy nie zostały zszyte
  // dane analizy do schowka: to, co analiza zwróciła dla tego wykroju, i powód, dla którego elementy nie zostały zszyte
  async function anCopyData() {
    const d = model && model.d, imp = state.imp; if (!imp) return;
    const out = { wersja: BUILD.v, rozmiar: imp.size || '', szycie: d && d.sewn ? (d.sewn.plan ? 'plan' : 'kroj') : d && d.approx ? 'przyblizenie' : 'brak', powod: (d && d.sewErr) || '', analiza: imp.an || null, elementy: ((d && d.pieces) || []).map((q) => ({ nazwa: q.name, rola: q.role || '', ciecie: q.cut || '', w: Math.round(q.w), h: Math.round(q.h), x: Math.round(q.box.x0), y: Math.round(q.box.y0) })) }, text = JSON.stringify(out);
    try { await navigator.clipboard.writeText(text); say('Dane analizy są w schowku. Wklej je tam, gdzie chcesz je przekazać.'); }
    catch (e) { try { await saveFile('wykrojnik-analiza.json', new TextEncoder().encode(text), 'application/json', false, 'Schowek jest niedostępny, więc dane analizy zapisałam w pliku wykrojnik-analiza.json w folderze Wykrojnika.', 'Schowek jest niedostępny, więc dane analizy pobrały się jako plik wykrojnik-analiza.json.'); } catch (e2) { say('Nie udało się skopiować ani zapisać danych analizy.'); } }
  }
  $('seeCopy').addEventListener('click', anCopyData); $('anCopy').addEventListener('click', anCopyData);
  $('seeN').addEventListener('click', () => { const b = $('seeBox'); b.hidden = !b.hidden; $('seeN').setAttribute('aria-expanded', String(!b.hidden)); });
  const blStat = (t) => { const e = $('blS'); if (e) e.textContent = t || ''; };
  function blNote() {
    const e = $('blStat'); if (!e) return; const inApp = !!(desktop && desktop.childProcess);
    const more = (BL.whyC ? ' ' + BL.whyC : '') + (BL.why2 ? ' ' + BL.why2 : BL.last ? ' Ostatnio przeliczone: ' + BL.last + '.' : '');
    if (BL.mode === 'server' && BL.on) { e.textContent = 'Render wysokiej jakości jest podłączony. Gotowy obraz pojawia się w podglądzie 3D sekundę po zatrzymaniu widoku.' + more; $('blPathRow').hidden = true; return; }
    e.textContent = !inApp ? 'Render wysokiej jakości jest teraz niedostępny, więc widzisz zwykły podgląd. ' + (SRV.why || 'Sprawdzam usługę renderującą…') : BL.on ? 'Blender jest podłączony. Gotowy obraz pojawia się w podglądzie 3D sekundę po zatrzymaniu widoku.' + (BL.whyC ? ' ' + BL.whyC : '') + (BL.why2 ? ' ' + BL.why2 : BL.last ? ' Ostatnio przeliczone: ' + BL.last + '.' : '') : BL.why || (fileOk ? 'Szukam Blendera…' : 'Usługa renderująca nie odpowiada. Blender z tego komputera wymaga zgody na pliki, którą włączysz w panelu Projekty.');
    $('blPathRow').hidden = !inApp || BL.on || !BL.why;
  }
  async function blInit(custom) {
    if (!custom && (BL.mode === 'server' || (await srvInit()))) return;
    if (!desktop || !desktop.childProcess || !desktop.fs || !fileOk) { blNote(); return; }
    BL.mode = 'local';
    BL.on = false; BL.why = ''; blNote();
    try {
      const home = await desktop.os.homedir(), saved = (() => { try { return localStorage.getItem('wykrojnik.blender') || ''; } catch (e) { return ''; } })();
      const cands = [custom, saved, '/Applications/Blender.app/Contents/MacOS/Blender', home + '/Applications/Blender.app/Contents/MacOS/Blender'].filter(Boolean).map((p) => (/\.app\/?$/.test(p) ? p.replace(/\/$/, '') + '/Contents/MacOS/Blender' : p));
      let found = ''; for (const p of cands) if (await desktop.fs.exists(p).catch(() => false)) { found = p; break; }
      if (!found) { const r = await desktop.childProcess.exec("mdfind \"kMDItemCFBundleIdentifier == 'org.blenderfoundation.blender'\" | head -1", { timeout: 8000 }).catch(() => null), app = r && r.stdout ? r.stdout.trim().split('\n')[0] : ''; if (app && (await desktop.fs.exists(app + '/Contents/MacOS/Blender').catch(() => false))) found = app + '/Contents/MacOS/Blender'; }
      if (!found) { BL.why = custom ? 'Pod tą ścieżką nie ma Blendera. Wskaż plik Blender.app.' : 'Nie znalazłam Blendera na tym komputerze. Jeśli jest zainstalowany w nietypowym miejscu, podaj ścieżkę do Blender.app.'; blNote(); return; }
      if (custom) { try { localStorage.setItem('wykrojnik.blender', found); } catch (e) { /* ścieżka zostanie tylko na tę sesję */ } }
      BL.path = found; BL.dir = home + '/Documents/Wykrojnik/render'; await desktop.fs.mkdir(BL.dir, { recursive: true }); await desktop.fs.writeFile(BL.dir + '/wykrojnik_render.py', BL_PY, 'utf8');
      BL.on = true; blNote(); blTouch(); blSweep();
    } catch (e) { BL.why = 'Nie udało się przygotować Blendera: ' + String((e && e.message) || e).slice(0, 140); blNote(); }
  }
  // zapisane obrazy i ułożenia starsze niż dwa tygodnie znikają, żeby folder nie rósł bez końca
  async function blSweep() {
    try { const now = Date.now(), list = (await desktop.fs.readdir(BL.dir)).filter((e) => e.isFile && /^([a-z0-9]+\.png|tk-[a-z0-9]+\.bin)$/.test(e.name)).slice(0, 600);
      for (const e of list) { const st = await desktop.fs.stat(BL.dir + '/' + e.name).catch(() => null); if (st && now - st.mtimeMs > 14 * 864e5) await desktop.fs.rm(BL.dir + '/' + e.name).catch(() => {}); } } catch (e) { /* sprzątanie nie jest krytyczne */ }
  }
  function blStart() {
    if (BL.proc || BL.starting) return; BL.starting = true; BL.ready = false; BL.buf = '';
    const pr = desktop.childProcess.spawn(BL.path, ['-b', '--factory-startup', '-P', BL.dir + '/wykrojnik_render.py']); BL.proc = pr;
    pr.stdout.on('data', (ch) => { BL.buf += ch; let k; while ((k = BL.buf.indexOf('\n')) >= 0) { const ln = BL.buf.slice(0, k).trim(); BL.buf = BL.buf.slice(k + 1); if (ln.indexOf('WK ') === 0) blLine(ln); } });
    const gone = (why) => { if (BL.killing === pr) { why = ''; BL.killing = null; } if (BL.proc !== pr) return; BL.cur = null; BL.proc = null; BL.ready = false; BL.starting = false; BL.sent = ''; BL.busy = false; blStat(''); if (why) { BL.on = false; BL.why = why; blNote(); } };
    pr.on('error', (e) => gone('Blender się nie uruchomił: ' + String((e && e.message) || e).slice(0, 140)));
    pr.on('exit', (code) => gone(code ? 'Blender zakończył pracę z błędem (kod ' + code + '). Podgląd zostaje bez gotowego renderu.' : ''));
  }
  function blLine(ln) {
    const p = ln.split(' ');
    if (p[1] === 'READY') { BL.ready = true; BL.starting = false; blPump(); return; }
    const c = BL.cur; if (!c || c.id !== +p[2]) return; BL.cur = null; BL.busy = false;
    Promise.resolve(c.cb(p[1] === 'DONE', p.slice(3).join(' ').slice(0, 160))).then(blPump, blPump);
  }
  function blPump() { if (BL.clothQ) blClothGo(); else if (BL.want) blGo(); }
  async function blSend(job, cb, tp) { const id = ++BL.job; BL.cur = { id, cb, tp }; job.id = id; await BL.proc.stdin.write(JSON.stringify(job) + '\n'); }
  function blKill() { const pr = BL.proc; if (!pr) return; BL.killing = pr; BL.cur = null; BL.busy = false; pr.kill('SIGKILL').catch(() => {}); }
  // ---------- układanie tkaniny w Blenderze: płaskie elementy w skali 1:1, szwy jako sprężyny zszywające, kolizje z sylwetką i podłogą ----------
  function blBody() {
    const pos = [], idx = []; g3.scene.updateMatrixWorld(true); const v = new T3.Vector3();
    g3.scene.traverse((o) => { if (!o.isMesh || !o.material || !o.material.userData || !o.material.userData.body || !o.geometry.attributes.position) return; const P = o.geometry.attributes.position, off = pos.length / 3;
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos.push(+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)); }
      if (o.geometry.index) { const a = o.geometry.index.array; for (let i = 0; i < a.length; i++) idx.push(a[i] + off); } else for (let i = 0; i < P.count; i++) idx.push(i + off); });
    return { pos, idx };
  }
  function blClothData(tp, body) {
    const g = tp.g, pin = []; if (tp.holdOn && g.hold) for (const i of g.hold) pin.push(i); if (tp.pinned) for (let i = 0; i < g.ns; i++) if (g.pin[i] >= 0 && g.meta[i].pk !== 'S') pin.push(i);
    const r2 = (a) => Array.from(a, (x) => +x.toFixed(3));
    return { ns: g.ns, rmap: Array.from(g.rmap), uv: r2(g.ruv), tri: Array.from(g.tri), X: r2(tp.S.X), pin, body, floor: g3.floorY == null ? -110 : g3.floorY, st: tp.fab ? tp.fab.st : 0.3, knit: !!(tp.fab && tp.fab.knit), frames: 45 };
  }
  function blClothApply(tp, u8) {
    const g = tp.g; if (!u8 || u8.byteLength !== g.ns * 12) return false; const f = new Float32Array(u8.slice().buffer), lo = (g3.floorY == null ? -200 : g3.floorY) - 6;
    for (let i = 0; i < f.length; i += 3) if (!isFinite(f[i]) || !isFinite(f[i + 1]) || !isFinite(f[i + 2]) || Math.abs(f[i]) > 300 || Math.abs(f[i + 2]) > 300 || f[i + 1] < lo) return false;
    tp.S.X.set(f); tp.bl = 'done'; return true;
  }
  async function blCloth(tp) {
    if (BL.mode === 'server') return srvCloth(tp);
    tp.bl = 'run'; const file = BL.dir + '/tk-' + blHash(tp.key + '|c1|' + tp.g.ns) + '.bin';
    if (await desktop.fs.exists(file).catch(() => false)) { const u8 = await desktop.fs.readFile(file).catch(() => null); if (blClothApply(tp, u8)) { BL.last = 'tkanina z zapisu'; if (g3 && g3.top === tp) render3d(); return; } }
    BL.clothQ = { tp, file }; blStat('Układanie tkaniny…'); blPump();
  }
  async function blClothGo() {
    const q = BL.clothQ; if (!q) return; if (!BL.proc) { blStart(); return; } if (!BL.ready || BL.busy) return;
    BL.clothQ = null; const tp = q.tp; if (!g3 || g3.top !== tp) { blPump(); return; }
    BL.busy = true;
    try {
      const g = tp.g, body = blBody(); if (!body.idx.length) { tp.bl = 'fail'; BL.busy = false; blStat(''); blPump(); return; }
      const jf = BL.dir + '/tkanina.json';
      await desktop.fs.writeFile(jf, JSON.stringify(blClothData(tp, body)), 'utf8');
      await blSend({ cloth: jf, out: q.file }, async (ok, msg) => {
        blStat('');
        if (ok) { const u8 = await desktop.fs.readFile(q.file).catch(() => null); if (blClothApply(tp, u8)) { BL.last = 'tkanina ułożona w Blenderze'; BL.whyC = ''; if (g3 && g3.top === tp && state.view === '3d') render3d(); return; } msg = 'wynik nie przeszedł kontroli'; desktop.fs.rm(q.file).catch(() => {}); }
        tp.bl = 'fail'; BL.whyC = 'Blender nie ułożył tkaniny (' + msg + '). Widzisz ułożenie z podglądu.'; blNote();
      }, tp);
    } catch (e) { BL.busy = false; BL.cur = null; tp.bl = 'fail'; blStat(''); }
  }
  async function blShow(file, key) {
    try { const b64 = await desktop.fs.readFile(file, 'base64'); blPut('data:image/png;base64,' + b64, key); }
    catch (e) { blStat(''); }
  }
  function blPut(src, key) { if (key !== BL.want) return; const im = $('blImg'); im.onload = () => { if (key !== BL.want) return; const cs = g3.canvas.style; im.style.left = cs.left || '0'; im.style.top = '0'; im.style.width = cs.width || '100%'; im.style.height = '100%'; im.hidden = false; g3.canvas.style.opacity = '0'; BL.shown = key; blStat(''); seeFill(); }; im.src = src; }
  function blHide() { const im = $('blImg'); if (im && !im.hidden) { im.hidden = true; } if (g3 && g3.canvas) g3.canvas.style.opacity = ''; BL.shown = ''; seeFill(); }
  // wywoływane po każdym odświeżeniu podglądu: chowa gotowy obraz, gdy widok się zmienił, i zamawia nowy po sekundzie spokoju
  function blTouch() {
    seeFill();
    if (BL.mode !== 'server' && BL.cur && BL.cur.tp && (!g3 || g3.top !== BL.cur.tp)) { blKill(); blStat(''); } // inny projekt albo inne wymiary: stare układanie nie jest już potrzebne
    if (!BL.on && BL.mode !== 'local' && SRV.api && SRV.tries < 5 && Date.now() - SRV.last > 60000 && /^https?:/.test(location.protocol)) { SRV.tries++; srvInit(); } // usługa mogła być chwilowo niedostępna przy starcie
    if (!BL.on || !g3 || state.view !== '3d' || !$('home').hidden) { blHide(); clearTimeout(BL.t); BL.want = ''; return; }
    const r = g3.canvas.getBoundingClientRect(), ck = [cam.yaw.toFixed(3), cam.pitch.toFixed(3), cam.dist.toFixed(1), Math.round(r.width), Math.round(r.height), g3.mid.toFixed(1)].join('|');
    const dirty = BL.dirty; BL.dirty = false;
    if (BL.shown && (dirty || BL.shown.indexOf(ck + '#') !== 0)) blHide(); else if (BL.shown) return;
    clearTimeout(BL.t); BL.t = setTimeout(() => blAsk(ck), 1000);
  }
  async function blAsk(ck) {
    if (!BL.on || state.view !== '3d' || !g3) return;
    if ((g3.top && !g3.top.fail && !g3.top.done) || (g3.sim && !g3.sim.done) || !$('busy').hidden) { clearTimeout(BL.t); BL.t = setTimeout(() => blAsk(ck), 600); return; } // tkanina jeszcze się układa
    const tp = g3.top; if (tp && !tp.fail && tp.done && tp.g && !tp.bl) blCloth(tp);
    if (tp && tp.bl === 'run') { clearTimeout(BL.t); BL.t = setTimeout(() => blAsk(ck), 500); return; }
    let glb; try { glb = blGlb(); } catch (e) { glb = null; } if (!glb) return;
    const r = g3.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), sc = Math.min(1, 2000 / (Math.max(r.width, r.height) * dpr)), w = Math.round(r.width * dpr * sc), h = Math.round(r.height * dpr * sc);
    const key = ck + '#' + glb.sig + '.' + glb.msig, file = BL.dir + '/' + blHash(key + '|' + w + 'x' + h) + '.png'; BL.want = key; BL.pend = { glb, key, file, w, h };
    if (BL.mode === 'server') { srvRender(BL.pend); return; }
    if (await desktop.fs.exists(file).catch(() => false)) { BL.last = 'nic, obraz z zapisu'; blNote(); blShow(file, key); return; } // ten sam projekt i kadr: zapisany wynik
    BL.why2 = ''; blStat('Dopracowywanie podglądu…'); blGo();
  }
  async function blGo() {
    const q = BL.pend; if (!q || q.key !== BL.want) return; if (!BL.proc) { blStart(); return; } if (!BL.ready || BL.busy) return;
    BL.busy = true; const geoFile = BL.dir + '/scena.glb';
    try {
      const fresh = BL.sent !== q.glb.sig; if (fresh) { await desktop.fs.writeFile(geoFile, q.glb.bytes); BL.sent = q.glb.sig; }
      if (q.key !== BL.want) { BL.busy = false; blPump(); return; }
      const p = g3.camera.position;
      await blSend({ glb: geoFile, geo: q.glb.sig, mats: q.glb.mats, out: q.file, w: q.w, h: q.h, cam: { pos: [p.x, p.y, p.z], target: [0, g3.mid, 0], fov: g3.camera.fov } }, (ok, msg) => {
        if (BL.pend === q) BL.pend = null;
        if (q.key !== BL.want) return; // spóźniony wynik starszego zadania nie zastępuje widoku
        if (ok) { BL.last = (fresh ? 'scena i obraz' : 'tylko obraz') + (BL.last && BL.last.indexOf('tkanina') === 0 ? ', ' + BL.last : ''); blShow(q.file, q.key); blNote(); } else { blStat(''); BL.why2 = 'Blender nie wyrenderował tego widoku: ' + msg; blNote(); }
      });
    } catch (e) { BL.busy = false; BL.cur = null; blStat(''); BL.why2 = 'Nie udało się przekazać sceny do Blendera: ' + String((e && e.message) || e).slice(0, 140); blNote(); }
  }
  $('blPathGo').addEventListener('click', () => { const v = $('blPath').value.trim(); if (v) blInit(v); });
  if (TEST) window.__bl = { BL, blGlb, blInit, get g3() { return g3; } }; // tylko do testów
