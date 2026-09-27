/* FINAL UI INTEGRATION — SSW Airport Ground Handling Master Study */
(function () {
  "use strict";

  const state = {
    route: location.hash.slice(1) || "home",
    study: [], questions: [], glossary: [], topics: [], visuals: [], audio: null, sources: null,
    audioStore: null, audioController: null, progressStore: null, analytics: null, examSession: null, examTick: null, examPersistedSessionId: null,
    search: "",
    currentStudyIndex: -1
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const analytics = () => state.analytics || (state.progressStore && window.SSWGHProgress ? window.SSWGHProgress.buildAnalytics(state.progressStore) : null);
  const pct = () => Math.round(analytics()?.totals?.mcq_accuracy_percent || 0);
  function refreshAnalytics(){ state.analytics = state.progressStore && window.SSWGHProgress ? window.SSWGHProgress.buildAnalytics(state.progressStore) : null; return state.analytics; }
  const UI_SETTINGS_KEY = "ssw-gh-ui-settings-v1";
  function loadUISettings(){ try { const raw=JSON.parse(localStorage.getItem(UI_SETTINGS_KEY)||"{}"); return { darkMode:raw.darkMode!==false, comfortMode:raw.comfortMode===true, reducedMotion:raw.reducedMotion===true }; } catch(_){ return { darkMode:true, comfortMode:false, reducedMotion:false }; } }
  function saveUISettings(patch){ const next={...loadUISettings(),...patch}; try{localStorage.setItem(UI_SETTINGS_KEY,JSON.stringify(next));}catch(_){} applyUISettings(next); return next; }
  function applyUISettings(s=loadUISettings()){ document.documentElement.classList.toggle("light-mode",!s.darkMode); document.documentElement.classList.toggle("comfort-mode",s.comfortMode); document.documentElement.classList.toggle("reduced-motion",s.reducedMotion); }
  function isStandalone(){ return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone===true; }
  function safariInstallCard(){ if(isStandalone()) return `<article class="card install-card ready"><div class="install-icon">✓</div><div><span class="eyebrow">HOME SCREEN</span><h3>App mode active</h3><p class="muted">You are already installed and ready to study offline.</p></div></article>`; return `<article class="card install-card"><div class="install-icon">◎</div><div><span class="eyebrow">INSTALL APP</span><h3>Add to home screen</h3><p class="muted">Use browser install to keep the study deck and audio controls available offline.</p></div></article>`; }
  async function load(path) { const r = await fetch(path); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); }

  async function init() {
    applyUISettings();
    try {
      const [study, questions, glossary, topics, visuals, audio, sources] = await Promise.all([
        load("./data/study.json"), load("./data/questions.json"), load("./data/glossary.json"),
        load("./data/topics.json"), load("./data/visual-assets.json"), load("./data/audio.json"), load("./data/sources.json")
      ]);
      state.study = study.records || [];
      state.questions = questions.questions || [];
      state.glossary = glossary.terms || [];
      state.topics = topics.topics || [];
      state.visuals = visuals.assets || [];
      state.audio = audio; state.sources = sources;
      if (window.SSWGHProgress) {
        state.progressStore = new window.SSWGHProgress.ProgressStore({});
        refreshAnalytics();
      }
      if (window.SSWAudio) {
        state.audioStore = new SSWAudio.AudioStore(audio, sources);
        state.audioController = new SSWAudio.AudioController();
        state.audioController.on("play", meta => { state.progressStore?.recordAudioPlay({ track:"GROUND_HANDLING", source_id:meta?.source_id||"", fact_id:meta?.fact_id||"", source:"AUDIO", metadata:{language:meta?.language||"en", fallback:meta?.fallback||""} }); });
      }
      render();
    } catch (e) {
      console.error(e);
      $("#app").innerHTML = `<section class="error-screen"><div class="error-icon">⚠</div><h2>Master data could not be loaded</h2><p>Check the application files, service-worker cache, or network connection.</p></section>`;
    }
  }

  function shell(content, opts = {}) {
    applyUISettings();
    $("#app").innerHTML = `<div class="page-enter">${content}</div>`;
    $$("[data-route]").forEach(b => b.classList.toggle("active", b.dataset.route === state.route));
    if (opts.top) window.scrollTo({ top: 0, behavior: "auto" });
  }
  function go(route) { state.route = route; location.hash = route; render(); }
  function statCard(value, label, icon) { return `<div class="stat-card"><span class="stat-icon">${icon}</span><div><strong>${esc(value)}</strong><small>${esc(label)}</small></div></div>`; }
  function progressBar(value) { return `<div class="progress"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>`; }
  function sourceLine(x) { return `<div class="source-line">${esc(x.source_id || x.source?.source_id || "")} • p.${esc(x.physical_page || x.source?.physical_page || "")} ${x.fact_id ? "• " + esc(x.fact_id) : ""}</div>`; }

  function home() {
    const a=refreshAnalytics();
    const seen = new Set(state.progressStore?.events({type:"STUDY_OPEN"}).map(e=>e.fact_id)).size;
    const official = state.questions.filter(q => q.source_type === "OFFICIAL_SAMPLE").length;
    const examSessions = a?.totals?.exam_sessions || 0;
    const examPassed = a?.totals?.exam_passed || 0;
    const weak = a?.weak_areas?.slice(0,3) || [];
    const lastExam = a?.recent_exam_sessions?.[0];
    const streak = a?.streak?.current_days || 0;
    shell(`<section class="hero hero-command premium-dashboard">
      <div class="hero-grid"><div><div class="eyebrow">JAPAN SSW • AIRPORT OPERATIONS</div><h1>Ground Handling<br><span>Master Command</span></h1>
      <p>Source-traceable study built from the audited official JAEA Ground Handling materials. Study, practice, visuals, terminology and exam simulation in one cockpit-style workspace.</p>
      <div class="hero-actions"><button class="primary" data-route="study">▶ Continue Study</button><button class="secondary" data-route="mcq">MCQ Practice</button><button class="ghost" data-route="settings">Settings</button></div></div>
      <div class="cockpit-card"><div class="radar"><span>✈</span><i></i></div><div class="cockpit-line"><span>CONTENT</span><b>${state.study.length}</b></div><div class="cockpit-line"><span>PRACTICE</span><b>${state.questions.length}</b></div><div class="cockpit-line"><span>EXAMS</span><b>${examSessions}</b></div></div></div>
      <div class="dashboard-strip"><div><small>READINESS</small><b>${pct()}%</b><span>MCQ accuracy</span></div><div><small>STUDY</small><b>${seen}/${state.study.length}</b><span>blocks opened</span></div><div><small>PASS RATE</small><b>${examPassed}/${Math.max(examSessions,1)}</b><span>completed exams</span></div></div>
    </section>
    <section class="stats-grid">${statCard(state.study.length,"Verified study blocks","▣")}${statCard(state.questions.length,"Practice questions","✓")}${statCard(state.glossary.length,"Technical terms","✦")}${statCard(official,"Official samples","◎")}</section>
    <section class="section-title"><div><span class="eyebrow">MISSION CONTROL</span><h2>Quick Start</h2></div></section>
    <section class="quick-grid"><button class="feature-card" data-route="study"><span>▣</span><b>Study Deck</b><small>Verified facts with source traceability</small></button><button class="feature-card" data-route="mcq"><span>✓</span><b>MCQ Practice</b><small>Timed drills and answer explanations</small></button><button class="feature-card" data-route="settings"><span>⚙</span><b>Audio & Settings</b><small>Controls for language output and playback</small></button></section>
    <section class="dashboard-grid">
      <article class="card progress-card"><div class="row-between"><div><span class="eyebrow">LOCAL LEARNING LOG</span><h3>Your progress</h3></div><strong>${pct()}%</strong></div>${progressBar(pct())}<p class="muted">All learner activity is stored locally in the browser.</p></article>
      <article class="card"><span class="eyebrow">WEAK AREAS</span><h3>Focus next</h3>${weak.length?weak.map(w=>`<div class="focus-row"><span>${esc(w.key)}</span><b>${w.accuracy_percent}%</b></div>`).join(""):'<div class="empty">No weak areas detected yet.</div>'}</article>
      <article class="card"><span class="eyebrow">LATEST EXAM</span><h3>Session history</h3>${lastExam?`<div class="exam-mini"><b>${esc(lastExam.section||"REAL EXAM")}</b><strong>${lastExam.score_percent||0}%</strong><small>${esc(lastExam.started_at ? new Date(lastExam.started_at).toLocaleString() : "")}</small></div>`:'<div class="empty">No study sessions completed yet.</div>'}</article>
    </section>`);
  }

  function study() {
    const grouped = new Map();
    state.study.forEach(x => { const key = x.chapter_id || "OTHER"; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(x); });
    shell(`<div class="section-title"><div><span class="eyebrow">VERIFIED KNOWLEDGE</span><h2>Study Deck</h2></div><span class="tag">${state.study.length} verified</span></div>
      <div class="toolbar"><input id="studySearch" autocomplete="off" placeholder="Search concept, topic or source"><button class="secondary small" data-route="home">Home</button></div>
      <div id="studyList" class="study-groups"></div>`);
    const draw = () => {
      const q = $("#studySearch").value.trim().toLowerCase();
      const records = state.study.filter(x => (`${x.title} ${x.content?.en} ${x.content?.si} ${x.content?.ja} ${x.source_id}`).toLowerCase().includes(q));
      const by = new Map(); records.forEach(x => { if (!by.has(x.chapter_id)) by.set(x.chapter_id, []); by.get(x.chapter_id).push(x); });
      $("#studyList").innerHTML = [...by.entries()].map(([chapter, items]) => `<section class="chapter-group"><div class="chapter-heading"><b>${esc(chapter)}</b><span>${items.length}</span></div>${items.map(x => `<button class="study-item" data-study="${esc(x.fact_id||x.study_id||"")}"><span class="tag">${esc(x.track||"GROUND_HANDLING")}</span><strong>${esc(x.title || x.topic_id || x.fact_id)}</strong><small>${esc(x.source_id || "source")}</small></button>`).join("")}</section>`).join("") || '<div class="empty">No study blocks match your search.</div>';
    };
    $("#studySearch").oninput = draw; draw();
  }

  function studyDetail(id) {
    const x = state.study.find(a => a.fact_id === id);
    if (!x) return;

    state.currentStudyIndex = state.study.findIndex(a => a.fact_id === id);
    state.progressStore?.recordStudyOpen({ track:"GROUND_HANDLING", fact_id:id, study_id:id, source:"STUDY_DECK" });
    refreshAnalytics();

    const visuals = state.visuals.filter(v => (v.topic_ids || []).includes(x.topic_id));
    const visual = visuals[0] ? `<figure class="official-visual"><img src="./${esc(visuals[0].path)}" alt="Official source visual, ${esc(visuals[0].source_id)} page ${visuals[0].physical_page}" loading="lazy"></figure>` : "";
    const langButtons = ["ja","en","si"].map(lang => {
      const supported = !!state.audioStore?.forFact(id)?.[0]?.variants?.[lang];
      return `<button class="audio-btn ${supported ? "" : "disabled"}" data-audio="${esc(id)}" data-lang="${lang}" title="${supported ? "Play in " + lang.toUpperCase() : "No audio for " + lang.toUpperCase()}">${supported ? "🔊" : "—"} ${lang.toUpperCase()}</button>`;
    }).join("");

    const hasPrevious = state.currentStudyIndex > 0;
    const hasNext = state.currentStudyIndex < state.study.length - 1;
    const previousId = hasPrevious ? state.study[state.currentStudyIndex - 1].fact_id : null;
    const nextId = hasNext ? state.study[state.currentStudyIndex + 1].fact_id : null;

    shell(`<div class="study-navigation-top">
      <button class="ghost back-btn" data-route="study">← Back to Study</button>
      <span class="study-counter">${state.currentStudyIndex + 1} / ${state.study.length}</span>
    </div>
    <article class="study-detail card"><div class="detail-top"><span class="tag">${esc(x.kind || "study")}</span><span class="tag">${esc(x.track || "GROUND_HANDLING")}</span></div><h2>${esc(x.title || x.fact_id || "Study item")}</h2>
      <div class="audio-panel simple-audio-panel">
        <div class="audio-label">Audio</div>
        <div class="audio-controls-inline">${langButtons}<button class="ghost small" data-audio-stop="${esc(id)}">Stop</button><button class="ghost small" data-audio-pause="${esc(id)}">Pause</button><button class="ghost small" data-audio-resume="${esc(id)}">Resume</button></div>
      </div>
      <div class="content-stack"><section class="content-block"><div class="block-tools"></div><div class="jp-text">${esc(x.content?.ja || "")}</div></section><section class="content-block"><div class="en-text">${esc(x.content?.en || "")}</div></section><section class="content-block"><div class="si-text">${esc(x.content?.si || "")}</div></section></div>
      ${visual}
      ${x.exam_point ? `<div class="exam-point"><b>Exam recognition</b><p>${esc(x.exam_point)}</p></div>` : ""}
      <div class="detail-meta">${sourceLine(x)}${x.illustration_ids?.length ? `<span>Visual links: ${x.illustration_ids.length}</span>` : ""}</div>
    </article>
    <div class="lesson-navigation">
      ${hasPrevious ? `<button class="nav-btn prev-btn" data-study="${esc(previousId)}">← Previous Lesson</button>` : '<button class="nav-btn prev-btn disabled">← Previous Lesson</button>'}
      <button class="nav-btn home-btn" data-route="study">Back to Study</button>
      ${hasNext ? `<button class="nav-btn next-btn" data-study="${esc(nextId)}">Next Lesson →</button>` : '<button class="nav-btn next-btn disabled">Next Lesson →</button>'}
    </div>`, { top: true });
  }

  function questionText(q) { return q.question || { english:"", sinhala:"", japanese:"" }; }
  function choiceText(c, mode = "practice") { return mode === "exam" ? (c.japanese || c.text || c.english) : (c.english || c.text); }

  function mcq() {
    if (!state.questions.length) return shell(`<div class="empty">No verified questions available.</div>`);
    if (state.mcqIndex == null) state.mcqIndex = 0;
    state.mcqLocked = false; drawQuestion();
  }
  function drawQuestion() {
    const q = state.questions[state.mcqIndex] || state.questions[0]; state.mcqIndex = state.questions.indexOf(q);
    const qt = questionText(q);
    shell(`<div class="section-title"><div><span class="eyebrow">PRACTICE DECK</span><h2>MCQ ${state.mcqIndex + 1}</h2></div><span class="tag">${state.mcqIndex + 1}/${state.questions.length}</span></div>
      <article class="question-card card"><div class="question-badges"><span class="tag">${esc(q.label || q.source_type)}</span><span class="tag">${esc(q.question_type)}</span></div><div class="question-text">${esc(qt.english || qt.sinhala || qt.japanese || "")}</div><div class="answers">${(q.choices || []).map(c => `<button class="answer" data-answer="${esc(c.choice_id)}">${esc(choiceText(c))}</button>`).join("")}</div><div id="explain" class="explain"></div><button class="primary" id="nextQ">Next</button></article>`);
    $$(".answer").forEach(b => b.onclick = () => answer(b.dataset.answer));
    $("#nextQ").onclick = () => { state.mcqIndex = state.mcqIndex + 1 < state.questions.length ? state.mcqIndex + 1 : 0; drawQuestion(); };
  }
  function answer(id) {
    if (state.mcqLocked) return; state.mcqLocked = true;
    const q = state.questions[state.mcqIndex]; const correct = id === q.correct_choice_id;
    state.progressStore?.recordMcqAnswer({ track:"GROUND_HANDLING", question_id:q.question_id, correct, source:q.source_type || "PRACTICE", source_id:q.source?.source_id || "", topic_id:q.topic_id || "", metadata:{section:q.label || "MCQ"} });
    $$(".answer").forEach(b => { if (b.dataset.answer === q.correct_choice_id) b.classList.add("correct"); else if (b.dataset.answer === id) b.classList.add("wrong"); });
    $("#explain").innerHTML = `<div class="answer-result ${correct ? "good" : "bad"}"><b>${correct ? "✓ Correct" : "✕ Incorrect"}</b><p>${esc(q.explanation?.english || "")}</p><p>${esc(q.explanation?.sinhala || "")}</p></div>`;
  }

  function officialSamples() {
    const list = state.questions.filter(q => q.source_type === "OFFICIAL_SAMPLE");
    shell(`<div class="section-title"><div><span class="eyebrow">IMMUTABLE SOURCE SET</span><h2>Official Samples</h2></div><span class="tag">${list.length}</span></div><div class="notice">These question sets remain source-traceable and are not editable by the learner.</div>${list.map(q => `<article class="card sample-item"><b>${esc(q.question_id)}</b><p>${esc(q.question || "")}</p></article>`).join("")}`);
  }

  function glossary() {
    shell(`<div class="section-title"><div><span class="eyebrow">AVIATION TERMINOLOGY</span><h2>Technical Terms</h2></div><span class="tag">${state.glossary.length}</span></div><div class="toolbar"><input id="termSearch" autocomplete="off" placeholder="Search term"><button class="secondary small" data-route="home">Home</button></div><div id="termList" class="list"></div>`);
    const draw = () => { const q = $("#termSearch").value.toLowerCase(); $("#termList").innerHTML = state.glossary.filter(x => (`${x.japanese} ${x.english} ${x.sinhala}`).toLowerCase().includes(q)).map(x => `<article class="card compact-row"><div><b>${esc(x.japanese || x.english || x.sinhala)}</b><small>${esc(x.english || "")}</small></div><div class="tag">${esc(x.sinhala || "")}</div></article>`).join("") || '<div class="empty">No terms found.</div>'; };
    $("#termSearch").oninput = draw; draw();
  }

  function visualLibrary() {
    shell(`<div class="section-title"><div><span class="eyebrow">OFFICIAL SOURCE IMAGERY</span><h2>Visual Library</h2></div><span class="tag">${state.visuals.length} extracted</span></div><div class="toolbar"><input id="visualSearch" autocomplete="off" placeholder="Search by page, source or topic"><button class="secondary small" data-route="home">Home</button></div><div id="visualList" class="visual-grid"></div>`);
    const draw = () => { const q = $("#visualSearch").value.toLowerCase(); $("#visualList").innerHTML = state.visuals.filter(v => (`${v.source_id} ${v.physical_page} ${(v.topic_ids||[]).join(" ")}`).toLowerCase().includes(q)).map(v => `<article class="card visual-item"><img src="./${esc(v.path)}" alt="${esc(v.source_id)}" loading="lazy"><div><b>${esc(v.source_id)}</b><small>p.${esc(v.physical_page)}</small></div></article>`).join("") || '<div class="empty">No visuals match.</div>'; };
    $("#visualSearch").oninput = draw; draw();
  }

  function searchPage() {
    shell(`<div class="section-title"><div><span class="eyebrow">MASTER INDEX</span><h2>Search Everything</h2></div></div><div class="toolbar"><input id="globalSearch" value="${esc(state.search)}" autocomplete="off" placeholder="Search the entire verified library"><button class="secondary small" data-route="home">Home</button></div><div id="globalResults"></div>`);
    const draw = () => { const q = $("#globalSearch").value.trim().toLowerCase(); state.search=q; if(!q){$("#globalResults").innerHTML='<div class="empty">Enter a keyword to search the verified content.</div>'; return;} const hits = [...state.study, ...state.questions, ...state.glossary].filter(x => { const hay = JSON.stringify(x).toLowerCase(); return hay.includes(q); }); $("#globalResults").innerHTML = hits.slice(0,20).map(x => `<article class="card compact-row"><div><b>${esc(x.title || x.japanese || x.question_id || x.fact_id || "Result")}</b><small>${esc(x.source_id || x.source?.source_id || x.question_type || "")}</small></div><button class="ghost small" data-route="study">Open</button></article>`).join("") || '<div class="empty">No results found.</div>'; };
    $("#globalSearch").oninput=draw; draw();
  }

  function progress() {
    const a=refreshAnalytics();
    const seen=new Set(state.progressStore?.events({type:"STUDY_OPEN"}).map(e=>e.fact_id)).size;
    const acc=pct();
    const exams=(a?.recent_exam_sessions||[]).slice(0,8);
    const examRows=exams.length ? exams.map(s=>`<article class="card compact-row"><div><b>${esc(s.section||s.session_type||"Exam")}</b><small>${esc(s.started_at ? new Date(s.started_at).toLocaleString() : "")}</small></div><div class="result-pill ${Number(s.score_percent||0) >= 65 ? "pass" : "fail"}">${Number(s.score_percent||0)}%</div></article>`).join("") : '<div class="empty">No exam sessions recorded yet.</div>';
    const topicRows=(a?.weak_areas||[]).slice(0,6).map(x=>`<div class="topic-row static"><span><b>${esc(x.key)}</b><small>${x.answered} answers • ${x.correct} correct</small></span><strong>${x.accuracy_percent}%</strong></div>`).join("") || '<div class="empty">No weak topics yet.</div>';
    shell(`<div class="section-title"><div><span class="eyebrow">LEARNER ANALYTICS</span><h2>Progress & Results</h2></div></div>
      <section class="stats-grid">${statCard(acc+"%","MCQ accuracy","◎")}${statCard(a?.totals?.mcq_answered||0,"Questions answered","✓")}${statCard(seen,"Study blocks opened","▣")}${statCard(a?.streak?.current_days||0,"Active streak","✦")}</section>
      <section class="card progress-card"><div class="row-between"><h3>Practice accuracy</h3><strong>${acc}%</strong></div>${progressBar(acc)}<p class="muted">All learner activity is stored in the browser and can be reset at any time.</p></section>
      <section><div class="section-title"><div><span class="eyebrow">REAL EXAM HISTORY</span><h3>Recent Sessions</h3></div></div><div class="list">${examRows}</div></section>
      <section><div class="section-title"><div><span class="eyebrow">FOCUS AREAS</span><h3>Weak Topics</h3></div></div><div class="list">${topicRows}</div></section>
      <article class="card progress-card"><button class="ghost" id="resetProgress">Reset all learner progress</button></article>`);
    $("#resetProgress").onclick=()=>{if(confirm("Reset all learner progress?")){state.progressStore?.reset();state.examPersistedSessionId=null;refreshAnalytics();progress();}};
  }

  function settings(){
    const ui=loadUISettings();
    shell(`<div class="section-title"><div><span class="eyebrow">SYSTEM</span><h2>Settings</h2></div></div>
      <article class="card appearance-card"><div class="row-between"><div><span class="eyebrow">DISPLAY</span><h3>Comfort & appearance</h3><p class="muted">Optimized for long study sessions on mobile screens.</p></div></div>
        <div class="audio-setting-row"><div><b>Dark mode</b><small>Use the default cockpit reading theme.</small></div><button class="switch ${ui.darkMode?'on':''}" data-ui-setting="darkMode" aria-label="Toggle dark mode"></button></div>
        <div class="audio-setting-row"><div><b>Comfort mode</b><small>Increase spacing and readability.</small></div><button class="switch ${ui.comfortMode?'on':''}" data-ui-setting="comfortMode" aria-label="Toggle comfort mode"></button></div>
        <div class="audio-setting-row"><div><b>Reduced motion</b><small>Reduce animations for calmer study sessions or mobile performance.</small></div><button class="switch ${ui.reducedMotion?'on':''}" data-ui-setting="reducedMotion" aria-label="Toggle reduce motion"></button></div>
      </article>
      ${audioSettings()}
      ${safariInstallCard()}
      <article class="card"><h3>Data status</h3><p>Verified study: ${state.study.length} • Questions: ${state.questions.length} • Visuals: ${state.visuals.length} • Terms: ${state.glossary.length}</p></article>`);
    $$('[data-ui-setting]').forEach(b=>b.onclick=()=>{ const key=b.dataset.uiSetting; saveUISettings({[key]:!loadUISettings()[key]}); settings(); });
    const c=state.audioController; if(!c)return;
    $$('[data-audio-setting]').forEach(b=>b.onclick=()=>{const key=b.dataset.audioSetting; if(key.startsWith('channel:')) c.toggleChannel(key.split(':')[1]); else c.toggle(key); settings();});
    const volume=$("#audioVolume"); if(volume)volume.oninput=()=>{c.setSettings({volume:Number(volume.value)}); $("#audioVolumeValue").textContent=Math.round(Number(volume.value)*100)+"%";};
    const rate=$("#audioRate"); if(rate)rate.oninput=()=>{c.setSettings({rate:Number(rate.value)}); $("#audioRateValue").textContent=Number(rate.value).toFixed(2)+"×";};
  }

  function audioSettings(){
    const c=state.audioController;
    if(!c)return `<article class="card"><h3>Audio Control</h3><p class="muted">Audio engine is unavailable.</p></article>`;
    const s=c.getSettings();
    const blocks=state.audioStore?.blocks||[];
    const first=blocks[0];
    const sample=(lang)=>esc(first?.variants?.[lang]?.text||first?.content?.[lang]||"No source-backed audio text");
    const toggle=(id,label,on,sub="")=>`<div class="audio-setting-row"><div><b>${label}</b>${sub?`<small>${sub}</small>`:""}</div><button class="switch ${on?"on":""}" data-audio-setting="${id}" aria-label="Toggle ${label}"></button></div>`;
    return `<article class="card audio-control-card"><div class="row-between"><div><span class="eyebrow">VOICE CONTROL</span><h3>Audio Control</h3></div><button class="audio-stop ghost" aria-label="Stop audio">Stop</button></div>
      <div class="audio-control-summary"><strong>${blocks.length}</strong><span>source-backed blocks • browser fallback available</span></div>
      ${toggle("masterEnabled","Master Voice",s.masterEnabled,"One switch for all study audio")}
      <div class="audio-channel-title">Voice channels</div>
      ${toggle("channel:ja",sample("ja"),s.channels.ja,"Japanese sources")}
      ${toggle("channel:en",sample("en"),s.channels.en,"English sources")}
      ${toggle("channel:si",sample("si"),s.channels.si,"Sinhala sources")}
      ${toggle("autoPlay","Auto Play",s.autoPlay,"Play the first enabled voice when a study block opens")}
      ${toggle("autoQueue","Auto Queue",s.autoQueue,"Queue enabled voices sequentially when selected")}
      ${toggle("fallbackAllowed","Browser fallback",s.fallbackAllowed,"Use browser speech when recordings are pending")}
      <div class="audio-range-row"><label for="audioVolume">Volume <b id="audioVolumeValue">${Math.round(s.volume*100)}%</b></label><input id="audioVolume" type="range" min="0" max="1" step="0.05" value="${s.volume}"></div>
      <div class="audio-range-row"><label for="audioRate">Speed <b id="audioRateValue">${s.rate.toFixed(2)}×</b></label><input id="audioRate" type="range" min="0.5" max="1.75" step="0.05" value="${s.rate}"></div>
    </article>`;
  }

  function render(){
    if (state.route === "study") study(); else if (state.route === "mcq") mcq(); else if (state.route === "official-samples") officialSamples(); else if (state.route === "visual-library") visualLibrary(); else if (state.route === "glossary") glossary(); else if (state.route === "search") searchPage(); else if (state.route === "progress") progress(); else if (state.route === "settings") settings(); else if (state.route === "home") home(); else home();
    $$("[data-route]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.route)));
  }

  function playStudyAudio(factId,lang){
    const block = state.audioStore?.forFact(factId)?.[0];
    if(block && state.audioController) state.audioController.playBlock(block,lang);
  }

  function queueStudyAudio(factId){
    const block = state.audioStore?.forFact(factId)?.[0], c = state.audioController;
    if(!block || !c) return;
    const s = c.getSettings();
    const items = ["ja","en","si"].filter(lang => s.channels[lang]).map(lang => ({block,language:lang}));
    c.playQueue(items);
  }

  function stopStudyAudio(){ state.audioController?.stop(); }

  document.addEventListener("click", e => {
    const ab = e.target.closest("[data-audio]");
    if(ab){ playStudyAudio(ab.dataset.audio, ab.dataset.lang); return; }

    const ps = e.target.closest("[data-audio-pause]");
    if(ps){ state.audioController?.pause(); return; }

    const rs = e.target.closest("[data-audio-resume]");
    if(rs){ state.audioController?.resume(); return; }

    const ss = e.target.closest("[data-audio-stop]");
    if(ss){ stopStudyAudio(); return; }

    if(e.target.closest(".audio-stop")){ stopStudyAudio(); return; }

    const aq = e.target.closest("[data-queue]");
    if(aq){ queueStudyAudio(aq.dataset.queue); return; }

    const sid = e.target.closest("[data-study]")?.dataset.study;
    if(sid){ studyDetail(sid); if(state.audioController?.getSettings().autoPlay){ const b = state.audioStore?.forFact(sid)?.[0]; const first = ["ja","en","si"].find(lang => b?.variants?.[lang] && state.audioController.getSettings().channels[lang]); if(first) state.audioController.playBlock(b, first); } return; }

    const aid = e.target.closest("[data-answer]")?.dataset.answer;
    if(aid){ answer(aid); return; }
  });

  window.addEventListener("hashchange",()=>{ state.route=location.hash.slice(1)||"home"; render(); });
  const updateOrientation=()=>{ const g=$("#orientationGuard"); if(g) g.classList.toggle("show",window.matchMedia?.("(orientation: landscape) and (max-width: 900px)").matches); };
  window.addEventListener("resize",updateOrientation,{passive:true}); window.addEventListener("orientationchange",updateOrientation,{passive:true}); setTimeout(updateOrientation,0);
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
  init();
})();
