// Actual BFCache navigation in an isolated browser with BFCache enabled.
// The external navigation link is mapped to a loopback page in this QA DOM only.
async (page) => {
  const checks=[],assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const entry=page.url(),origin=new URL(entry).origin;
  assert(new URL(entry).hostname==="127.0.0.1","Loopback only");
  const settled=()=>page.waitForFunction(()=>document.querySelector("#result-label")?.textContent.startsWith("최종")&&!document.querySelector("#run").disabled);
  await settled();await page.locator("#bias").fill("12");await page.locator("#run").click();await settled();
  assert(await page.locator('#level option[value="1"]').getAttribute("disabled")===null,"Progress unlocked through an actual answer");
  await page.locator("#seed").fill("");
  await page.evaluate(()=>{window.qaReturn=[];for(const type of ["pagehide","pageshow"])addEventListener(type,e=>window.qaReturn.push({type,persisted:e.persisted}));});
  await page.locator("nav a").first().evaluate((el,href)=>el.href=href,origin+"/packet-journey/");
  await page.locator("nav a").first().click();await page.waitForURL(origin+"/packet-journey/");
  await page.goBack({waitUntil:"commit"});await page.waitForURL(entry,{waitUntil:"commit"});await settled();
  const events=await page.evaluate(()=>window.qaReturn);
  assert(events?.some(e=>e.type==="pagehide"&&e.persisted)&&events.some(e=>e.type==="pageshow"&&e.persisted),"Actual persisted BFCache return");
  assert(await page.locator("#seed").inputValue()==="17","Return restores the explicit valid default seed");
  assert(await page.locator('#level option[value="1"]').getAttribute("disabled")!==null,"Return discards transient progress");
  await page.locator("#hint").click();assert((await page.locator("#hint-text").innerText()).length>0,"Fresh challenge hint works");
  await page.locator("#bias").fill("12");await page.locator("#run").click();await settled();
  assert((await page.locator("#metrics").innerText()).includes("MAE 0.000"),"Fresh challenge can be solved after return");
  return {checks,events,linkMapping:"In-memory loopback QA fixture, no source/gallery edits"};
}
