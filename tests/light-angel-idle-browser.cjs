'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const deps='C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),{createCanvas,loadImage}=require(deps+'@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],captures=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   let now=0,id=0;const pending=new Map();Object.defineProperty(performance,'now',{value:()=>now});
   requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);
   window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...pending.values()];pending.clear();run.forEach(fn=>fn(now));}while(ms>0);};
  });
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.evaluate(()=>{
   const Original=LightAngelLayeredGrowthRenderer;window.LightAngelLayeredGrowthRenderer=class extends Original{
    constructor(){super();window.r=this;}draw(...args){this.hostArgs=args;return window.paint?super.draw(...args):!this.error;}
   };
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.flow=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(...args){window.session=this;window.result=begin.apply(this,args);return result;};
   Math.random=()=>.1;
   window.drawIdle=()=>{
    Original.prototype.draw.apply(r,r.hostArgs);
    const p=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;let hash=2166136261;
    for(let i=0;i<p.length;i+=4)hash=Math.imul(hash^p[i],16777619)>>>0;
    return {vertices:r.meshes.map(m=>Array.from(m.vertices)),frame:r.frame,layer:r.layerState,art:r.art,gl:r.gl.getError(),error:r.error,hash,clock:r.hostArgs[3].motionTime};
   };
   window.seekIdle=clock=>{
    // Seek the formal host's continuous integrated motion clock only after
    // result confirmation. Its normal rendering and layout path stays active.
    let lo=10,hi=80;for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(LightRankGrowth.sample(mid,result,flow.formationDuration).time<clock)lo=mid;else hi=mid;}
    flow.paused=true;flow.elapsed=(lo+hi)/2;advance(0);return drawIdle();
   };
  });
  const click=id=>page.locator('#'+id).click({force:true});
  await page.locator('#s_master').uncheck({force:true});await page.locator('#s_light').check({force:true});
  for(const rank of ['A','S','SS']){
   await click('tab_probabilities');await page.locator('#rareChance_'+rank).evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await click('btnStart');await page.waitForFunction(()=>window.r?.loaded,null,{polling:100});
   await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(260,360,{steps:6});await page.mouse.up();
   for(let i=0;i<20;i++){await page.evaluate(()=>advance(500));if(await page.evaluate(()=>flow.state==='REVEAL'))break;}
   assert.equal(await page.evaluate(()=>flow.state),'REVEAL');
   const frames=[];
   for(const clock of [14.4,17.1]){
    const frame=await page.evaluate(clock=>seekIdle(clock),clock);frames.push(frame);
    assert.equal(frame.layer.to,rank);assert.equal(frame.layer.progress,1);assert.equal(frame.layer.exposure,0);assert.equal(frame.gl,0);assert.equal(frame.error,'');
    assert.equal(frame.frame.charge+frame.frame.expansion+frame.frame.burst,0,'only resting wings, not the release');
    assert.ok(Math.abs(frame.clock-clock)<1e-7);assert.equal(await page.locator('#fireScanRank').textContent(),rank);
    const file=path.join(root,`artifacts/light-idle-v114-${rank}-${clock}.png`);await page.screenshot({path:file});captures.push(file);
   }
   let moved=0,max=0;for(let side=0;side<2;side++)for(let i=0;i<frames[0].vertices[side].length;i+=4){
    const a=frames[0].vertices[side],b=frames[1].vertices[side];assert.equal(a[i+2],b[i+2]);assert.equal(a[i+3],b[i+3]);
    const d=Math.hypot(a[i]-b[i],a[i+1]-b[i+1]);if(d>2)moved++;max=Math.max(max,d);
   }
   assert.ok(moved>100&&max>8,rank+' real wing mesh moves perceptibly while UVs stay intact');
   const paused=await page.evaluate(()=>{const t=flow.elapsed;advance(1000);return {t,after:flow.elapsed,frame:drawIdle()};});
   assert.equal(paused.t,paused.after);assert.equal(paused.frame.hash,frames[1].hash);assert.deepEqual(paused.frame.vertices,frames[1].vertices);
   const replay=await page.evaluate(()=>seekIdle(14.4));assert.deepEqual(replay.vertices,frames[0].vertices);assert.equal(replay.hash,frames[0].hash);
   assert.ok(await page.evaluate(()=>session.currentResult===result&&Object.isFrozen(result)));
   console.log(rank+' idle formal mesh moved:',{vertices:moved,maxPixels:+max.toFixed(2)});
   await click('effectPreviewBack');
  }
  const sheet=createCanvas(390*2,844*3),ctx=sheet.getContext('2d');for(let i=0;i<captures.length;i++)ctx.drawImage(await loadImage(captures[i]),i%2*390,Math.floor(i/2)*844);
  fs.writeFileSync(path.join(root,'artifacts/light-idle-v114-contact.png'),sheet.toBuffer('image/png'));
  assert.deepEqual(errors,[]);console.log('PASS formal A/S/SS idle: moving wing meshes, unchanged UVs, settled color/ranks, stable pause/replay, immutable results, no GL errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
