import {kernelStage,runPipeline,validatePipeline,compareImages} from "./model.js";

export const objectives=Object.freeze([
  {title:"01 / 평탄부의 단서",maxPasses:1,allowed:["kernel"],mae:.25,rmse:.5,
    brief:"한 번의 밝기 이동을 복원하세요. 중앙 계수 1, 나누기 1, 흑백 끔. 밝기 0–48만 바꿀 수 있습니다.",
    hint:"평탄한 곳의 원본과 목표 RGB를 비교하세요. 경계의 모양이 그대로라면 주변 계수는 필요 없습니다."},
  {title:"02 / 점이 퍼지는 모양",maxPasses:1,allowed:["kernel"],mae:.5,rmse:1,
    brief:"양수 3×3 평균 커널을 복원하세요. 계수 합 = 나누기, 밝기 0, 흑백 끔. 한 단계로 끝내세요.",
    hint:"밝은 점 주변의 퍼짐을 검사하세요. 모서리·변·중앙의 비율이 다릅니다. [1, m, 1]의 세로·가로 곱으로 대칭 평균을 만들 수 있습니다. m은 시드마다 다릅니다."},
  {title:"03 / 부호가 말하는 방향",maxPasses:2,allowed:["kernel","sobel"],mae:.6,rmse:1.5,
    brief:"평균 커널 → 방향 Sobel, 정확히 두 단계입니다. 목표의 회색 128은 변화가 없는 곳입니다. 방향과 증폭을 추론하세요.",
    hint:"X는 좌우 변화, Y는 상하 변화입니다. 밝아지는 경계와 어두워지는 경계의 부호를 보세요. 먼저 잡음을 평균으로 줄이세요."},
  {title:"04 / 순서는 교환되지 않는다",maxPasses:2,allowed:["kernel","threshold"],mae:.6,rmse:1.5,
    brief:"평균 커널과 문턱값을 각각 한 번 씁니다. 순서는 직접 정하세요. 목표 가장자리의 중간 회색을 설명해야 합니다.",
    hint:"문턱값이 마지막이면 결과는 0 또는 255뿐입니다. 목표에 중간 회색이 있으면 순서를 다시 생각하세요."},
  {title:"05 / 경계 지도 조립",maxPasses:4,allowed:["kernel","sobel","threshold"],mae:.8,rmse:2,
    brief:"평균 2회, Sobel 크기 1회, 문턱값 1회를 조립하세요. 정확히 네 단계. 잡음 억제·경계 검출·선택·펴기 순서를 추론하세요.",
    hint:"크기는 √(Gx²+Gy²)입니다. 가는 잡음 선이 많으면 Sobel 앞 평균, 선 끝이 계단이면 문턱값 뒤 평균을 검토하세요."}
]);
function generator(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function syntheticImage(seed=17,width=192,height=128) {
  if(!Number.isInteger(seed)||seed<0||seed>999999||!Number.isInteger(width)||!Number.isInteger(height)||width<24||height<24||width>720||height>480)throw new RangeError("합성 입력 범위를 확인하세요.");
  const random=generator(seed),data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const u=x/width,v=y/height,i=(y*width+x)*4,noise=Math.round((random()-.5)*24);
    let value=30+u*125+v*25;
    if(u>.1&&u<.35&&v>.18&&v<.75)value=195;
    if((u-.68)**2+(v-.48)**2<.13**2)value=55;
    if(v>.8)value=Math.floor(x/4)%2?225:40;
    if(x===Math.floor(width*.48)&&y===Math.floor(height*.3))value=255;
    data[i]=value+noise;data[i+1]=value+noise+(u>.5?18:0);data[i+2]=value+noise+(v<.5?12:0);data[i+3]=255;
  }
  return {width,height,data};
}
export function createChallenge(level,seed) {
  if(!Number.isInteger(level)||level<0||level>=objectives.length)throw new RangeError("과제 번호를 확인하세요.");
  const source=syntheticImage(seed),random=generator(seed+71),pick=values=>values[Math.floor(random()*values.length)];
  const m=pick([2,3,4]),average={...kernelStage(),name:"대칭 평균",kernel:[1,m,1,m,m*m,m,1,m,1],divisor:(m+2)**2};
  let solution;
  if(level===0)solution=[{...kernelStage(),bias:pick([12,24,36])}];
  if(level===1)solution=[average];
  if(level===2)solution=[average,{kind:"sobel",direction:pick(["x","y"]),gain:pick([.5,1,1.5])}];
  if(level===3)solution=[{kind:"threshold",cutoff:pick([96,128,160])},average];
  if(level===4)solution=[average,{kind:"sobel",direction:"magnitude",gain:pick([.75,1,1.25])},{kind:"threshold",cutoff:pick([40,60,80])},
    {...kernelStage(),name:"방향 평균",kernel:pick([[0,0,0,1,2,1,0,0,0],[0,1,0,0,2,0,0,1,0]]),divisor:4}];
  return {level,seed,source,target:runPipeline(source,solution).output,solution,objective:objectives[level]};
}
export function constraintFailure(challenge,stages) {
  const {level,objective}=challenge;
  validatePipeline(challenge.source,stages);
  if(stages.length>objective.maxPasses||stages.some(s=>!objective.allowed.includes(s.kind)))return "이 과제의 단계 수와 허용 연산을 확인하세요.";
  if(level===0){const s=stages[0];if(s.gray||s.divisor!==1||s.bias<0||s.bias>48||s.kernel.some((v,i)=>v!==(i===4?1:0)))return "첫 과제는 중앙 1·나누기 1·흑백 끔을 유지하고 밝기 0–48만 조절하세요.";}
  else {
    for(const s of stages)if(s.kind==="kernel"&&(s.gray||s.bias!==0||s.kernel.some(v=>v<0)||Math.abs(s.kernel.reduce((a,b)=>a+b,0)-s.divisor)>1e-8))return "평균 커널은 음수 없이, 계수 합 = 나누기, 밝기 0, 흑백 끔이어야 합니다.";
    if(level===2&&(stages.length!==2||stages[0].kind!=="kernel"||stages[1].kind!=="sobel"||stages[1].direction==="magnitude"))return "평균 커널 → X 또는 Y Sobel, 두 단계가 필요합니다.";
    if(level===3&&(stages.length!==2||stages.filter(s=>s.kind==="threshold").length!==1||stages.filter(s=>s.kind==="kernel").length!==1))return "평균과 문턱값을 각각 한 번 사용하세요. 순서가 결과를 바꿉니다.";
    if(level===4&&(stages.length!==4||stages.filter(s=>s.kind==="kernel").length!==2||stages.filter(s=>s.kind==="threshold").length!==1||stages.filter(s=>s.kind==="sobel"&&s.direction==="magnitude").length!==1))return "평균 2회·Sobel 크기 1회·문턱값 1회가 필요합니다.";
  }
  return null;
}
export function assessChallenge(challenge,stages,output,previousMae=null) {
  const metrics=compareImages(output,challenge.target),constraint=constraintFailure(challenge,stages),o=challenge.objective;
  const passed=!constraint&&metrics.mae<=o.mae&&metrics.rmse<=o.rmse&&metrics.alphaMae===0;
  let feedback=constraint|| (passed?"허용 연산과 두 오차 기준을 충족했습니다. 같은 규칙을 다음 과제에 적용해 보세요.":
    Math.abs(metrics.bias)>3?`평균 부호 오차 ${metrics.bias.toFixed(2)}: 양수는 목표보다 밝음, 음수는 어두움입니다. 평탄부와 밝기·증폭부터 검사하세요.`:
    "평탄부보다 경계의 차이가 큰지 차이 지도를 보세요. 평균 비율·Sobel 방향·문턱값·단계 순서를 한 번에 하나씩 바꿔 비교하세요.");
  if(previousMae!==null&&!passed)feedback+=` 이전 시도 대비 MAE ${metrics.mae<previousMae?"감소":"증가 또는 동일"} (${(metrics.mae-previousMae).toFixed(3)}).`;
  return {metrics,passed,feedback};
}
