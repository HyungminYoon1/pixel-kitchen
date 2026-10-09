// Pure byte-domain calculations: no DOM, IO, storage or scheduler.
export const MAX_PIXELS=360000, MAX_PASSES=4, MAX_WORK=40000000;
export const recipes=Object.freeze(Object.fromEntries(Object.entries({
  identity:{name:"항등",kernel:[0,0,0,0,1,0,0,0,0],divisor:1,bias:0},
  sharpen:{name:"샤프닝",kernel:[0,-1,0,-1,5,-1,0,-1,0],divisor:1,bias:0},
  blur:{name:"박스 평균",kernel:[1,1,1,1,1,1,1,1,1],divisor:9,bias:0},
  gaussian:{name:"가우시안 3×3",kernel:[1,2,1,2,4,2,1,2,1],divisor:16,bias:0},
  edge:{name:"라플라시안",kernel:[-1,-1,-1,-1,8,-1,-1,-1,-1],divisor:1,bias:0},
  emboss:{name:"양각",kernel:[-2,-1,0,-1,1,1,0,1,2],divisor:1,bias:128},
  sobel:{name:"Sobel X 커널",kernel:[-1,0,1,-2,0,2,-1,0,1],divisor:1,bias:128}
}).map(([id,r])=>[id,Object.freeze({...r,kernel:Object.freeze(r.kernel)})])));
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
const luminance=(data,i)=>Math.round(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722);
const gx=[-1,0,1,-2,0,2,-1,0,1],gy=[-1,-2,-1,0,0,0,1,2,1];
export function validateImage(image) {
  if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width>720||image.height>480||image.width*image.height>MAX_PIXELS||!(image.data instanceof Uint8ClampedArray)||image.data.length!==image.width*image.height*4)
    throw new RangeError("지원하지 않는 이미지 크기 또는 픽셀 배열입니다.");
}
export function validateRecipe(recipe) {
  if(!recipe||!Array.isArray(recipe.kernel)||recipe.kernel.length!==9||Array.from(recipe.kernel).some(n=>!Number.isFinite(n)||Math.abs(n)>16)) throw new RangeError("필터 숫자 9개는 -16부터 16까지입니다.");
  if(!Number.isFinite(recipe.divisor)||recipe.divisor<.1||recipe.divisor>64||!Number.isFinite(recipe.bias)||Math.abs(recipe.bias)>255) throw new RangeError("나누기는 0.1–64, 밝기는 -255–255입니다.");
}
export function validateStage(stage) {
  if(!stage||!["kernel","sobel","threshold"].includes(stage.kind)) throw new RangeError("알 수 없는 처리 단계입니다.");
  if(stage.kind==="kernel") {validateRecipe(stage);if(typeof stage.gray!=="boolean")throw new TypeError("흑백 설정은 참 또는 거짓이어야 합니다.");}
  else if(stage.kind==="sobel") {if(!["x","y","magnitude"].includes(stage.direction)||!Number.isFinite(stage.gain)||stage.gain<.25||stage.gain>4)throw new RangeError("Sobel 방향과 증폭 0.25–4를 확인하세요.");}
  else if(!Number.isInteger(stage.cutoff)||stage.cutoff<0||stage.cutoff>255)throw new RangeError("문턱값은 정수 0–255입니다.");
}
export function kernelStage(id="identity") {
  if(!Object.hasOwn(recipes,id))throw new RangeError("알 수 없는 필터입니다.");
  return {kind:"kernel",...recipes[id],kernel:[...recipes[id].kernel],gray:false};
}
export function validatePipeline(image,stages) {
  validateImage(image);
  if(!Array.isArray(stages)||stages.length<1||stages.length>MAX_PASSES)throw new RangeError("파이프라인은 1–4단계입니다.");
  let taps=0;
  for(const stage of stages){validateStage(stage);taps+=stage.kind==="kernel"?27+(stage.gray?3:0):stage.kind==="sobel"?57:6;}
  const work=image.width*image.height*taps;
  if(work>MAX_WORK)throw new RangeError("계산 예산 4천만을 초과합니다. Sobel 단계를 줄이거나 작은 사진을 선택하세요.");
  return work;
}
function pixel(image,x,y,stage) {
  const {width,height,data}=image,neighbors=[],sums=[0,0,0];
  if(stage.kind==="threshold") {const value=luminance(data,(y*width+x)*4),color=value>=stage.cutoff?255:0;return {neighbors,raw:[color,color,color],color:[color,color,color],luminance:value};}
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
    const i=(bound(y+dy,0,height-1)*width+bound(x+dx,0,width-1))*4,k=(dy+1)*3+dx+1;
    const values=stage.kind==="sobel"||stage.gray?Array(3).fill(luminance(data,i)):[data[i],data[i+1],data[i+2]];
    if(stage.kind==="sobel"){sums[0]+=values[0]*gx[k];sums[1]+=values[0]*gy[k];neighbors.push({values,weight:gx[k],weightY:gy[k]});}
    else {for(let c=0;c<3;c++)sums[c]+=values[c]*stage.kernel[k];neighbors.push({values,weight:stage.kernel[k]});}
  }
  const response=stage.kind==="sobel"?(stage.direction==="magnitude"?Math.hypot(sums[0],sums[1])/4*stage.gain:sums[stage.direction==="x"?0:1]/4*stage.gain+128):null;
  const raw=response===null?sums.map(n=>n/stage.divisor+stage.bias):Array(3).fill(response);
  return {neighbors,sums,raw,color:Array.from(new Uint8ClampedArray(raw))};
}
export function inspectStage(image,x,y,stage) {
  validateImage(image);validateStage(stage);
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError("픽셀 좌표를 확인하세요.");
  x=bound(Math.round(x),0,image.width-1);y=bound(Math.round(y),0,image.height-1);
  return {x,y,...pixel(image,x,y,stage),alpha:image.data[(y*image.width+x)*4+3]};
}
export function inspectPixel(image,x,y,recipe,gray=false){return inspectStage(image,x,y,{...recipe,kind:"kernel",gray});}
// Separate fast row loop; independent scalar oracle lives in tests.
function calculateRows(image,output,stage,start,end) {
  const {width,height,data}=image;
  for(let y=start;y<end;y++)for(let x=0;x<width;x++) {
    const base=(y*width+x)*4;
    if(stage.kind==="threshold")output[base]=output[base+1]=output[base+2]=luminance(data,base)>=stage.cutoff?255:0;
    else {
      let r=0,g=0,b=0,sx=0,sy=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const i=(bound(y+dy,0,height-1)*width+bound(x+dx,0,width-1))*4,k=(dy+1)*3+dx+1;
        if(stage.kind==="sobel"){const v=luminance(data,i);sx+=v*gx[k];sy+=v*gy[k];}
        else if(stage.gray){const v=luminance(data,i)*stage.kernel[k];r+=v;g+=v;b+=v;}
        else {const w=stage.kernel[k];r+=data[i]*w;g+=data[i+1]*w;b+=data[i+2]*w;}
      }
      if(stage.kind==="sobel"){const value=stage.direction==="magnitude"?Math.hypot(sx,sy)/4*stage.gain:(stage.direction==="x"?sx:sy)/4*stage.gain+128;output[base]=output[base+1]=output[base+2]=value;}
      else {output[base]=r/stage.divisor+stage.bias;output[base+1]=g/stage.divisor+stage.bias;output[base+2]=b/stage.divisor+stage.bias;}
    }
    output[base+3]=data[base+3];
  }
}
export function* pipelineSteps(image,stages,rows=16) {
  const work=validatePipeline(image,stages);
  if(!Number.isInteger(rows)||rows<1||rows>32)throw new RangeError("행 묶음은 1–32입니다.");
  stages=stages.map(stage=>({...stage,...(stage.kernel?{kernel:[...stage.kernel]}:{})}));
  let current=image;const outputs=[];
  for(let index=0;index<stages.length;index++) {
    const output={width:image.width,height:image.height,data:new Uint8ClampedArray(image.data.length)};
    for(let row=0;row<image.height;row+=rows){calculateRows(current,output.data,stages[index],row,Math.min(row+rows,image.height));yield {stage:index+1,rows:Math.min(row+rows,image.height),height:image.height};}
    outputs.push(output);current=output;
  }
  return {output:current,outputs,work};
}
export function runPipeline(image,stages){const iterator=pipelineSteps(image,stages);let next;do{next=iterator.next();}while(!next.done);return next.value;}
export function convolve(image,recipe,gray=false){return runPipeline(image,[{...recipe,kind:"kernel",gray}]).output;}
export function compareImages(actual,target,gain=4) {
  validateImage(actual);validateImage(target);
  if(actual.width!==target.width||actual.height!==target.height)throw new RangeError("같은 크기의 이미지가 필요합니다.");
  if(!Number.isFinite(gain)||gain<1||gain>16)throw new RangeError("차이 지도 증폭은 1–16입니다.");
  let absolute=0,squared=0,signed=0,max=0,channels=0,alphaError=0,changed=0;
  const heatmap={width:actual.width,height:actual.height,data:new Uint8ClampedArray(actual.data.length)};
  for(let i=0;i<actual.data.length;i+=4) {
    const ad=Math.abs(actual.data[i+3]-target.data[i+3]);alphaError+=ad;let local=ad;
    if(actual.data[i+3]!==0||target.data[i+3]!==0)for(let c=0;c<3;c++){const delta=actual.data[i+c]-target.data[i+c],error=Math.abs(delta);absolute+=error;squared+=delta*delta;signed+=delta;max=Math.max(max,error);local=Math.max(local,error);channels++;}
    if(local>0)changed++;
    heatmap.data[i]=Math.min(255,local*gain);heatmap.data[i+1]=Math.min(255,local);heatmap.data[i+2]=0;heatmap.data[i+3]=255;
  }
  const pixels=actual.width*actual.height;
  return {mae:channels?absolute/channels:0,rmse:channels?Math.sqrt(squared/channels):0,bias:channels?signed/channels:0,max,channels,alphaMae:alphaError/pixels,changedPixels:changed,pixels,heatmap};
}
export function histogram(image,channel="gray") {
  validateImage(image);
  if(!["gray","r","g","b","alpha"].includes(channel))throw new RangeError("히스토그램 채널을 확인하세요.");
  const bins=new Uint32Array(256),offset={r:0,g:1,b:2,alpha:3}[channel];let pixels=0;
  for(let i=0;i<image.data.length;i+=4) {
    if(channel!=="alpha"&&image.data[i+3]===0)continue;
    bins[channel==="gray"?luminance(image.data,i):image.data[i+offset]]++;pixels++;
  }
  return {bins,pixels};
}
