# Offline LMS (Mobile & Desktop)

A modern, fast, mobile-friendly offline Learning Management System (LMS) and video course player. Built with Progressive Web App (PWA) support so you can open it once online and use it completely offline on both mobile phones (iOS / Android) and desktop computers.

---

## 🌟 Key Features

### 📱 1. Mobile-First & Touch-Friendly UI
- **Responsive Layout**: Designed for phones, tablets, and desktop displays with safe-area notch and dynamic island support.
- **Mobile Bottom Navigation**: One-thumb navigation between Chapters, Classes, To-Do list, and Folder sources.
- **Touch Gestures on Video Player**:
  - **Double-tap left**: Rewinds 10s with smooth ripple animation.
  - **Double-tap right**: Fast-forwards 10s with smooth ripple animation.
  - **Single tap**: Toggle playback / show controls.
  - **Touch Scrubber**: Smooth finger-drag timeline with floating timestamp tooltip.
- **Mobile Bottom Sheet To-Do**: Swipeable drawer for managing study goals and pending tasks.

### ⚡ 2. 100% Offline PWA (Progressive Web App)
- **Install to Home Screen**: Install as a standalone native-feeling app on iOS (Safari Share > Add to Home Screen) and Android (Chrome > Install App).
- **Offline Service Worker (`sw.js`)**: Automatically precaches the application shell. Works with **zero internet connection** after the first visit.

### 📂 3. Universal Folder & File Picking
- **Desktop (Chrome/Edge)**: Native `showDirectoryPicker()` with IndexedDB handle persistence ("Reopen Saved Folder" with one click).
- **Android**: Directory selection via `<input webkitdirectory>`.
- **iOS / Safari Fallback**: Multi-file picker (`<input multiple>`) that lets users select video and PDF files directly from the Files app and automatically groups them into subjects and chapters.
- **Pre-scanned Manifest**: Run `python3 scan_courses.py` to auto-generate `courses-manifest.js` for zero-click instant loading.

### 📊 4. Progress Tracking & Productivity
- Mark lectures as completed with visual checkmarks and chapter progress bars.
- Resumes video playback right where you left off with an instant resume notification and "Restart" option.
- Built-in **Study To-Do List** with active/completed filters and badge count.
- **Import & Export Progress**: Backup and restore your study progress as a JSON file across devices.

---

## 🚀 How to Host & Launch Online

You can host this repository for free on any static web host:

### Option A: GitHub Pages
1. Push this folder to a GitHub repository.
2. In the repository settings, go to **Pages** > Select `main` branch > `/root` > Save.
3. Your app will be live at `https://<username>.github.io/<repo-name>/`.

### Option B: Vercel / Netlify / Cloudflare Pages
1. Import the repository in [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
2. Deploy as a static site (no build command needed, publish directory is `.`).

---

## 💻 Local Usage

To run locally on your computer:

```bash
# Start a simple local server
python3 -m http.server 8080

# Open in your browser
# http://localhost:8080
```

To auto-generate a manifest from your local video folder:
```bash
python3 scan_courses.py
```
