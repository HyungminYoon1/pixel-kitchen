// Run on integration 4178 using output/playwright/bfcache.config.json.
// Actual local links + browser back; no synthetic PageTransitionEvent dispatch.
async page => {
  const checks=[],errors=[];
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const onError=error=>errors.push(error.message);page.on("pageerror",onError);
  const settled=()=>page.waitForFunction(()=>!document.querySelector("#run").disabled&&document.querySelector("#result-label").textContent.startsWith("최종"));
  const entry=page.url(),origin=new URL(entry).origin;
  const observe=()=>page.evaluate(()=>{
    window.qaBfcache={events:[],cleared:false};
    addEventListener("pagehide",event=>{
      const canvases=[...document.querySelectorAll("canvas")];
      window.qaBfcache.cleared=canvases.every(c=>c.width===1&&c.height===1)&&document.querySelector("#image-file").files.length===0&&document.querySelector("#export").disabled&&document.querySelector("#formula").textContent===""&&document.querySelector("#neighborhood").children.length===0;
      window.qaBfcache.events.push({type:"pagehide",persisted:event.persisted});
    });
    addEventListener("pageshow",event=>window.qaBfcache.events.push({type:"pageshow",persisted:event.persisted}));
  });
  const roundtrip=async (label,startDuringNavigate=false)=>{
    const href=await page.getByRole("link",{name:"WEB LAB",exact:true}).getAttribute("href");
    assert(new URL(href,entry).origin===origin,`${label}: local internal link`);
    if(startDuringNavigate){await page.evaluate(()=>{document.querySelector("#run").click();document.querySelector("nav a").click();});await page.waitForURL(origin+"/web-lab/");}
    else await page.getByRole("link",{name:"WEB LAB",exact:true}).click();
    assert(new URL(page.url()).pathname==="/web-lab/",`${label}: navigated to web-lab`);
    console.log("SNAPSHOT local destination\n"+await page.locator("body").ariaSnapshot());
    await page.goBack({waitUntil:"commit"});await page.waitForURL(entry,{waitUntil:"commit"});await settled();
    const evidence=await page.evaluate(()=>window.qaBfcache);
    assert(evidence?.events.some(e=>e.type==="pagehide"&&e.persisted)&&evidence.events.some(e=>e.type==="pageshow"&&e.persisted),`${label}: actual persisted BFCache roundtrip`);
    assert(evidence.cleared,`${label}: pixels/file input/inspector cleared on leave`);
    assert(await page.locator("#mode").inputValue()==="challenge"&&await page.locator("#seed").inputValue()==="17",`${label}: fresh default challenge`);
    assert(await page.locator("#dimensions").innerText()==="192 × 128",`${label}: synthetic dimensions restored`);
    assert(await page.locator('#level option[value="1"]').getAttribute("disabled")!==null,`${label}: previous progress discarded`);
    assert(!(await page.locator("#export").isDisabled()),`${label}: completed fresh output export enabled`);
    console.log("SNAPSHOT returned workspace\n"+await page.locator("#challenge-panel").ariaSnapshot());
  };
  try {
    await page.addInitScript(()=>{addEventListener("pagehide",()=>{window.qaBusyBeforeCleanup=document.querySelector("#run")?.disabled;});});
    await page.reload();await settled();await observe();
    await page.getByRole("spinbutton",{name:"밝기 더하기",exact:true}).fill("12");
    await page.getByRole("button",{name:"파이프라인 실행",exact:true}).click();await settled();
    assert(await page.locator('#level option[value="1"]').getAttribute("disabled")===null,"progress unlocked before leaving");
    // Visible seed editing is allowed; a blank pending seed must not break return.
    await page.getByRole("spinbutton",{name:"재현 시드",exact:true}).fill("");
    await roundtrip("challenge");
    await page.getByRole("button",{name:"추론 단서 보기",exact:true}).click();
    assert((await page.locator("#hint-text").innerText()).length>0,"hint button works after back");
    await page.getByRole("spinbutton",{name:"밝기 더하기",exact:true}).fill("12");
    await page.getByRole("button",{name:"파이프라인 실행",exact:true}).click();await settled();
    assert((await page.locator("#metrics").innerText()).includes("MAE 0.000 · RMSE 0.000"),"calculation and objective work after back");
    await page.locator("#result").focus();const before=await page.locator("#coordinate").innerText();await page.keyboard.press("ArrowRight");
    assert(before!==await page.locator("#coordinate").innerText(),"pixel inspector works after back");
    const image=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=4;c.height=2;const ctx=c.getContext("2d");ctx.fillStyle="#df2375";ctx.fillRect(0,0,4,2);return c.toDataURL("image/png").split(",")[1];});
    await page.locator("#image-file").setInputFiles({name:"private-fixture.png",mimeType:"image/png",buffer:Buffer.from(image,"base64")});
    await page.waitForFunction(()=>document.querySelector("#dimensions").textContent==="4 × 2");await settled();
    assert(await page.locator("#mode").inputValue()==="lab","actual local PNG imported into lab");
    await roundtrip("imported image");
    const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"최종 PNG 저장",exact:true}).click();const download=await downloadPromise;
    assert(await download.failure()===null,"fresh synthetic PNG download after private file discarded");
    await roundtrip("repeated return");
    await page.getByRole("button",{name:"샘플 복원",exact:true}).click();await settled();
    assert(await page.locator("#dimensions").innerText()==="600 × 400","sample button works after repeated back");
    for(let i=0;i<3;i++){await page.getByRole("combobox",{name:"추가할 연산",exact:true}).selectOption("kernel");await page.getByRole("button",{name:"단계 추가",exact:true}).click();}
    // Controlled scheduler delay, not a fabricated pagehide/pageshow event.
    await page.evaluate(()=>{const timer=window.setTimeout;window.setTimeout=(callback,delay,...args)=>{window.setTimeout=timer;if(delay===0){window.qaReleaseRun=()=>callback(...args);return 0;}return timer(callback,delay,...args);};});
    await roundtrip("in-flight calculation",true);
    assert(await page.evaluate(()=>window.qaBusyBeforeCleanup),"controlled scheduling: navigation interrupted in-flight calculation");
    await page.evaluate(()=>{window.qaReleaseRun();delete window.qaReleaseRun;});
    await page.waitForTimeout(30);
    await page.getByRole("button",{name:"파이프라인 실행",exact:true}).click();await settled();
    assert(!(await page.locator("#export").isDisabled()),"old calculation cannot disable fresh workspace");
    assert(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0&&document.cookie===""),"no browser storage retention");
    assert(errors.length===0,"no uncaught page errors in fixed roundtrips");
    return {evidence:"BROWSER_LOCAL actual BFCache with default disabling flag removed; in-flight row scheduling is a test double",count:checks.length,checks,errors};
  }finally {page.off("pageerror",onError);}
}
