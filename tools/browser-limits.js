// Additional LOCAL resource/import QA. Controlled import delays are test doubles.
async (page) => {
  const checks=[],assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const settled=()=>page.waitForFunction(()=>!document.querySelector("#run").disabled&&document.querySelector("#result-label").textContent.startsWith("최종"));
  const add=async(kind)=>{await page.getByRole("combobox",{name:"추가할 연산",exact:true}).selectOption(kind);await page.getByRole("button",{name:"단계 추가",exact:true}).click();};
  await page.reload();await settled();
  const fixtures=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=1440;canvas.height=960;const ctx=canvas.getContext("2d");ctx.fillStyle="#ff813a";ctx.fillRect(0,0,canvas.width,canvas.height);return ["image/png","image/jpeg","image/webp"].map(type=>({type,data:canvas.toDataURL(type).split(",")[1]}));});
  for(const [index,fixture] of fixtures.entries()){
    await page.locator("#image-file").setInputFiles({name:["large.png","large.jpg","large.webp"][index],mimeType:fixture.type,buffer:Buffer.from(fixture.data,"base64")});
    await page.waitForFunction(()=>document.querySelector("#dimensions").textContent==="720 × 480"&&document.querySelector("#cancel-import").disabled&&!document.querySelector("#run").disabled);
    await settled();
    assert((await page.locator("#dimensions").innerText())==="720 × 480",`actual ${fixture.type} import resized to cap`);
  }
  for(let i=0;i<3;i++)await add("kernel");
  await page.getByRole("button",{name:"파이프라인 실행",exact:true}).click();await settled();
  const timing=await page.locator("#progress").innerText();assert(timing.includes("37.32M / 40M"),"max canvas four kernel passes within work budget");
  await page.getByRole("button",{name:"순서 초기화",exact:true}).click();
  await add("sobel");await add("sobel");await add("sobel");
  await page.getByRole("button",{name:"파이프라인 실행",exact:true}).click();
  assert((await page.locator("#status").innerText()).includes("예산"),"over-budget pipeline rejected before processing");
  assert(await page.getByRole("button",{name:"최종 PNG 저장",exact:true}).isDisabled(),"over-budget pipeline cannot export");
  // Keep real decoding but delay completion to deterministically exercise cancellation.
  await page.evaluate(()=>{window.qaDecode=createImageBitmap;window.createImageBitmap=async file=>{const bitmap=await window.qaDecode(file);return new Promise(resolve=>{window.qaRelease=()=>resolve(bitmap);});};});
  await page.locator("#image-file").setInputFiles({name:"delayed.png",mimeType:"image/png",buffer:Buffer.from(fixtures[0].data,"base64")});
  await page.waitForFunction(()=>typeof window.qaRelease==="function");
  assert(!(await page.getByRole("button",{name:"사진 읽기 취소",exact:true}).isDisabled()),"pending decode can be explicitly cancelled");
  await page.locator("#image-file").setInputFiles({name:"second.png",mimeType:"image/png",buffer:Buffer.from(fixtures[0].data,"base64")});
  assert((await page.locator("#status").innerText()).includes("이미 사진"),"only one decoder in flight");
  await page.getByRole("button",{name:"사진 읽기 취소",exact:true}).click();
  assert((await page.locator("#status").innerText()).includes("취소"),"explicit import cancellation feedback");
  await page.getByRole("button",{name:"샘플 복원",exact:true}).click();await settled();
  await page.evaluate(()=>{window.qaRelease();window.createImageBitmap=window.qaDecode;delete window.qaRelease;delete window.qaDecode;});
  await page.waitForTimeout(80);
  assert((await page.locator("#dimensions").innerText())==="600 × 400","controlled late import cannot replace restored sample");
  await page.evaluate(()=>{window.qaDecode=createImageBitmap;window.qaClosed=false;window.createImageBitmap=async()=>({width:5000,height:5000,close(){window.qaClosed=true;}});});
  await page.locator("#image-file").setInputFiles({name:"decoded-limit.png",mimeType:"image/png",buffer:Buffer.from(fixtures[0].data,"base64")});
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("2,400만"));
  assert(await page.evaluate(()=>window.qaClosed),"controlled decoded >24MP rejected and bitmap closed");
  await page.evaluate(()=>{window.createImageBitmap=window.qaDecode;delete window.qaDecode;delete window.qaClosed;});
  await page.getByRole("combobox",{name:"작업 모드",exact:true}).selectOption("challenge");await settled();
  await page.getByRole("spinbutton",{name:"재현 시드",exact:true}).fill("991");
  assert((await page.locator("#seed-label").innerText()).includes("적용 시드 17"),"unapplied seed explicitly labelled");
  await page.getByRole("button",{name:"시드로 처음부터",exact:true}).click();await settled();
  assert((await page.locator("#seed-label").innerText()).includes("적용 시드 991"),"new seed applied explicitly");
  assert(await page.locator('#level option[value="4"]').getAttribute("disabled")!==null,"new seed resets progression");
  return {evidence:"BROWSER_LOCAL desktop; delayed decode and >24MP dimensions are test doubles",count:checks.length,checks,maxCanvasTiming:timing,physicalMobile:"NOT_RUN"};
}
