#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
function assert(condition, message){ if(!condition) errors.push(message); }
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }

// Runtime-test the canonical ProgressStore without a browser.
const context = {
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Set,
  Map,
  Number,
  String,
  Boolean,
  Promise,
  window: { localStorage: null }
};
vm.createContext(context);
vm.runInContext(read('app/progress.js'), context, {filename:'app/progress.js'});
const API = context.window.SSWGHProgress;
assert(API && API.ProgressStore, 'ProgressStore API unavailable');

if (API) {
  const store = new API.ProgressStore({storage: {getItem(){return null;},setItem(){},removeItem(){}}});
  store.recordExamStart({track:'GROUND_HANDLING',source:'REAL_EXAM',source_id:'EXAM_ENGINE',metadata:{session_id:'test-1',section:'WRITTEN'}});
  store.recordExamAnswer({track:'GROUND_HANDLING',source:'REAL_EXAM',question_id:'Q1',correct:true,metadata:{session_id:'test-1'}});
  store.recordExamComplete({track:'GROUND_HANDLING',source:'REAL_EXAM',metadata:{session_id:'test-1',section:'WRITTEN',passed:true}});
  store.addSession({session_id:'test-1',session_type:'REAL_EXAM_WRITTEN',section:'WRITTEN',started_at:new Date().toISOString(),completed_at:new Date().toISOString(),total:30,answered:1,correct:1,score_percent:100,source_type:'REAL_EXAM',status:'COMPLETED',metadata:{section:'WRITTEN',passed:true,exam_status:'SUBMITTED'}});
  const a = API.buildAnalytics(store);
  assert(a.totals.exam_starts === 1, 'exam_starts analytics failed');
  assert(a.totals.exam_answers === 1, 'exam_answers analytics failed');
  assert(a.totals.exam_sessions === 1, 'exam_sessions analytics failed');
  assert(a.totals.exam_completed === 1, 'exam_completed analytics failed');
  assert(a.totals.exam_passed === 1, 'exam_passed analytics failed');
  assert(a.recent_exam_sessions.length === 1, 'recent exam session history failed');
  assert(a.recent_exam_sessions[0].score_percent === 100, 'exam score persistence failed');
}

const app = read('app.js');
const exam = read('app/exam.js');
assert(app.includes('recordExamStart'), 'app.js missing exam start integration');
assert(app.includes('recordExamAnswer'), 'app.js missing exam answer integration');
assert(app.includes('recordExamComplete'), 'app.js missing exam completion integration');
assert(app.includes('recordExamAbandon'), 'app.js missing exam abandonment integration');
assert(app.includes('r?.percentage'), 'app.js does not use canonical exam score field');
assert(app.includes('s.started_at'), 'app.js does not use canonical exam start timestamp');
assert(exam.includes('this.session_id'), 'exam session ID missing');
assert(exam.includes('session_id: this.session_id'), 'exam snapshot missing session ID');
assert(!app.includes('s.startedAt'), 'stale startedAt field remains');
assert(!app.includes('score_percent:r.score_percent'), 'stale score_percent source remains');

const data = JSON.parse(read('data/progress-schema.json'));
assert(data && typeof data === 'object', 'progress schema unreadable');

const report = {
  status: errors.length ? 'FAIL' : 'PASS',
  errors,
  warnings,
  checks: {
    progress_store_runtime: errors.length === 0,
    exam_lifecycle_hooks: app.includes('recordExamStart') && app.includes('recordExamComplete') && app.includes('recordExamAbandon'),
    canonical_exam_fields: app.includes('r?.percentage') && app.includes('s.started_at'),
    exam_session_id: exam.includes('this.session_id'),
    progress_schema_readable: !!data
  }
};
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
