import {recipes,kernelStage,validateStage,validatePipeline,pipelineSteps,inspectStage,compareImages,MAX_PASSES,MAX_WORK} from "./model.js";
import {objectives,syntheticImage,createChallenge,assessChallenge} from "./challenges.js";
import {expose,tool,canvasPointer} from "./ui.js";

const $=selector=>document.querySelector(selector),inputs=[];
let source,challenge=null,stages=[kernelStage()],active=0,outputs=null,processed=null;
let runningIterator=null;
let selected={x:96,y:64},runVersion=0,importVersion=0,busy=false,decoding=false,draft=false,unlocked=0,attempts=0,previousMae=null;
const status=message=>{$("#status").textContent=message;};
const stageName=s=>s.kind==="kernel"?s.name||"직접 커널":s.kind==="sobel"?`Sobel ${s.direction==="magnitude"?"크기":s.direction.toUpperCase()}`:`문턱값 ${s.cutoff}`;
const draw=(canvas,image)=>{canvas.width=image.width;canvas.height=image.height;canvas.getContext("2d").putImageData(new ImageData(image.data,image.width,image.height),0,0);};
function setBusy(value){busy=value;$("#cancel").disabled=!value;$("#run").disabled=value;$("#export").disabled=value||!processed||draft;}
function invalidate(message="설정이 바뀌었습니다. 파이프라인을 실행하세요.") {
  runVersion++;setBusy(false);outputs=null;processed=null;
  $("#metrics").textContent="실행 전 / 오차 미계산";$("#feedback").textContent="현재 설정을 실행한 뒤 목표와 비교하세요.";
  $("#result-label").textContent="미계산";$("#compare-label").textContent="미계산";$("#rgb-result").textContent="현재 설정은 아직 계산하지 않았습니다.";
  $("#progress").textContent="현재 설정 미계산";
  $("#neighborhood").replaceChildren();$("#formula").textContent="";$("#next").disabled=true;
  // Clear obsolete previews rather than presenting old output as current.
  for(const id of ["#result","#comparison","#heatmap"]) $(id).getContext("2d").clearRect(0,0,$(id).width,$(id).height);
  $("#export").disabled=true;status(message);
}
for(let i=0;i<9;i++){const input=document.createElement("input");input.type="number";input.min="-16";input.max="16";input.step=".1";input.required=true;input.setAttribute("aria-label",`필터 ${Math.floor(i/3)+1}행 ${i%3+1}열`);$("#kernel").append(input);inputs.push(input);}
for(const [id,r] of Object.entries(recipes)){const b=document.createElement("button");b.type="button";b.textContent=r.name;b.dataset.recipe=id;b.addEventListener("click",()=>choose(id));$("#presets").append(b);}
for(const [i,o] of objectives.entries()){const option=document.createElement("option");option.value=i;option.textContent=o.title;$("#level").append(option);}
function renderStages() {
  $("#stage-list").replaceChildren(...stages.map((s,i)=>{const b=document.createElement("button");b.type="button";b.textContent=`${i+1}. ${stageName(s)}`;b.setAttribute("aria-pressed",String(i===active));b.addEventListener("click",()=>{if(draft)status("미적용 숫자를 되돌리고 선택한 단계의 설정을 표시합니다.");draft=false;active=i;renderStages();renderEditor();inspect();});return b;}));
  $("#stage-count").textContent=`${stages.length} / ${challenge?challenge.objective.maxPasses:MAX_PASSES}`;
  $("#add").disabled=stages.length>=(challenge?challenge.objective.maxPasses:MAX_PASSES);
  $("#remove").disabled=stages.length===1;$("#up").disabled=active===0;$("#down").disabled=active===stages.length-1;
  const allowed=challenge?challenge.objective.allowed:["kernel","sobel","threshold"];
  for(const option of $("#add-kind").options)option.disabled=!allowed.includes(option.value);
  if(!allowed.includes($("#add-kind").value))$("#add-kind").value=allowed[0];
  $("#inspect-stage").textContent=`${active+1}단계 입력 → 출력`;
}
function renderEditor() {
  const s=stages[active],kernel=s.kind==="kernel",sobel=s.kind==="sobel";
  $("#kernel-editor").hidden=!kernel;$("#sobel-editor").hidden=!sobel;$("#threshold-editor").hidden=s.kind!=="threshold";
  $("#editor-title").textContent=`${active+1}단계 / ${stageName(s)}`;
  $("#presets").hidden=!!challenge;$("#normalize").disabled=challenge?.level===0;
  if(kernel){inputs.forEach((input,i)=>{input.value=s.kernel[i];input.disabled=challenge?.level===0;input.min=challenge?"0":"-16";});$("#divisor").value=s.divisor;$("#bias").value=s.bias;$("#gray").checked=s.gray;
    $("#divisor").disabled=challenge?.level===0;$("#bias").disabled=!!challenge&&challenge.level!==0;$("#gray").disabled=!!challenge;
    $("#bias").min=challenge?"0":"-255";$("#bias").max=challenge?.level===0?"48":"255";
    for(const button of $("#presets").children)button.disabled=challenge?.level===0;
  }
  if(sobel){$("#direction").value=s.direction;$("#gain").value=s.gain;for(const option of $("#direction").options)option.disabled=challenge?.level===2?option.value==="magnitude":challenge?.level===4?option.value!=="magnitude":false;}
  if(s.kind==="threshold")$("#cutoff").value=s.cutoff;
  $("#draft-label").textContent="적용된 설정";
  kernelInfo();
}
function kernelInfo(){const sum=inputs.reduce((total,input)=>total+Number(input.value),0),divisor=Number($("#divisor").value);$("#kernel-info").textContent=`계수 합 ${sum.toFixed(2)} · 평탄부 배율 ${divisor>0?(sum/divisor).toFixed(3):"미정"}. 배율 1이면 일정한 밝기를 유지합니다 (밝기 0).`;}
$("#normalize").addEventListener("click",()=>{const sum=inputs.reduce((total,input)=>total+Number(input.value),0);if(!Number.isFinite(sum)||sum<.1||sum>64){status("계수 합이 0.1–64일 때만 나누기로 쓸 수 있습니다.");return;}$("#divisor").value=Number(sum.toFixed(6));draft=true;invalidate("계수 합을 나누기로 지정했습니다. 실행해서 경계의 차이를 비교하세요.");kernelInfo();$("#draft-label").textContent="미적용 숫자";});
function readEditor() {
  const s=stages[active];
  const read=id=>{const element=typeof id==="string"?$(id):id;if(element.value.trim()===""||!element.checkValidity())throw new RangeError("빈 숫자 또는 입력 범위를 확인하세요.");return Number(element.value);};
  const next=s.kind==="kernel"?{kind:"kernel",name:"직접 만든 커널",kernel:inputs.map(read),divisor:read("#divisor"),bias:read("#bias"),gray:$("#gray").checked}:s.kind==="sobel"?{kind:"sobel",direction:$("#direction").value,gain:read("#gain")}:{kind:"threshold",cutoff:read("#cutoff")};
  validateStage(next);return next;
}
function commitEditor(){if(draft){stages[active]=readEditor();draft=false;renderStages();renderEditor();}}
function choose(id) {
  if(!Object.hasOwn(recipes,id)||stages[active].kind!=="kernel"||challenge?.level===0)throw new RangeError("현재 단계에서 선택할 수 없는 커널입니다.");
  stages[active]=kernelStage(id);draft=false;invalidate();renderStages();renderEditor();return summary();
}
$("#editor").addEventListener("input",()=>{draft=true;invalidate("입력 중입니다. 실행하면 이 단계의 숫자도 적용됩니다.");kernelInfo();$("#draft-label").textContent="미적용 숫자";});
$("#custom").addEventListener("click",()=>{try{stages[active]=readEditor();draft=false;invalidate("단계 설정을 적용했습니다. 전체 파이프라인을 실행하세요.");renderStages();renderEditor();}catch(error){status(error.message);}});
$("#add").addEventListener("click",()=>{try{commitEditor();if(stages.length>=(challenge?challenge.objective.maxPasses:MAX_PASSES))throw new RangeError("이 작업의 최대 단계 수에 도달했습니다.");const kind=$("#add-kind").value;
  stages.push(kind==="kernel"?kernelStage():kind==="sobel"?{kind,direction:challenge?.level===4?"magnitude":"x",gain:1}:{kind,cutoff:128});active=stages.length-1;invalidate();renderStages();renderEditor();}catch(error){status(error.message);}});
