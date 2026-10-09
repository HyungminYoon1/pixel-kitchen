// The only persistence adapter. Fixed key, schema-validated settings only.
import {parsePresets,validatePresets,addPreset,removePreset,MAX_PRESET_BYTES} from "./recipe.js";
export const PRESET_KEY="pixel-kitchen-presets-v1";
export function presetStore(getStorage=()=>globalThis.localStorage) {
  function access(action) {
    try{return action(getStorage());}catch(error){
      if(error instanceof RangeError||error instanceof TypeError||error instanceof SyntaxError)throw error;
      throw new Error("기기 저장을 사용할 수 없습니다.");
    }
  }
  const read=()=>access(storage=>{const text=storage.getItem(PRESET_KEY);return text===null?{version:1,presets:[]}:parsePresets(text);});
  const write=state=>access(storage=>{
    const valid=validatePresets(state),text=JSON.stringify(valid);
    if(new TextEncoder().encode(text).length>MAX_PRESET_BYTES)throw new RangeError("프리셋 저장 한도를 초과했습니다.");
    storage.setItem(PRESET_KEY,text);return valid;
  });
  return {
    read,
    save:recipe=>write(addPreset(read(),recipe)),
    remove:slot=>write(removePreset(read(),slot)),
    erase:()=>access(storage=>{storage.removeItem(PRESET_KEY);return {version:1,presets:[]};})
  };
}
