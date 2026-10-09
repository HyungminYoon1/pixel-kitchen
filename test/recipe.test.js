import test from "node:test";
import assert from "node:assert/strict";
import {kernelStage,runPipeline,histogram} from "../dist/src/model.js";
import {documentFromStages,validateDocument,parseDocument,serializeDocument,stagesForImage,addPreset,removePreset,parsePresets,MAX_RECIPE_BYTES,MAX_PRESET_BYTES} from "../dist/src/recipe.js";
import {presetStore,PRESET_KEY} from "../dist/src/storage.js";

const doc=()=>documentFromStages([kernelStage("gaussian"),{kind:"sobel",direction:"magnitude",gain:.75},{kind:"threshold",cutoff:60}]);
const image={width:3,height:1,data:Uint8ClampedArray.from([0,0,0,0,128,128,128,128,255,255,255,255])};
function memory() {
  const entries=new Map(),calls=[];
  return {entries,calls,getItem(key){calls.push(["get",key]);return entries.get(key)??null;},setItem(key,value){calls.push(["set",key]);entries.set(key,value);},removeItem(key){calls.push(["remove",key]);entries.delete(key);}};
}
test("recipe roundtrip preserves actual ordered output and alpha without retaining labels or images",()=>{
  const stages=[{...kernelStage("blur"),name:"private-file.png",data:[1,2,3],path:"C:/private"},{kind:"threshold",cutoff:128}];
  const recipe=documentFromStages(stages),serialized=serializeDocument(recipe),restored=stagesForImage(image,parseDocument(serialized));
  assert.deepEqual(restored.map(s=>s.kind),["kernel","threshold"]);
  assert.deepEqual([...runPipeline(image,restored).output.data],[0,0,0,0,255,255,255,128,255,255,255,255]);
  assert.equal(/name|private|path|data/.test(serialized),false);
  assert.deepEqual(runPipeline(image,restored).output.data,runPipeline(image,stages).output.data);
  recipe.stages[0].kernel[0]=16;assert.equal(stages[0].kernel[0],1);
});
test("interchange fixes version/model and rejects missing, unknown and prototype fields at every level",()=>{
  for(const alter of [
    d=>d.version=2,d=>d.version="1",d=>d.model="future",d=>delete d.model,
    d=>d.image={data:[1]},d=>d.name="photo",d=>d.stages[0].name="average",d=>d.stages[1].path="file",d=>d.stages[2].gain=1,
    d=>d.stages[0].gray="true",d=>d.stages[0].kernel=Object.assign([1,2,1,2,4,2,1,2,1],{extra:1})
  ]){const d=doc();alter(d);assert.throws(()=>validateDocument(d));}
  assert.throws(()=>parseDocument('{"version":1,"model":"pixel-kitchen-byte-v1","stages":[],"__proto__":{}}'));
  assert.throws(()=>validateDocument(Object.assign(Object.create({version:1}),{model:"pixel-kitchen-byte-v1",stages:doc().stages})));
  const d=doc();d[Symbol("hidden")]=1;assert.throws(()=>validateDocument(d));
});
test("negative recipes reject finite/range/type/array violations before they reach processing",()=>{
  const invalid=[[],Array(5).fill(kernelStage()),Array(1),[null],
    [{...kernelStage(),divisor:0}],[{...kernelStage(),divisor:64.1}],[{...kernelStage(),bias:256}],
    [{...kernelStage(),kernel:Array(9)}],[{...kernelStage(),kernel:Array(9).fill(NaN)}],[{...kernelStage(),kernel:Array(9).fill(16.01)}],
    [{kind:"sobel",direction:"z",gain:1}],[{kind:"sobel",direction:"x",gain:.24}],[{kind:"sobel",direction:"x",gain:Infinity}],
    [{kind:"threshold",cutoff:256}],[{kind:"threshold",cutoff:-1}],[{kind:"threshold",cutoff:1.5}],[{kind:"threshold",cutoff:"128"}]];
  for(const stages of invalid)assert.throws(()=>validateDocument({version:1,model:"pixel-kitchen-byte-v1",stages}));
  assert.throws(()=>parseDocument('{"version":1,"model":"pixel-kitchen-byte-v1","stages":[{"kind":"sobel","direction":"x","gain":1e400}]}'));
});
test("file parser caps UTF-8 bytes and rejects malformed JSON; image work budget remains enforced",()=>{
  assert.throws(()=>parseDocument(" ".repeat(MAX_RECIPE_BYTES+1)),RangeError);
  assert.throws(()=>parseDocument("가".repeat(3000)),RangeError);
  for(const text of ["", "[", "null", "[]", "{}",'{"version":1}'])assert.throws(()=>parseDocument(text));
  const recipe=documentFromStages(Array(4).fill({kind:"sobel",direction:"x",gain:1}));
  assert.equal(stagesForImage(image,recipe).length,4);
  const before=JSON.stringify(recipe),large={width:720,height:480,data:new Uint8ClampedArray(720*480*4)};
  assert.throws(()=>stagesForImage(large,recipe),/예산/);assert.equal(JSON.stringify(recipe),before);
});
test("8 numbered presets persist only validated settings, reload independently and reuse deleted slots",()=>{
  const storage=memory(),store=presetStore(()=>storage);let state;
  for(let i=0;i<8;i++)state=store.save(doc());
  assert.deepEqual(state.presets.map(p=>p.slot),[1,2,3,4,5,6,7,8]);
  const raw=storage.entries.get(PRESET_KEY);assert.ok(Buffer.byteLength(raw)<MAX_PRESET_BYTES);
  assert.deepEqual(Object.keys(JSON.parse(raw)),["version","presets"]);
  assert.throws(()=>store.save(doc()),/최대/);assert.equal(storage.entries.get(PRESET_KEY),raw);
  const reloaded=presetStore(()=>storage).read();reloaded.presets[0].recipe.stages[0].kernel[0]=15;
  assert.equal(store.read().presets[0].recipe.stages[0].kernel[0],1);
  store.remove(3);assert.equal(store.save(doc()).presets[2].slot,3);
  assert.ok(storage.calls.every(call=>call[1]===PRESET_KEY));
});
test("malformed stored schema fails closed and cannot be silently overwritten",()=>{
  const storage=memory(),store=presetStore(()=>storage);
  const first={version:1,presets:[{slot:1,recipe:doc()}]};
  for(const raw of ["bad",JSON.stringify({...first,photo:"bytes"}),JSON.stringify({...first,version:2}),JSON.stringify({...first,presets:[...first.presets,...first.presets]}),JSON.stringify({version:1,presets:[{slot:9,recipe:doc()}]})," ".repeat(MAX_PRESET_BYTES+1)]) {
    storage.entries.set(PRESET_KEY,raw);assert.throws(()=>store.read());assert.throws(()=>store.save(doc()));assert.equal(storage.entries.get(PRESET_KEY),raw);
  }
  store.erase();assert.deepEqual(store.read(),{version:1,presets:[]});
  assert.throws(()=>parsePresets(JSON.stringify({version:1,presets:[{slot:1,recipe:doc(),path:"private"}]})));
});
test("erase only removes own settings and preserves gallery/other service records",()=>{
  const storage=memory(),store=presetStore(()=>storage),summary='{"version":1,"apps":{"other":{"completed":1,"total":5,"updatedAt":"2026-10-09T00:00:00.000Z"}}}';
  storage.entries.set("web-lab-progress-v1",summary);storage.entries.set("other-service","untouched");store.save(doc());store.erase();
  assert.equal(storage.entries.has(PRESET_KEY),false);assert.equal(storage.entries.get("web-lab-progress-v1"),summary);assert.equal(storage.entries.get("other-service"),"untouched");
  assert.ok(storage.calls.every(call=>call[1]===PRESET_KEY));
});
test("blocked storage, quota failure and invalid inputs fail without replacing prior data",()=>{
  const store=presetStore(()=>{throw new Error("SecurityError");});for(const action of [()=>store.read(),()=>store.save(doc()),()=>store.erase()])assert.throws(action,/저장/);
  const storage=memory(),working=presetStore(()=>storage);working.save(doc());const before=storage.entries.get(PRESET_KEY);
  storage.setItem=()=>{throw new Error("QuotaExceededError");};assert.throws(()=>working.save(doc()),/저장/);assert.equal(storage.entries.get(PRESET_KEY),before);
  assert.throws(()=>working.save({...doc(),file:"private"}));assert.equal(storage.entries.get(PRESET_KEY),before);
  assert.throws(()=>removePreset({version:1,presets:[]},1));
  const state={version:1,presets:[]};addPreset(state,doc());assert.equal(state.presets.length,0);
});
test("histogram hand-derived bins exclude fully transparent color, preserve partial alpha, and sum correctly",()=>{
  const before=[...image.data];
  for(const channel of ["gray","r","g","b"]){const h=histogram(image,channel);assert.equal(h.pixels,2);assert.equal(h.bins[0],0);assert.equal(h.bins[128],1);assert.equal(h.bins[255],1);assert.equal(h.bins.reduce((a,b)=>a+b,0),2);}
  const alpha=histogram(image,"alpha");assert.equal(alpha.pixels,3);for(const value of [0,128,255])assert.equal(alpha.bins[value],1);
  const color={width:1,height:1,data:Uint8ClampedArray.from([100,50,0,255])};assert.equal(histogram(color).bins[57],1);
  const transparent={...color,data:new Uint8ClampedArray(4)};assert.equal(histogram(transparent).pixels,0);assert.equal(histogram(transparent,"alpha").bins[0],1);
  assert.deepEqual([...image.data],before);assert.throws(()=>histogram(image,"bad"));assert.throws(()=>histogram({...image,width:0}));
});
