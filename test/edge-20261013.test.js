import test from "node:test";
import assert from "node:assert/strict";
// Injected storage fixture, never a real user's browser data.
function device() {
  const data=new Map();
  return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
}
const stamp="2026-10-13T00:00:00.000Z";
const peer={completed:1,total:3,updatedAt:stamp};
import {presetStore,PRESET_KEY} from "../dist/src/storage.js";
import {kernelStage,runPipeline,pipelineSteps,compareImages,histogram} from "../dist/src/model.js";
import {documentFromStages,parseDocument,serializeDocument,MAX_RECIPE_BYTES} from "../dist/src/recipe.js";
const recipe=()=>documentFromStages([kernelStage()]);
test("EDGE silent preset write must not report saved",()=>{
  const s=device();s.setItem=()=>{};assert.throws(()=>presetStore(()=>s).save(recipe()));
});
test("EDGE overwritten readback is not confirmation of requested preset",()=>{
  const s=device();s.setItem=(k)=>s.data.set(k,JSON.stringify({version:1,presets:[]}));
  assert.throws(()=>presetStore(()=>s).save(recipe()));
});
test("EDGE silent preset deletion must not report erased",()=>{
  const s=device(),store=presetStore(()=>s);store.save(recipe());s.removeItem=()=>{};
  assert.throws(()=>store.erase());assert.equal(store.read().presets.length,1);
});
test("EDGE recipe exact byte limit parses, plus one rejects, and roundtrip clones",()=>{
  const raw=serializeDocument(recipe()),padded=raw+" ".repeat(MAX_RECIPE_BYTES-Buffer.byteLength(raw));
  assert.deepEqual(parseDocument(padded),recipe());assert.throws(()=>parseDocument(padded+" "));
  const a=parseDocument(raw),b=parseDocument(raw);a.stages[0].kernel[4]=0;assert.equal(b.stages[0].kernel[4],1);
});
test("EDGE one-pixel alpha and clipped boundaries use independent expected bytes",()=>{
  const image={width:1,height:1,data:Uint8ClampedArray.from([0,128,255,7])};
  for(const bias of [-255,255]){
    const result=runPipeline(image,[{...kernelStage(),bias}]).output;
    assert.deepEqual([...result.data],bias<0?[0,0,0,7]:[255,255,255,7]);
    assert.equal(histogram(result,"alpha").bins[7],1);
  }
  assert.deepEqual([...image.data],[0,128,255,7]);
});
test("EDGE canceled iterator stays terminal and cannot contaminate a retry",()=>{
  const image={width:1,height:32,data:new Uint8ClampedArray(128).fill(128)};
  const stages=[kernelStage()],job=pipelineSteps(image,stages,1);
  job.next();job.return();assert.deepEqual(job.next(),{value:undefined,done:true});
  assert.deepEqual(runPipeline(image,stages).output.data,image.data);
});
test("EDGE heat display gain cannot change metrics and transparent RGB does not score",()=>{
  const a={width:1,height:1,data:Uint8ClampedArray.from([255,128,0,0])};
  const b={width:1,height:1,data:Uint8ClampedArray.from([0,0,255,0])};
  for(const gain of [1,16]){const m=compareImages(a,b,gain);assert.equal(m.mae,0);assert.equal(m.alphaMae,0);assert.equal(m.changedPixels,0);}
  for(const gain of [0,17,NaN,"4",null])assert.throws(()=>compareImages(a,b,gain));
});
test("EDGE deleted slot reused after reload without touching peer storage",()=>{
  const s=device();s.setItem("web-lab-progress-v1",JSON.stringify(peer));
  const store=presetStore(()=>s);store.save(recipe());store.save(recipe());store.remove(1);
  assert.deepEqual(presetStore(()=>s).save(recipe()).presets.map(p=>p.slot),[1,2]);
  store.erase();store.erase();assert.equal(s.getItem("web-lab-progress-v1"),JSON.stringify(peer));
});
