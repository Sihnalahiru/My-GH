/* FINAL UI INTEGRATION — SSW Airport Ground Handling Master Study */
(function () {
  "use strict";

  const state = {
    route: location.hash.slice(1) || "home",
    study: [], questions: [], glossary: [], topics: [], visuals: [], audio: null, sources: null,
    audioStore: null, audioController: null, progressStore: null, analytics: null, examSession: null, examTick: null, examPersistedSessionId: null,
    search: ""
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const analytics = () => state.analytics || (state.progressStore && window.SSWGHProgress ? window.SSWGHProgress.buildAnalytics(state.progressStore) : null);
  const pct = () => Math.round(analytics()?.totals?.mcq_accuracy_percent || 0);
  function refreshAnalytics(){ state.analytics = state.progressStore && window.SSWGHProgress ? window.SSWGHProgress.buildAnalytics(state.progressStore) : null; return state.analytics; }
  const UI_SETTINGS_KEY = "ssw-gh-ui-settings-v1";
  function loadUISettings(){ try { const raw=JSON.parse(localStorage.getItem(UI_SETTINGS_KEY)||"{}"); return { darkMode:raw.darkMode!==false, comfortMode:raw.comfortMode===true, reducedMotion:raw.reducedMotion===true }; } catch(_) { return {darkMode:true,comfortMode:false,reducedMotion:false}; } }
  function saveUISettings(patch){ const next={...loadUISettings(),...patch}; try{localStorage.setItem(UI_SETTINGS_KEY,JSON.stringify(next));}catch(_){} applyUISettings(next); return next; }
  function applyUISettings(s=loadUISettings()){ document.documentElement.classList.toggle("light-mode",!s.darkMode); document.documentElement.classList.toggle("comfort-mode",s.comfortMode); document.documentElement.classList.toggle("reduced-motion",s.reducedMotion); const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.setAttribute("content",s.darkMode?"#07111f":"#f4f7fa"); }
  function isStandalone(){ return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone===true; }
  function safariInstallCard(){ if(isStandalone()) return `<article class="card install-card ready"><div class="install-icon">✓</div><div><span class="eyebrow">HOME SCREEN</span><h3>App mode active</h3><p>This study workspace is running as an installed web app.</p></div></article>`; return `<article class="card install-card"><div class="install-icon">＋</div><div><span class="eyebrow">SAFARI READY</span><h3>Add to Home Screen</h3><p>In Safari, use <b>Share → Add to Home Screen</b> to launch this PWA like an app. The manifest and app icon are already configured.</p></div></article>`; }
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
        state.audioController.on("play", meta => { state.progressStore?.recordAudioPlay({ track:"GROUND_HANDLING", source_id:meta?.source_id||"", fact_id:meta?.fact_id||"", source:"AUDIO", metadata:meta||{} }); refreshAnalytics(); });
      }
      render();
    } catch (e) {
      console.error(e);
      $("#app").innerHTML = `<section class="error-screen"><div class="error-icon">⚠</div><h2>Master data could not be loaded</h2><p>Check the application files, service-worker cache, or network connection.</p><button class="primary" onclick="location.reload()">Retry</button></section>`;
    }
  }

  function shell(content, opts = {}) {
    applyUISettings();
    $("#app").innerHTML = `<div class="page-enter">${content}</div>`;
    $$("[data-route]").forEach(b => b.classList.toggle("active", b.dataset.route === state.route));
    if (opts.top) window.scrollTo({ top: 0, behavior: "instant" });
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
      <div class="hero-actions"><button class="primary" data-route="study">▶ Continue Study</button><button class="secondary" data-route="mcq">MCQ Practice</button><button class="ghost" data-route="real-exam">Timed Exam</button></div></div>
      <div class="cockpit-card"><div class="radar"><span>✈</span><i></i></div><div class="cockpit-line"><span>CONTENT</span><b>${state.study.length}</b></div><div class="cockpit-line"><span>PRACTICE</span><b>${state.questions.length}</b></div><div class="cockpit-line"><span>VISUALS</span><b>${state.visuals.length}</b></div><div class="cockpit-line"><span>STREAK</span><b>${streak}d</b></div></div></div>
      <div class="dashboard-strip"><div><small>READINESS</small><b>${pct()}%</b><span>MCQ accuracy</span></div><div><small>STUDY</small><b>${seen}/${state.study.length}</b><span>blocks opened</span></div><div><small>EXAMS</small><b>${examSessions}</b><span>${examPassed} passed</span></div><div><small>TIME</small><b>${a?.totals?.study_minutes||0}m</b><span>logged study</span></div></div>
    </section>
    <section class="stats-grid">${statCard(state.study.length,"Verified study blocks","▣")}${statCard(state.questions.length,"Practice questions","✓")}${statCard(state.glossary.length,"Technical terms","文")}${statCard(official,"Official samples","★")}${statCard(examSessions,"Exam sessions","⏱")}${statCard(examPassed,"Exam passes","✓")}</section>
    <section class="section-title"><div><span class="eyebrow">MISSION CONTROL</span><h2>Quick Start</h2></div></section>
    <section class="quick-grid"><button class="feature-card" data-route="study"><span>▣</span><b>Study Deck</b><small>Verified facts with source traceability</small></button><button class="feature-card" data-route="mcq"><span>✓</span><b>MCQ Practice</b><small>Official samples + source-based practice</small></button><button class="feature-card" data-route="visual-library"><span>◉</span><b>Visual Library</b><small>Official extracted illustrations</small></button><button class="feature-card" data-route="real-exam"><span>⏱</span><b>Real Exam Mode</b><small>Japanese-focused timed simulation</small></button></section>
    <section class="dashboard-grid">
      <article class="card progress-card"><div class="row-between"><div><span class="eyebrow">LOCAL LEARNING LOG</span><h3>Your progress</h3></div><strong>${pct()}%</strong></div>${progressBar(pct())}<small>${seen} study blocks opened • ${a?.totals?.mcq_answered || 0} MCQs answered</small></article>
      <article class="card"><span class="eyebrow">WEAK AREAS</span><h3>Focus next</h3>${weak.length?weak.map(w=>`<div class="focus-row"><span>${esc(w.key)}</span><b>${w.accuracy_percent}%</b></div>`).join(""):`<p class="muted">Complete a few practice questions to generate source-linked focus areas.</p>`}</article>
      <article class="card"><span class="eyebrow">LATEST EXAM</span><h3>Session history</h3>${lastExam?`<div class="exam-mini"><b>${esc(lastExam.section||"REAL EXAM")}</b><strong>${lastExam.score_percent}%</strong><small>${esc(lastExam.status||"")} • ${esc(lastExam.answered)}/${esc(lastExam.total)} answered</small></div>`:`<p class="muted">No real exam session recorded yet.</p>`}<button class="secondary small" data-route="progress">Open analytics</button></article>
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
      $("#studyList").innerHTML = [...by.entries()].map(([chapter, items]) => `<section class="chapter-group"><div class="chapter-heading"><b>${esc(chapter)}</b><span>${items.length}</span></div>${items.map(x => `<button class="topic-row" data-study="${esc(x.fact_id)}"><span class="row-icon">${x.kind === "warning" ? "⚠" : x.kind === "procedure" ? "↻" : "•"}</span><span><b>${esc(x.title)}</b><small>${esc(x.content?.en || "")}</small>${sourceLine(x)}</span><span class="chev">›</span></button>`).join("")}</section>`).join("") || `<div class="empty">No verified block matches this search.</div>`;
    };
    $("#studySearch").oninput = draw; draw();
  }

  function studyDetail(id) {
    const x = state.study.find(a => a.fact_id === id); if (!x) return;
    state.progressStore?.recordStudyOpen({ track:"GROUND_HANDLING", fact_id:id, study_id:id, source:"STUDY_DECK" }); refreshAnalytics();
    const visuals = state.visuals.filter(v => (v.topic_ids || []).includes(x.topic_id));
    const visual = visuals[0] ? `<figure class="official-visual"><img src="./${esc(visuals[0].path)}" alt="Official source visual, ${esc(visuals[0].source_id)} page ${visuals[0].physical_page}" loading="lazy"><figcaption>Official source visual • ${esc(visuals[0].source_id)} • physical p.${esc(visuals[0].physical_page)}</figcaption></figure>` : "";
    const audio = lang => state.audioStore?.forFact(id)?.[0]?.variants?.[lang];
    const audioButton = lang => audio(lang) ? `<button class="audio-btn" data-audio="${esc(id)}" data-lang="${lang}" title="Play this block">🔊</button>` : "";
    shell(`<button class="ghost back-btn" data-route="study">← Back to Study</button><article class="study-detail card"><div class="detail-top"><span class="tag">${esc(x.kind)}</span><span class="tag">${esc(x.source_id)} • p.${esc(x.physical_page)}</span></div><h2>${esc(x.title)}</h2>${visual}
      <div class="content-stack"><section class="content-block"><div class="block-tools">${audioButton("ja")}</div><div class="jp-text">${esc(x.content?.ja)}</div></section><section class="content-block"><div class="block-tools">${audioButton("en")}</div><div class="en-text">${esc(x.content?.en)}</div></section><section class="content-block"><div class="block-tools">${audioButton("si")}</div><div class="si-text">${esc(x.content?.si)}</div></section></div>
      ${x.exam_point ? `<div class="exam-point"><b>Exam recognition</b><p>${esc(x.exam_point)}</p></div>` : ""}
      <div class="detail-meta">${sourceLine(x)}${x.illustration_ids?.length ? `<span>Visual links: ${x.illustration_ids.length}</span>` : ""}</div><div class="study-audio-actions"><button class="audio-stop ghost" aria-label="Stop voice">■ Stop Voice</button><button class="secondary audio-queue" data-queue="${esc(id)}">▶ Play enabled voices</button></div></article>`, { top: true });
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
      <article class="question-card card"><div class="question-badges"><span class="tag">${esc(q.label || q.source_type)}</span><span class="tag">${esc(q.question_type)}</span></div><div class="jp-question">${esc(qt.japanese)}</div><div class="practice-secondary"><p>${esc(qt.english)}</p><p>${esc(qt.sinhala)}</p></div><div class="answers">${q.choices.map(c => `<button class="answer" data-answer="${esc(c.choice_id)}"><span>${esc(c.choice_id)}</span>${esc(choiceText(c))}</button>`).join("")}</div><div id="explain"></div><div class="question-footer">${sourceLine(q.source || {})}</div></article>`);
  }
  function answer(id) {
    if (state.mcqLocked) return; state.mcqLocked = true;
    const q = state.questions[state.mcqIndex]; const correct = id === q.correct_choice_id;
    state.progressStore?.recordMcqAnswer({ track:"GROUND_HANDLING", question_id:q.question_id, correct, source:q.source_type || "PRACTICE", source_id:q.source?.source_id || "", topic_id:q.topic_id || "", chapter_id:q.chapter_id || "" }); refreshAnalytics();
    $$(".answer").forEach(b => { if (b.dataset.answer === q.correct_choice_id) b.classList.add("correct"); else if (b.dataset.answer === id) b.classList.add("wrong"); });
    $("#explain").innerHTML = `<div class="answer-result ${correct ? "good" : "bad"}"><b>${correct ? "✓ Correct" : "✕ Incorrect"}</b><p>${esc(q.explanation?.english || "")}</p><p>${esc(q.explanation?.sinhala || "")}</p><button class="primary" id="nextQ">${state.mcqIndex + 1 < state.questions.length ? "Next question →" : "Restart deck ↺"}</button></div>`;
    $("#nextQ").onclick = () => { state.mcqIndex = state.mcqIndex + 1 < state.questions.length ? state.mcqIndex + 1 : 0; drawQuestion(); };
  }

  function officialSamples() {
    const list = state.questions.filter(q => q.source_type === "OFFICIAL_SAMPLE");
    shell(`<div class="section-title"><div><span class="eyebrow">IMMUTABLE SOURCE SET</span><h2>Official Samples</h2></div><span class="tag">${list.length}</span></div><div class="notice">These questions are preserved separately from generated practice and are not modified by the study engine.</div><div class="list" style="margin-top:14px">${list.map((q,i) => `<article class="card sample-card"><div class="row-between"><span class="tag">OFFICIAL SAMPLE</span><b>#${i+1}</b></div><h3>${esc(q.question.english)}</h3><p class="jp-question small-jp">${esc(q.question.japanese)}</p><div class="sample-answer"><b>Answer: ${esc(q.correct_choice_id)}</b><p>${esc(q.explanation.english)}</p></div>${sourceLine(q.source)}</article>`).join("")}</div>`);
  }

  function glossary() {
    shell(`<div class="section-title"><div><span class="eyebrow">AVIATION TERMINOLOGY</span><h2>Technical Terms</h2></div><span class="tag">${state.glossary.length}</span></div><div class="toolbar"><input id="termSearch" placeholder="Search Japanese, English or Sinhala"></div><div id="termList" class="term-grid"></div>`);
    const draw = () => { const q = $("#termSearch").value.toLowerCase(); $("#termList").innerHTML = state.glossary.filter(x => (`${x.japanese} ${x.english} ${x.sinhala}`).toLowerCase().includes(q)).map(x => `<article class="term-card"><b class="jp-text">${esc(x.japanese)}</b><span>${esc(x.english)}</span><p>${esc(x.sinhala)}</p>${sourceLine(x)}</article>`).join("") || `<div class="empty">No terms found.</div>`; };
    $("#termSearch").oninput = draw; draw();
  }

  function visualLibrary() {
    shell(`<div class="section-title"><div><span class="eyebrow">OFFICIAL SOURCE IMAGERY</span><h2>Visual Library</h2></div><span class="tag">${state.visuals.length} extracted</span></div><div class="toolbar"><input id="visualSearch" placeholder="Search source, page or topic"></div><div id="visualList" class="visual-grid"></div>`);
    const draw = () => { const q = $("#visualSearch").value.toLowerCase(); $("#visualList").innerHTML = state.visuals.filter(v => (`${v.source_id} ${v.physical_page} ${(v.topic_ids||[]).join(" ")}`).toLowerCase().includes(q)).map(v => `<figure class="visual-card"><img src="./${esc(v.path)}" alt="Official visual from ${esc(v.source_id)} page ${esc(v.physical_page)}" loading="lazy"><figcaption><b>${esc(v.source_id)}</b> • p.${esc(v.physical_page)}<br><small>${esc((v.topic_ids||[]).join(" • "))}</small></figcaption></figure>`).join("") || `<div class="empty">No visual matches this search.</div>`; };
    $("#visualSearch").oninput = draw; draw();
  }

  function searchPage() {
    shell(`<div class="section-title"><div><span class="eyebrow">MASTER INDEX</span><h2>Search Everything</h2></div></div><div class="toolbar"><input id="globalSearch" value="${esc(state.search)}" placeholder="Search study, terms, questions, visuals"></div><div id="globalResults" class="list"></div>`);
    const draw = () => { const q = $("#globalSearch").value.trim().toLowerCase(); state.search=q; if(!q){$("#globalResults").innerHTML='<div class="empty">Enter a keyword to search the verified content layer.</div>';return;} const s=state.study.filter(x=>`${x.title} ${x.content?.en} ${x.content?.ja} ${x.content?.si}`.toLowerCase().includes(q)).slice(0,12); const t=state.glossary.filter(x=>`${x.japanese} ${x.english} ${x.sinhala}`.toLowerCase().includes(q)).slice(0,12); const qu=state.questions.filter(x=>`${x.question?.english} ${x.question?.japanese}`.toLowerCase().includes(q)).slice(0,12); $("#globalResults").innerHTML=`${s.map(x=>`<button class="topic-row" data-study="${esc(x.fact_id)}"><span class="row-icon">▣</span><span><b>${esc(x.title)}</b><small>Study • ${esc(x.source_id)} p.${x.physical_page}</small></span><span>›</span></button>`).join("")}${t.map(x=>`<article class="term-card"><b>${esc(x.japanese)}</b><span>${esc(x.english)}</span><p>${esc(x.sinhala)}</p></article>`).join("")}${qu.map(x=>`<article class="card"><span class="tag">${esc(x.label)}</span><h3>${esc(x.question?.english)}</h3>${sourceLine(x.source)}</article>`).join("")}` || '<div class="empty">No verified results.</div>'; };
    $("#globalSearch").oninput=draw; draw();
  }

  function progress() {
    const a=refreshAnalytics();
    const seen=new Set(state.progressStore?.events({type:"STUDY_OPEN"}).map(e=>e.fact_id)).size;
    const acc=pct();
    const exams=(a?.recent_exam_sessions||[]).slice(0,8);
    const examRows=exams.length ? exams.map(s=>{
      const score=Number(s.score_percent||0);
      const label=s.metadata?.exam_status || s.status || "UNKNOWN";
      const passed=s.metadata?.passed === true;
      return `<article class="card compact-row"><div><b>${esc(s.section||s.session_type||"Exam")}</b><small>${esc(s.started_at ? new Date(s.started_at).toLocaleString() : "")}</small></div><div class="row-end"><strong>${score}%</strong><span class="tag">${passed?"PASS":label}</span></div></article>`;
    }).join("") : '<div class="empty">No exam sessions recorded yet.</div>';
    const topicRows=(a?.weak_areas||[]).slice(0,6).map(x=>`<div class="topic-row static"><span><b>${esc(x.key)}</b><small>${x.answered} answers • ${x.correct} correct</small></span><strong>${x.accuracy_percent}%</strong></div>`).join("") || '<div class="empty">Weak-area analytics will appear after enough answers are recorded.</div>';
    shell(`<div class="section-title"><div><span class="eyebrow">LEARNER ANALYTICS</span><h2>Progress & Results</h2></div></div>
      <section class="stats-grid">${statCard(acc+"%","MCQ accuracy","◎")}${statCard(a?.totals?.mcq_answered||0,"Questions answered","✓")}${statCard(seen,"Study blocks opened","▣")}${statCard(a?.totals?.study_minutes||0,"Study minutes","◷")}${statCard(a?.totals?.exam_sessions||0,"Exam sessions","⏱")}${statCard(a?.totals?.exam_passed||0,"Exam passes","★")}</section>
      <section class="card progress-card"><div class="row-between"><h3>Practice accuracy</h3><strong>${acc}%</strong></div>${progressBar(acc)}<p class="muted">All learner activity is stored in one unified local progress store.</p></section>
      <section><div class="section-title"><div><span class="eyebrow">REAL EXAM HISTORY</span><h3>Recent Sessions</h3></div></div><div class="list">${examRows}</div></section>
      <section><div class="section-title"><div><span class="eyebrow">FOCUS AREAS</span><h3>Weak Topics</h3></div></div><div class="list">${topicRows}</div></section>
      <section class="card"><div class="row-between"><div><h3>Activity</h3><small>${a?.streak?.current_days||0}-day active streak • ${a?.streak?.active_days_total||0} active days</small></div><strong>${a?.totals?.event_count||0}</strong></div><div class="weekly-strip">${(a?.weekly||[]).slice(-8).map(w=>`<div><small>${esc(w.week)}</small><b>${w.questions}</b><span>${w.accuracy_percent}%</span></div>`).join("")}</div></section>
      <article class="card progress-card"><button class="ghost" id="resetProgress">Reset all learner progress</button></article>`);
    $("#resetProgress").onclick=()=>{if(confirm("Reset all learner progress?")){state.progressStore?.reset();state.examPersistedSessionId=null;refreshAnalytics();progress();}};
  }

  function realExam() {
    const written = state.questions.filter(q => q.source_type !== "PREDICTED_PRACTICE" && q.status === "VERIFIED" && q.track === "GROUND_HANDLING");
    const practical = written.filter(q => q.visual_id);
    const a=refreshAnalytics();
    const recent=(a?.recent_exam_sessions||[]).slice(0,5);
    const recentHtml=recent.length ? `<div class="list">${recent.map(s=>`<article class="card compact-row"><div><b>${esc(s.section||"Exam")}</b><small>${esc(s.started_at ? new Date(s.started_at).toLocaleString() : "")}</small></div><div class="row-end"><strong>${Number(s.score_percent||0)}%</strong><span class="tag">${s.metadata?.passed===true?"PASS":esc(s.metadata?.exam_status||s.status)}</span></div></article>`).join("")}</div>` : '<div class="empty">No previous exam sessions.</div>';
    shell(`<div class="section-title"><div><span class="eyebrow">TIMED SIMULATION</span><h2>Real Exam Mode</h2></div><span class="tag">65% threshold</span></div><section class="exam-intro card"><div class="exam-badge">⏱</div><h3>Japanese-focused examination simulation</h3><p>Written: approximately 30 questions / 45 minutes. Practical / judgment: approximately 15 questions / 30 minutes. The current verified content pool contains ${practical.length} practical-eligible visual question(s), so the practical simulation remains locked until the visual question pool is sufficiently verified.</p><div class="exam-actions"><button class="primary" id="startWritten">Start Written</button><button class="secondary" id="startPractical" ${practical.length < 15 ? "disabled" : ""}>Start Practical</button></div></section><div class="notice">Listening is not presented as a separate official exam section. Audio remains a study/practice feature.</div><section><div class="section-title"><div><span class="eyebrow">LOCAL HISTORY</span><h3>Recent Exam Sessions</h3></div></div>${recentHtml}</section>`);
    $("#startWritten").onclick=()=>startExam("WRITTEN",written); $("#startPractical").onclick=()=>startExam("PRACTICAL",practical);
  }
  function startExam(section,list){
    if(!window.SSWRealExam)return;
    const n=section==="WRITTEN"?30:15;
    const session=new SSWRealExam.RealExamSession({section});
    session.loadQuestions(shuffle([...list]).slice(0,n));
    if(!session.questions.length)return;
    state.examSession=session; state.examPersistedSessionId=null;
    session.start();
    state.progressStore?.recordExamStart({track:"GROUND_HANDLING",source:"REAL_EXAM",source_id:"EXAM_ENGINE",metadata:{session_id:session.session_id,section,question_count:session.questions.length,duration_minutes:session.config.duration_minutes}});
    refreshAnalytics();
    renderExam();
    state.examTick=setInterval(()=>{session.checkTime(); if(session.status!=="RUNNING"){clearInterval(state.examTick); renderExamResult();} else updateExamTimer();},1000);
  }
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function updateExamTimer(){const el=$("#examTimer"); if(!el||!state.examSession)return; const sec=state.examSession.remainingSeconds(); el.textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}
  function renderExam(){const s=state.examSession, q=s.current(); if(!q)return; const qt=q.question; shell(`<div class="exam-top"><button class="ghost" id="abandonExam">Exit</button><div><b>${esc(s.config.title)}</b><small>${s.section}</small></div><strong id="examTimer">--:--</strong></div><div class="exam-progress">Question ${s.progress().current} / ${s.progress().total} • Answered ${s.progress().answered}</div><article class="exam-card card"><div class="jp-question">${esc(qt.japanese)}</div><div class="exam-choices">${q.choices.map(c=>`<button class="exam-choice ${s.answers.get(q.question_id)===c.choice_id?"selected":""}" data-exam-choice="${esc(c.choice_id)}"><b>${esc(c.choice_id)}</b><span>${esc(choiceText(c,"exam"))}</span></button>`).join("")}</div><div class="exam-nav"><button class="secondary" id="prevExam">← Previous</button><button class="secondary" id="nextExam">Next →</button><button class="primary" id="submitExam">Submit</button></div></article><div class="exam-map">${s.questions.map((x,i)=>`<button class="${i===s.index?"current":""} ${s.answers.has(x.question_id)?"answered":""}" data-jump="${i}">${i+1}</button>`).join("")}</div>`); updateExamTimer();
    $("#abandonExam").onclick=()=>{if(confirm("Abandon this exam session?")){persistExamAbandon(s);s.abandon();clearInterval(state.examTick);state.examSession=null;realExam();}};
    $$('[data-exam-choice]').forEach(b=>b.onclick=()=>{const previous=s.answers.get(s.current()?.question_id); const result=s.answer(b.dataset.examChoice); if(result.accepted && previous!==b.dataset.examChoice){const current=s.current(); state.progressStore?.recordExamAnswer({track:"GROUND_HANDLING",source:"REAL_EXAM",source_id:"EXAM_ENGINE",question_id:current?.question_id||"",correct:b.dataset.examChoice===current?.correct_choice_id,metadata:{session_id:s.session_id,section:s.section}}); refreshAnalytics();} renderExam();});
    $("#prevExam").onclick=()=>{s.previous();renderExam();}; $("#nextExam").onclick=()=>{s.next();renderExam();}; $("#submitExam").onclick=()=>{s.submit();clearInterval(state.examTick);renderExamResult();};
    $$('[data-jump]').forEach(b=>b.onclick=()=>{s.jumpTo(Number(b.dataset.jump));renderExam();});
  }
  function persistExamAbandon(s){
    if(!state.progressStore||!s||state.examPersistedSessionId===s.session_id)return;
    state.progressStore.recordExamAbandon({track:"GROUND_HANDLING",source:"REAL_EXAM",source_id:"EXAM_ENGINE",metadata:{session_id:s.session_id,section:s.section,answered:s.progress().answered,total:s.questions.length}});
    state.progressStore.addSession({session_id:s.session_id,session_type:`REAL_EXAM_${s.section}`,section:s.section,started_at:s.started_at,completed_at:new Date().toISOString(),total:s.questions.length,answered:s.progress().answered,correct:0,score_percent:0,source_type:"REAL_EXAM",status:"ABANDONED",metadata:{section:s.section,exam_status:"ABANDONED",passed:false}});
    state.examPersistedSessionId=s.session_id; refreshAnalytics();
  }
  function renderExamResult(){
    const s=state.examSession, r=s?.score||null;
    if(s?.score && state.progressStore && state.examPersistedSessionId!==s.session_id){
      const completedAt=s.submitted_at ? new Date(s.submitted_at).toISOString() : new Date().toISOString();
      const passed=Boolean(r.passed);
      state.progressStore.recordExamComplete({track:"GROUND_HANDLING",source:"REAL_EXAM",source_id:"EXAM_ENGINE",metadata:{session_id:s.session_id,section:s.section,total:r.total,answered:r.answered,correct:r.correct,percentage:r.percentage,passed,status:r.status}});
      state.progressStore.addSession({session_id:s.session_id,session_type:`REAL_EXAM_${s.section}`,section:s.section,started_at:s.started_at,completed_at:completedAt,total:r.total,answered:r.answered,correct:r.correct,incorrect:r.incorrect,score_percent:r.percentage,source_type:"REAL_EXAM",status:"COMPLETED",metadata:{section:s.section,exam_status:r.status,passed}});
      state.examPersistedSessionId=s.session_id; refreshAnalytics();
    }
    shell(`<section class="result-card card"><div class="eyebrow">EXAM SESSION RESULT</div><h2>${esc(s?.config?.title||"Exam Session")}</h2><div class="result-score">${r?.percentage ?? 0}%</div><p>Answered ${r?.answered ?? 0} of ${r?.total ?? 0}. ${r?.passed ? "The session reached the configured 65% practice threshold." : "The session did not reach the configured 65% practice threshold."}</p><div class="stats-grid">${statCard(r?.correct??0,"Correct","✓")}${statCard(r?.incorrect??0,"Incorrect","✕")}${statCard(r?.unanswered??0,"Unanswered","—")}${statCard(r?.status||"","Session status","◷")}</div><p class="muted">This local simulation does not determine official examination results.</p><button class="primary" data-route="real-exam">Back to Exam Mode</button><button class="secondary" data-route="progress">View Progress & History</button></section>`);
  }

  function audioSettings(){
    const c=state.audioController;
    if(!c)return `<article class="card"><h3>Audio Control</h3><p class="muted">Audio engine is unavailable.</p></article>`;
    const s=c.getSettings();
    const blocks=state.audioStore?.blocks||[];
    const first=blocks[0];
    const sample=(lang)=>esc(first?.variants?.[lang]?.text||first?.content?.[lang]||"No source-backed audio text");
    const toggle=(id,label,on,sub="")=>`<div class="audio-setting-row"><div><b>${label}</b>${sub?`<small>${sub}</small>`:""}</div><button class="switch ${on?"on":""}" data-audio-setting="${id}" aria-pressed="${on}"><span></span><em>${on?"ON":"OFF"}</em></button></div>`;
    return `<article class="card audio-control-card"><div class="row-between"><div><span class="eyebrow">VOICE CONTROL</span><h3>Audio Control</h3></div><button class="audio-stop ghost" aria-label="Stop voice">■ Stop Voice</button></div>
      <div class="audio-control-summary"><strong>${blocks.length}</strong><span>source-backed blocks • browser fallback available</span></div>
      ${toggle("masterEnabled","Master Voice",s.masterEnabled,"One switch for all study audio")}
      <div class="audio-channel-title">Voice channels</div>
      ${toggle("channel:ja",sample("ja"),s.channels.ja,"Source text preview")}
      ${toggle("channel:en",sample("en"),s.channels.en,"Source text preview")}
      ${toggle("channel:si",sample("si"),s.channels.si,"Source text preview")}
      ${toggle("autoPlay","Auto Play",s.autoPlay,"Try to play the first enabled voice when a study block opens")}
      ${toggle("autoQueue","Auto Queue",s.autoQueue,"Play enabled voices sequentially when queued")}
      ${toggle("fallbackAllowed","Browser fallback",s.fallbackAllowed,"Use browser voice when a recording URL is not yet available")}
      <div class="audio-range-row"><label for="audioVolume">Volume <b id="audioVolumeValue">${Math.round(s.volume*100)}%</b></label><input id="audioVolume" type="range" min="0" max="1" step="0.05" value="${s.volume}"></div>
      <div class="audio-range-row"><label for="audioRate">Speed <b id="audioRateValue">${s.rate.toFixed(2)}×</b></label><input id="audioRate" type="range" min="0.5" max="1.75" step="0.05" value="${s.rate}"></div>
    </article>`;
  }
  function settings(){
    const ui=loadUISettings();
    shell(`<div class="section-title"><div><span class="eyebrow">SYSTEM</span><h2>Settings</h2></div></div>
      <article class="card appearance-card"><div class="row-between"><div><span class="eyebrow">DISPLAY</span><h3>Comfort & appearance</h3><p class="muted">Optimized for long study sessions on Safari and mobile screens.</p></div></div>
      ${(()=>{const toggle=(id,label,on,sub)=>`<div class="audio-setting-row"><div><b>${label}</b><small>${sub}</small></div><button class="switch ${on?'on':''}" data-ui-setting="${id}" aria-pressed="${on}"><span></span><em>${on?'ON':'OFF'}</em></button></div>`;return toggle('darkMode','Dark mode',ui.darkMode,'Premium dark cockpit appearance')+toggle('comfortMode','Comfort view',ui.comfortMode,'Softer contrast, larger reading rhythm and reduced visual intensity')+toggle('reducedMotion','Reduce motion',ui.reducedMotion,'Minimize interface animation for calmer study');})()}
      </article>
      ${audioSettings()}
      ${safariInstallCard()}
      <article class="card"><h3>Data status</h3><p>Verified study: ${state.study.length} • Questions: ${state.questions.length} • Visuals: ${state.visuals.length} • Terms: ${state.glossary.length}</p><p class="muted">Official source data is read-only. Learner progress, display preferences and audio preferences are stored locally.</p></article>`);
    $$('[data-ui-setting]').forEach(b=>b.onclick=()=>{ const key=b.dataset.uiSetting; saveUISettings({[key]:!loadUISettings()[key]}); settings(); });
    const c=state.audioController;
    if(!c)return;
    $$('[data-audio-setting]').forEach(b=>b.onclick=()=>{const key=b.dataset.audioSetting; if(key.startsWith('channel:')) c.toggleChannel(key.split(':')[1]); else c.toggle(key); settings();});
    const volume=$("#audioVolume"); if(volume)volume.oninput=()=>{c.setSettings({volume:Number(volume.value)}); $("#audioVolumeValue").textContent=Math.round(Number(volume.value)*100)+"%";};
    const rate=$("#audioRate"); if(rate)rate.oninput=()=>{c.setSettings({rate:Number(rate.value)}); $("#audioRateValue").textContent=Number(rate.value).toFixed(2)+"×";};
  }

  function render(){
    if (state.route === "study") study(); else if (state.route === "mcq") mcq(); else if (state.route === "official-samples") officialSamples(); else if (state.route === "visual-library") visualLibrary(); else if (state.route === "glossary") glossary(); else if (state.route === "search") searchPage(); else if (state.route === "progress") progress(); else if (state.route === "real-exam") realExam(); else if (state.route === "settings") settings(); else home();
    $$("[data-route]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.route)));
  }
  function playStudyAudio(factId,lang){const block=state.audioStore?.forFact(factId)?.[0]; if(block&&state.audioController) state.audioController.playBlock(block,lang);}
  function queueStudyAudio(factId){
    const block=state.audioStore?.forFact(factId)?.[0], c=state.audioController; if(!block||!c)return;
    const s=c.getSettings(); const items=["ja","en","si"].filter(lang=>s.channels[lang]).map(lang=>({block,language:lang}));
    c.playQueue(items);
  }
  function stopStudyAudio(){state.audioController?.stop();}

  document.addEventListener("click", e=>{
    const ab=e.target.closest("[data-audio]"); if(ab){playStudyAudio(ab.dataset.audio,ab.dataset.lang);return;}
    if(e.target.closest(".audio-stop")){stopStudyAudio();return;}
    const aq=e.target.closest("[data-queue]"); if(aq){queueStudyAudio(aq.dataset.queue);return;}
    const sid=e.target.closest("[data-study]")?.dataset.study; if(sid){studyDetail(sid); if(state.audioController?.getSettings().autoPlay){const b=state.audioStore?.forFact(sid)?.[0]; const first=["ja","en","si"].find(l=>state.audioController.getSettings().channels[l]&&b?.variants?.[l]); if(first)state.audioController.playBlock(b,first);} return;}
    const aid=e.target.closest("[data-answer]")?.dataset.answer; if(aid){answer(aid);return;}
  });
  window.addEventListener("hashchange",()=>{state.route=location.hash.slice(1)||"home";render();});
  const updateOrientation=()=>{const g=$("#orientationGuard"); if(g) g.classList.toggle("show",window.matchMedia?.("(orientation: landscape) and (max-width: 900px)").matches);};
  window.addEventListener("resize",updateOrientation,{passive:true}); window.addEventListener("orientationchange",updateOrientation,{passive:true}); setTimeout(updateOrientation,0);
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
  init();
})();
