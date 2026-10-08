export const recipes=Object.freeze({
  identity:{name:"그대로",kernel:[0,0,0,0,1,0,0,0,0],divisor:1,bias:0},
  sharpen:{name:"선명하게",kernel:[0,-1,0,-1,5,-1,0,-1,0],divisor:1,bias:0},
  blur:{name:"부드럽게",kernel:[1,1,1,1,1,1,1,1,1],divisor:9,bias:0},
  edge:{name:"윤곽선",kernel:[-1,-1,-1,-1,8,-1,-1,-1,-1],divisor:1,bias:0},
  emboss:{name:"양각",kernel:[-2,-1,0,-1,1,1,0,1,2],divisor:1,bias:128},
  sobel:{name:"세로 경계",kernel:[-1,0,1,-2,0,2,-1,0,1],divisor:1,bias:128}
});
export function validateRecipe(recipe) {
  if(!Array.isArray(recipe.kernel)||recipe.kernel.length!==9||recipe.kernel.some(n=>!Number.isFinite(n)||Math.abs(n)>16)) throw new RangeError("필터 숫자는 -16부터 16까지입니다.");
  if(!Number.isFinite(recipe.divisor)||recipe.divisor<.1||recipe.divisor>64||!Number.isFinite(recipe.bias)||Math.abs(recipe.bias)>255) throw new RangeError("나누기 또는 밝기 범위를 확인하세요.");
}
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
export function inspectPixel(image,x,y,recipe,gray=false) {
  validateRecipe(recipe);
  x=bound(Math.round(x),0,image.width-1);y=bound(Math.round(y),0,image.height-1);
  const sums=[0,0,0],neighbors=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
    const i=(bound(y+dy,0,image.height-1)*image.width+bound(x+dx,0,image.width-1))*4;
    const rgb=[image.data[i],image.data[i+1],image.data[i+2]];
    const values=gray?Array(3).fill(Math.round(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)):rgb;
    const weight=recipe.kernel[(dy+1)*3+dx+1];neighbors.push({values,weight});
    for(let c=0;c<3;c++)sums[c]+=values[c]*weight;
  }
  const raw=sums.map(n=>n/recipe.divisor+recipe.bias);
  const color=Array.from(new Uint8ClampedArray(raw));
  return {x,y,neighbors,sums,raw,color};
}
export function convolve(image,recipe,gray=false) {
  validateRecipe(recipe);
  const {width,height,data}=image;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>360000||data.length!==width*height*4) throw new RangeError("지원하지 않는 이미지 크기입니다.");
  const output=new Uint8ClampedArray(data.length);
  const source=gray?Uint8ClampedArray.from(data):data;
  if(gray)for(let i=0;i<source.length;i+=4) source[i]=source[i+1]=source[i+2]=Math.round(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const base=(y*width+x)*4;
    for(let c=0;c<3;c++) {
      let sum=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=source[(bound(y+dy,0,height-1)*width+bound(x+dx,0,width-1))*4+c]*recipe.kernel[(dy+1)*3+dx+1];
      output[base+c]=sum/recipe.divisor+recipe.bias;
    }
    output[base+3]=data[base+3];
  }
  return {width,height,data:output};
}
