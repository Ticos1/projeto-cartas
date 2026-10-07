import os, re, sys
root = sys.argv[1]
rows = []
for serie in sorted(os.listdir(root)):
    sp = os.path.join(root, serie)
    if not os.path.isdir(sp) or serie == "Pokémon TCG Pocket": continue
    for f in sorted(os.listdir(sp)):
        if not f.endswith(".ts"): continue
        s = open(os.path.join(sp, f), encoding="utf8").read()
        m = re.search(r"name:\s*\{(.*?)\}", s, re.S)
        names = m.group(1) if m else ""
        pt = re.search(r"['\"]?pt(?:-br)?['\"]?\s*:\s*['\"]([^'\"]+)", names)
        sid = re.search(r"id:\s*['\"]([^'\"]+)", s)
        rel = re.search(r"releaseDate:\s*(\{.*?\}|['\"][^'\"]+['\"])", s, re.S)
        cd = os.path.join(sp, f[:-3])
        total = ptc = 0
        if os.path.isdir(cd):
            for c in os.listdir(cd):
                if not c.endswith(".ts"): continue
                total += 1
                cs = open(os.path.join(cd, c), encoding="utf8").read()
                nm = re.search(r"name:\s*\{(.*?)\}", cs, re.S)
                if nm and re.search(r"['\"]?pt(-br)?['\"]?\s*:", nm.group(1)): ptc += 1
        rows.append((serie, f[:-3], sid.group(1) if sid else "?", pt.group(1) if pt else "-", total, ptc))
for r in rows: print("|".join(map(str, r)))
