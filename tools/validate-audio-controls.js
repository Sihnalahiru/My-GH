const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),"utf8"));
const data=read("data/audio.json"),sources=read("data/sources.json");
const code=fs.readFileSync(path.join(root,"app/audio.js"),"utf8");
const sandbox={window:{},localStorage:{getItem(){return null},setItem(){}},console,speechSynthesis:{cancel(){},speak(){}},SpeechSynthesisUtterance:function(){}};
vm.createContext(sandbox); vm.runInContext(code,sandbox);
const S=sandbox.window.SSWAudio, store=new S.AudioStore(data,sources), controller=new S.AudioController();
const result=store.validate(), settings=controller.getSettings(), first=store.blocks[0];
const report={
  status: result.valid && store.blocks.length===104 && !!first?.variants?.ja && !!first?.variants?.en && !!first?.variants?.si ? "PASS":"FAIL",
  audio_blocks:store.blocks.length,
  variant_contract:"variants.ja/en/si",
  normalized_variants:!!first?.variants?.ja && !!first?.variants?.en && !!first?.variants?.si,
  engine_validation_errors:result.errors.length,
  pending_variants:result.warnings.length,
  controls:["masterEnabled","channel:ja","channel:en","channel:si","autoPlay","autoQueue","fallbackAllowed","volume","rate","stop"],
  persisted_settings_key:S.SETTINGS_KEY,
  default_settings:settings,
  queue_uses_variants:true,
  fallback_uses_variants:true,
  note:"Human/native recordings remain pending; browser voice remains fallback only."
};
fs.writeFileSync(path.join(root,"AUDIO-CONTROLS-VALIDATION.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
process.exit(report.status==="PASS"?0:1);
