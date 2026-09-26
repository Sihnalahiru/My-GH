const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p), 'utf8'));
const errors=[]; const warnings=[];
const files=['data/sources.json','data/curriculum.json','data/chapters.json','data/topics.json','data/study.json','data/questions.json','data/answers.json','data/glossary.json','data/visual-assets.json','data/illustrations.json','data/image-map.json','data/audio.json','manifest.json'];
for(const f of files){try{read(f)}catch(e){errors.push(`JSON:${f}:${e.message}`)}}
if(errors.length){console.log(JSON.stringify({phase:'FINAL-PHASE-D-UI-QA',status:'FAILED',errors,warnings},null,2));process.exit(1)}
const sources=read('data/sources.json');
const topics=read('data/topics.json').topics||[];
const study=read('data/study.json').records||[];
const questions=read('data/questions.json').questions||[];
const glossary=read('data/glossary.json').terms||[];
const visuals=read('data/visual-assets.json').assets||[];
const audio=read('data/audio.json').audio_blocks||[];
const sourceMap=new Map((sources.sources||[]).map(x=>[x.source_id,x]));
const factMap=new Map(study.map(x=>[x.fact_id,x]));
const topicSet=new Set(topics.map(x=>x.topic_id));
const visualSet=new Set(visuals.map(x=>x.illustration_id));
const audioSet=new Set(audio.map(x=>x.audio_block_id));
const official=questions.filter(q=>q.source_type==='OFFICIAL_SAMPLE');
const practice=questions.filter(q=>q.source_type==='SOURCE_BASED_PRACTICE');
const predicted=questions.filter(q=>q.source_type==='PREDICTED_PRACTICE');
for(const x of study){
  if(x.track!=='GROUND_HANDLING') errors.push(`STUDY_TRACK:${x.fact_id}`);
  if(x.status!=='VERIFIED'||x.verification_status!=='VERIFIED_SOURCE_CONTENT') errors.push(`STUDY_STATUS:${x.fact_id}`);
  if(!sourceMap.has(x.source_id)) errors.push(`STUDY_SOURCE:${x.fact_id}`);
  if(!topicSet.has(x.topic_id)) errors.push(`STUDY_TOPIC:${x.fact_id}`);
  for(const id of (x.illustration_ids||[])) if(!visualSet.has(id)) errors.push(`STUDY_VISUAL:${x.fact_id}:${id}`);
  for(const id of (x.audio_block_ids||[])) if(!audioSet.has(id)) errors.push(`STUDY_AUDIO:${x.fact_id}:${id}`);
  for(const l of ['ja','en','si']) if(!x.content?.[l]) errors.push(`STUDY_LANG:${x.fact_id}:${l}`);
}
for(const q of questions){
  if(q.track!=='GROUND_HANDLING') errors.push(`QUESTION_TRACK:${q.question_id}`);
  if(q.status!=='VERIFIED') errors.push(`QUESTION_STATUS:${q.question_id}`);
  if(!factMap.has(q.fact_id)) errors.push(`QUESTION_FACT:${q.question_id}`);
  if(!sourceMap.has(q.source?.source_id)) errors.push(`QUESTION_SOURCE:${q.question_id}`);
  if(!Number.isInteger(q.source?.physical_page)||q.source.physical_page<1) errors.push(`QUESTION_PAGE:${q.question_id}`);
  if(!Array.isArray(q.choices)||q.choices.length!==4) errors.push(`QUESTION_CHOICES:${q.question_id}`);
  if(!q.choices.some(c=>c.choice_id===q.correct_choice_id)) errors.push(`QUESTION_CORRECT:${q.question_id}`);
  if(!q.question?.english||!q.question?.japanese||!q.question?.sinhala) errors.push(`QUESTION_TRILINGUAL:${q.question_id}`);
  if(!q.explanation?.english||!q.explanation?.sinhala) errors.push(`QUESTION_EXPLANATION:${q.question_id}`);
  if(q.source_type==='OFFICIAL_SAMPLE' && (!q.official||!q.immutable||q.label!=='OFFICIAL SAMPLE')) errors.push(`OFFICIAL_INTEGRITY:${q.question_id}`);
  if(q.source_type==='SOURCE_BASED_PRACTICE' && (q.official||q.label!=='SOURCE-BASED PRACTICE')) errors.push(`PRACTICE_INTEGRITY:${q.question_id}`);
  if(q.visual_id && !visualSet.has(q.visual_id)) errors.push(`QUESTION_VISUAL:${q.question_id}:${q.visual_id}`);
}
for(const t of glossary){if(!t.japanese||!t.english||!t.sinhala) errors.push(`TERM_TRILINGUAL:${t.term_id}`); if(!sourceMap.has(t.source_id)) errors.push(`TERM_SOURCE:${t.term_id}`)}
for(const v of visuals){const p=path.join(root,v.path||''); if(!v.path||!fs.existsSync(p)) errors.push(`VISUAL_FILE:${v.visual_id}`); if(!sourceMap.has(v.source_id)) errors.push(`VISUAL_SOURCE:${v.visual_id}`)}
for(const a of audio){if(a.track!=='GROUND_HANDLING') errors.push(`AUDIO_TRACK:${a.audio_block_id}`); if(!factMap.has(a.fact_id)) errors.push(`AUDIO_FACT:${a.audio_block_id}`); if(!sourceMap.has(a.source_id)) errors.push(`AUDIO_SOURCE:${a.audio_block_id}`); for(const l of ['ja','en','si']) if(!a.variants?.[l]?.text) errors.push(`AUDIO_TEXT:${a.audio_block_id}:${l}`); if(a.status!=='PENDING_AUDIO') warnings.push(`PENDING_AUDIO:${a.audio_block_id}`)}
const counts={ground_handling_topics:topics.filter(x=>x.track==='GROUND_HANDLING').length,study_records:study.length,questions:questions.length,official_samples:official.length,source_based_practice:practice.length,predicted_practice:predicted.length,glossary_terms:glossary.length,visuals:visuals.length,audio_blocks:audio.length,pending_audio_variants:audio.length*3};
const report={phase:'FINAL-PHASE-D-UI-QA',status:errors.length?'FAILED':'PASS',errors,warnings,counts,checks:{all_json_parse:true,ground_handling_isolated:!questions.some(q=>q.track!=='GROUND_HANDLING'),study_topic_coverage:new Set(study.map(x=>x.topic_id)).size===counts.ground_handling_topics,visual_files_exist:errors.filter(x=>x.startsWith('VISUAL_FILE')).length===0,question_integrity:errors.filter(x=>x.startsWith('QUESTION_')||x.includes('INTEGRITY')).length===0,audio_provenance:errors.filter(x=>x.startsWith('AUDIO_')).length===0}};
fs.writeFileSync(path.join(root,'FINAL-PHASE-D-UI-QA.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
process.exit(errors.length?1:0);
