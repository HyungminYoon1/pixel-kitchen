import test from "node:test";import assert from "node:assert/strict";
import {recipes,convolve,inspectPixel,validateRecipe} from "../dist/src/model.js";
const image={width:3,height:3,data:Uint8ClampedArray.from(Array.from({length:9},(_,i)=>[i*20,i*10,200-i*10,150+i]).flat())};
test("identity preserves every channel including alpha and does not mutate source",()=>{const before=[...image.data];assert.deepEqual([...convolve(image,recipes.identity).data],before);assert.deepEqual([...image.data],before);});
test("blur, sharpen and signed filters agree with pixel inspection including clamped edges",()=>{for(const recipe of Object.values(recipes))for(const gray of [false,true]){const out=convolve(image,recipe,gray);for(let y=0;y<3;y++)for(let x=0;x<3;x++)assert.deepEqual([...out.data.slice((y*3+x)*4,(y*3+x)*4+3)],inspectPixel(image,x,y,recipe,gray).color);}});
test("box blur computes the center as an average and retains alpha",()=>{const out=convolve(image,recipes.blur);assert.equal(out.data[16],80);assert.equal(out.data[19],154);});
test("invalid kernels, zero divisors and oversized work are rejected",()=>{assert.throws(()=>validateRecipe({kernel:Array(9).fill(NaN),divisor:1,bias:0}),RangeError);assert.throws(()=>convolve(image,{...recipes.blur,divisor:0}),RangeError);assert.throws(()=>convolve({...image,width:99999},recipes.identity),RangeError);});
