import test from "node:test";
import assert from "node:assert/strict";
import {recipes,kernelStage,runPipeline,pipelineSteps,validatePipeline,validateImage,inspectStage,compareImages,MAX_WORK} from "../dist/src/model.js";
import {syntheticImage,createChallenge,assessChallenge,objectives} from "../dist/src/challenges.js";
import {canvasPointer} from "../dist/src/ui.js";

function fixture(width=5,height=4){return {width,height,data:Uint8ClampedArray.from(Array.from({length:width*height},(_,i)=>[(i*41)%256,(i*19+7)%256,(i*73)%256,(i*11)%256]).flat())};}
// Independent scalar reference. Explicit byte rounding (including half-to-even),
// nested matrices and input lookup: no model/inspector used for expected pixels.
function byte(n){if(n<=0)return 0;if(n>=255)return 255;const low=Math.floor(n);return n-low===.5?low+(low%2):Math.round(n);}
function reference(image,stage){
  const result=[];
  const at=(x,y)=>{const i=(Math.max(0,Math.min(image.height-1,y))*image.width+Math.max(0,Math.min(image.width-1,x)))*4;return Array.from(image.data.slice(i,i+4));};
  const luma=rgb=>Math.round((2126*rgb[0]+7152*rgb[1]+722*rgb[2])/10000);
  const horizontal=[[-1,0,1],[-2,0,2],[-1,0,1]],vertical=[[-1,-2,-1],[0,0,0],[1,2,1]];
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++) {
    let rgb;
    if(stage.kind==="threshold")rgb=Array(3).fill(luma(at(x,y))>=stage.cutoff?255:0);
    else if(stage.kind==="sobel") {
      let xsum=0,ysum=0;
      for(let row=0;row<3;row++)for(let col=0;col<3;col++){const v=luma(at(x+col-1,y+row-1));xsum+=horizontal[row][col]*v;ysum+=vertical[row][col]*v;}
      const response=stage.direction==="magnitude"?Math.sqrt(xsum*xsum+ysum*ysum)/4*stage.gain:(stage.direction==="x"?xsum:ysum)/4*stage.gain+128;
      rgb=Array(3).fill(byte(response));
    }else {
      rgb=[0,1,2].map(channel=>{let total=0;for(let row=0;row<3;row++)for(let col=0;col<3;col++){const v=at(x+col-1,y+row-1);total+=stage.kernel[row*3+col]*(stage.gray?luma(v):v[channel]);}return byte(total/stage.divisor+stage.bias);});
    }
    result.push(...rgb,at(x,y)[3]);
  }
  return {...image,data:Uint8ClampedArray.from(result)};
}
test("all kernels and gradients match independent reference, corners and non-square images",()=>{
  const source=fixture(),before=[...source.data];
  const stages=[...Object.keys(recipes).map(kernelStage),{...kernelStage("gaussian"),gray:true},...['x','y','magnitude'].map(direction=>({kind:"sobel",direction,gain:.75})),{kind:"threshold",cutoff:128}];
  for(const stage of stages){const out=runPipeline(source,[stage]).output,expected=reference(source,stage);assert.deepEqual(out.data,expected.data,stage.name||stage.direction||stage.kind);for(const [x,y] of [[0,0],[4,3],[2,2]])assert.deepEqual(inspectStage(source,x,y,stage).color,[...expected.data.slice((y*5+x)*4,(y*5+x)*4+3)]);}
  assert.deepEqual([...source.data],before);
});
test("hand-derived Sobel ramp: Gx 80, Gy 160, signed and magnitude scale",()=>{
  const source={width:3,height:3,data:Uint8ClampedArray.from(Array.from({length:9},(_,i)=>Array(3).fill(i%3*10+Math.floor(i/3)*20).concat(37)).flat())};
  for(const [direction,value] of [["x",148],["y",168],["magnitude",45]])assert.equal(runPipeline(source,[{kind:"sobel",direction,gain:1}]).output.data[16],value);
  const p=inspectStage(source,1,1,{kind:"sobel",direction:"x",gain:1});assert.deepEqual(p.sums,[80,160,0]);assert.equal(p.alpha,37);
});
test("threshold boundary, per-pass clipping and ties-to-even rounding",()=>{
  const source={width:3,height:1,data:Uint8ClampedArray.from([127,127,127,0,128,128,128,128,129,129,129,255])};
  assert.deepEqual([...runPipeline(source,[{kind:"threshold",cutoff:128}]).output.data],[0,0,0,0,255,255,255,128,255,255,255,255]);
  const half=runPipeline({width:1,height:1,data:Uint8ClampedArray.from([1,3,5,99])},[{...kernelStage(),divisor:2}]).output;
  assert.deepEqual([...half.data],[0,2,2,99]);
  assert.deepEqual([...runPipeline(source,[{...kernelStage(),bias:200},{...kernelStage(),bias:-200}]).output.data],[55,55,55,0,55,55,55,128,55,55,55,255]);
});
test("four-pass pipeline independently reconstructed, alpha preserved at every pass",()=>{
  const source=fixture(),stages=[kernelStage("gaussian"),{kind:"sobel",direction:"magnitude",gain:1.25},{kind:"threshold",cutoff:60},kernelStage("blur")];
  const actual=runPipeline(source,stages);let expected=source;
  for(let i=0;i<stages.length;i++){expected=reference(expected,stages[i]);assert.deepEqual(actual.outputs[i].data,expected.data);for(let p=3;p<source.data.length;p+=4)assert.equal(actual.outputs[i].data[p],source.data[p]);}
  assert.equal(actual.work,5*4*(27+57+6+27));
});
test("blur then threshold differs from threshold then blur",()=>{
  const source={width:3,height:1,data:Uint8ClampedArray.from([0,0,0,255,255,255,255,255,0,0,0,255])},blur=kernelStage("blur"),threshold={kind:"threshold",cutoff:128};
  assert.deepEqual([...runPipeline(source,[blur,threshold]).output.data.filter((_,i)=>i%4===0)],[0,0,0]);
  assert.deepEqual([...runPipeline(source,[threshold,blur]).output.data.filter((_,i)=>i%4===0)],[85,85,85]);
});
test("MAE / RMSE / sign / max / heatmap use independent hand calculation",()=>{
  const a={width:2,height:1,data:Uint8ClampedArray.from([13,16,30,128,255,123,88,0])},b={width:2,height:1,data:Uint8ClampedArray.from([10,20,30,128,0,0,0,0])};
  const m=compareImages(a,b,4);assert.equal(m.mae,7/3);assert.equal(m.rmse,Math.sqrt(25/3));assert.equal(m.bias,-1/3);assert.equal(m.max,4);assert.equal(m.channels,3);assert.equal(m.alphaMae,0);assert.equal(m.changedPixels,1);assert.deepEqual([...m.heatmap.data],[16,4,0,255,0,0,0,255]);
  const boosted=compareImages(a,b,16);assert.equal(boosted.mae,m.mae);assert.deepEqual([...boosted.heatmap.data.slice(0,4)],[64,4,0,255]);
  assert.equal(compareImages(a,a).rmse,0);
});
test("alpha errors are separate; fully transparent pairs have no RGB score",()=>{
  const a={width:1,height:1,data:Uint8ClampedArray.from([255,22,3,0])},b={width:1,height:1,data:Uint8ClampedArray.from([0,0,0,0])};
  assert.equal(compareImages(a,b).channels,0);assert.equal(compareImages(a,b).mae,0);
  const c={...b,data:Uint8ClampedArray.from([0,0,0,100])};assert.equal(compareImages(b,c).alphaMae,100);assert.equal(compareImages(b,c).changedPixels,1);
});
test("reject oversized, sparse, invalid stages and compute before processing",()=>{
  const source=fixture(),large={width:720,height:480,data:new Uint8ClampedArray(720*480*4)},sobel={kind:"sobel",direction:"x",gain:1};
  assert.throws(()=>runPipeline(source,[]),RangeError);assert.throws(()=>runPipeline(source,Array(5).fill(kernelStage())),RangeError);
  assert.throws(()=>runPipeline(large,Array(4).fill(sobel)),/예산/);assert.ok(validatePipeline(large,Array(4).fill(kernelStage()))<=MAX_WORK);
  for(const bad of [{...sobel,gain:NaN},{...sobel,direction:"z"},{kind:"threshold",cutoff:1.2},{...kernelStage(),kernel:Array(9)},{...kernelStage(),gray:"yes"}])assert.throws(()=>runPipeline(source,[bad]));
  assert.throws(()=>validateImage({...source,width:0}));assert.throws(()=>compareImages(source,fixture(2,2)));assert.throws(()=>compareImages(source,source,17));assert.throws(()=>inspectStage(source,NaN,0,kernelStage()));
});
test("chunk iterator cancellation produces no final result or source mutation",()=>{
  const source=fixture(5,40),before=[...source.data],stage=kernelStage("blur"),iterator=pipelineSteps(source,[stage],8);
  assert.deepEqual(iterator.next().value,{stage:1,rows:8,height:40});stage.kernel.fill(0);
  assert.equal(iterator.return().done,true);assert.equal(iterator.next().value,undefined);assert.deepEqual([...source.data],before);
  const full=pipelineSteps(source,[kernelStage()],8);assert.equal(Array.from(full).length,5);
  assert.throws(()=>Array.from(pipelineSteps(source,[kernelStage()],33)));
});
test("chunk configuration snapshots and synchronous result agree",()=>{
  const source=fixture(5,40),stage=kernelStage("blur"),iterator=pipelineSteps(source,[stage],8),expected=runPipeline(source,[stage]).output;
  iterator.next();stage.bias=255;stage.kernel.fill(0);let next;do{next=iterator.next();}while(!next.done);assert.deepEqual(next.value.output.data,expected.data);
});
test("seed reproducibility, variations, all objectives independently reproduce target",()=>{
  assert.deepEqual(syntheticImage(17).data,syntheticImage(17).data);assert.notDeepEqual(syntheticImage(17).data,syntheticImage(18).data);
  for(const seed of [0,17,991,999999])for(let level=0;level<objectives.length;level++) {
    const challenge=createChallenge(level,seed);let expected=challenge.source;
    for(const stage of challenge.solution)expected=reference(expected,stage);
    assert.deepEqual(expected.data,challenge.target.data);
    const assessment=assessChallenge(challenge,challenge.solution,expected);assert.equal(assessment.passed,true);assert.equal(assessment.metrics.mae,0);
    assert.equal(assessChallenge(challenge,[kernelStage()],challenge.source).passed,false);
  }
  assert.throws(()=>createChallenge(5,17));assert.throws(()=>syntheticImage(-1));
});
test("constraints reject matching target with illegal recipe and provide useful feedback",()=>{
  const c=createChallenge(0,17),bad=[{...c.solution[0],kernel:[1,0,0,0,1,0,0,0,0]}],a=assessChallenge(c,bad,c.target);
  assert.equal(a.metrics.mae,0);assert.equal(a.passed,false);assert.match(a.feedback,/중앙 1/);
  const wrong=assessChallenge(c,[kernelStage()],c.source,0);assert.match(wrong.feedback,/어두움/);assert.match(wrong.feedback,/증가/);
  const c4=createChallenge(3,17);assert.match(assessChallenge(c4,[kernelStage()],c4.source).feedback,/각각 한 번/);
});
test("pointer uses fractional content dimensions and pixel cells, excluding CSS borders",()=>{
  const saved=globalThis.getComputedStyle;
  globalThis.getComputedStyle=()=>({borderLeftWidth:"1px",borderRightWidth:"1px",borderTopWidth:"1px",borderBottomWidth:"1px"});
  try {
    const canvas={width:600,height:400,getBoundingClientRect:()=>({left:20.5,top:10.25,width:957.5,height:639})};
    assert.deepEqual(canvasPointer(canvas,{clientX:21.5+955.5*.25,clientY:11.25+637*.25}),{x:150,y:100});
    assert.deepEqual(canvasPointer(canvas,{clientX:21.5+955.5*150.9/600,clientY:11.25+637*100.9/400}),{x:150,y:100});
  }finally {if(saved)globalThis.getComputedStyle=saved;else delete globalThis.getComputedStyle;}
});
