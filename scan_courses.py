#!/usr/bin/env python3
import os
import json

root_dir = os.path.dirname(os.path.abspath(__file__))
files_list = []

for root, dirs, files in os.walk(root_dir):
    rel_root = os.path.relpath(root, root_dir)
    if rel_root == ".":
        continue
    # Skip hidden folders
    parts = rel_root.split(os.sep)
    if any(p.startswith('.') for p in parts):
        continue
        
    for f in sorted(files):
        if f.startswith('.') or f in ['app.js', 'styles.css', 'index.html', 'courses-manifest.js', 'scan_courses.py', 'update_classes.sh', 'pdf.min.js', 'pdf.worker.min.js', 'progress.json', 'classes-progress.json']:
            continue
        rel_path = os.path.join(rel_root, f).replace('\\', '/')
        try:
            file_size = os.path.getsize(os.path.join(root, f))
        except Exception:
            file_size = 0
        files_list.append({
            "path": rel_path,
            "size": file_size
        })

manifest_path = os.path.join(root_dir, "courses-manifest.js")
with open(manifest_path, "w", encoding="utf-8") as out:
    out.write("// Auto-generated Courses Manifest for Offline LMS\n")
    out.write("window.OFFLINE_LMS_MANIFEST = ")
    json.dump(files_list, out, indent=2, ensure_ascii=False)
    out.write(";\n")

print(f"Scanned {len(files_list)} files. Saved courses-manifest.js successfully!")
