import {recipes,convolve,inspectPixel,validateRecipe} from "./model.js";
import {expose,tool,canvasPointer} from "./ui.js";
const $=s=>document.querySelector(s),original=$("#original"),result=$("#result");
let source,processed,active="sharpen",recipe={...recipes.sharpen},selected={x:300,y:200},gray=false;
const inputs=[];
for(let i=0;i<9;i++){const input=document.createElement("input");input.type="number";input.min="-16";input.max="16";input.step=".1";input.setAttribute("aria-label",`필터 ${Math.floor(i/3)+1}행 ${i%3+1}열`);$("#kernel").append(input);inputs.push(input);}
for(const [id,r] of Object.entries(recipes)){const button=document.createElement("button");button.type="button";button.textContent=r.name;button.dataset.recipe=id;button.addEventListener("click",()=>choose(id));$("#presets").append(button);}
function sample(){
  original.width=600;original.height=400;const ctx=original.getContext("2d");
  const gradient=ctx.createLinearGradient(0,0,600,400);gradient.addColorStop(0,"#ed4f2e");gradient.addColorStop(.45,"#ffca38");gradient.addColorStop(.7,"#2fbda3");gradient.addColorStop(1,"#2652c6");ctx.fillStyle=gradient;ctx.fillRect(0,0,600,400);
  for(let x=0;x<600;x+=60){ctx.fillStyle=x%120===0?"#fff":"#171717";ctx.fillRect(x,0,60,55);}
  ctx.fillStyle="#191b25";ctx.fillRect(75,100,180,195);ctx.fillStyle="#ff6b35";ctx.fillRect(100,125,130,145);
  ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(390,195,75,0,Math.PI*2);ctx.fill();ctx.fillStyle="#1634b5";ctx.beginPath();ctx.arc(390,195,45,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#fff";ctx.font="bold 30px monospace";ctx.fillText("RGB / 3×3",285,345);
  source=ctx.getImageData(0,0,600,400);selected={x:300,y:200};apply();
}
function apply(){
  validateRecipe(recipe);processed=convolve(source,recipe,gray);result.width=processed.width;result.height=processed.height;result.getContext("2d").putImageData(new ImageData(processed.data,processed.width,processed.height),0,0);
  $("#dimensions").textContent=`${source.width} × ${source.height}`;$("#filter-label").textContent=active==="custom"?"직접 만든 필터":recipes[active].name;
  for(let i=0;i<9;i++)inputs[i].value=recipe.kernel[i];$("#divisor").value=recipe.divisor;$("#bias").value=recipe.bias;$("#gray").checked=gray;
  for(const button of $("#presets").children)button.setAttribute("aria-pressed",String(button.dataset.recipe===active));inspect();
}
function choose(id){if(!Object.hasOwn(recipes,id))throw new RangeError("알 수 없는 필터입니다.");active=id;recipe={...recipes[id],kernel:[...recipes[id].kernel]};apply();return summary();}
function summary(){return {filter:active,width:source.width,height:source.height,grayscale:gray,kernel:[...recipe.kernel],divisor:recipe.divisor,bias:recipe.bias};}
function inspect(){const p=inspectPixel(source,selected.x,selected.y,recipe,gray);selected={x:p.x,y:p.y};$("#coordinate").textContent=`x ${p.x} / y ${p.y}`;$("#neighborhood").replaceChildren(...p.neighbors.map(n=>{const span=document.createElement("span");span.textContent=`${n.values[0]} × ${n.weight}`;return span;}));$("#formula").textContent=`R: (${p.neighbors.map(n=>`${n.values[0]}×${n.weight}`).join(" + ")}) / ${recipe.divisor} + ${recipe.bias}`;$("#rgb-result").textContent=`RGB(${p.color.join(", ")}) · R 원값 ${p.raw[0].toFixed(2)} · 0–255 범위로 저장`;}
result.addEventListener("pointerdown",event=>{selected=canvasPointer(result,event);inspect();});
result.addEventListener("keydown",event=>{const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!move)return;event.preventDefault();selected.x+=move[0];selected.y+=move[1];inspect();});
$("#custom").addEventListener("click",()=>{try{const next={kernel:inputs.map(i=>Number(i.value)),divisor:Number($("#divisor").value),bias:Number($("#bias").value)};validateRecipe(next);recipe=next;active="custom";apply();$("#status").textContent="내 필터를 적용했습니다.";}catch(error){$("#status").textContent=error.message;}});
$("#gray").addEventListener("change",()=>{gray=$("#gray").checked;apply();});$("#sample").addEventListener("click",()=>{importVersion++;sample();$("#status").textContent="샘플을 복원했습니다. 내 사진은 업로드하지 않고 이 브라우저에서 처리합니다.";});
let importVersion=0;
$("#image-file").addEventListener("change",async event=>{
  const file=event.target.files[0];if(!file)return;const version=++importVersion;let bitmap;
  try{if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>8*1024*1024)throw new Error("PNG·JPEG·WebP 파일을 8 MB 이내로 선택하세요.");bitmap=await createImageBitmap(file);if(version!==importVersion)return;if(bitmap.width*bitmap.height>24000000)throw new Error("사진 크기는 2,400만 픽셀 이내로 선택하세요.");const scale=Math.min(1,720/bitmap.width,480/bitmap.height);original.width=Math.max(1,Math.round(bitmap.width*scale));original.height=Math.max(1,Math.round(bitmap.height*scale));original.getContext("2d").drawImage(bitmap,0,0,original.width,original.height);source=original.getContext("2d").getImageData(0,0,original.width,original.height);selected={x:Math.floor(source.width/2),y:Math.floor(source.height/2)};apply();$("#status").textContent=`${source.width} × ${source.height} 픽셀로 가공합니다. 사진은 서버로 전송하지 않습니다.`;}catch(error){$("#status").textContent=error.message||"사진을 열 수 없습니다.";}finally{bitmap?.close();event.target.value="";}
});
$("#export").addEventListener("click",()=>result.toBlob(blob=>{if(!blob){$("#status").textContent="PNG를 만들 수 없습니다.";return;}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="pixel-kitchen.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$("#status").textContent="가공 결과를 PNG로 저장했습니다.";},"image/png"));
sample();
expose([tool("read_pixel_workspace","Read the current filter and image dimensions, without returning private image pixels.",{},summary,true),tool("apply_pixel_filter","Apply a named filter to the current browser-local image.",{preset:{type:"string",enum:Object.keys(recipes)},grayscale:{type:"boolean"}},input=>{if(typeof input.grayscale!=="undefined"&&typeof input.grayscale!=="boolean")throw new TypeError("grayscale must be boolean");if(!Object.hasOwn(recipes,input.preset))throw new RangeError("Unknown preset");gray=input.grayscale??gray;return choose(input.preset);})]);
