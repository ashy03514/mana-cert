'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage();await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    const result=await page.evaluate(async()=>{
      const r=new LightAngelLayeredGrowthRenderer();await r.ready;const c=document.createElement('canvas');c.width=390;c.height=844;
      r.initGrowth=()=>{throw Error('Injected growth shader allocation failure');};
      const ok=r.draw(c.getContext('2d'),390,844,{time:2,growth:.5,motionTime:2});
      const out={ok,error:r.error,released:r.program===null&&r.growthMeshes.length===0};r.dispose();return out;
    });
    assert.equal(result.ok,false);assert.match(result.error,/羽翼生長/);assert.equal(result.released,true);
    console.log('PASS growth initialization failure is contained, reports an error and releases GPU resources.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
