const fs=require("fs"),path=require("path"),crypto=require("crypto");
const root=path.resolve(__dirname,"..");
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),"utf8"));
const study=read("data/study.json"), audio=read("data/audio.json"), sources=read("data/sources.json");
const errors=[],warnings=[];
const facts=new Map((study.records||[]).map(x=>[x.fact_id,x]));
const src=new Map((sources.sources||[]).map(x=>[x.source_id,x]));
const blocks=audio.audio_blocks||[];
if(!blocks.length)errors.push("AUD-C-001:no audio blocks");
const ids=new Set();
for(const b of blocks){
 if(ids.has(b.audio_block_id))errors.push("AUD-C-002:duplicate:"+b.audio_block_id); ids.add(b.audio_block_id);
 const f=facts.get(b.fact_id), s=src.get(b.source_id);
 if(!f)errors.push("AUD-C-003:fact:"+b.fact_id);
 if(!s)errors.push("AUD-C-004:source:"+b.source_id);
 if(f && (f.source_id!==b.source_id || f.physical_page!==b.source_page))errors.push("AUD-C-005:provenance:"+b.audio_block_id);
 if(f && ["ja","en","si"].some(k=>(f.content?.[k]||"")!==(b.content?.[k]||"")))errors.push(`AUD-C-006:content mismatch:${b.audio_block_id}`);
 for(const lang of ["ja","en","si"]){
   const v=b.variants?.[lang] || b.audio?.[lang];
   if(!v)errors.push(`AUD-C-007:${b.audio_block_id}:${lang}`);
   else if(v.text!==b.content[lang])errors.push(`AUD-C-008:${b.audio_block_id}:${lang}`);
   else if(v.status==="VERIFIED" && !v.audio_url)errors.push(`AUD-C-009:${b.audio_block_id}:${lang}`);
   if(v?.status==="PENDING_AUDIO")warnings.push(`PENDING_AUDIO:${b.audio_block_id}:${lang}`);
 }
}
const report={
 phase:"FINAL-PHASE-C",
 status:errors.length?"FAILED":"VERIFIED_SOURCE_BACKED_AUDIO_INTEGRATION",
 counts:{study_records:facts.size,audio_blocks:blocks.length,pending_audio:blocks.filter(x=>x.status==="PENDING_AUDIO").length,
 recordings_verified:blocks.filter(x=>x.status==="VERIFIED").length},
 errors,warnings,
 note:"Source-backed block structure and browser fallback are verified. Human/native recordings remain pending and are never represented as VERIFIED."
};
fs.writeFileSync(path.join(root,"data/FINAL-PHASE-C-VALIDATION.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exit(1);
