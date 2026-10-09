// Pure, image-free interchange. This model tag fixes the byte semantics.
import {validateStage,validatePipeline,MAX_PASSES} from "./model.js";

export const RECIPE_VERSION=1,MODEL_VERSION="pixel-kitchen-byte-v1",MAX_RECIPE_BYTES=8192;
export const MAX_PRESETS=8,MAX_PRESET_BYTES=65536;
function fields(value,keys) {
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError("레시피 필드를 확인하세요.");
}
function dense(value,min,max) {
  if(!Array.isArray(value)||value.length<min||value.length>max||Object.keys(value).length!==value.length||Array.from(value).some(item=>item===undefined))throw new RangeError("레시피 배열 범위를 확인하세요.");
}
function stageCopy(stage) {
  validateStage(stage);
  if(stage.kind==="kernel")return {kind:"kernel",kernel:[...stage.kernel],divisor:stage.divisor,bias:stage.bias,gray:stage.gray};
  if(stage.kind==="sobel")return {kind:"sobel",direction:stage.direction,gain:stage.gain};
  return {kind:"threshold",cutoff:stage.cutoff};
}
export function validateDocument(value) {
  fields(value,["version","model","stages"]);
  if(value.version!==RECIPE_VERSION||value.model!==MODEL_VERSION)throw new RangeError("지원하지 않는 레시피 버전입니다.");
  dense(value.stages,1,MAX_PASSES);
  const stages=value.stages.map(stage=>{
    const keys=stage?.kind==="kernel"?["kind","kernel","divisor","bias","gray"]:stage?.kind==="sobel"?["kind","direction","gain"]:["kind","cutoff"];
    fields(stage,keys);
    if(stage.kind==="kernel")dense(stage.kernel,9,9);
    return stageCopy(stage);
  });
  return {version:RECIPE_VERSION,model:MODEL_VERSION,stages};
}
export function documentFromStages(stages) {
  dense(stages,1,MAX_PASSES);
  return validateDocument({version:RECIPE_VERSION,model:MODEL_VERSION,stages:stages.map(stageCopy)});
}
function parseBounded(text,max) {
  if(typeof text!=="string"||text.length>max||new TextEncoder().encode(text).length>max)throw new RangeError("레시피 파일이 너무 큽니다.");
  try{return JSON.parse(text);}catch{throw new SyntaxError("JSON 레시피를 확인하세요.");}
}
export function parseDocument(text){return validateDocument(parseBounded(text,MAX_RECIPE_BYTES));}
export function stagesForImage(image,value){const recipe=validateDocument(value);validatePipeline(image,recipe.stages);return recipe.stages;}
export function serializeDocument(value){const text=JSON.stringify(validateDocument(value),null,2);if(new TextEncoder().encode(text).length>MAX_RECIPE_BYTES)throw new RangeError("레시피 파일이 너무 큽니다.");return text;}
export function validatePresets(value) {
  fields(value,["version","presets"]);
  if(value.version!==1)throw new RangeError("지원하지 않는 프리셋 버전입니다.");
  dense(value.presets,0,MAX_PRESETS);const slots=new Set();
  const presets=value.presets.map(entry=>{
    fields(entry,["slot","recipe"]);
    if(!Number.isInteger(entry.slot)||entry.slot<1||entry.slot>MAX_PRESETS||slots.has(entry.slot))throw new RangeError("프리셋 번호를 확인하세요.");
    slots.add(entry.slot);return {slot:entry.slot,recipe:validateDocument(entry.recipe)};
  }).sort((a,b)=>a.slot-b.slot);
  return {version:1,presets};
}
export function parsePresets(text){return validatePresets(parseBounded(text,MAX_PRESET_BYTES));}
export function addPreset(state,recipe) {
  const next=validatePresets(state);recipe=validateDocument(recipe);
  if(next.presets.length>=MAX_PRESETS)throw new RangeError("프리셋은 최대 8개입니다. 하나를 삭제하세요.");
  let slot=1;while(next.presets.some(entry=>entry.slot===slot))slot++;
  next.presets.push({slot,recipe});return validatePresets(next);
}
export function removePreset(state,slot) {
  const next=validatePresets(state);
  if(!next.presets.some(entry=>entry.slot===slot))throw new RangeError("프리셋을 선택하세요.");
  next.presets=next.presets.filter(entry=>entry.slot!==slot);return next;
}
