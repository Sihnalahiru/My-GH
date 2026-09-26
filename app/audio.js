/* FINAL PHASE C/D — Block-Based Audio / Voice Engine
 *
 * Source content remains authoritative. Audio is a presentation layer.
 * The current master data uses `variants` as the canonical per-voice field.
 * Human/official recordings are preferred; browser SpeechSynthesis is fallback only.
 */
(function () {
  "use strict";

  const AUDIO_STATUS = Object.freeze({
    NOT_REQUIRED:"NOT_REQUIRED", PENDING_AUDIO:"PENDING_AUDIO", GENERATED:"GENERATED",
    RECORDED:"RECORDED", REVIEW_REQUIRED:"REVIEW_REQUIRED", VERIFIED:"VERIFIED", BLOCKED:"BLOCKED"
  });
  const LANG_KEYS = Object.freeze(["ja","en","si"]);
  const AUDIO_TYPES = Object.freeze([
    "DEFINITION","CORE_KNOWLEDGE","SAFETY","PROCEDURE","WARNING","EXAMPLE",
    "DISTINCTION","TERM","EXAM_RECOGNITION","QUESTION","EXPLANATION","VISUAL_EXPLANATION","VISUAL","NUMERICAL"
  ]);
  const SETTINGS_KEY = "ssw-gh-audio-settings-v1";
  const DEFAULT_SETTINGS = Object.freeze({
    masterEnabled:true,
    channels:{ja:true,en:true,si:true},
    autoPlay:false,
    autoQueue:false,
    volume:1,
    rate:0.92,
    fallbackAllowed:true
  });

  function cloneDefaults(){
    return {
      ...DEFAULT_SETTINGS,
      channels:{...DEFAULT_SETTINGS.channels}
    };
  }
  function loadSettings(){
    try{
      const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");
      return {
        masterEnabled:raw.masterEnabled!==false,
        channels:{ja:raw.channels?.ja!==false,en:raw.channels?.en!==false,si:raw.channels?.si!==false},
        autoPlay:raw.autoPlay===true,
        autoQueue:raw.autoQueue===true,
        volume:Number.isFinite(Number(raw.volume))?Math.max(0,Math.min(1,Number(raw.volume))):1,
        rate:Number.isFinite(Number(raw.rate))?Math.max(.5,Math.min(1.75,Number(raw.rate))):.92,
        fallbackAllowed:raw.fallbackAllowed!==false
      };
    }catch(_){ return cloneDefaults(); }
  }
  function saveSettings(settings){
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch(_){ }
  }

  function normalizeVariant(v){
    if(!v || typeof v!=="object") return null;
    return {
      audio_id:v.audio_id||null, language:v.language||null, text:v.text||"",
      audio_url:v.audio_url||null, creator_type:v.creator_type||null,
      provider:v.provider||null, source_text_hash:v.source_text_hash||null,
      status:v.status||AUDIO_STATUS.PENDING_AUDIO,
      pronunciation_review:v.pronunciation_review||null
    };
  }

  function normalizeBlock(r){
    if(!r || typeof r!=="object") return null;
    const c=r.content||{};
    const variants=r.variants||r.audio||{};
    return {
      audio_block_id:r.audio_block_id||null, track:r.track||null, fact_id:r.fact_id||null,
      source_id:r.source_id||null,
      source_page:Number.isInteger(r.source_page)?r.source_page:null,
      content_type:r.content_type||"STUDY", audio_type:r.audio_type||"CORE_KNOWLEDGE",
      content:{ja:c.ja||"",en:c.en||"",si:c.si||""},
      variants:{ja:normalizeVariant(variants.ja),en:normalizeVariant(variants.en),si:normalizeVariant(variants.si)},
      playback:{
        block_only:r.playback?.block_only!==false,
        queue_allowed:r.playback?.queue_allowed!==false,
        stop_supported:r.playback?.stop_supported!==false,
        fallback_allowed:r.playback?.fallback_allowed!==false
      },
      source_content_id:r.source_content_id||null,
      source_text_hash:r.source_text_hash||null,
      status:r.status||AUDIO_STATUS.PENDING_AUDIO,
      verification_status:r.verification_status||"PENDING"
    };
  }

  function validateAudioBlock(block,context={}){
    const errors=[],warnings=[];
    if(!block.audio_block_id)errors.push("AUD-001");
    if(!block.track)errors.push("AUD-002");
    if(!block.fact_id)errors.push("AUD-003");
    if(!block.source_id)errors.push("AUD-004");
    if(!Number.isInteger(block.source_page)||block.source_page<1)errors.push("AUD-005");
    if(!AUDIO_TYPES.includes(block.audio_type))errors.push("AUD-006");
    if(!context.sources?.has(block.source_id))errors.push("AUD-007");
    const src=context.sources?.get(block.source_id);
    if(src&&src.track!==block.track)errors.push("AUD-008");
    if(!block.content.ja&&!block.content.en&&!block.content.si)errors.push("AUD-009");
    for(const lang of LANG_KEYS){
      const v=block.variants[lang];
      if(!v)continue;
      if(v.language&&v.language!==lang)errors.push("AUD-010");
      if(v.status===AUDIO_STATUS.VERIFIED&&!v.audio_url)errors.push("AUD-011");
      if(v.status===AUDIO_STATUS.VERIFIED&&!v.text)errors.push("AUD-012");
      if(v.status===AUDIO_STATUS.PENDING_AUDIO)warnings.push(`AUD-W001:${lang}`);
    }
    if(!block.playback.stop_supported)errors.push("AUD-014");
    return {valid:errors.length===0,errors,warnings};
  }

  class AudioStore{
    constructor(audioData,sourceData){
      this.blocks=(audioData?.audio_blocks||[]).map(normalizeBlock).filter(Boolean);
      this.sources=new Map((sourceData?.sources||[]).map(s=>[s.source_id,s]));
      this.index=new Map(this.blocks.map(b=>[b.audio_block_id,b]));
    }
    get(id){return this.index.get(id)||null}
    all(o={}){
      let b=[...this.blocks];
      if(o.track)b=b.filter(x=>x.track===o.track);
      if(o.fact_id)b=b.filter(x=>x.fact_id===o.fact_id);
      if(o.source_id)b=b.filter(x=>x.source_id===o.source_id);
      if(o.audio_type)b=b.filter(x=>x.audio_type===o.audio_type);
      if(o.status)b=b.filter(x=>x.status===o.status);
      return b;
    }
    forFact(id){return this.all({fact_id:id})}
    verified(){return this.all({status:AUDIO_STATUS.VERIFIED})}
    validate(){
      const errors=[],warnings=[],ids=new Set();
      for(const b of this.blocks){
        if(ids.has(b.audio_block_id))errors.push(`AUD-015:${b.audio_block_id}`);
        ids.add(b.audio_block_id);
        const v=validateAudioBlock(b,{sources:this.sources});
        if(!v.valid)errors.push({audio_block_id:b.audio_block_id,errors:v.errors});
        warnings.push(...v.warnings.map(w=>({audio_block_id:b.audio_block_id,warning:w})));
      }
      return {valid:errors.length===0,errors,warnings,counts:{total:this.blocks.length,verified:this.verified().length,pending:this.all({status:AUDIO_STATUS.PENDING_AUDIO}).length}};
    }
  }

  class AudioController{
    constructor(){
      this.currentAudio=null; this.currentSpeech=null; this.queue=[]; this.currentIndex=0;
      this.speechActive=false; this.listeners=new Set(); this.settings=loadSettings();
    }
    on(event,cb){this.listeners.add(cb);return()=>this.listeners.delete(cb)}
    emit(event,payload){for(const cb of this.listeners){try{cb(event,payload)}catch(_){}}}
    getSettings(){return { ...this.settings, channels:{...this.settings.channels} }}
    setSettings(patch={}){
      this.settings={
        ...this.settings,
        ...patch,
        channels:{...this.settings.channels,...(patch.channels||{})}
      };
      this.settings.volume=Math.max(0,Math.min(1,Number(this.settings.volume)||0));
      this.settings.rate=Math.max(.5,Math.min(1.75,Number(this.settings.rate)||.92));
      saveSettings(this.settings); this.emit("settings",this.getSettings()); return this.getSettings();
    }
    toggle(key){return this.setSettings({[key]:!this.settings[key]})}
    toggleChannel(lang){if(!LANG_KEYS.includes(lang))return this.getSettings();return this.setSettings({channels:{[lang]:!this.settings.channels[lang]}})}
    stop(){
      if(this.currentAudio){try{this.currentAudio.pause();this.currentAudio.currentTime=0}catch(_){} }
      this.currentAudio=null;
      if("speechSynthesis" in window){try{speechSynthesis.cancel()}catch(_){} }
      this.currentSpeech=null; this.speechActive=false; this.queue=[]; this.currentIndex=0; this.emit("stop");
    }
    canPlay(lang){return this.settings.masterEnabled && this.settings.channels?.[lang]!==false}
    async playUrl(url,metadata={}){
      if(!url){this.emit("error",{code:"AUD-008",message:"Audio URL is missing.",metadata});return false}
      if(this.currentAudio){try{this.currentAudio.pause();this.currentAudio.currentTime=0}catch(_){} }
      if("speechSynthesis" in window){try{speechSynthesis.cancel()}catch(_){} }
      const a=new Audio(url); this.currentAudio=a; a.volume=this.settings.volume;
      a.playbackRate=this.settings.rate;
      a.addEventListener("ended",()=>{this.currentAudio=null;this.emit("ended",metadata);this.currentIndex++;this.playNext()},{once:true});
      a.addEventListener("error",()=>{this.currentAudio=null;this.emit("error",{code:"AUD-008",message:"Audio playback failed.",metadata});this.currentIndex++ ;this.playNext()},{once:true});
      try{await a.play();this.emit("play",metadata);return true}catch(e){this.currentAudio=null;this.emit("error",{code:"AUD-008",message:e?.message||"Playback blocked.",metadata});return false}
    }
    speechLocale(lang){return {ja:"ja-JP",en:"en-US",si:"si-LK"}[lang]||lang}
    async playSpeech(text,lang,metadata={}){
      if(!text){this.emit("error",{code:"AUD-009",message:"No source-backed text is available.",metadata});return false}
      if(!("speechSynthesis" in window)){this.emit("error",{code:"AUD-009",message:"Browser voice is unavailable.",metadata});return false}
      try{speechSynthesis.cancel()}catch(_){}
      this.currentSpeech=new SpeechSynthesisUtterance(text); const u=this.currentSpeech;
      u.lang=this.speechLocale(lang); u.rate=this.settings.rate; u.pitch=1; u.volume=this.settings.volume;
      u.onstart=()=>{this.speechActive=true;this.emit("play",{...metadata,fallback:"BROWSER_SPEECH_FALLBACK"})};
      u.onend=()=>{this.speechActive=false;this.currentSpeech=null;this.emit("ended",{...metadata,fallback:"BROWSER_SPEECH_FALLBACK"});this.currentIndex++;this.playNext()};
      u.onerror=e=>{this.speechActive=false;this.currentSpeech=null;this.emit("error",{code:"AUD-010",message:e?.error||"Browser voice failed.",metadata});this.currentIndex++;this.playNext()};
      speechSynthesis.speak(u); return true;
    }
    async playBlock(block,lang){
      if(!block||!LANG_KEYS.includes(lang)){this.emit("error",{code:"AUD-001",message:"Requested audio block is unavailable.",language:lang});return false}
      if(!this.canPlay(lang)){this.emit("blocked",{reason:"CHANNEL_DISABLED",language:lang});return false}
      const v=block.variants?.[lang];
      if(!v){this.emit("error",{code:"AUD-001",message:"Requested voice variant is unavailable.",audio_block_id:block.audio_block_id,language:lang});return false}
      if(v.audio_url)return this.playUrl(v.audio_url,{audio_block_id:block.audio_block_id,language:lang,fact_id:block.fact_id,source_id:block.source_id,source_page:block.source_page});
      const fallback=block.playback?.fallback_allowed!==false && this.settings.fallbackAllowed;
      if(fallback&&v.text)return this.playSpeech(v.text,lang,{audio_block_id:block.audio_block_id,language:lang,fact_id:block.fact_id,source_id:block.source_id,source_page:block.source_page});
      this.emit("error",{code:"AUD-001",message:"Recorded audio is pending for this block.",audio_block_id:block.audio_block_id,language:lang});return false;
    }
    enqueue(block,lang){if(block&&LANG_KEYS.includes(lang)&&this.canPlay(lang))this.queue.push({block,language:lang});return true}
    async playQueue(items=null){
      this.stop();
      if(Array.isArray(items))this.queue=items.filter(x=>x?.block&&LANG_KEYS.includes(x?.language)&&this.canPlay(x.language));
      this.currentIndex=0; if(!this.queue.length)return false; return this.playNext();
    }
    async playNext(){
      if(this.currentIndex>=this.queue.length){this.queue=[];this.currentIndex=0;this.emit("queueEnd");return false}
      const item=this.queue[this.currentIndex]; const v=item.block?.variants?.[item.language];
      if(!this.canPlay(item.language)){this.currentIndex++;return this.playNext()}
      if(v?.audio_url)return this.playUrl(v.audio_url,{audio_block_id:item.block.audio_block_id,language:item.language,fact_id:item.block.fact_id,source_id:item.block.source_id,source_page:item.block.source_page});
      const fallback=item.block?.playback?.fallback_allowed!==false && this.settings.fallbackAllowed;
      if(fallback&&v?.text)return this.playSpeech(v.text,item.language,{audio_block_id:item.block.audio_block_id,language:item.language,fact_id:item.block.fact_id,source_id:item.block.source_id,source_page:item.block.source_page});
      this.currentIndex++;return this.playNext();
    }
  }

  window.SSWAudio={AUDIO_STATUS,AUDIO_TYPES,LANG_KEYS,SETTINGS_KEY,AudioStore,AudioController,validateAudioBlock};
})();
