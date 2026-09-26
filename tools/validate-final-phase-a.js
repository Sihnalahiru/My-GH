const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,".."), errors=[],warnings=[];
const load=f=>JSON.parse(fs.readFileSync(path.join(root,f),"utf8"));
for(const f of ["data/study.json","data/questions.json","data/glossary.json","data/illustrations.json","data/audio.json","index.html","app.js","styles.css","manifest.json","sw.js",".github/workflows/pages.yml"]) if(!fs.existsSync(path.join(root,f))) errors.push("MISSING:"+f);
if(fs.existsSync(path.join(root,"data/study.json"))){const d=load("data/study.json"); if(!Array.isArray(d.records)||!d.records.length)errors.push("NO_STUDY_RECORDS");}
if(fs.existsSync(path.join(root,"data/questions.json"))){const d=load("data/questions.json"); for(const q of d.questions||[]){
  const requiredCore=!q.question_id||!q.source_id||!q.physical_page||!Array.isArray(q.choices);
  if(requiredCore){errors.push("QUESTION_SCHEMA:"+q.question_id);continue;}
  if(q.source_type==="SOURCE_BASED_PRACTICE" && q.choices.filter(x=>x.text!=="—").length!==4)
    errors.push("QUESTION_SCHEMA:"+q.question_id);
  if(q.source_type==="OFFICIAL_SAMPLE" && q.choices.filter(x=>x.text!=="—").length<2)
    errors.push("OFFICIAL_SAMPLE_SCHEMA:"+q.question_id);
}}
if(fs.existsSync(path.join(root,"data/glossary.json"))){const d=load("data/glossary.json"); for(const t of d.terms||[])if(!t.japanese||!t.english||!t.sinhala||!t.source_id||!t.physical_page)errors.push("GLOSSARY_SCHEMA:"+t.term_id);}
if(fs.existsSync(path.join(root,"data/audio.json"))&&(load("data/audio.json").audio_blocks||[]).length===0)warnings.push("AUDIO_PENDING");
if(fs.existsSync(path.join(root,"data/illustrations.json"))&&(load("data/illustrations.json").illustrations||[]).some(x=>x.status==="VISUAL_PIXEL_PENDING"))warnings.push("VISUAL_PIXEL_EXTRACTION_PENDING");
const report={build:"FINAL-PHASE-A",status:errors.length?"FAILED":"VERIFIED",errors,warnings,rule:"Do not call final release until audio, visual pixels, full source population and live deployment QA pass."};
fs.writeFileSync(path.join(root,"FINAL-PHASE-A-VALIDATION.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));process.exit(errors.length?1:0);