#!/usr/bin/env python3
"""
Auto-scanner script for Offline LMS.
Scans current directory and subdirectories for course videos (.mp4, .mkv, .webm, etc.)
and documents (.pdf) and generates `courses-manifest.js` for instant pre-loading.
"""
import os
import json

root_dir = os.path.dirname(os.path.abspath(__file__))
files_list = []

IGNORE_DIRS = {'.git', '.agent', 'icons', '__pycache__', 'node_modules'}
IGNORE_FILES = {
    'app.js', 'styles.css', 'index.html', 'courses-manifest.js', 
    'scan_courses.py', 'sw.js', 'manifest.json', 'progress.json',
    'README.md', '.gitignore'
}

for root, dirs, files in os.walk(root_dir):
    # Filter directories in-place to avoid descending into ignored directories
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
    
    rel_root = os.path.relpath(root, root_dir)
    if rel_root == ".":
        continue
        
    for f in sorted(files):
        if f.startswith('.') or f in IGNORE_FILES:
            continue
            
        rel_path = os.path.join(rel_root, f).replace('\\', '/')
        file_path = os.path.join(root, f)
        try:
            file_size = os.path.getsize(file_path)
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

print(f"✓ Scanned {len(files_list)} files.")
print(f"✓ Saved manifest to {manifest_path}")
