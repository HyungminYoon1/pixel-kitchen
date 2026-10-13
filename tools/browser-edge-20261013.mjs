import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
const require=createRequire(resolve(process.env.PLAYWRIGHT_PACKAGE||"../output/playwright/implement-20261012/package.json"));
const {chromium}=require("playwright");
const app=basename(process.cwd()),base=process.env.EDGE_BASE_URL||"http://127.0.0.1:59540";
assert.equal(new URL(base).hostname,"127.0.0.1","isolated loopback only");
const out=resolve("output/playwright/edge-20261013");await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--mute-audio"]});
const checks=[],errors=[];
const check=(value,label)=>{assert(value,label);checks.push(label);};
async function click(page,selector,width){const el=page.locator(selector);if(width<500)await el.tap();else await el.click();}
async function settled(page){await page.waitForFunction(()=>!document.querySelector("#run").disabled&&document.querySelector("#result-label").textContent.startsWith("최종"));}
async function finishTrace(page){for(let i=0;i<150&&!await page.locator("#step").isDisabled();i++)await page.locator("#step").click();assert(await page.locator("#step").isDisabled());}
async function choose(page,label){await page.locator("#operation-choices button").filter({has:page.getByText(label,{exact:true})}).click();await finishTrace(page);}
async function mainFlow(page,width){

  await settled(page);await page.locator("#bias").fill("12");await page.locator("#run").focus();await page.keyboard.press("Enter");await settled(page);
  check(!(await page.locator("#next").isDisabled()),width+": seed17 objective solved with real editor input");
  await click(page,"#sample",width);await settled(page);
  await page.locator("#bias").fill("");await click(page,"#run",width);
  check((await page.locator("#status").innerText()).includes("빈 숫자"),width+": empty input rejects");
  check(await page.locator("#export").isDisabled(),width+": invalid draft cannot export stale pixels");
  await page.locator("#bias").fill("0");await click(page,"#run",width);await settled(page);
  await page.locator("#recipe-file").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from("{")});
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("JSON"));
  check((await page.locator("#result-label").innerText()).startsWith("최종"),width+": malformed recipe preserves calculated result");
  await page.locator("#recipe-file").setInputFiles({name:"oversize.json",mimeType:"application/json",buffer:Buffer.alloc(8193,32)});
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("8 KiB"));
  check(!(await page.locator("#export").isDisabled()),width+": oversize recipe preserves exportable output");
  await click(page,"#preset-save",width);await click(page,"#preset-load",width);await click(page,"#run",width);await settled(page);
  const downloadPromise=page.waitForEvent("download");await click(page,"#recipe-export",width);const download=await downloadPromise;
  await download.saveAs(out+"/recipe-"+width+".json");
  check(download.suggestedFilename()==="pixel-kitchen-recipe-v1.json",width+": explicit settings download");
  await page.locator("#result").focus();await page.keyboard.press("ArrowRight");
  check((await page.locator("#coordinate").innerText()).includes("301"),width+": keyboard pixel inspector");

}
async function fixtures(browser) {

  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:"reduce"});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));page.setDefaultTimeout(15000);

  try{
    // Controlled asynchronous fixture: native decoder runs after explicit release.
    await page.addInitScript(()=>{
      const decode=window.createImageBitmap.bind(window);
      window.createImageBitmap=(...args)=>new Promise((resolve,reject)=>{
        window.qaDecodeRelease=()=>decode(...args).then(bitmap=>{
          const close=bitmap.close.bind(bitmap);bitmap.close=()=>{window.qaClosed=(window.qaClosed||0)+1;close();};resolve(bitmap);
        },reject);
      });
      const read=File.prototype.text;
      File.prototype.text=function(){return new Promise((resolve,reject)=>{window.qaReadRelease=()=>read.call(this).then(resolve,reject);});};
    });
    await page.goto(base+"/"+app+"/");await settled(page);
    const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=1;c.height=1;c.getContext("2d").fillRect(0,0,1,1);return c.toDataURL("image/png").split(",")[1];}),"base64");
    await page.locator("#image-file").setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:png});
    await page.waitForFunction(()=>typeof window.qaDecodeRelease==="function");
    await page.locator("#cancel-import").tap();await page.locator("#sample").tap();await settled(page);
    await page.evaluate(()=>window.qaDecodeRelease());await page.waitForFunction(()=>window.qaClosed===1);
    check((await page.locator("#dimensions").innerText())==="600 × 400","TEST_DOUBLE canceled late native decode closed without replacing sample");
    await page.locator("#recipe-file").setInputFiles({name:"fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({version:1,model:"pixel-kitchen-byte-v1",stages:[{kind:"threshold",cutoff:255}]}))});
    await page.waitForFunction(()=>typeof window.qaReadRelease==="function");
    await page.locator("#sample").tap();await settled(page);await page.evaluate(()=>window.qaReadRelease());await page.waitForTimeout(100);
    check((await page.locator("#stage-list").innerText()).includes("샤프닝"),"TEST_DOUBLE stale recipe cannot replace reset workspace");
    // Readback no-op fixture tests actual UI error handling.
    await page.evaluate(()=>{Storage.prototype.setItem=function(){};});
    await page.locator("#preset-save").tap();
    check((await page.locator("#preset-status").innerText()).includes("저장"),"TEST_DOUBLE unconfirmed preset save displays error");
    check((await page.locator("#saved-presets option").count())<=1,"TEST_DOUBLE unconfirmed save adds no preset");
    await page.screenshot({path:out+"/storage-readback.png",fullPage:true});
  }finally{await context.close();}
}

try{
  for(const width of process.env.EDGE_FIXTURES_ONLY?[]:[1440,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<500,isMobile:width<500,reducedMotion:"reduce"});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on("pageerror",e=>errors.push(e.message));
    try{
      await page.goto(base+"/"+app+"/");
      await mainFlow(page,width);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+": no horizontal overflow");
      await page.screenshot({path:out+"/viewport-"+width+".png",fullPage:true});
    }catch(e){await page.screenshot({path:out+"/FAIL-"+width+".png",fullPage:true});throw e;}finally{await context.close();}
  }
  await fixtures(browser);
  check(errors.length===0,"no uncaught browser exceptions");
}finally{
  await writeFile(out+"/browser.json",JSON.stringify({app,checks,errors,fixtureNote:"Only named injected timing/storage fixtures are TEST_DOUBLE. Main UI uses actual browser input.",remoteCI:"NOT_RUN",live:"NOT_RUN"},null,2));
  await browser.close();
}
console.log(JSON.stringify({app,checks:checks.length,errors}));
