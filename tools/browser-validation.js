// Optional regression via playwright-cli run-code --filename. Isolated localhost only.
async (page) => {
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  assert(new URL(page.url()).hostname==="127.0.0.1","Use an isolated loopback preview");
  await page.reload();
  const settled=()=>page.waitForFunction(()=>!document.querySelector("#run").disabled&&document.querySelector("#result-label").textContent.startsWith("최종"));
  await settled();
  await page.locator("#bias").fill("12");
  await page.locator("#run").click();await settled();
  assert((await page.locator("#feedback").innerText()).includes("충족"),"First challenge solved through visible inputs");
  await page.locator("#seed").fill("");await page.locator("#new-seed").click();
  assert((await page.locator("#status").innerText()).includes("시드"),"Invalid seed rejected");
  await page.locator("#next").click();await settled();
  assert(await page.locator("#level").inputValue()==="1","Invalid seed must preserve unlocked progression");
  // Switching level uses the applied seed even while the seed editor is blank.
  await page.locator("#level").selectOption("0");await settled();
  assert(await page.locator("#level").inputValue()==="0","Applied seed supports existing level navigation");
  await page.locator("#seed").fill("18");await page.locator("#new-seed").click();await settled();
  assert(await page.locator('#level option[value="1"]').getAttribute("disabled")!==null,"Valid new seed resets progression");
  return {checks:5,status:await page.locator("#status").innerText()};
}