$("#remove").addEventListener("click",()=>{if(stages.length===1)return;stages.splice(active,1);active=Math.min(active,stages.length-1);draft=false;invalidate();renderStages();renderEditor();});
function move(delta){try{commitEditor();const to=active+delta;if(to<0||to>=stages.length)return;[stages[to],stages[active]]=[stages[active],stages[to]];active=to;invalidate();renderStages();renderEditor();}catch(error){status(error.message);}}
$("#up").addEventListener("click",()=>move(-1));$("#down").addEventListener("click",()=>move(1));
$("#reset-pipeline").addEventListener("click",()=>{stages=[kernelStage()];active=0;draft=false;invalidate();renderStages();renderEditor();});

async function process(countAttempt=true) {
  let iterator;const version=++runVersion;
  try {
    commitEditor();const work=validatePipeline(source,stages);iterator=pipelineSteps(source,stages);runningIterator=iterator;
    outputs=null;processed=null;setBusy(true);$("#metrics").textContent="계산 중…";$("#feedback").textContent="";$("#next").disabled=true;
    const start=performance.now();let next;
    while(true){if(version!==runVersion){iterator.return();return;}next=iterator.next();if(next.done)break;$("#progress").textContent=`${next.value.stage}/${stages.length}단계 · ${next.value.rows}/${source.height}행`;await new Promise(resolve=>setTimeout(resolve,0));}
    if(version!==runVersion)return;
    outputs=next.value.outputs;processed=next.value.output;draw($("#result"),processed);
    $("#result-label").textContent=`최종 ${stages.length}단계`;$("#progress").textContent=`${(work/1000000).toFixed(2)}M / ${MAX_WORK/1000000}M work · ${(performance.now()-start).toFixed(0)} ms (이 기기)`;
    renderComparisonOptions();renderComparison();inspect();
    if(challenge){const assessment=assessChallenge(challenge,stages,processed,previousMae);showMetrics(assessment.metrics);if(countAttempt){attempts++;previousMae=assessment.metrics.mae;$("#feedback").textContent=`시도 ${attempts} · ${assessment.feedback}`;if(assessment.passed){unlocked=Math.max(unlocked,Math.min(objectives.length-1,challenge.level+1));renderLevels();$("#next").disabled=challenge.level===objectives.length-1;}}else $("#feedback").textContent="초기 비교입니다. 단서를 읽고 설정을 바꿔 실행하세요.";}
    else {$("#metrics").textContent="자유 실험 / 목표 점수 없음";$("#feedback").textContent="중간 단계와 최종 결과를 비교하세요. PNG에는 최종 결과만 저장됩니다.";}
    status("현재 파이프라인 계산을 완료했습니다. 픽셀을 누르거나 비교 슬라이더를 움직여 보세요.");
  } catch(error){if(version===runVersion){invalidate(error.message);}}
  finally {iterator?.return();if(runningIterator===iterator)runningIterator=null;if(version===runVersion)setBusy(false);}
}
$("#run").addEventListener("click",()=>process());
$("#cancel").addEventListener("click",()=>invalidate("계산을 취소했습니다. 부분 결과는 내보내지 않습니다."));
function showMetrics(m) {$("#metrics").textContent=`MAE ${m.mae.toFixed(3)} · RMSE ${m.rmse.toFixed(3)} · 최대 RGB 차이 ${m.max} · 부호 평균 ${m.bias.toFixed(3)} · α MAE ${m.alphaMae.toFixed(3)} · 다른 픽셀 ${m.changedPixels}/${m.pixels}`;draw($("#heatmap"),compareImages(processed,challenge.target,Number($("#heat-gain").value)).heatmap);}
function renderComparisonOptions() {
  const previous=$("#compare-stage").value;
  $("#compare-stage").replaceChildren(...outputs.map((_,i)=>{const option=document.createElement("option");option.value=i;option.textContent=`${i+1}단계 ${stageName(stages[i])}`;return option;}));
  $("#compare-stage").value=previous!==""&&Number(previous)<outputs.length?previous:outputs.length-1;
}
function renderComparison() {
  if(!outputs)return;
  const index=Number($("#compare-stage").value),image=outputs[index]||processed,reference=$("#reference").value==="target"&&challenge?challenge.target:source;
  const canvas=$("#comparison");draw(canvas,reference);const ctx=canvas.getContext("2d"),cut=Math.round(image.width*Number($("#wipe").value)/100);
  ctx.save();ctx.beginPath();ctx.rect(cut,0,image.width-cut,image.height);ctx.clip();ctx.putImageData(new ImageData(image.data,image.width,image.height),0,0,cut,0,image.width-cut,image.height);ctx.restore();
  ctx.strokeStyle="#ff813a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cut,0);ctx.lineTo(cut,image.height);ctx.stroke();
  $("#compare-label").textContent=`왼쪽 ${reference===source?"원본":"목표"} ${$("#wipe").value}% / 오른쪽 ${index+1}단계`;
}
for(const id of ["#wipe","#compare-stage","#reference"])$(id).addEventListener("input",renderComparison);
$("#heat-gain").addEventListener("input",()=>{if(processed&&challenge)showMetrics(compareImages(processed,challenge.target,Number($("#heat-gain").value)));});
function inspect() {
  if(!outputs)return;
  const input=active===0?source:outputs[active-1],s=stages[active],p=inspectStage(input,selected.x,selected.y,s);selected={x:p.x,y:p.y};
  $("#coordinate").textContent=`x ${p.x} / y ${p.y}`;$("#inspect-stage").textContent=`${active+1}단계 입력 → 출력`;
  $("#neighborhood").replaceChildren(...p.neighbors.map(n=>{const span=document.createElement("span");span.textContent=s.kind==="sobel"?`${n.values[0]} × (${n.weight}, ${n.weightY})`:`${n.values[0]} × ${n.weight}`;return span;}));
  $("#formula").textContent=s.kind==="kernel"?`R: (${p.neighbors.map(n=>`${n.values[0]}×${n.weight}`).join(" + ")}) / ${s.divisor} + ${s.bias}`:s.kind==="threshold"?`Rec.709 밝기 ${p.luminance} ≥ ${s.cutoff} → ${p.color[0]}`:`Gx=${p.sums[0]}, Gy=${p.sums[1]} · ${s.direction==="magnitude"?"√(Gx²+Gy²) / 4 × 증폭":"G"+s.direction+" / 4 × 증폭 + 128"}`;
  const i=(p.y*source.width+p.x)*4,actual=Array.from(outputs[active].data.slice(i,i+3));
  const target=challenge?Array.from(challenge.target.data.slice(i,i+3)):null;
  $("#rgb-result").textContent=`${active+1}단계 RGB(${actual.join(", ")}) · α ${p.alpha} · R 원값 ${p.raw[0].toFixed(2)}${target?` · 최종 목표 RGB(${target.join(", ")})`:""}`;
}
for(const id of ["#result","#comparison","#target"]){const canvas=$(id);canvas.addEventListener("pointerdown",event=>{selected=canvasPointer(canvas,event);inspect();});canvas.addEventListener("keydown",event=>{const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!move)return;event.preventDefault();selected.x+=move[0];selected.y+=move[1];inspect();});}
function renderLevels(){for(const option of $("#level").options)option.disabled=Number(option.value)>unlocked;}
function configureWorkspace() {
  draw($("#original"),source);$("#dimensions").textContent=`${source.width} × ${source.height}`;
  $("#challenge-panel").hidden=!challenge;$("#target-figure").hidden=!challenge;$("#heat-figure").hidden=!challenge;
  $("#reference-target").disabled=!challenge;$("#reference").value=challenge?"target":"source";
  selected={x:Math.floor(source.width/2),y:Math.floor(source.height/2)};
  if(challenge){draw($("#target"),challenge.target);$("#brief").textContent=challenge.objective.brief;$("#goal").textContent=`MAE ≤ ${challenge.objective.mae}, RMSE ≤ ${challenge.objective.rmse}, α 오차 0 + 연산 제약`;$("#hint-text").textContent="";$("#level").value=challenge.level;}
  renderStages();renderEditor();renderLevels();process(false);
}
function startChallenge(level=0,seed=Number($("#seed").value)) {
  if($("#seed").value.trim()===""||!Number.isInteger(seed)||seed<0||seed>999999)throw new RangeError("시드는 정수 0–999999입니다.");
  $("#seed").value=seed;$("#seed-label").textContent=`적용 시드 ${seed} · 변경 후 '시드로 처음부터'를 누르세요.`;
  importVersion++;invalidate();challenge=createChallenge(level,seed);source=challenge.source;stages=[kernelStage()];active=0;draft=false;attempts=0;previousMae=null;$("#mode").value="challenge";configureWorkspace();
}
function sample(){importVersion++;invalidate();challenge=null;source=syntheticImage(17,600,400);stages=[kernelStage("sharpen")];active=0;draft=false;$("#mode").value="lab";configureWorkspace();}
$("#mode").addEventListener("change",()=>{try{$("#mode").value==="lab"?sample():startChallenge(0);}catch(error){status(error.message);}});
$("#sample").addEventListener("click",sample);
$("#new-seed").addEventListener("click",()=>{try{unlocked=0;startChallenge(0);}catch(error){status(error.message);}});
$("#level").addEventListener("change",()=>{try{const level=Number($("#level").value);if(level>unlocked)throw new RangeError("이전 과제를 먼저 통과하세요.");startChallenge(level,challenge.seed);}catch(error){status(error.message);}});
$("#next").addEventListener("click",()=>{if(challenge&&challenge.level<unlocked)startChallenge(challenge.level+1,challenge.seed);});
$("#seed").addEventListener("input",()=>{$("#seed-label").textContent=`적용 시드 ${challenge.seed} · 입력한 새 시드는 아직 적용하지 않았습니다.`;});
$("#hint").addEventListener("click",()=>{$("#hint-text").textContent=challenge.objective.hint;});

