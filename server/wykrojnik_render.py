import bpy, sys, json, math, os
from mathutils import Vector
def conv(p): return Vector((p[0], -p[2], p[1]))
st = {"geo": None}
def engine(sc):
    for e in (os.environ.get("WK_ENGINE", ""), "BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if not e: continue
        try:
            sc.render.engine = e; return
        except Exception: pass
def base():
    sc = bpy.context.scene; engine(sc)
    if sc.render.engine == "CYCLES":
        try:
            sc.cycles.samples = int(os.environ.get("WK_SAMPLES", "48")); sc.cycles.use_denoising = True; sc.cycles.device = "CPU"
        except Exception: pass
    sc.render.film_transparent = True; sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    try: sc.view_settings.view_transform = "Standard"
    except Exception: pass
    try: sc.eevee.taa_render_samples = 48
    except Exception: pass
    w = bpy.data.worlds.new("wk"); w.use_nodes = True; bg = w.node_tree.nodes.get("Background")
    if bg: bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 0.4
    sc.world = w
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
def purge():
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in [d for d in blk if d.users == 0]: blk.remove(d)
def load(job):
    if st["geo"] == job["geo"]: return
    for o in [o for o in bpy.data.objects if o.type == "MESH" or o.type == "EMPTY"]: bpy.data.objects.remove(o, do_unlink=True)
    purge(); bpy.ops.import_scene.gltf(filepath=job["glb"]); st["mats"] = {}
    for m in bpy.data.materials:
        if m.name.startswith("wk") and m.name[2:].split(".")[0].isdigit(): st["mats"][int(m.name[2:].split(".")[0])] = m
    for o in bpy.data.objects:
        if o.type == "MESH":
            for p in o.data.polygons: p.use_smooth = True
    st["geo"] = job["geo"]
def paint(job):
    for i, q in enumerate(job.get("mats") or []):
        m = st.get("mats", {}).get(i)
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m and m.node_tree else None
        if not b: continue
        col = b.inputs["Base Color"]; al = b.inputs["Alpha"]
        if not col.is_linked: col.default_value = (q["c"][0], q["c"][1], q["c"][2], 1.0)
        if not al.is_linked: al.default_value = q["a"]
        b.inputs["Roughness"].default_value = q["r"]; b.inputs["Metallic"].default_value = q["m"]
def aim(o, loc, to):
    o.location = loc; o.rotation_euler = (to - loc).to_track_quat("-Z", "Y").to_euler()
def named(name, make):
    o = bpy.data.objects.get(name)
    if o is None:
        o = make(); o.name = name; bpy.context.scene.collection.objects.link(o)
    return o
def frame(job):
    sc = bpy.context.scene; c = job["cam"]; pos = conv(c["pos"]); tgt = conv(c["target"])
    cam = named("wk_cam", lambda: bpy.data.objects.new("wk_cam", bpy.data.cameras.new("wk_cam")))
    cam.data.sensor_fit = "VERTICAL"; cam.data.angle_y = math.radians(c["fov"]); cam.data.clip_start = 1; cam.data.clip_end = 100000
    aim(cam, pos, tgt); sc.camera = cam
    sc.render.resolution_x = int(job["w"]); sc.render.resolution_y = int(job["h"]); sc.render.resolution_percentage = 100
    fwd = (tgt - pos).normalized(); up = Vector((0, 0, 1)); right = fwd.cross(up).normalized(); d = (tgt - pos).length
    for name, off, power in (("wk_key", right * -0.7 + up * 0.8 - fwd * 0.6, 3.0), ("wk_fill", right * 0.9 + up * 0.25 - fwd * 0.5, 1.0), ("wk_rim", right * 0.3 + up * 0.7 + fwd * 0.9, 1.4)):
        L = named(name, lambda: bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN")))
        L.data.energy = power; L.data.angle = 0.35; aim(L, tgt + off.normalized() * d, tgt)
def mk(name, verts, edges, faces):
    old = bpy.data.objects.get(name)
    if old: bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(name); me.from_pydata(verts, edges, faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o
def cloth(job):
    import array
    c = json.load(open(job["cloth"])); S = 0.01; sc = bpy.context.scene
    for o in [o for o in bpy.data.objects if o.type == "MESH" or o.type == "EMPTY"]: bpy.data.objects.remove(o, do_unlink=True)
    st["geo"] = None; purge()
    cv = lambda a, i: (a[i] * S, -a[i + 2] * S, a[i + 1] * S)
    bp = c["body"]["pos"]; bi = c["body"]["idx"]
    body = mk("wk_body", [cv(bp, i) for i in range(0, len(bp), 3)], [], [tuple(bi[i:i + 3]) for i in range(0, len(bi), 3)])
    body.modifiers.new("col", "COLLISION"); body.collision.thickness_outer = 0.004; body.collision.thickness_inner = 0.03; body.collision.cloth_friction = 12
    fz = c["floor"] * S; fl = mk("wk_floor", [(-3, -3, fz), (3, -3, fz), (3, 3, fz), (-3, 3, fz)], [], [(0, 1, 2, 3)])
    fl.modifiers.new("col", "COLLISION"); fl.collision.thickness_outer = 0.003; fl.collision.cloth_friction = 20
    X = c["X"]; rmap = c["rmap"]; uv = c["uv"]; tri = c["tri"]; ns = c["ns"]; nr = len(rmap)
    by = {}
    for r, s in enumerate(rmap): by.setdefault(s, []).append(r)
    sew = [(g[k], g[k + 1]) for g in by.values() for k in range(len(g) - 1)]
    lift = lambda p: (p[0], p[1], max(p[2], fz + 0.006))
    ob = mk("wk_cloth", [lift(cv(X, s * 3)) for s in rmap], sew, [tuple(tri[i:i + 3]) for i in range(0, len(tri), 3)])
    ob.shape_key_add(name="Basis"); flat = ob.shape_key_add(name="flat"); flat.value = 0.0; ob.active_shape_key_index = 0
    for i in range(nr): flat.data[i].co = (uv[i * 2] * S, uv[i * 2 + 1] * S, 0.0)
    m = ob.modifiers.new("cloth", "CLOTH"); s = m.settings; k = float(c.get("st", 0.3)); knit = bool(c.get("knit"))
    s.quality = 10; s.mass = 0.25; s.air_damping = 2.0; s.tension_stiffness = 6 if knit else 30; s.compression_stiffness = 6 if knit else 20; s.shear_stiffness = 3 if knit else 8
    s.bending_stiffness = 0.03 * (200 ** k); s.tension_damping = 8; s.compression_damping = 8; s.shear_damping = 8; s.bending_damping = 0.6
    s.use_sewing_springs = True; s.sewing_force_max = 0; s.rest_shape_key = flat
    pins = set(c.get("pin", []))
    if pins:
        vg = ob.vertex_groups.new(name="pin"); vg.add([r for r in range(nr) if rmap[r] in pins], 1.0, "REPLACE"); s.vertex_group_mass = "pin"
    cs = m.collision_settings; cs.use_collision = True; cs.distance_min = 0.004; cs.collision_quality = 3; cs.use_self_collision = True; cs.self_distance_min = 0.002; cs.self_friction = 5
    n = int(c.get("frames", 45)); m.point_cache.frame_start = 1; m.point_cache.frame_end = n; sc.frame_start = 1; sc.frame_end = n
    for f in range(1, n + 1): sc.frame_set(f)
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); vs = ev.data.vertices
    gaps = sorted((vs[a].co - vs[b].co).length / S for a, b in sew) or [0.0]
    if gaps[-1] > 8.0 or gaps[int(len(gaps) * 0.85)] > 1.5: raise Exception("szwy rozeszly sie o %.1f cm" % gaps[-1])
    out = array.array("f", [0.0]) * (ns * 3); cnt = [0] * ns
    for r in range(nr):
        co = vs[r].co; s3 = rmap[r] * 3; out[s3] += co.x / S; out[s3 + 1] += co.z / S; out[s3 + 2] += -co.y / S; cnt[rmap[r]] += 1
    for i in range(ns):
        if cnt[i] > 1:
            for q in range(3): out[i * 3 + q] /= cnt[i]
    with open(job["out"], "wb") as fh: out.tofile(fh)
    sc.frame_set(1)
    for o in [o for o in bpy.data.objects if o.type == "MESH"]: bpy.data.objects.remove(o, do_unlink=True)
base(); print("WK READY", flush=True)
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    jid = "?"
    try:
        job = json.loads(line); jid = job["id"]
        if job.get("quit"): break
        if job.get("cloth"): cloth(job)
        else:
            load(job); paint(job); frame(job); bpy.context.scene.render.filepath = job["out"]; bpy.ops.render.render(write_still=True)
        print("WK DONE %s" % jid, flush=True)
    except Exception as e:
        print("WK FAIL %s %s" % (jid, str(e).replace("\n", " ")[:300]), flush=True)
