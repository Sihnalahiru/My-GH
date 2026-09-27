/* OPTIMIZED FINAL UI INTEGRATION — SSW Airport Ground Handling Master Study */
(function () {
  "use strict";

  // ========== UTILITIES ==========
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  // ========== DEBOUNCE UTILITY ==========
  function debounce(fn, delay = 300) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // ========== STATE ==========
  const state = {
    route: location.hash.slice(1) || "home",
    study: [], questions: [], glossary: [], topics: [], visuals: [], audio: null, sources: null,
    audioStore: null, audioController: null, progressStore: null, analytics: null, 
    examSession: null, examTick: null, examPersistedSessionId: null,
    search: "", currentStudyIndex: -1,
    // Cache for analytics to avoid recalculation
    _analyticsCached: null, _analyticsExpiry: 0
  };

  // ========== ANALYTICS WITH MEMOIZATION ==========
  const ANALYTICS_CACHE_TTL = 5000; // 5 seconds
  function getAnalytics() {
    const now = Date.now();
    if (state._analyticsCached && now < state._analyticsExpiry) {
      return state._analyticsCached;
    }
    const result = state.analytics || (state.progressStore && window.SSWGHProgress 
      ? window.SSWGHProgress.buildAnalytics(state.progressStore) 
      : null);
    state._analyticsCached = result;
    state._analyticsExpiry = now + ANALYTICS_CACHE_TTL;
    return result;
  }

  function refreshAnalytics() {
    state.analytics = state.progressStore && window.SSWGHProgress 
      ? window.SSWGHProgress.buildAnalytics(state.progressStore) 
      : null;
    state._analyticsCached = state.analytics;
    state._analyticsExpiry = Date.now() + ANALYTICS_CACHE_TTL;
    return state.analytics;
  }

  const pct = () => Math.round(getAnalytics()?.totals?.mcq_accuracy_percent || 0);

  // ========== UI SETTINGS ==========
  const UI_SETTINGS_KEY = "ssw-gh-ui-settings-v1";
  function loadUISettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(UI_SETTINGS_KEY) || "{}");
      return {
        darkMode: raw.darkMode !== false,
        comfortMode: raw.comfortMode === true,
        reducedMotion: raw.reducedMotion === true
      };
    } catch (_) {
      return { darkMode: true, comfortMode: false, reducedMotion: false };
    }
  }

  function saveUISettings(patch) {
    const next = { ...loadUISettings(), ...patch };
    try {
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(next));
    } catch (_) {}
    applyUISettings(next);
    return next;
  }

  function applyUISettings(s = loadUISettings()) {
    document.documentElement.classList.toggle("light-mode", !s.darkMode);
    document.documentElement.classList.toggle("comfort-mode", s.comfortMode);
    document.documentElement.classList.toggle("reduced-motion", s.reducedMotion);
  }

  function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function safariInstallCard() {
    if (isStandalone())
      return `<article class="card install-card ready"><div class="install-icon">✓</div><div><span class="eyebrow">HOME SCREEN</span><h3>App mode active</h3><p>Your study session syncs locally.</p></div></article>`;
    return "";
  }

  // ========== DATA LOADING WITH LAZY INITIALIZATION ==========
  async function load(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  }

  // Load critical data first, audio/visuals on demand
  async function init() {
    applyUISettings();
    try {
      // Load critical data: study, questions, glossary first
      const [study, questions, glossary, topics] = await Promise.all([
        load("./data/study.json"),
        load("./data/questions.json"),
        load("./data/glossary.json"),
        load("./data/topics.json")
      ]);

      state.study = study.records || [];
      state.questions = questions.questions || [];
      state.glossary = glossary.terms || [];
      state.topics = topics.topics || [];

      // Load non-critical data in background
      Promise.all([
        load("./data/visual-assets.json"),
        load("./data/audio.json"),
        load("./data/sources.json")
      ]).then(([visuals, audio, sources]) => {
        state.visuals = visuals.assets || [];
        state.audio = audio;
        state.sources = sources;
      }).catch(e => console.warn("Non-critical assets failed to load:", e));

      if (window.SSWGHProgress) {
        state.progressStore = new window.SSWGHProgress.ProgressStore({});
        refreshAnalytics();
      }

      if (window.SSWAudio) {
        state.audioStore = new SSWAudio.AudioStore(state.audio || {}, state.sources || {});
        state.audioController = new SSWAudio.AudioController();
        state.audioController.on("play", meta => {
          state.progressStore?.recordAudioPlay({
            track: "GROUND_HANDLING",
            source_id: meta?.source_id || "",
            fact_id: meta?.fact_id || "",
            source: "AUDIO"
          });
        });
      }

      render();
    } catch (e) {
      console.error(e);
      $("#app").innerHTML = `<section class="error-screen"><div class="error-icon">⚠</div><h2>Master data could not be loaded</h2><p>Check the application files, service-worker cache, or network connection.</p></section>`;
    }
  }

  // ========== RENDERING ==========
  function shell(content, opts = {}) {
    applyUISettings();
    $("#app").innerHTML = `<div class="page-enter">${content}</div>`;
    $$("[data-route]").forEach(b => b.classList.toggle("active", b.dataset.route === state.route));
    if (opts.top) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function go(route) {
    state.route = route;
    location.hash = route;
    render();
  }

  function statCard(value, label, icon) {
    return `<div class="stat-card"><span class="stat-icon">${icon}</span><div><strong>${esc(value)}</strong><small>${esc(label)}</small></div></div>`;
  }

  function progressBar(value) {
    return `<div class="progress"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>`;
  }

  function sourceLine(x) {
    return `<div class="source-line">${esc(x.source_id || x.source?.source_id || "")} • p.${esc(x.physical_page || x.source?.physical_page || "")} ${x.fact_id ? "• " + esc(x.fact_id) : ""}</div>`;
  }

  // ========== PAGE: HOME ==========
  function home() {
    const a = getAnalytics();
    const seen = new Set(state.progressStore?.events({ type: "STUDY_OPEN" }).map(e => e.fact_id)).size;
    const examSessions = a?.totals?.exam_sessions || 0;
    const weak = a?.weak_areas?.slice(0, 3) || [];
    const lastExam = a?.recent_exam_sessions?.[0];

    shell(`<section class="hero hero-command premium-dashboard">
      <div class="hero-grid"><div><div class="eyebrow">JAPAN SSW • AIRPORT OPERATIONS</div><h1>Ground Handling<br><span>Master Command</span></h1>
      <p>Source-traceable study built from the audited official JAEA Ground Handling materials.</p>
      <div class="hero-actions"><button class="primary" data-route="study">▶ Continue Study</button><button class="secondary" data-route="mcq">MCQ Practice</button></div></div>
      <div class="cockpit-card"><div class="radar"><span>✈</span><i></i></div><div class="cockpit-line"><span>CONTENT</span><b>${state.study.length}</b></div><div class="cockpit-line"><span>PRACTICE</span><b>${state.questions.length}</b></div></div>
      <div class="dashboard-strip"><div><small>READINESS</small><b>${pct()}%</b><span>MCQ accuracy</span></div><div><small>STUDY</small><b>${seen}/${state.study.length}</b><span>blocks opened</span></div></div>
    </section>
    <section class="stats-grid">${statCard(state.study.length, "Verified study blocks", "▣")}${statCard(state.questions.length, "Practice questions", "✓")}${statCard(state.glossary.length, "Technical terms", "◎")}</section>
    <section class="dashboard-grid">
      <article class="card progress-card"><div class="row-between"><div><span class="eyebrow">LOCAL LEARNING LOG</span><h3>Your progress</h3></div><strong>${pct()}%</strong></div>${progressBar(pct())}</article>
      <article class="card"><span class="eyebrow">WEAK AREAS</span><h3>Focus next</h3>${weak.length ? weak.map(w => `<div class="focus-row"><span>${esc(w.key)}</span><b>${w.accuracy_percent}%</b></div>`).join("") : "<p class='muted'>No data yet</p>"}</article>
    </section>`);
  }

  // ========== PAGE: STUDY WITH OPTIMIZED DEBOUNCED SEARCH ==========
  function study() {
    const grouped = new Map();
    state.study.forEach(x => {
      const key = x.chapter_id || "OTHER";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(x);
    });

    shell(`<div class="section-title"><div><span class="eyebrow">VERIFIED KNOWLEDGE</span><h2>Study Deck</h2></div><span class="tag">${state.study.length} verified</span></div>
      <div class="toolbar"><input id="studySearch" autocomplete="off" placeholder="Search concept, topic or source"><button class="secondary small" data-route="home">Home</button></div>
      <div id="studyList" class="study-groups"></div>`);

    // Debounced search (300ms delay)
    const draw = debounce(() => {
      const q = $("#studySearch").value.trim().toLowerCase();
      const records = state.study.filter(x => 
        (`${x.title} ${x.content?.en} ${x.content?.si} ${x.content?.ja} ${x.source_id}`).toLowerCase().includes(q)
      );
      const by = new Map();
      records.forEach(x => {
        if (!by.has(x.chapter_id)) by.set(x.chapter_id, []);
        by.get(x.chapter_id).push(x);
      });
      $("#studyList").innerHTML = [...by.entries()]
        .map(([chapter, items]) => `<section class="chapter-group"><div class="chapter-heading"><b>${esc(chapter)}</b><span>${items.length}</span></div><div class="item-list">${items.map(item => `<button class="item-link" data-study="${esc(item.fact_id)}">${esc(item.title)}</button>`).join("")}</div></section>`)
        .join("");
    }, 300);

    const input = $("#studySearch");
    if (input) {
      input.oninput = draw;
      draw(); // Initial draw
    }
  }

  // ========== PAGE: STUDY DETAIL ==========
  function studyDetail(id) {
    const x = state.study.find(a => a.fact_id === id);
    if (!x) return;

    state.currentStudyIndex = state.study.findIndex(a => a.fact_id === id);
    state.progressStore?.recordStudyOpen({ track: "GROUND_HANDLING", fact_id: id, study_id: id, source: "STUDY_DECK" });
    refreshAnalytics();

    const visuals = state.visuals.filter(v => (v.topic_ids || []).includes(x.topic_id));
    const visual = visuals[0] ? `<figure class="official-visual"><img src="./${esc(visuals[0].path)}" alt="Official source visual" loading="lazy"></figure>` : "";

    const langButtons = ["ja", "en", "si"].map(lang => {
      const supported = !!state.audioStore?.forFact(id)?.[0]?.variants?.[lang];
      return `<button class="audio-btn ${supported ? "" : "disabled"}" data-audio="${esc(id)}" data-lang="${lang}" title="${supported ? "Play in " + lang.toUpperCase() : "No audio"}">${lang.toUpperCase()}</button>`;
    }).join("");

    const hasPrevious = state.currentStudyIndex > 0;
    const hasNext = state.currentStudyIndex < state.study.length - 1;
    const previousId = hasPrevious ? state.study[state.currentStudyIndex - 1].fact_id : null;
    const nextId = hasNext ? state.study[state.currentStudyIndex + 1].fact_id : null;

    shell(`<div class="study-navigation-top">
      <button class="ghost back-btn" data-route="study">← Back to Study</button>
      <span class="study-counter">${state.currentStudyIndex + 1} / ${state.study.length}</span>
    </div>
    <article class="study-detail card"><div class="detail-top"><span class="tag">${esc(x.kind || "study")}</span></div><h2>${esc(x.title)}</h2>
      <div class="audio-panel simple-audio-panel">
        <div class="audio-label">Audio</div>
        <div class="audio-controls-inline">${langButtons}<button class="ghost small" data-audio-stop="${esc(id)}">Stop</button></div>
      </div>
      <div class="content-stack"><section class="content-block"><div class="jp-text">${esc(x.content?.ja || "")}</div></section></div>
      ${visual}
      <div class="detail-meta">${sourceLine(x)}</div>
    </article>
    <div class="lesson-navigation">
      ${hasPrevious ? `<button class="nav-btn prev-btn" data-study="${esc(previousId)}">← Previous</button>` : '<button class="nav-btn prev-btn disabled">← Previous</button>'}
      <button class="nav-btn home-btn" data-route="study">Back to Study</button>
      ${hasNext ? `<button class="nav-btn next-btn" data-study="${esc(nextId)}">Next →</button>` : '<button class="nav-btn next-btn disabled">Next →</button>'}
    </div>`, { top: true });
  }

  // ========== PAGE: MCQ ==========
  function mcq() {
    if (!state.questions.length) return shell(`<div class="empty">No verified questions available.</div>`);
    if (state.mcqIndex == null) state.mcqIndex = 0;
    state.mcqLocked = false;
    drawQuestion();
  }

  function drawQuestion() {
    const q = state.questions[state.mcqIndex] || state.questions[0];
    state.mcqIndex = state.questions.indexOf(q);
    shell(`<div class="section-title"><div><span class="eyebrow">PRACTICE DECK</span><h2>MCQ ${state.mcqIndex + 1}</h2></div><span class="tag">${state.mcqIndex + 1}/${state.questions.length}</span></div>
      <article class="question-card card"><h3>${esc((q.question || {}).english || "")}</h3>
      <div class="answers">${(q.choices || []).map(c => `<button class="answer" data-answer="${esc(c.id)}">${esc(c.english || c.text || "")}</button>`).join("")}</div>
      <div id="explain"></div><button id="nextQ" class="primary">Next Question</button></article>`);

    $$(".answer").forEach(b => b.onclick = () => answer(b.dataset.answer));
    $("#nextQ").onclick = () => { state.mcqIndex = state.mcqIndex + 1 < state.questions.length ? state.mcqIndex + 1 : 0; drawQuestion(); };
  }

  function answer(id) {
    if (state.mcqLocked) return;
    state.mcqLocked = true;
    const q = state.questions[state.mcqIndex];
    const correct = id === q.correct_choice_id;
    state.progressStore?.recordMcqAnswer({
      track: "GROUND_HANDLING", question_id: q.question_id, correct,
      source: q.source_type || "PRACTICE"
    });
    $$(".answer").forEach(b => {
      if (b.dataset.answer === q.correct_choice_id) b.classList.add("correct");
      else if (b.dataset.answer === id) b.classList.add("wrong");
    });
    $("#explain").innerHTML = `<div class="answer-result ${correct ? "good" : "bad"}"><b>${correct ? "✓ Correct" : "✕ Incorrect"}</b><p>${esc(q.explanation?.english || "")}</p></div>`;
  }

  // ========== PAGE: GLOSSARY WITH DEBOUNCED SEARCH ==========
  function glossary() {
    shell(`<div class="section-title"><div><span class="eyebrow">AVIATION TERMINOLOGY</span><h2>Technical Terms</h2></div><span class="tag">${state.glossary.length}</span></div>
      <div class="toolbar"><input id="termSearch" autocomplete="off" placeholder="Search terms"><button class="secondary small" data-route="home">Home</button></div>
      <div id="termList" class="term-list"></div>`);

    const draw = debounce(() => {
      const q = $("#termSearch").value.toLowerCase();
      $("#termList").innerHTML = state.glossary
        .filter(x => (`${x.japanese} ${x.english} ${x.sinhala}`).toLowerCase().includes(q))
        .map(x => `<div class="term-item"><b>${esc(x.japanese)}</b><span>${esc(x.english)}</span><p>${esc(x.sinhala)}</p></div>`)
        .join("");
    }, 300);

    const input = $("#termSearch");
    if (input) {
      input.oninput = draw;
      draw();
    }
  }

  // ========== PAGE: VISUAL LIBRARY WITH DEBOUNCED SEARCH ==========
  function visualLibrary() {
    shell(`<div class="section-title"><div><span class="eyebrow">OFFICIAL SOURCE IMAGERY</span><h2>Visual Library</h2></div><span class="tag">${state.visuals.length}</span></div>
      <div class="toolbar"><input id="visualSearch" autocomplete="off" placeholder="Search visuals"><button class="secondary small" data-route="home">Home</button></div>
      <div id="visualList" class="visual-grid"></div>`);

    const draw = debounce(() => {
      const q = $("#visualSearch").value.toLowerCase();
      $("#visualList").innerHTML = state.visuals
        .filter(v => (`${v.source_id} ${v.physical_page}`).toLowerCase().includes(q))
        .map(v => `<figure class="visual-thumb"><img src="./${esc(v.path)}" alt="${esc(v.source_id)}" loading="lazy"><figcaption>${esc(v.source_id)} p.${v.physical_page}</figcaption></figure>`)
        .join("");
    }, 300);

    const input = $("#visualSearch");
    if (input) {
      input.oninput = draw;
      draw();
    }
  }

  // ========== PAGE: PROGRESS ==========
  function progress() {
    const a = getAnalytics();
    const seen = new Set(state.progressStore?.events({ type: "STUDY_OPEN" }).map(e => e.fact_id)).size;
    const acc = pct();
    const exams = (a?.recent_exam_sessions || []).slice(0, 8);

    shell(`<div class="section-title"><div><span class="eyebrow">LEARNER ANALYTICS</span><h2>Progress & Results</h2></div></div>
      <section class="stats-grid">${statCard(acc + "%", "MCQ accuracy", "◎")}${statCard(seen, "Study blocks opened", "▣")}</section>
      <section class="card progress-card"><div class="row-between"><h3>Practice accuracy</h3><strong>${acc}%</strong></div>${progressBar(acc)}</section>
      <article class="card progress-card"><button class="ghost" id="resetProgress">Reset progress</button></article>`);

    $("#resetProgress").onclick = () => {
      if (confirm("Reset all learner progress?")) {
        state.progressStore?.reset();
        state.examPersistedSessionId = null;
        refreshAnalytics();
        progress();
      }
    };
  }

  // ========== PAGE: SETTINGS ==========
  function settings() {
    const ui = loadUISettings();
    shell(`<div class="section-title"><div><span class="eyebrow">SYSTEM</span><h2>Settings</h2></div></div>
      <article class="card appearance-card">
        <div class="row-between"><div><span class="eyebrow">DISPLAY</span><h3>Appearance</h3></div></div>
        <div class="audio-setting-row"><div><b>Dark mode</b></div><button class="switch ${ui.darkMode ? 'on' : ''}" data-ui-setting="darkMode" aria-pressed="${ui.darkMode}"></button></div>
        <div class="audio-setting-row"><div><b>Comfort mode</b></div><button class="switch ${ui.comfortMode ? 'on' : ''}" data-ui-setting="comfortMode" aria-pressed="${ui.comfortMode}"></button></div>
        <div class="audio-setting-row"><div><b>Reduced motion</b></div><button class="switch ${ui.reducedMotion ? 'on' : ''}" data-ui-setting="reducedMotion" aria-pressed="${ui.reducedMotion}"></button></div>
      </article>
      ${safariInstallCard()}
      <article class="card"><h3>Data status</h3><p>Study: ${state.study.length} • Questions: ${state.questions.length} • Glossary: ${state.glossary.length} • Visuals: ${state.visuals.length}</p></article>`);

    $$('[data-ui-setting]').forEach(b => {
      b.onclick = () => {
        const key = b.dataset.uiSetting;
        saveUISettings({ [key]: !loadUISettings()[key] });
        settings();
      };
    });
  }

  // ========== AUDIO HANDLERS ==========
  function playStudyAudio(factId, lang) {
    const block = state.audioStore?.forFact(factId)?.[0];
    if (block && state.audioController) state.audioController.playBlock(block, lang);
  }

  function stopStudyAudio() {
    state.audioController?.stop();
  }

  // ========== EVENT DELEGATION ==========
  document.addEventListener("click", e => {
    const ab = e.target.closest("[data-audio]");
    if (ab) { playStudyAudio(ab.dataset.audio, ab.dataset.lang); return; }

    const ss = e.target.closest("[data-audio-stop]");
    if (ss) { stopStudyAudio(); return; }

    const sid = e.target.closest("[data-study]")?.dataset.study;
    if (sid) { studyDetail(sid); return; }
  });

  // ========== ROUTER ==========
  function render() {
    if (state.route === "study") study();
    else if (state.route === "mcq") mcq();
    else if (state.route === "glossary") glossary();
    else if (state.route === "visual-library") visualLibrary();
    else if (state.route === "progress") progress();
    else if (state.route === "settings") settings();
    else home();

    $$("[data-route]").forEach(b => b.addEventListener("click", () => go(b.dataset.route)));
  }

  // ========== INITIALIZATION ==========
  window.addEventListener("hashchange", () => {
    state.route = location.hash.slice(1) || "home";
    render();
  });

  const updateOrientation = () => {
    const g = $("#orientationGuard");
    if (g) g.classList.toggle("show", window.matchMedia?.("(orientation: landscape) and (max-width: 900px)").matches);
  };
  window.addEventListener("resize", updateOrientation, { passive: true });
  window.addEventListener("orientationchange", updateOrientation, { passive: true });
  setTimeout(updateOrientation, 0);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);

  init();
})();