$("#image-file").addEventListener("change",async event=>{
  const file=event.target.files[0];if(!file)return;
  if(decoding){event.target.value="";status("이미 사진을 읽고 있습니다. 읽기가 끝난 뒤 다시 선택하세요.");return;}
  const version=++importVersion;let bitmap;
  try {
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>8*1024*1024)throw new Error("PNG·JPEG·WebP 파일을 8 MB 이내로 선택하세요.");
    decoding=true;$("#cancel-import").disabled=false;
    invalidate("로컬 사진을 읽는 중입니다. 사진 읽기 취소·샘플 복원·과제 전환으로 취소할 수 있습니다.");
    bitmap=await createImageBitmap(file);if(version!==importVersion)return;
    if(bitmap.width*bitmap.height>24000000)throw new Error("사진 크기는 2,400만 픽셀 이내로 선택하세요.");
    const scale=Math.min(1,720/bitmap.width,480/bitmap.height),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
    invalidate();challenge=null;source=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height);stages=[kernelStage()];active=0;draft=false;$("#mode").value="lab";configureWorkspace();
  }catch(error){if(version===importVersion)status(error.message||"사진을 열 수 없습니다.");}finally{bitmap?.close();decoding=false;$("#cancel-import").disabled=true;event.target.value="";}
});
$("#cancel-import").addEventListener("click",()=>{importVersion++;$("#cancel-import").disabled=true;status("사진 읽기를 취소했습니다. 디코더가 끝나면 결과를 폐기합니다. 현재 원본으로 다시 실행할 수 있습니다.");});
$("#export").addEventListener("click",()=>{if(!processed||busy||draft)return;const version=runVersion;$("#result").toBlob(blob=>{if(version!==runVersion)return;if(!blob){status("PNG를 만들 수 없습니다.");return;}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="pixel-kitchen.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status("최종 결과 PNG 다운로드를 요청했습니다.");},"image/png");});
window.addEventListener("pagehide",()=>{
  runningIterator?.return();runningIterator=null;importVersion++;
  invalidate("페이지 이동으로 작업을 비웠습니다.");source=null;challenge=null;
  $("#image-file").value="";$("#cancel-import").disabled=true;
  $("#dimensions").textContent="";$("#coordinate").textContent="";
  for(const canvas of document.querySelectorAll("canvas")){canvas.width=1;canvas.height=1;}
});
window.addEventListener("pageshow",event=>{
  if(!event.persisted)return;
  // Never revive a private file, former pipeline or progress from BFCache.
  unlocked=0;$("#seed").value=17;startChallenge(0,17);expose(workspaceTools);
});
function summary(){return {mode:challenge?"challenge":"lab",width:source.width,height:source.height,passes:stages.length,busy,decoding,draft,workLimit:MAX_WORK};}
startChallenge();
const workspaceTools=[tool("read_pixel_workspace","Read dimensions and bounded pipeline status; no private pixels or challenge answer.",{},summary,true),tool("apply_pixel_filter","Select a kernel in a free local lab. Run with visible controls.",{preset:{type:"string",enum:Object.keys(recipes)}},input=>{if(challenge)throw new RangeError("Use visible challenge controls");return choose(input.preset);})];
expose(workspaceTools);
