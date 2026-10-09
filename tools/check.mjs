import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve("dist");
const textFiles=[];
let count = 0;
async function walk(dir) {
  for (const e of await readdir(dir, {withFileTypes:true})) {
    const p = resolve(dir,e.name);
    if(e.isDirectory()) { await walk(p); continue; }
    count++;
    if(/\.(js|css|html)$/.test(e.name)) {
      textFiles.push(p);
      const bytes=await readFile(p);
      assert(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),"Unexpected BOM");
    }
    if(e.name.endsWith(".js")) {
      execFileSync(process.execPath,["--check",p],{stdio:"inherit"});
      const js=await readFile(p,"utf8");
      assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|eval)\s*(?:\(|\.)/.test(js),"Unexpected network, persistence or eval API");
      for(const [,ref] of js.matchAll(/\bfrom\s+"(\.\/[^"\n]+)"/g)) await readFile(resolve(dirname(p),ref));
      if(["model.js","challenges.js"].includes(e.name)) assert(!/\b(?:document|window|navigator|ImageData|setTimeout|performance)\b/.test(js),"Pure calculation boundary broken");
    }
    if(!e.name.endsWith(".html")) continue;
    const html=await readFile(p,"utf8");
    assert(html.includes('lang="ko"')&&html.includes('name="viewport"')&&html.includes('<title>'),"Missing metadata");
    assert(html.includes("connect-src 'none'")&&html.includes("object-src 'none'"),"Missing connection policy");
    assert(!/<iframe\b|\son\w+=/i.test(html),"Inline execution or frame");
    for(const [,ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if(/^(https?:|data:)/.test(ref)) continue;
      const target=resolve(dirname(p),ref.endsWith("/")?ref+"index.html":ref);
      assert(target.startsWith(root+sep),"Asset escaped dist");
      await readFile(target);
    }
  }
}
await walk(root);
for(const dir of ["test","tools","docs"])for(const name of await readdir(dir))if(/\.(js|mjs|md)$/.test(name))textFiles.push(resolve(dir,name));
textFiles.push(...["README.md","architecture.md","package.json",".gitattributes",".gitignore"].map(p=>resolve(p)));
for(const path of textFiles){const bytes=await readFile(path);assert(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),`Unexpected BOM: ${path}`);const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);assert(!/(?<!\r)\n/.test(text),`Expected CRLF: ${path}`);}
console.log(`PASS: ${count} public files; syntax, imports, metadata, CSP, pure model boundaries; ${textFiles.length} text files UTF-8 without BOM / CRLF.`);
