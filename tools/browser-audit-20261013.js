async (page) => {
  const checks=[],errors=[],assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);},output="../output/qa-20261013/pixel-kitchen";
  page.on("pageerror",e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
  const settled=()=>page.waitForFunction(()=>!document.querySelector("#run").disabled&&document.querySelector("#result-label").textContent.startsWith("최종"));
  await page.locator("#sample").click();await settled();await page.locator("#reset-pipeline").click();
  await page.getByRole("button",{name:"박스 평균",exact:true}).click();
  await page.locator("#add-kind").selectOption("threshold");await page.locator("#add").click();
  await page.locator("#cutoff").fill("128");await page.locator("#run").click();await settled();
  const distribution=()=>page.locator("#result").evaluate(c=>{
    const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data,values=new Set();
    for(let i=0;i<d.length;i+=4)values.add(d[i]);return [...values].sort((a,b)=>a-b);
  });
  assert(JSON.stringify(await distribution())==="[0,255]","Average then threshold produces only two byte values");
  await page.locator("#up").click();await page.locator("#run").click();await settled();
  const values=await distribution();assert(values.some(n=>n>0&&n<255),"Threshold then average creates intermediate byte values");
  await page.locator("#compare-stage").selectOption("1");await page.locator("#hist-source").selectOption("result");
  await page.locator("#order-experiment summary").click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+"/desktop.png",fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);await page.screenshot({path:output+`/mobile-${width}.png`,fullPage:true});}
  await page.locator("#cutoff").fill("");await page.locator("#run").click();
  assert((await page.locator("#status").innerText()).includes("빈 숫자"),"Empty stage input rejected");
  assert(await page.locator("#export").isDisabled(),"Invalid draft cannot export old pixels");
  assert(errors.length===0,"No uncaught page errors");return {checks,errors,values,screenshots:output};
}
