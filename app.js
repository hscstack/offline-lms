// Offline LMS Application Logic with Hash Routing & State Management
(function () {
  'use strict';

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // --- STATE ---
  let coursesData = {}; // { Subject: { Chapter: { subject, chapter, lectures: [...] } } }
  let currentSubject = null;
  let currentChapter = null;
  let currentLectureIndex = -1;
  let currentSubjectFilter = 'all';
  let chaptersSearchQuery = '';
  let activeObjectURLs = [];
  let storedDirHandle = null; // FileSystem Access API directory handle
  let currentTodoFilter = 'all';

  const STORAGE_KEY_DONE     = 'offline_lms_done_classes';
  const STORAGE_KEY_LAST_POS = 'offline_lms_pos_';          // + lectureId
  const STORAGE_KEY_LAST_DUR = 'offline_lms_dur_';          // + lectureId
  const STORAGE_KEY_LAST_LEC = 'offline_lms_last_lecture';  // {sub, chap, idx, id, pos}
  const STORAGE_KEY_TODOS    = 'offline_lms_todos';
  const IDB_DB_NAME          = 'offline_lms_db';
  const IDB_STORE_NAME       = 'handles';
  const IDB_HANDLE_KEY       = 'root_dir_handle';

  // SVG Icons
  const SVG_CHECK  = `<svg class="check-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const SVG_CIRCLE = `<svg class="circle-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle></svg>`;

  // --- DOM ELEMENTS ---
  const welcomeModal = document.getElementById('welcome-modal');
  const folderInput = document.getElementById('folder-input');
  const changeFolderBtn = document.getElementById('change-folder-btn');
  const todoToggleBtn = document.getElementById('todo-toggle-btn');
  const todoOverlay = document.getElementById('todo-overlay');
  const todoDrawer = document.getElementById('todo-drawer');
  const todoCloseBtn = document.getElementById('todo-close-btn');
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const todoEmptyState = document.getElementById('todo-empty-state');
  const todoBadge = document.getElementById('todo-badge');
  const todoCountPill = document.getElementById('todo-count-pill');
  const todoClearCompletedBtn = document.getElementById('todo-clear-completed-btn');

  const exportProgressBtn = document.getElementById('export-progress-btn');
  const importProgressBtn = document.getElementById('import-progress-btn');
  const importProgressInput = document.getElementById('import-progress-input');
  const brandHomeBtn = document.getElementById('brand-home-btn');
  const rootFolderName = document.getElementById('root-folder-name');
  const reopenCardWrap = document.getElementById('reopen-card-wrap');
  const reopenFolderBtn = document.getElementById('reopen-folder-btn');
  const reopenBtnText = document.getElementById('reopen-btn-text');
  const continueWatchingContainer = document.getElementById('continue-watching-container');

  const overallProgressBar = document.getElementById('overall-progress-bar');
  const overallProgressText = document.getElementById('overall-progress-text');

  // View 1: Chapters Overview
  const viewChapters = document.getElementById('view-chapters');
  const chaptersSearchInput = document.getElementById('chapters-search');
  const subjectFilterTabs = document.getElementById('subject-filter-tabs');
  const chaptersGrid = document.getElementById('chapters-grid');

  // View 2: Chapter Classes List
  const viewClasses = document.getElementById('view-classes');
  const backToChaptersBtn = document.getElementById('back-to-chapters-btn');
  const currentChapterSubject = document.getElementById('current-chapter-subject');
  const currentChapterTitle = document.getElementById('current-chapter-title');
  const currentChapterProgress = document.getElementById('current-chapter-progress');
  const classesListContainer = document.getElementById('classes-list-container');

  // View 3: Player View
  const viewPlayer = document.getElementById('view-player');
  const backToClassesBtn = document.getElementById('back-to-classes-btn');
  const playerBreadcrumb = document.getElementById('player-breadcrumb');
  const playerClassTitle = document.getElementById('player-class-title');
  const playerMarkDoneBtn = document.getElementById('player-mark-done-btn');
  const playerPrevBtn = document.getElementById('player-prev-btn');
  const playerNextBtn = document.getElementById('player-next-btn');

  const playerVideoBox = document.getElementById('player-video-box');
  const mainVideoPlayer = document.getElementById('main-video-player');
  const playerDocBox = document.getElementById('player-doc-box');
  const mainPdfFrame = document.getElementById('main-pdf-frame');
  const docTitleText = document.getElementById('doc-title-text');
  const docSizeBadge = document.getElementById('doc-size-badge');
  const docExternalLink = document.getElementById('doc-external-link');
  const docDownloadLink = document.getElementById('doc-download-link');
  const docFullscreenBtn = document.getElementById('doc-fullscreen-btn');
  const playerTabsContainer = document.getElementById('player-tabs-container');
  const playerMediaContainer = document.querySelector('.player-media-container');

  const playerOtherBox = document.getElementById('player-other-box');
  const extraFilesList = document.getElementById('extra-files-list');
  const playerTabsList = document.getElementById('player-tabs-list');

  // Custom Player Elements
  const customPlayerWrapper = document.getElementById('custom-player-wrapper');
  const customVideoControls = document.getElementById('custom-video-controls');
  const videoClickSurface = document.getElementById('video-click-surface');
  const tapZoneLeft = document.getElementById('tap-zone-left');
  const tapZoneRight = document.getElementById('tap-zone-right');
  const rippleLeft = document.getElementById('ripple-left');
  const rippleRight = document.getElementById('ripple-right');
  const videoCenterIndicator = document.getElementById('video-center-indicator');
  const centerIconWrap = document.getElementById('center-icon-wrap');

  const videoResumeBanner = document.getElementById('video-resume-banner');
  const resumeTimeText = document.getElementById('resume-time-text');
  const resumeRestartBtn = document.getElementById('resume-restart-btn');
  const resumeDismissBtn = document.getElementById('resume-dismiss-btn');

  const playerProgressContainer = document.getElementById('player-progress-container');
  const progressBarBuffer = document.getElementById('progress-bar-buffer');
  const progressBarPlayed = document.getElementById('progress-bar-played');
  const playerTimeTooltip = document.getElementById('player-time-tooltip');

  const ctrlPlayBtn = document.getElementById('ctrl-play-btn');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const ctrlRewindBtn = document.getElementById('ctrl-rewind-btn');
  const ctrlForwardBtn = document.getElementById('ctrl-forward-btn');

  const ctrlMuteBtn = document.getElementById('ctrl-mute-btn');
  const iconVolHigh = document.getElementById('icon-vol-high');
  const iconVolLow = document.getElementById('icon-vol-low');
  const iconVolMute = document.getElementById('icon-vol-mute');
  const ctrlVolumeSlider = document.getElementById('ctrl-volume-slider');

  const playerTimeDisplay = document.getElementById('player-time-display');
  const ctrlTimeCurrent = document.getElementById('ctrl-time-current');
  const ctrlTimeDuration = document.getElementById('ctrl-time-duration');

  const ctrlSpeedBtn = document.getElementById('ctrl-speed-btn');
  const currentSpeedText = document.getElementById('ctrl-speed-text');
  const speedMenuPopover = document.getElementById('speed-menu-popover');
  const speedOptions = document.querySelectorAll('.speed-option');
  const customSpeedInput = document.getElementById('custom-speed-input');
  const btnSpeedMinus = document.getElementById('btn-speed-minus');
  const btnSpeedPlus = document.getElementById('btn-speed-plus');

  const ctrlPipBtn = document.getElementById('ctrl-pip-btn');
  const ctrlFullscreenBtn = document.getElementById('ctrl-fullscreen-btn');
  const iconFsEnter = document.getElementById('icon-fs-enter');
  const iconFsExit = document.getElementById('icon-fs-exit');

  // Custom Player Internal State
  let isScrubbing = false;
  let scrubTargetTime = 0;
  let wasPlayingBeforeScrub = false;
  let showRemainingTime = false;
  let controlsHideTimeout = null;
  let centerIndicatorTimeout = null;
  let resumeBannerTimeout = null;
  let lastNonZeroVolume = 1.0;
  let clickCounter = 0;
  let singleClickTimeout = null;
  let currentVideoLectureId = null;
  let isHoveringControls = false;
  let lastPositionSaveTime = 0;

  const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25];

  // --- LOCAL STORAGE HELPERS ---
  function getDoneClasses() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DONE);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function setDoneClasses(set) {
    try {
      localStorage.setItem(STORAGE_KEY_DONE, JSON.stringify(Array.from(set)));
    } catch (e) {}
  }

  function isClassDone(lectureId) {
    return getDoneClasses().has(lectureId);
  }

  function toggleClassDone(lectureId) {
    const doneSet = getDoneClasses();
    if (doneSet.has(lectureId)) {
      doneSet.delete(lectureId);
    } else {
      doneSet.add(lectureId);
    }
    setDoneClasses(doneSet);
    updateGlobalProgress();
    if (viewChapters.classList.contains('active')) renderChaptersGrid();
    if (viewClasses.classList.contains('active')) renderChapterClasses();
    if (viewPlayer.classList.contains('active')) updatePlayerDoneButton();
    renderContinueWatchingCard();
  }

  // Natural sort helper for numbers in strings (e.g. "Lecture 2" before "Lecture 10")
  function naturalSort(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  // Subject Pill Color helper
  function getSubjectColorClass(subject) {
    const s = (subject || '').toLowerCase();
    if (s.includes('physic') || s.includes('পদার্থ')) return 'physics';
    if (s.includes('chem') || s.includes('রসায়ন') || s.includes('রসায়ন')) return 'chemistry';
    if (s.includes('math') || s.includes('গণিত')) return 'math';
    if (s.includes('bio') || s.includes('জীব')) return 'biology';
    if (s.includes('ict')) return 'ict';
    return 'default';
  }

  // --- PLAYBACK POSITION & LAST LECTURE PERSISTENCE ---
  function saveLastLecture(sub, chap, idx, id, pos) {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_LEC, JSON.stringify({
        sub, chap, idx, id, pos: Math.floor(pos), timestamp: Date.now()
      }));
    } catch(e) {}
  }

  function getLastLecture() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_LEC);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function getSavedPosition(lectureId) {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_POS + lectureId);
    return raw ? parseInt(raw, 10) : 0;
  }

  function saveCurrentVideoPosition(force = false) {
    if (!currentVideoLectureId || !mainVideoPlayer.src) return;
    const now = Date.now();
    if (!force && (now - lastPositionSaveTime < 2500)) return; // Throttle to prevent playback jank
    lastPositionSaveTime = now;

    const curTime = mainVideoPlayer.currentTime;
    const dur = mainVideoPlayer.duration || 0;

    if (curTime > 2 && (!dur || curTime < dur - 5) && !mainVideoPlayer.ended) {
      const sec = Math.floor(curTime);
      localStorage.setItem(STORAGE_KEY_LAST_POS + currentVideoLectureId, sec);
      if (dur > 0) {
        localStorage.setItem(STORAGE_KEY_LAST_DUR + currentVideoLectureId, Math.floor(dur));
      }
      if (currentSubject && currentChapter && currentLectureIndex >= 0) {
        saveLastLecture(currentSubject, currentChapter, currentLectureIndex, currentVideoLectureId, sec);
      }
    }
  }

  // Save on page exit / backgrounding
  window.addEventListener('beforeunload', () => saveCurrentVideoPosition(true));
  window.addEventListener('pagehide', () => saveCurrentVideoPosition(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentVideoPosition(true);
  });

  // --- MANUAL EXPORT / IMPORT PROGRESS HELPERS ---
  function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // --- TO-DO SYSTEM & PERSISTENCE ---
  function getTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TODOS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTodos(todos) {
    try {
      localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
    } catch (e) {}
    updateTodoBadge();
    renderTodoList();
  }

  function addTodo(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const todos = getTodos();
    const newTodo = {
      id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      text: trimmed,
      completed: false,
      created_at: Date.now()
    };
    todos.unshift(newTodo);
    saveTodos(todos);
    showToast('Task added!');
  }

  function toggleTodo(id) {
    const todos = getTodos();
    const target = todos.find(t => t.id === id);
    if (target) {
      target.completed = !target.completed;
      saveTodos(todos);
    }
  }

  function deleteTodo(id) {
    let todos = getTodos();
    todos = todos.filter(t => t.id !== id);
    saveTodos(todos);
    showToast('Task deleted');
  }

  function clearCompletedTodos() {
    let todos = getTodos();
    const initialLen = todos.length;
    todos = todos.filter(t => !t.completed);
    if (todos.length < initialLen) {
      saveTodos(todos);
      showToast('Completed tasks cleared');
    }
  }

  function updateTodoBadge() {
    const todos = getTodos();
    const pendingCount = todos.filter(t => !t.completed).length;
    if (todoBadge) {
      if (pendingCount > 0) {
        todoBadge.textContent = pendingCount > 99 ? '99+' : String(pendingCount);
        todoBadge.style.display = 'inline-flex';
      } else {
        todoBadge.style.display = 'none';
      }
    }
    if (todoCountPill) {
      todoCountPill.textContent = `${pendingCount} ${pendingCount === 1 ? 'task' : 'tasks'} pending`;
    }
    if (todoClearCompletedBtn) {
      const hasCompleted = todos.some(t => t.completed);
      todoClearCompletedBtn.style.display = hasCompleted ? 'block' : 'none';
    }
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diffSec = Math.floor((now - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderTodoList() {
    if (!todoList) return;
    const todos = getTodos();
    let filtered = todos;
    if (currentTodoFilter === 'active') {
      filtered = todos.filter(t => !t.completed);
    } else if (currentTodoFilter === 'completed') {
      filtered = todos.filter(t => t.completed);
    }

    todoList.innerHTML = '';
    if (filtered.length === 0) {
      if (todoEmptyState) {
        todoEmptyState.style.display = 'flex';
        const emptyDesc = todoEmptyState.querySelector('.empty-desc');
        if (emptyDesc) {
          if (currentTodoFilter === 'completed') {
            emptyDesc.textContent = 'No completed tasks yet.';
          } else if (currentTodoFilter === 'active') {
            emptyDesc.textContent = 'No active tasks! You have completed everything.';
          } else {
            emptyDesc.textContent = 'No tasks in this list. Add a task above to stay organized.';
          }
        }
      }
    } else {
      if (todoEmptyState) todoEmptyState.style.display = 'none';
      filtered.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        const timeStr = formatRelativeTime(todo.created_at);

        li.innerHTML = `
          <button type="button" class="todo-item-check" data-id="${escapeHtml(todo.id)}" title="${todo.completed ? 'Mark as incomplete' : 'Mark as complete'}" aria-label="Toggle task">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <div class="todo-item-content">
            <span class="todo-item-text">${escapeHtml(todo.text)}</span>
            ${timeStr ? `<span class="todo-item-time">${escapeHtml(timeStr)}</span>` : ''}
          </div>
          <button type="button" class="todo-item-del" data-id="${escapeHtml(todo.id)}" title="Delete task" aria-label="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;
        todoList.appendChild(li);
      });
    }
  }

  function openTodoDrawer() {
    if (!todoOverlay) return;
    todoOverlay.style.display = 'flex';
    void todoOverlay.offsetWidth;
    todoOverlay.classList.add('open');
    renderTodoList();
    updateTodoBadge();
    if (todoInput) {
      setTimeout(() => todoInput.focus(), 150);
    }
  }

  function closeTodoDrawer() {
    if (!todoOverlay) return;
    todoOverlay.classList.remove('open');
    setTimeout(() => {
      if (!todoOverlay.classList.contains('open')) {
        todoOverlay.style.display = 'none';
      }
    }, 250);
  }

  function exportProgressFile() {
    const doneClasses = Array.from(getDoneClasses());
    const positions = {};
    const durations = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_LAST_POS)) {
        const id = key.substring(STORAGE_KEY_LAST_POS.length);
        const val = parseInt(localStorage.getItem(key), 10);
        if (!isNaN(val)) positions[id] = val;
      } else if (key && key.startsWith(STORAGE_KEY_LAST_DUR)) {
        const id = key.substring(STORAGE_KEY_LAST_DUR.length);
        const val = parseInt(localStorage.getItem(key), 10);
        if (!isNaN(val)) durations[id] = val;
      }
    }

    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      done_classes: doneClasses,
      positions,
      durations,
      last_lecture: getLastLecture(),
      todos: getTodos(),
      settings: {
        preferred_speed: parseFloat(localStorage.getItem('offline_lms_preferred_speed') || '1'),
        preferred_volume: parseFloat(localStorage.getItem('offline_lms_preferred_volume') || '1')
      }
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progress.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Progress exported to progress.json');
  }

  function importProgressFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== 'object') throw new Error('Invalid JSON');

        // 1. Merge / Set Done classes
        if (Array.isArray(data.done_classes)) {
          const current = getDoneClasses();
          data.done_classes.forEach(id => {
            if (typeof id === 'string') current.add(id);
          });
          setDoneClasses(current);
        }

        // 2. Set Positions & Durations
        if (data.positions && typeof data.positions === 'object') {
          Object.entries(data.positions).forEach(([id, pos]) => {
            if (typeof pos === 'number' && !isNaN(pos)) {
              localStorage.setItem(STORAGE_KEY_LAST_POS + id, String(Math.floor(pos)));
            }
          });
        }
        if (data.durations && typeof data.durations === 'object') {
          Object.entries(data.durations).forEach(([id, dur]) => {
            if (typeof dur === 'number' && !isNaN(dur)) {
              localStorage.setItem(STORAGE_KEY_LAST_DUR + id, String(Math.floor(dur)));
            }
          });
        }

        // 3. Last lecture
        if (data.last_lecture && typeof data.last_lecture === 'object') {
          try {
            localStorage.setItem(STORAGE_KEY_LAST_LEC, JSON.stringify(data.last_lecture));
          } catch(e) {}
        }

        // 4. Todos
        if (Array.isArray(data.todos)) {
          const currentTodos = getTodos();
          const existingIds = new Set(currentTodos.map(t => t.id));
          const merged = [...currentTodos];
          data.todos.forEach(t => {
            if (t && typeof t === 'object' && t.text) {
              if (t.id && existingIds.has(t.id)) {
                const idx = merged.findIndex(item => item.id === t.id);
                if (idx >= 0) merged[idx] = t;
              } else {
                merged.push({
                  id: t.id || 'todo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                  text: String(t.text),
                  completed: Boolean(t.completed),
                  created_at: t.created_at || Date.now()
                });
              }
            }
          });
          saveTodos(merged);
        }

        // 5. Settings
        if (data.settings && typeof data.settings === 'object') {
          if (data.settings.preferred_speed) {
            localStorage.setItem('offline_lms_preferred_speed', String(data.settings.preferred_speed));
          }
          if (data.settings.preferred_volume !== undefined) {
            localStorage.setItem('offline_lms_preferred_volume', String(data.settings.preferred_volume));
          }
        }

        // Refresh UI views
        updateGlobalProgress();
        if (viewChapters && viewChapters.classList.contains('active')) renderChaptersGrid();
        if (viewClasses && viewClasses.classList.contains('active')) renderChapterClasses();
        if (viewPlayer && viewPlayer.classList.contains('active')) updatePlayerDoneButton();
        renderContinueWatchingCard();
        updateTodoBadge();
        renderTodoList();

        showToast('Progress imported successfully!');
      } catch (err) {
        alert('Could not read progress file. Make sure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  }

  // --- INDEXEDDB: Persist FileSystem Access API directory handle ---
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async function saveHandleToIDB(handle) {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put(handle, IDB_HANDLE_KEY);
    } catch(e) {}
  }

  async function loadHandleFromIDB() {
    try {
      const db = await openIDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const req = tx.objectStore(IDB_STORE_NAME).get(IDB_HANDLE_KEY);
        req.onsuccess = (e) => resolve(e.target.result || null);
        req.onerror   = (e) => reject(e.target.error);
      });
    } catch(e) { return null; }
  }

  async function tryAutoLoadFromHandle(handle) {
    if (!handle) return false;
    try {
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') {
        const req = await handle.requestPermission({ mode: 'read' });
        if (req !== 'granted') return false;
      }
      storedDirHandle = handle;
      await loadCoursesFromHandle(handle);
      return true;
    } catch(e) {
      return false;
    }
  }

  const SKIP_NAMES = new Set(['app.js', 'styles.css', 'index.html', 'courses-manifest.js', 'scan_courses.py', 'update_classes.sh']);

  async function walkDirHandle(dirHandle, pathParts, lecturesMap) {
    for await (const [name, entry] of dirHandle.entries()) {
      if (name.startsWith('.') || SKIP_NAMES.has(name)) continue;

      if (entry.kind === 'directory') {
        await walkDirHandle(entry, [...pathParts, name], lecturesMap);
      } else {
        const file = await entry.getFile();
        classifyAndInsertItem(file, [...pathParts, name], lecturesMap);
      }
    }
  }

  async function loadCoursesFromHandle(dirHandle) {
    coursesData = {};
    const lecturesMap = {};
    rootFolderName.textContent = 'Offline LMS';

    await walkDirHandle(dirHandle, [], lecturesMap);

    finalizeCoursesData();
  }

  // --- UNIVERSAL ITEM CLASSIFICATION & PARSING ---
  // Handles real File objects, Directory Handle files, and Manifest items ({path, size})
  function classifyAndInsertItem(item, pathParts, lecturesMap) {
    const fileName = pathParts[pathParts.length - 1];
    if (!fileName || fileName.startsWith('.') || SKIP_NAMES.has(fileName)) return;

    let subject = 'General';
    let chapter = 'General';
    let lectureName = 'Lecture';

    if (pathParts.length >= 4) {
      subject     = pathParts[0];
      chapter     = pathParts[1];
      const rawName = pathParts.slice(2).join(' - ');
      const lastDot = rawName.lastIndexOf('.');
      lectureName = lastDot > 0 ? rawName.substring(0, lastDot) : rawName;
    } else if (pathParts.length === 3) {
      subject     = pathParts[0];
      chapter     = pathParts[1];
      const lastDot = fileName.lastIndexOf('.');
      lectureName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    } else if (pathParts.length === 2) {
      subject     = 'General';
      chapter     = pathParts[0];
      const lastDot = fileName.lastIndexOf('.');
      lectureName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    } else {
      // 1 part (flat file or direct file selection)
      const lastDot = fileName.lastIndexOf('.');
      const rawName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
      const parts = rawName.split(/[-_—]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        subject = parts[0];
        chapter = parts[1];
        lectureName = parts.slice(2).join(' - ');
      } else if (parts.length === 2) {
        subject = 'General';
        chapter = parts[0];
        lectureName = parts[1];
      } else {
        subject = 'General';
        chapter = 'All Classes';
        lectureName = rawName;
      }
    }

    const lectureId = `${subject}:::${chapter}:::${lectureName}`;

    if (!coursesData[subject]) coursesData[subject] = {};
    if (!coursesData[subject][chapter]) {
      coursesData[subject][chapter] = { subject, chapter, lectures: [] };
    }

    if (!lecturesMap[lectureId]) {
      lecturesMap[lectureId] = {
        id: lectureId,
        subject,
        chapter,
        name: lectureName,
        video: null,
        lectureSheet: null,
        practiceSheet: null,
        otherPdfs: [],
        otherFiles: []
      };
      coursesData[subject][chapter].lectures.push(lecturesMap[lectureId]);
    }

    const lec   = lecturesMap[lectureId];
    const lower = fileName.toLowerCase();

    if (/\.(mp4|webm|mkv|mov|avi|m4v|ogv|3gp|ts)$/i.test(lower)) {
      if (!lec.video) lec.video = item; else lec.otherFiles.push(item);
    } else if (lower.endsWith('.pdf')) {
      if (lower.includes('lecture') || lower.includes('class') || lower.includes('sheet') || lower.includes('লেফটেন্যান্ট') || lower.includes('লেকচার')) {
        if (!lec.lectureSheet) lec.lectureSheet = item; else lec.otherPdfs.push(item);
      } else if (lower.includes('practice') || lower.includes('dpp') || lower.includes('অনুশীলনী') || lower.includes('exam')) {
        if (!lec.practiceSheet) lec.practiceSheet = item; else lec.otherPdfs.push(item);
      } else {
        lec.otherPdfs.push(item);
      }
    } else {
      lec.otherFiles.push(item);
    }
  }

  function finalizeCoursesData() {
    // Sort lectures inside each chapter
    Object.keys(coursesData).forEach(sub => {
      Object.keys(coursesData[sub]).forEach(chap => {
        coursesData[sub][chap].lectures.sort((a, b) => naturalSort(a.name, b.name));
      });
    });

    welcomeModal.style.display = 'none';
    updateGlobalProgress();
    renderSubjectFilterTabs();
    renderContinueWatchingCard();

    if (!window.location.hash || window.location.hash === '#/') {
      navigateTo('#/');
      renderChaptersOverviewView();
    } else {
      handleRoute();
    }
  }

  // --- MANIFEST-BASED AUTO LOAD ---
  function loadCoursesFromManifest(manifestList) {
    coursesData = {};
    const lecturesMap = {};
    rootFolderName.textContent = 'Offline LMS';

    manifestList.forEach(entry => {
      const parts = entry.path.split('/');
      classifyAndInsertItem(entry, parts, lecturesMap);
    });

    finalizeCoursesData();
  }

  // --- FOLDER INPUT PARSER (Standard Fallback) ---
  function parseSelectedFolder(files) {
    coursesData = {};
    if (!files || files.length === 0) return;

    rootFolderName.textContent = 'Offline LMS';

    const lecturesMap = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');
      classifyAndInsertItem(file, parts, lecturesMap);
    }

    finalizeCoursesData();
  }

  // --- MEDIA URL & METADATA HELPERS ---
  function getMediaUrl(item) {
    if (!item) return '';
    if (item instanceof Blob || item instanceof File) {
      const url = URL.createObjectURL(item);
      activeObjectURLs.push(url);
      return url;
    }
    if (typeof item === 'string') return encodeURI(item);
    if (item.path) return encodeURI(item.path);
    return '';
  }

  function getItemName(item) {
    if (!item) return '';
    if (item.name) return item.name;
    if (item.path) {
      const parts = item.path.split('/');
      return parts[parts.length - 1];
    }
    return 'File';
  }

  function getItemSize(item) {
    if (!item) return 0;
    return item.size || 0;
  }

  // --- CONTINUE WATCHING CARD ---
  function renderContinueWatchingCard() {
    if (!continueWatchingContainer) return;
    continueWatchingContainer.innerHTML = '';

    const last = getLastLecture();
    if (!last) return;

    const { sub, chap, idx, id, pos } = last;
    const chapData = coursesData[sub] && coursesData[sub][chap];
    if (!chapData || !chapData.lectures[idx]) return;

    const lec = chapData.lectures[idx];
    if (isClassDone(lec.id)) return; // Don't show if already completed

    const savedPos = getSavedPosition(lec.id);
    const displayPos = savedPos || pos || 0;
    if (displayPos < 3) return; // Don't show if watched less than 3s

    const card = document.createElement('div');
    card.className = 'continue-watching-card';

    card.innerHTML = `
      <div class="continue-left">
        <div class="continue-play-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
        </div>
        <div class="continue-info">
          <div class="continue-title">${escapeHtml(lec.name)}</div>
          <div class="continue-sub">${escapeHtml(sub)} • ${escapeHtml(chap)} • ${formatTimeSec(displayPos)}</div>
        </div>
      </div>
      <button class="btn-continue-play" id="btn-continue-play">Resume</button>
    `;

    continueWatchingContainer.appendChild(card);

    const navigateToLec = () => {
      navigateTo(`#/player?sub=${encodeURIComponent(sub)}&chap=${encodeURIComponent(chap)}&idx=${idx}`);
    };
    const playBtn = document.getElementById('btn-continue-play');
    if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateToLec(); });
    card.addEventListener('click', navigateToLec);
  }

  function formatTimeSec(sec) {
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
  }

  // --- TEARDOWN MEDIA ---
  function stopAllMedia() {
    saveCurrentVideoPosition(true);

    if (mainVideoPlayer) {
      mainVideoPlayer.pause();
      mainVideoPlayer.removeAttribute('src');
      mainVideoPlayer.load();
    }
    if (mainPdfFrame) {
      mainPdfFrame.removeAttribute('src');
    }
    activeObjectURLs.forEach(url => URL.revokeObjectURL(url));
    activeObjectURLs = [];
    resetCustomPlayerUI();
  }

  function resetCustomPlayerUI() {
    currentVideoLectureId = null;
    isScrubbing = false;
    isHoveringControls = false;
    clearTimeout(resumeBannerTimeout);
    clearTimeout(controlsHideTimeout);
    clearTimeout(centerIndicatorTimeout);
    clearTimeout(singleClickTimeout);
    clickCounter = 0;
    if (progressBarPlayed) progressBarPlayed.style.width = '0%';
    if (progressBarBuffer) progressBarBuffer.style.width = '0%';
    if (ctrlTimeCurrent) ctrlTimeCurrent.textContent = '00:00';
    if (ctrlTimeDuration) ctrlTimeDuration.textContent = '00:00';
    if (iconPlay && iconPause) {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    }
    if (videoResumeBanner) videoResumeBanner.style.display = 'none';
    if (customPlayerWrapper) customPlayerWrapper.classList.remove('controls-hidden');
    if (speedMenuPopover) speedMenuPopover.style.display = 'none';
  }

  // --- ROUTER (Hash-Based) ---
  function navigateTo(hash) {
    window.location.hash = hash;
  }

  function handleRoute() {
    if (Object.keys(coursesData).length === 0) {
      welcomeModal.style.display = 'flex';
      return;
    }

    const hash = window.location.hash || '#/';

    if (hash.startsWith('#/player')) {
      const params = parseHashParams(hash);
      const sub = decodeURIComponent(params.sub || '');
      const chap = decodeURIComponent(params.chap || '');
      const idx = parseInt(params.idx || '0', 10);

      if (coursesData[sub] && coursesData[sub][chap] && coursesData[sub][chap].lectures[idx]) {
        currentSubject = sub;
        currentChapter = chap;
        currentLectureIndex = idx;
        renderPlayerView(idx);
      } else {
        navigateTo('#/');
      }
    } else if (hash.startsWith('#/chapter')) {
      stopAllMedia();
      const params = parseHashParams(hash);
      const sub = decodeURIComponent(params.sub || '');
      const chap = decodeURIComponent(params.chap || '');

      if (coursesData[sub] && coursesData[sub][chap]) {
        currentSubject = sub;
        currentChapter = chap;
        currentLectureIndex = -1;
        renderClassesListView();
      } else {
        navigateTo('#/');
      }
    } else {
      stopAllMedia();
      currentSubject = null;
      currentChapter = null;
      currentLectureIndex = -1;
      renderChaptersOverviewView();
    }
  }

  function parseHashParams(hash) {
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return {};
    const qs = hash.substring(qIdx + 1);
    const params = {};
    qs.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) params[k] = v || '';
    });
    return params;
  }

  window.addEventListener('hashchange', handleRoute);

  // --- VIEW 1: CHAPTERS OVERVIEW ---
  function renderChaptersOverviewView() {
    viewChapters.classList.add('active');
    viewClasses.classList.remove('active');
    viewPlayer.classList.remove('active');
    renderContinueWatchingCard();
    renderChaptersGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSubjectFilterTabs() {
    if (!subjectFilterTabs) return;
    subjectFilterTabs.innerHTML = '';
    const subjects = Object.keys(coursesData).sort(naturalSort);
    let totalChapters = 0;
    subjects.forEach(s => totalChapters += Object.keys(coursesData[s]).length);

    const allBtn = document.createElement('button');
    allBtn.className = `subject-tab-btn ${currentSubjectFilter === 'all' ? 'active' : ''}`;
    allBtn.innerHTML = `<span>All Subjects</span> <span class="tab-count">${totalChapters}</span>`;
    allBtn.addEventListener('click', () => {
      currentSubjectFilter = 'all';
      renderSubjectFilterTabs();
      renderChaptersGrid();
    });
    subjectFilterTabs.appendChild(allBtn);

    subjects.forEach(sub => {
      const count = Object.keys(coursesData[sub]).length;
      const btn = document.createElement('button');
      btn.className = `subject-tab-btn ${currentSubjectFilter === sub ? 'active' : ''}`;
      btn.innerHTML = `<span>${escapeHtml(sub)}</span> <span class="tab-count">${count}</span>`;
      btn.addEventListener('click', () => {
        currentSubjectFilter = sub;
        renderSubjectFilterTabs();
        renderChaptersGrid();
      });
      subjectFilterTabs.appendChild(btn);
    });
  }

  function renderChaptersGrid() {
    if (!chaptersGrid) return;
    chaptersGrid.innerHTML = '';
    const doneSet = getDoneClasses();
    const query = (chaptersSearchQuery || '').trim().toLowerCase();

    const chapterList = [];

    Object.keys(coursesData).forEach(sub => {
      if (currentSubjectFilter !== 'all' && currentSubjectFilter !== sub) return;

      Object.keys(coursesData[sub]).forEach(chap => {
        const chapObj = coursesData[sub][chap];
        const lectures = chapObj.lectures;
        const total = lectures.length;
        const done = lectures.filter(l => doneSet.has(l.id)).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        const matchesQuery = !query || sub.toLowerCase().includes(query) || chap.toLowerCase().includes(query) || lectures.some(l => l.name.toLowerCase().includes(query));
        if (matchesQuery) {
          chapterList.push({ subject: sub, chapter: chap, total, done, pct });
        }
      });
    });

    if (chapterList.length === 0) {
      chaptersGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-subtle);">
          <p style="font-weight: 700; font-size: 15px; color: var(--text-title);">No chapters found</p>
          <p style="font-size: 13px; margin-top: 4px;">Make sure the selected folder contains video or PDF files.</p>
        </div>
      `;
      return;
    }

    chapterList.sort((a, b) => naturalSort(a.chapter, b.chapter));

    chapterList.forEach(c => {
      const card = document.createElement('div');
      card.className = 'chapter-card';
      const colorClass = getSubjectColorClass(c.subject);

      card.innerHTML = `
        <div>
          <div class="chapter-card-top">
            <span class="subject-pill ${colorClass}">${escapeHtml(c.subject)}</span>
            <span class="chapter-card-count">${c.total} ${c.total === 1 ? 'class' : 'classes'}</span>
          </div>
          <h3 class="chapter-card-title">${escapeHtml(c.chapter)}</h3>
        </div>
        <div class="chapter-card-bottom">
          <div class="chapter-progress-meta">
            <span>${c.done > 0 ? `${c.done} of ${c.total} completed` : `${c.total} ${c.total === 1 ? 'class' : 'classes'}`}</span>
            <span style="font-weight: 700; font-family: var(--font-mono);">${c.pct}%</span>
          </div>
          <div class="chapter-card-track">
            <div class="chapter-card-fill" style="width: ${c.pct}%;"></div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        navigateTo(`#/chapter?sub=${encodeURIComponent(c.subject)}&chap=${encodeURIComponent(c.chapter)}`);
      });

      chaptersGrid.appendChild(card);
    });
  }

  // In-chapter search state
  let chapterSearchQuery = '';

  function renderClassesListView() {
    viewChapters.classList.remove('active');
    viewClasses.classList.add('active');
    viewPlayer.classList.remove('active');
    chapterSearchQuery = '';
    const searchInput = document.getElementById('chapter-classes-search');
    if (searchInput) searchInput.value = '';
    renderChapterClasses();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderChapterClasses() {
    if (!currentSubject || !currentChapter || !coursesData[currentSubject] || !coursesData[currentSubject][currentChapter]) {
      navigateTo('#/');
      return;
    }

    const chapObj = coursesData[currentSubject][currentChapter];
    const doneSet = getDoneClasses();
    const total = chapObj.lectures.length;
    let done = 0;

    chapObj.lectures.forEach(l => {
      if (doneSet.has(l.id)) done++;
    });

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    if (currentChapterSubject) {
      currentChapterSubject.textContent = chapObj.subject;
      currentChapterSubject.className = 'chapter-subject-name';
    }
    if (currentChapterTitle) currentChapterTitle.textContent = chapObj.chapter;

    const chapterProgressText = document.getElementById('current-chapter-progress');
    if (chapterProgressText) {
      chapterProgressText.textContent = `${done} of ${total} completed`;
    }
    const chapterMeter = document.getElementById('chapter-meter-fill');
    if (chapterMeter) {
      chapterMeter.style.width = `${pct}%`;
      chapterMeter.className = 'chapter-progress-fill';
    }

    // Filter lectures by search query
    const query = chapterSearchQuery.toLowerCase();
    const filteredLectures = [];

    chapObj.lectures.forEach((lec, origIdx) => {
      const matchesSearch = !query || lec.name.toLowerCase().includes(query);
      if (matchesSearch) {
        filteredLectures.push({ lec, origIdx });
      }
    });

    classesListContainer.innerHTML = '';

    if (filteredLectures.length === 0) {
      classesListContainer.innerHTML = `
        <div class="empty-state">
          <p>No classes match your search.</p>
        </div>
      `;
      return;
    }

    filteredLectures.forEach(({ lec, origIdx }) => {
      const isDone = doneSet.has(lec.id);
      const savedPos = getSavedPosition(lec.id);
      const storedDur = parseInt(localStorage.getItem(STORAGE_KEY_LAST_DUR + lec.id) || '0', 10);
      const hasVideo = !!lec.video;
      const videoUrl = hasVideo ? getMediaUrl(lec.video) : '';

      let durationText = hasVideo ? (storedDur > 0 ? formatTimeSec(storedDur) : 'Video') : 'Document';
      let progressPct = 0;
      if (isDone) {
        progressPct = 100;
      } else if (savedPos > 3 && storedDur > 0) {
        progressPct = Math.min(100, Math.round((savedPos / storedDur) * 100));
      }

      const card = document.createElement('div');
      card.className = `class-lms-card ${isDone ? 'done' : ''}`;

      // Thumbnail Container (16:9)
      const thumb = document.createElement('div');
      thumb.className = 'class-card-thumb';

      if (hasVideo) {
        const videoEl = document.createElement('video');
        videoEl.className = 'class-thumb-video';
        videoEl.preload = 'metadata';
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.src = `${videoUrl}#t=1`;

        videoEl.addEventListener('loadedmetadata', () => {
          if (videoEl.duration && videoEl.duration > 0 && !storedDur) {
            const sec = Math.floor(videoEl.duration);
            localStorage.setItem(STORAGE_KEY_LAST_DUR + lec.id, sec);
            const durEl = thumb.querySelector('.class-thumb-duration');
            if (durEl) durEl.textContent = formatTimeSec(sec);
          }
        });

        thumb.appendChild(videoEl);
      } else {
        const docPreview = document.createElement('div');
        docPreview.className = 'class-thumb-doc';
        docPreview.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <span class="doc-tag-label">Study Document</span>
        `;
        thumb.appendChild(docPreview);
      }

      // Checkmark toggle button
      const checkBtn = document.createElement('button');
      checkBtn.className = `class-check-btn ${isDone ? 'is-done' : ''}`;
      checkBtn.title = isDone ? 'Mark as incomplete' : 'Mark as complete';
      checkBtn.innerHTML = isDone ? SVG_CHECK : SVG_CIRCLE;
      checkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleClassDone(lec.id);
      });
      thumb.appendChild(checkBtn);

      // Play icon on hover
      const playIcon = document.createElement('div');
      playIcon.className = 'class-thumb-play-icon';
      playIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
      thumb.appendChild(playIcon);

      // Duration badge
      const durBadge = document.createElement('div');
      durBadge.className = 'class-thumb-duration';
      durBadge.textContent = durationText;
      thumb.appendChild(durBadge);

      // Progress bar strip
      if (progressPct > 0) {
        const progBar = document.createElement('div');
        progBar.className = 'class-thumb-progress-bar';
        progBar.innerHTML = `<div class="class-thumb-progress-fill" style="width: ${progressPct}%;"></div>`;
        thumb.appendChild(progBar);
      }

      // Card Body
      const body = document.createElement('div');
      body.className = 'class-card-body';

      body.innerHTML = `
        <h3 class="class-card-title" title="${escapeHtml(lec.name)}">${escapeHtml(lec.name)}</h3>
        <div class="class-card-meta">
          <span>Class ${origIdx + 1}</span>
          <span>•</span>
          <span>${hasVideo ? 'Video' : 'Document'}</span>
          ${savedPos > 3 && !isDone ? `<span>• ${formatTimeSec(savedPos)}</span>` : ''}
        </div>
      `;

      card.appendChild(thumb);
      card.appendChild(body);

      card.addEventListener('click', () => {
        navigateTo(`#/player?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}&idx=${origIdx}`);
      });

      classesListContainer.appendChild(card);
    });
  }

  // --- VIEW 3: PLAYER VIEW ---
  function renderPlayerView(index) {
    if (!currentSubject || !currentChapter) return;
    const lectures = coursesData[currentSubject][currentChapter].lectures;
    if (index < 0 || index >= lectures.length) return;

    viewChapters.classList.remove('active');
    viewClasses.classList.remove('active');
    viewPlayer.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    currentLectureIndex = index;
    const lec = lectures[index];

    stopAllMedia();

    playerBreadcrumb.textContent = `${lec.subject} / ${lec.chapter}`;
    playerClassTitle.textContent = lec.name;

    playerPrevBtn.disabled = index === 0;
    playerNextBtn.disabled = index === lectures.length - 1;

    updatePlayerDoneButton();

    const hasVideo = !!lec.video;
    if (hasVideo) {
      playerVideoBox.style.display = 'flex';
      const url = getMediaUrl(lec.video);
      currentVideoLectureId = lec.id;
      loadCustomVideo(url, currentVideoLectureId);
    } else {
      playerVideoBox.style.display = 'none';
      currentVideoLectureId = null;
    }

    const defaultDoc = lec.lectureSheet || lec.practiceSheet || (lec.otherPdfs.length > 0 ? lec.otherPdfs[0] : null);
    if (defaultDoc) {
      playerDocBox.style.display = 'flex';
      loadPdfDoc(defaultDoc);
    } else {
      playerDocBox.style.display = 'none';
    }

    if (lec.otherFiles && lec.otherFiles.length > 0) {
      renderExtraFiles(lec.otherFiles);
      playerOtherBox.style.display = (!hasVideo && !defaultDoc) ? 'block' : 'none';
    } else {
      playerOtherBox.style.display = 'none';
    }

    buildPlayerTabs(lec, defaultDoc);
  }

  function updatePlayerDoneButton() {
    if (currentLectureIndex < 0 || !currentSubject || !currentChapter) return;
    const lec = coursesData[currentSubject][currentChapter].lectures[currentLectureIndex];
    const isDone = isClassDone(lec.id);

    if (isDone) {
      playerMarkDoneBtn.className = 'btn-mark-toggle is-done';
      playerMarkDoneBtn.innerHTML = `${SVG_CHECK} <span>Completed</span>`;
    } else {
      playerMarkDoneBtn.className = 'btn-mark-toggle';
      playerMarkDoneBtn.innerHTML = `${SVG_CIRCLE} <span>Mark as Done</span>`;
    }
  }

  function renderExtraFiles(files) {
    if (!extraFilesList) return;
    extraFilesList.innerHTML = '';
    files.forEach(f => {
      const url = getMediaUrl(f);
      const name = getItemName(f);
      const size = getItemSize(f);
      const li = document.createElement('li');
      li.className = 'extra-file-row';
      li.innerHTML = `
        <a href="${url}" download="${escapeHtml(name)}">${escapeHtml(name)}</a>
        <span style="font-size: 11px; color: var(--text-muted);">${formatFileSize(size)}</span>
      `;
      extraFilesList.appendChild(li);
    });
  }

  function buildPlayerTabs(lec, defaultDoc) {
    if (!playerTabsList || !playerTabsContainer) return;
    playerTabsList.innerHTML = '';
    const tabs = [];

    const hasVideo = !!lec.video;

    if (hasVideo) {
      tabs.push({ id: 'video', title: 'Class Video', type: 'video' });
    }

    if (lec.lectureSheet) {
      tabs.push({ id: 'lecture-sheet', title: 'Lecture Sheet', item: lec.lectureSheet, type: 'pdf' });
    }
    if (lec.practiceSheet) {
      tabs.push({ id: 'practice-sheet', title: 'Practice Sheet', item: lec.practiceSheet, type: 'pdf' });
    }
    lec.otherPdfs.forEach((f, i) => {
      tabs.push({ id: `pdf-${i}`, title: getItemName(f), item: f, type: 'pdf' });
    });
    if (lec.otherFiles && lec.otherFiles.length > 0) {
      tabs.push({ id: 'other', title: `Attachments (${lec.otherFiles.length})`, items: lec.otherFiles, type: 'other' });
    }

    if (tabs.length <= 1 && !defaultDoc && (lec.otherFiles.length === 0)) {
      playerTabsContainer.style.display = 'none';
      return;
    }
    playerTabsContainer.style.display = 'block';

    // Default active tab: Video if exists, otherwise first document/attachment
    let activeTabId = hasVideo ? 'video' : (tabs[0] ? tabs[0].id : '');

    tabs.forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = `tab-btn-pill ${tab.id === activeTabId ? 'active' : ''}`;
      btn.textContent = tab.title;

      btn.addEventListener('click', () => {
        playerTabsList.querySelectorAll('.tab-btn-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (tab.type === 'video') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (tab.type === 'pdf') {
          playerDocBox.style.display = 'flex';
          loadPdfDoc(tab.item);
          playerDocBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (tab.type === 'other') {
          playerOtherBox.style.display = 'block';
          playerOtherBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      playerTabsList.appendChild(btn);
    });
  }

  function loadPdfDoc(item) {
    if (!item) return;
    const url = getMediaUrl(item);
    const name = getItemName(item);
    const size = getItemSize(item);

    if (docTitleText) {
      docTitleText.textContent = name;
      docTitleText.title = name;
    }
    if (docSizeBadge) docSizeBadge.textContent = formatFileSize(size);
    if (docExternalLink) docExternalLink.href = url;
    if (docDownloadLink) {
      docDownloadLink.href = url;
      docDownloadLink.download = name;
    }

    if (mainPdfFrame) {
      const frameUrl = url.includes('#') ? url : `${url}#view=FitH&navpanes=0&toolbar=0`;
      if (mainPdfFrame.src !== frameUrl) {
        mainPdfFrame.src = frameUrl;
      }
    }
  }

  // --- OVERALL PROGRESS ---
  function updateGlobalProgress() {
    const doneSet = getDoneClasses();
    let totalClasses = 0;
    let doneCount = 0;
    let totalChapters = 0;

    const subjects = Object.keys(coursesData);
    const totalSubjects = subjects.length;

    subjects.forEach(sub => {
      const chaps = Object.keys(coursesData[sub]);
      totalChapters += chaps.length;
      chaps.forEach(chap => {
        coursesData[sub][chap].lectures.forEach(l => {
          totalClasses++;
          if (doneSet.has(l.id)) doneCount++;
        });
      });
    });

    const percent = totalClasses > 0 ? Math.round((doneCount / totalClasses) * 100) : 0;
    if (overallProgressBar) overallProgressBar.style.width = `${percent}%`;
    if (overallProgressText) overallProgressText.textContent = `${doneCount}/${totalClasses} (${percent}%)`;
  }

  // --- EVENT LISTENERS ---
  const chooseFolderBtn = document.getElementById('choose-folder-btn');
  if (chooseFolderBtn) {
    chooseFolderBtn.addEventListener('click', async () => {
      if (window.showDirectoryPicker) {
        try {
          const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
          if (dirHandle) {
            await saveHandleToIDB(dirHandle);
            await loadCoursesFromHandle(dirHandle);
            return;
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            folderInput.click();
          }
        }
      } else {
        folderInput.click();
      }
    });
  }

  folderInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      parseSelectedFolder(e.target.files);
    }
  });

  const multiFileInput = document.getElementById('multi-file-input');
  if (multiFileInput) {
    multiFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        parseSelectedFolder(e.target.files);
      }
    });
  }

  if (reopenFolderBtn) {
    reopenFolderBtn.addEventListener('click', async () => {
      const handle = await loadHandleFromIDB();
      if (handle) {
        const ok = await tryAutoLoadFromHandle(handle);
        if (!ok) {
          alert('Could not open the saved folder. Please select it again.');
        }
      }
    });
  }

  if (exportProgressBtn) {
    exportProgressBtn.addEventListener('click', exportProgressFile);
  }

  if (importProgressBtn && importProgressInput) {
    importProgressBtn.addEventListener('click', () => {
      importProgressInput.click();
    });
    importProgressInput.addEventListener('change', importProgressFile);
  }

  // To-Do Event Listeners
  if (todoToggleBtn) {
    todoToggleBtn.addEventListener('click', openTodoDrawer);
  }

  if (todoCloseBtn) {
    todoCloseBtn.addEventListener('click', closeTodoDrawer);
  }

  if (todoOverlay) {
    todoOverlay.addEventListener('click', (e) => {
      if (e.target === todoOverlay) {
        closeTodoDrawer();
      }
    });
  }

  if (todoForm && todoInput) {
    todoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addTodo(todoInput.value);
      todoInput.value = '';
    });
  }

  const todoFilterBtns = document.querySelectorAll('.todo-filter-btn');
  todoFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      todoFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTodoFilter = btn.getAttribute('data-filter') || 'all';
      renderTodoList();
    });
  });

  if (todoClearCompletedBtn) {
    todoClearCompletedBtn.addEventListener('click', clearCompletedTodos);
  }

  if (todoList) {
    todoList.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('.todo-item-check');
      if (checkBtn) {
        const id = checkBtn.getAttribute('data-id');
        if (id) toggleTodo(id);
        return;
      }
      const delBtn = e.target.closest('.todo-item-del');
      if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        if (id) deleteTodo(id);
        return;
      }
    });
  }

  changeFolderBtn.addEventListener('click', async () => {
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        if (dirHandle) {
          await saveHandleToIDB(dirHandle);
          await loadCoursesFromHandle(dirHandle);
          return;
        }
      } catch(e) {
        // User cancelled picker or permission denied - fallback to modal
      }
    }
    welcomeModal.style.display = 'flex';
  });

  brandHomeBtn.addEventListener('click', () => {
    navigateTo('#/');
  });

  backToChaptersBtn.addEventListener('click', () => {
    navigateTo('#/');
  });

  backToClassesBtn.addEventListener('click', () => {
    if (currentSubject && currentChapter) {
      navigateTo(`#/chapter?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}`);
    } else {
      navigateTo('#/');
    }
  });

  if (playerBreadcrumb) {
    playerBreadcrumb.style.cursor = 'pointer';
    playerBreadcrumb.addEventListener('click', () => {
      if (currentSubject && currentChapter) {
        navigateTo(`#/chapter?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}`);
      } else {
        navigateTo('#/');
      }
    });
  }

  chaptersSearchInput.addEventListener('input', (e) => {
    chaptersSearchQuery = e.target.value.trim();
    renderChaptersGrid();
  });

  const chapterClassesSearch = document.getElementById('chapter-classes-search');
  if (chapterClassesSearch) {
    chapterClassesSearch.addEventListener('input', (e) => {
      chapterSearchQuery = e.target.value.trim();
      renderChapterClasses();
    });
  }

  playerMarkDoneBtn.addEventListener('click', () => {
    if (currentLectureIndex >= 0 && currentSubject && currentChapter) {
      const lec = coursesData[currentSubject][currentChapter].lectures[currentLectureIndex];
      toggleClassDone(lec.id);
    }
  });

  playerPrevBtn.addEventListener('click', () => {
    if (currentLectureIndex > 0) {
      navigateTo(`#/player?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}&idx=${currentLectureIndex - 1}`);
    }
  });

  playerNextBtn.addEventListener('click', () => {
    if (currentSubject && currentChapter) {
      const lectures = coursesData[currentSubject][currentChapter].lectures;
      if (currentLectureIndex < lectures.length - 1) {
        navigateTo(`#/player?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}&idx=${currentLectureIndex + 1}`);
      }
    }
  });

  if (docFullscreenBtn) {
    docFullscreenBtn.addEventListener('click', () => {
      if (!playerDocBox) return;
      if (!document.fullscreenElement) {
        if (playerDocBox.requestFullscreen) {
          playerDocBox.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    });
  }

  // --- CUSTOM VIDEO PLAYER LOGIC ---
  function loadCustomVideo(url, lectureId) {
    mainVideoPlayer.src = url;
    currentVideoLectureId = lectureId;

    // Restore preferred playback rate
    const savedSpeed = parseFloat(localStorage.getItem('offline_lms_preferred_speed') || '1');
    applyPlaybackSpeed(savedSpeed, false);

    // Restore preferred volume
    const savedVol = localStorage.getItem('offline_lms_preferred_volume');
    if (savedVol !== null) {
      const vol = Math.max(0, Math.min(1, parseFloat(savedVol)));
      mainVideoPlayer.volume = vol;
      if (ctrlVolumeSlider) ctrlVolumeSlider.value = vol;
      mainVideoPlayer.muted = (vol === 0);
      if (vol > 0) lastNonZeroVolume = vol;
    } else {
      mainVideoPlayer.volume = 1;
      if (ctrlVolumeSlider) ctrlVolumeSlider.value = 1;
      mainVideoPlayer.muted = false;
      lastNonZeroVolume = 1;
    }
    updateVolumeIcons();

    if (progressBarPlayed) progressBarPlayed.style.width = '0%';
    if (progressBarBuffer) progressBarBuffer.style.width = '0%';
    if (ctrlTimeCurrent) ctrlTimeCurrent.textContent = '00:00';
    if (ctrlTimeDuration) ctrlTimeDuration.textContent = '00:00';

    if (videoResumeBanner) videoResumeBanner.style.display = 'none';
    clearTimeout(resumeBannerTimeout);

    const savedPosKey = STORAGE_KEY_LAST_POS + lectureId;
    const savedTime = parseFloat(localStorage.getItem(savedPosKey) || '0');

    let hasResumed = false;
    const applyResumeSeek = () => {
      if (hasResumed) return;
      if (savedTime > 2) {
        const dur = mainVideoPlayer.duration || 0;
        if (!dur || savedTime < dur - 5) {
          hasResumed = true;
          try {
            mainVideoPlayer.currentTime = savedTime;
          } catch(e) {}
          showResumeBanner(savedTime);
        }
      }
    };

    if (mainVideoPlayer.readyState >= 1) {
      applyResumeSeek();
    }

    mainVideoPlayer.addEventListener('loadedmetadata', applyResumeSeek, { once: true });
    mainVideoPlayer.addEventListener('canplay', applyResumeSeek, { once: true });

    mainVideoPlayer.play().catch(() => {});
  }

  function formatTime(seconds, includeHours) {
    if (isNaN(seconds) || seconds === null || seconds < 0) return includeHours ? '00:00:00' : '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = n => String(n).padStart(2, '0');

    if (includeHours || hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  function updateBufferProgress() {
    if (!mainVideoPlayer.duration || mainVideoPlayer.buffered.length === 0) return;
    const duration = mainVideoPlayer.duration;
    const curTime = mainVideoPlayer.currentTime;
    for (let i = 0; i < mainVideoPlayer.buffered.length; i++) {
      if (mainVideoPlayer.buffered.start(i) <= curTime && curTime <= mainVideoPlayer.buffered.end(i)) {
        const bufferEnd = mainVideoPlayer.buffered.end(i);
        const pct = Math.min(100, (bufferEnd / duration) * 100);
        if (progressBarBuffer) progressBarBuffer.style.width = `${pct}%`;
        break;
      }
    }
  }

  function updateProgressAndTimes() {
    const cur = isScrubbing ? scrubTargetTime : (mainVideoPlayer.currentTime || 0);
    const dur = mainVideoPlayer.duration || 0;
    const hasHours = dur >= 3600;

    if (dur > 0 && !isScrubbing) {
      const pct = Math.min(100, (cur / dur) * 100);
      if (progressBarPlayed) progressBarPlayed.style.width = `${pct}%`;
    }

    if (ctrlTimeCurrent) {
      ctrlTimeCurrent.textContent = formatTime(cur, hasHours);
    }

    if (ctrlTimeDuration) {
      if (showRemainingTime && dur > 0) {
        const remaining = Math.max(0, dur - cur);
        ctrlTimeDuration.textContent = `-${formatTime(remaining, hasHours)}`;
      } else {
        ctrlTimeDuration.textContent = formatTime(dur, hasHours);
      }
    }
  }

  function togglePlayPause() {
    if (!mainVideoPlayer.src) return;
    if (mainVideoPlayer.paused || mainVideoPlayer.ended) {
      mainVideoPlayer.play().catch(() => {});
    } else {
      mainVideoPlayer.pause();
    }
  }

  function seekRelative(seconds) {
    if (!mainVideoPlayer.src) return;
    const dur = mainVideoPlayer.duration || 0;
    let target = mainVideoPlayer.currentTime + seconds;
    if (target < 0) target = 0;
    if (dur > 0 && target > dur) target = dur;
    mainVideoPlayer.currentTime = target;
    updateProgressAndTimes();
    saveCurrentVideoPosition(true);
  }

  function animateDoubleTap(side) {
    const ripple = side === 'left' ? rippleLeft : rippleRight;
    if (!ripple) return;
    ripple.classList.remove('active');
    void ripple.offsetWidth; // force reflow
    ripple.classList.add('active');
    setTimeout(() => {
      ripple.classList.remove('active');
    }, 600);
  }

  function flashCenterIndicator(htmlContent) {
    if (!videoCenterIndicator || !centerIconWrap) return;
    clearTimeout(centerIndicatorTimeout);
    centerIconWrap.innerHTML = htmlContent;
    videoCenterIndicator.classList.add('active');
    centerIndicatorTimeout = setTimeout(() => {
      videoCenterIndicator.classList.remove('active');
    }, 700);
  }

  function updateVolumeIcons() {
    const isMuted = mainVideoPlayer.muted || mainVideoPlayer.volume === 0;
    const vol = mainVideoPlayer.volume;

    if (iconVolMute) iconVolMute.style.display = isMuted ? 'block' : 'none';
    if (iconVolLow)  iconVolLow.style.display  = (!isMuted && vol < 0.5) ? 'block' : 'none';
    if (iconVolHigh) iconVolHigh.style.display = (!isMuted && vol >= 0.5) ? 'block' : 'none';

    if (ctrlMuteBtn) {
      ctrlMuteBtn.title = isMuted ? 'Unmute (M)' : 'Mute (M)';
    }
  }

  function adjustVolumeStep(direction) {
    if (!mainVideoPlayer.src) return;
    const cur = (mainVideoPlayer.muted || mainVideoPlayer.volume === 0) ? 0 : mainVideoPlayer.volume;
    const step = 0.05;
    let newVol = Math.max(0, Math.min(1, Math.round((cur + (direction * step)) * 100) / 100));

    mainVideoPlayer.volume = newVol;
    mainVideoPlayer.muted = (newVol === 0);
    if (ctrlVolumeSlider) ctrlVolumeSlider.value = newVol;
    if (newVol > 0) lastNonZeroVolume = newVol;
    localStorage.setItem('offline_lms_preferred_volume', newVol);
    updateVolumeIcons();

    const volPct = Math.round(newVol * 100);
    const iconSvg = newVol === 0
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg><span style="font-size:12px;margin-top:2px;">Muted</span>`
      : (newVol >= 0.5
          ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span style="font-size:12px;margin-top:2px;">${volPct}%</span>`
          : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span style="font-size:12px;margin-top:2px;">${volPct}%</span>`
        );
    flashCenterIndicator(iconSvg);
    resetControlsAutoHide();
  }

  function applyPlaybackSpeed(speed, flash = true) {
    speed = Math.max(0.25, Math.min(4.0, Math.round(speed * 100) / 100));
    mainVideoPlayer.playbackRate = speed;

    const displaySpeedStr = (speed % 1 === 0) ? `${speed}x` : `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;

    if (currentSpeedText) {
      currentSpeedText.textContent = displaySpeedStr;
    }
    if (customSpeedInput) {
      customSpeedInput.value = speed.toFixed(2);
    }
    localStorage.setItem('offline_lms_preferred_speed', speed);

    const opts = document.querySelectorAll('.speed-option');
    opts.forEach(opt => {
      const s = parseFloat(opt.dataset.speed);
      opt.classList.toggle('active', Math.abs(s - speed) < 0.01);
    });

    if (flash) {
      flashCenterIndicator(`<span style="font-weight:700;font-size:18px;">${displaySpeedStr}</span>`);
    }
  }

  function adjustSpeedStep(direction, fine = false) {
    const cur = mainVideoPlayer.playbackRate || 1;
    const step = fine ? 0.05 : 0.1;
    const nextSpeed = Math.round((cur + (direction * step)) * 100) / 100;
    applyPlaybackSpeed(nextSpeed, true);
  }

  function toggleFullscreen() {
    if (!customPlayerWrapper) return;
    if (!document.fullscreenElement) {
      if (customPlayerWrapper.requestFullscreen) {
        customPlayerWrapper.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  function showControls() {
    if (customPlayerWrapper) {
      customPlayerWrapper.classList.remove('controls-hidden');
    }
  }

  function resetControlsAutoHide() {
    showControls();
    clearTimeout(controlsHideTimeout);
    if (!mainVideoPlayer.paused && (!speedMenuPopover || speedMenuPopover.style.display !== 'block') && !isScrubbing && !isHoveringControls) {
      controlsHideTimeout = setTimeout(() => {
        if (!mainVideoPlayer.paused && (!speedMenuPopover || speedMenuPopover.style.display !== 'block') && !isScrubbing && !isHoveringControls) {
          if (customPlayerWrapper) customPlayerWrapper.classList.add('controls-hidden');
        }
      }, 2500);
    }
  }

  function showResumeBanner(seconds) {
    if (!videoResumeBanner) return;
    if (resumeTimeText) {
      resumeTimeText.textContent = formatTime(seconds, seconds >= 3600);
    }
    videoResumeBanner.style.display = 'flex';
    clearTimeout(resumeBannerTimeout);
    resumeBannerTimeout = setTimeout(() => {
      if (videoResumeBanner) videoResumeBanner.style.display = 'none';
    }, 8000);
  }

  function getScrubTimeFromEvent(e) {
    if (!playerProgressContainer || !mainVideoPlayer.duration) return { pct: 0, time: 0 };
    const rect = playerProgressContainer.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    if (pos < 0) pos = 0;
    if (pos > 1) pos = 1;
    const time = pos * mainVideoPlayer.duration;
    return { pct: pos, time };
  }

  function initCustomVideoPlayer() {
    // Video Events
    mainVideoPlayer.addEventListener('play', () => {
      if (iconPlay && iconPause) {
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
      }
      if (ctrlPlayBtn) ctrlPlayBtn.title = 'Pause (Space / K)';
      resetControlsAutoHide();
    });

    mainVideoPlayer.addEventListener('pause', () => {
      if (iconPlay && iconPause) {
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
      }
      if (ctrlPlayBtn) ctrlPlayBtn.title = 'Play (Space / K)';
      saveCurrentVideoPosition(true);
      showControls();
    });

    mainVideoPlayer.addEventListener('timeupdate', () => {
      if (!isScrubbing) {
        updateProgressAndTimes();
      }
      saveCurrentVideoPosition(false);
    });

    mainVideoPlayer.addEventListener('seeked', () => {
      saveCurrentVideoPosition(true);
    });

    mainVideoPlayer.addEventListener('progress', updateBufferProgress);

    mainVideoPlayer.addEventListener('loadedmetadata', () => {
      updateProgressAndTimes();
    });

    mainVideoPlayer.addEventListener('ended', () => {
      if (iconPlay && iconPause) {
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
      }
      showControls();

      if (currentVideoLectureId) {
        localStorage.removeItem(STORAGE_KEY_LAST_POS + currentVideoLectureId);
        if (!isClassDone(currentVideoLectureId)) {
          toggleClassDone(currentVideoLectureId);
        }
      }
    });

    // Hover on controls area prevents auto-hide
    if (customVideoControls) {
      customVideoControls.addEventListener('mouseenter', () => {
        isHoveringControls = true;
        showControls();
        clearTimeout(controlsHideTimeout);
      });
      customVideoControls.addEventListener('mouseleave', () => {
        isHoveringControls = false;
        resetControlsAutoHide();
      });
    }

    // Gesture & Click Surface
    if (videoClickSurface) {
      videoClickSurface.addEventListener('click', (e) => {
        clickCounter++;
        const rect = videoClickSurface.getBoundingClientRect();
        const xPct = (e.clientX - rect.left) / rect.width;

        if (clickCounter === 1) {
          singleClickTimeout = setTimeout(() => {
            clickCounter = 0;
            togglePlayPause();
          }, 230);
        } else if (clickCounter === 2) {
          clearTimeout(singleClickTimeout);
          clickCounter = 0;

          if (xPct < 0.32) {
            seekRelative(-10);
            animateDoubleTap('left');
          } else if (xPct > 0.68) {
            seekRelative(10);
            animateDoubleTap('right');
          } else {
            toggleFullscreen();
          }
        }
      });
    }

    // Auto-hide controls on mouse idle
    if (customPlayerWrapper) {
      customPlayerWrapper.addEventListener('mousemove', resetControlsAutoHide);
      customPlayerWrapper.addEventListener('mouseleave', () => {
        if (!mainVideoPlayer.paused && (!speedMenuPopover || speedMenuPopover.style.display !== 'block') && !isScrubbing && !isHoveringControls) {
          clearTimeout(controlsHideTimeout);
          customPlayerWrapper.classList.add('controls-hidden');
        }
      });

      // Mouse Wheel Volume Control
      customPlayerWrapper.addEventListener('wheel', (e) => {
        if (!mainVideoPlayer.src) return;
        // If speed menu is open and mouse is scrolling inside it, do not intercept
        if (speedMenuPopover && speedMenuPopover.style.display === 'block' && speedMenuPopover.contains(e.target)) {
          return;
        }
        e.preventDefault();
        const direction = e.deltaY < 0 ? 1 : -1;
        adjustVolumeStep(direction);
      }, { passive: false });
    }

    // Scrubber
    if (playerProgressContainer) {
      playerProgressContainer.addEventListener('mouseenter', () => {
        if (playerTimeTooltip) playerTimeTooltip.classList.add('visible');
      });

      playerProgressContainer.addEventListener('mouseleave', () => {
        if (!isScrubbing && playerTimeTooltip) {
          playerTimeTooltip.classList.remove('visible');
        }
      });

      playerProgressContainer.addEventListener('mousemove', (e) => {
        const { pct, time } = getScrubTimeFromEvent(e);
        if (playerTimeTooltip) {
          playerTimeTooltip.style.left = (pct * 100) + '%';
          playerTimeTooltip.textContent = formatTime(time, (mainVideoPlayer.duration || 0) >= 3600);
        }
      });

      playerProgressContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !mainVideoPlayer.src) return;
        isScrubbing = true;
        wasPlayingBeforeScrub = !mainVideoPlayer.paused;
        if (wasPlayingBeforeScrub) {
          mainVideoPlayer.pause();
        }
        playerProgressContainer.classList.add('is-dragging');
        if (playerTimeTooltip) playerTimeTooltip.classList.add('visible');

        const { pct, time } = getScrubTimeFromEvent(e);
        scrubTargetTime = time;
        if (progressBarPlayed) progressBarPlayed.style.width = (pct * 100) + '%';
        if (playerTimeTooltip) {
          playerTimeTooltip.style.left = (pct * 100) + '%';
          playerTimeTooltip.textContent = formatTime(time, (mainVideoPlayer.duration || 0) >= 3600);
        }
        if (ctrlTimeCurrent) ctrlTimeCurrent.textContent = formatTime(time, (mainVideoPlayer.duration || 0) >= 3600);
      });
    }

    window.addEventListener('mousemove', (e) => {
      if (!isScrubbing) return;
      const { pct, time } = getScrubTimeFromEvent(e);
      scrubTargetTime = time;
      if (progressBarPlayed) progressBarPlayed.style.width = (pct * 100) + '%';
      if (playerTimeTooltip) {
        playerTimeTooltip.style.left = (pct * 100) + '%';
        playerTimeTooltip.textContent = formatTime(time, (mainVideoPlayer.duration || 0) >= 3600);
      }
      if (ctrlTimeCurrent) ctrlTimeCurrent.textContent = formatTime(time, (mainVideoPlayer.duration || 0) >= 3600);
    });

    window.addEventListener('mouseup', () => {
      if (!isScrubbing) return;
      isScrubbing = false;
      if (playerProgressContainer) playerProgressContainer.classList.remove('is-dragging');
      if (playerTimeTooltip) playerTimeTooltip.classList.remove('visible');

      mainVideoPlayer.currentTime = scrubTargetTime;
      saveCurrentVideoPosition(true);

      if (wasPlayingBeforeScrub) {
        mainVideoPlayer.play().catch(() => {});
      }
    });

    // Buttons
    if (ctrlPlayBtn) {
      ctrlPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayPause();
      });
    }

    if (ctrlRewindBtn) {
      ctrlRewindBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        seekRelative(-10);
        animateDoubleTap('left');
      });
    }

    if (ctrlForwardBtn) {
      ctrlForwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        seekRelative(10);
        animateDoubleTap('right');
      });
    }

    if (ctrlVolumeSlider) {
      ctrlVolumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        mainVideoPlayer.volume = val;
        mainVideoPlayer.muted = (val === 0);
        if (val > 0) lastNonZeroVolume = val;
        localStorage.setItem('offline_lms_preferred_volume', val);
        updateVolumeIcons();
      });
    }

    if (ctrlMuteBtn) {
      ctrlMuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mainVideoPlayer.muted || mainVideoPlayer.volume === 0) {
          mainVideoPlayer.muted = false;
          const restore = lastNonZeroVolume > 0 ? lastNonZeroVolume : 1;
          mainVideoPlayer.volume = restore;
          if (ctrlVolumeSlider) ctrlVolumeSlider.value = restore;
          localStorage.setItem('offline_lms_preferred_volume', restore);
          flashCenterIndicator(`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span style="font-size:12px;margin-top:2px;">${Math.round(restore * 100)}%</span>`);
        } else {
          lastNonZeroVolume = mainVideoPlayer.volume;
          mainVideoPlayer.muted = true;
          if (ctrlVolumeSlider) ctrlVolumeSlider.value = 0;
          flashCenterIndicator(`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg><span style="font-size:12px;margin-top:2px;">Muted</span>`);
        }
        updateVolumeIcons();
      });
    }

    if (playerTimeDisplay) {
      playerTimeDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        showRemainingTime = !showRemainingTime;
        updateProgressAndTimes();
      });
    }

    // Speed Popover & Custom Controls
    if (ctrlSpeedBtn && speedMenuPopover) {
      ctrlSpeedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = speedMenuPopover.style.display === 'block';
        speedMenuPopover.style.display = isShown ? 'none' : 'block';
        if (!isShown && customSpeedInput) {
          customSpeedInput.value = (mainVideoPlayer.playbackRate || 1).toFixed(2);
        }
      });

      if (btnSpeedMinus) {
        btnSpeedMinus.addEventListener('click', (e) => {
          e.stopPropagation();
          adjustSpeedStep(-1, false);
        });
      }

      if (btnSpeedPlus) {
        btnSpeedPlus.addEventListener('click', (e) => {
          e.stopPropagation();
          adjustSpeedStep(1, false);
        });
      }

      if (customSpeedInput) {
        customSpeedInput.addEventListener('click', (e) => e.stopPropagation());
        customSpeedInput.addEventListener('change', (e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val) && val >= 0.25 && val <= 4.0) {
            applyPlaybackSpeed(val, true);
          } else {
            customSpeedInput.value = (mainVideoPlayer.playbackRate || 1).toFixed(2);
          }
        });
        customSpeedInput.addEventListener('keydown', (e) => {
          e.stopPropagation(); // prevent player keyboard shortcuts while typing custom speed
          if (e.key === 'Enter') {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val >= 0.25 && val <= 4.0) {
              applyPlaybackSpeed(val, true);
            }
            customSpeedInput.blur();
          }
        });
      }

      const opts = document.querySelectorAll('.speed-option');
      opts.forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const speed = parseFloat(opt.dataset.speed);
          applyPlaybackSpeed(speed, true);
          speedMenuPopover.style.display = 'none';
        });
      });

      document.addEventListener('click', (e) => {
        if (speedMenuPopover.style.display === 'block' && !speedMenuPopover.contains(e.target) && e.target !== ctrlSpeedBtn && !ctrlSpeedBtn.contains(e.target)) {
          speedMenuPopover.style.display = 'none';
        }
      });
    }

    // PiP
    if (ctrlPipBtn) {
      if (document.pictureInPictureEnabled) {
        ctrlPipBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
            } else if (mainVideoPlayer.src) {
              await mainVideoPlayer.requestPictureInPicture();
            }
          } catch (err) {}
        });
      } else {
        ctrlPipBtn.style.display = 'none';
      }
    }

    // Fullscreen
    if (ctrlFullscreenBtn) {
      ctrlFullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });

      document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        if (customPlayerWrapper) customPlayerWrapper.classList.toggle('is-fullscreen', isFs);
        if (iconFsEnter && iconFsExit) {
          iconFsEnter.style.display = isFs ? 'none' : 'block';
          iconFsExit.style.display = isFs ? 'block' : 'none';
        }
        ctrlFullscreenBtn.title = isFs ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
      });
    }

    // Resume Banner buttons
    if (resumeRestartBtn) {
      resumeRestartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mainVideoPlayer.currentTime = 0;
        if (videoResumeBanner) videoResumeBanner.style.display = 'none';
        clearTimeout(resumeBannerTimeout);
        flashCenterIndicator('00:00');
      });
    }

    if (resumeDismissBtn) {
      resumeDismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (videoResumeBanner) videoResumeBanner.style.display = 'none';
        clearTimeout(resumeBannerTimeout);
      });
    }
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Escape closes To-Do drawer regardless of focus
    if (e.key === 'Escape' || e.code === 'Escape') {
      if (todoOverlay && todoOverlay.classList.contains('open')) {
        closeTodoDrawer();
        return;
      }
    }

    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditing = tag === 'input' || tag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable);

    // '/' or 'Ctrl+K' / 'Cmd+K' to focus search in overview
    if (!isEditing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
      if (viewChapters && viewChapters.classList.contains('active') && chaptersSearchInput) {
        e.preventDefault();
        chaptersSearchInput.focus();
        chaptersSearchInput.select();
        return;
      }
    }

    if (!viewPlayer.classList.contains('active')) return;
    if (isEditing) return;

    if (e.code === 'Space' || e.code === 'KeyK') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        togglePlayPause();
      }
    } else if (e.code === 'ArrowRight') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        seekRelative(5);
        flashCenterIndicator(`+5s`);
      }
    } else if (e.code === 'ArrowLeft') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        seekRelative(-5);
        flashCenterIndicator(`-5s`);
      }
    } else if (e.code === 'KeyL') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        seekRelative(10);
        animateDoubleTap('right');
      }
    } else if (e.code === 'KeyJ') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        seekRelative(-10);
        animateDoubleTap('left');
      }
    } else if (e.code === 'ArrowUp') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        adjustVolumeStep(1);
      }
    } else if (e.code === 'ArrowDown') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        adjustVolumeStep(-1);
      }
    } else if (e.code === 'KeyM') {
      if (mainVideoPlayer.src && ctrlMuteBtn) {
        e.preventDefault();
        ctrlMuteBtn.click();
      }
    } else if (e.code === 'KeyF') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        toggleFullscreen();
      }
    } else if (e.code === 'KeyI') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src && ctrlPipBtn && ctrlPipBtn.style.display !== 'none') {
        e.preventDefault();
        ctrlPipBtn.click();
      }
    } else if (e.key === '>' || (e.shiftKey && e.code === 'Period') || e.code === 'BracketRight') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        adjustSpeedStep(1);
      }
    } else if (e.key === '<' || (e.shiftKey && e.code === 'Comma') || e.code === 'BracketLeft') {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src) {
        e.preventDefault();
        adjustSpeedStep(-1);
      }
    } else if (e.code.startsWith('Digit') && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (playerVideoBox.style.display === 'flex' && mainVideoPlayer.src && mainVideoPlayer.duration) {
        const digit = parseInt(e.code.replace('Digit', ''), 10);
        if (!isNaN(digit) && digit >= 0 && digit <= 9) {
          e.preventDefault();
          const targetPct = digit * 0.1;
          mainVideoPlayer.currentTime = targetPct * mainVideoPlayer.duration;
          updateProgressAndTimes();
          flashCenterIndicator(`${digit * 10}%`);
        }
      }
    } else if (e.code === 'KeyN') {
      if (currentSubject && currentChapter) {
        const lectures = coursesData[currentSubject][currentChapter].lectures;
        if (currentLectureIndex < lectures.length - 1) {
          navigateTo(`#/player?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}&idx=${currentLectureIndex + 1}`);
        }
      }
    } else if (e.code === 'KeyP') {
      if (currentLectureIndex > 0) {
        navigateTo(`#/player?sub=${encodeURIComponent(currentSubject)}&chap=${encodeURIComponent(currentChapter)}&idx=${currentLectureIndex - 1}`);
      }
    }
  });

  // Helpers
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // --- APP STARTUP & INITIALIZATION ---
  async function initApp() {
    initCustomVideoPlayer();
    updateTodoBadge();
    renderTodoList();

    // 1. Try to load directly from window.OFFLINE_LMS_MANIFEST (Instant boot, 0 prompts)
    if (window.OFFLINE_LMS_MANIFEST && Array.isArray(window.OFFLINE_LMS_MANIFEST) && window.OFFLINE_LMS_MANIFEST.length > 0) {
      loadCoursesFromManifest(window.OFFLINE_LMS_MANIFEST);
      return;
    }

    // 2. Try IndexedDB stored FileSystem Access API directory handle
    const handle = await loadHandleFromIDB();
    if (handle) {
      if (reopenCardWrap) reopenCardWrap.style.display = 'block';
      if (reopenBtnText) reopenBtnText.textContent = `Reopen "${handle.name || 'Stored Folder'}" (1-Click)`;

      try {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          const ok = await tryAutoLoadFromHandle(handle);
          if (ok) return;
        }
      } catch(e) {}
    }

    // 3. Fallback to Welcome Modal
    welcomeModal.style.display = 'flex';
  }

  initApp();
})();
