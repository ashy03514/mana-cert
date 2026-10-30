'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
  await page.addInitScript(()=>{
   let t=0,id=0;const jobs=new Map();requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};cancelAnimationFrame=id=>jobs.delete(id);
   Object.defineProperty(performance,'now',{value:()=>t});window.tick=()=>{t+=16;const frames=[...jobs.values()];jobs.clear();frames.forEach(fn=>fn(t));};
  });
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.evaluate(()=>{
   window.artCalls={};window.beginCount=0;
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.checkFlow=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(settings){beginCount++;begin.call(this,settings);this.currentResult=Object.freeze({type:'magic',element:window.target,rank:'SS',mana:999});window.checkSession=this;window.committedResult=this.currentResult;return this.currentResult;};
   const hook=(C,key,index)=>{const draw=C.prototype.draw;C.prototype.draw=function(...args){const ok=draw.apply(this,args),frame=args[index];if(ok&&frame?.box)artCalls[key||this.element]={box:{...frame.box},ok,instance:this};return ok;};};
   hook(ElementMaterialRenderer,null,4);hook(WaterOceanReveal,'water',4);hook(WindTornadoRenderer,'wind',4);hook(EarthMountainRenderer,'earth',4);
   hook(LightAngelLayeredGrowthRenderer,'light',3);hook(DarkDemonWingGrowthRenderer,'dark',3);
  });
  const elements=[['火','fire'],['水','water'],['風','wind'],['土','earth'],['光','light'],['暗','dark']];
  for(const [element,key]of elements){
   await page.evaluate(e=>{window.target=e;window.artCalls={};},element);await page.locator('#btnStart').click({force:true});
   await page.evaluate(()=>{checkFlow.state='REVEAL';checkFlow.elapsed=20;tick();});
   await page.waitForFunction(key=>{tick();return !!artCalls[key]?.ok;},key,{polling:100});
   for(const [width,height,safe]of [[390,844,34],[320,568,0],[844,390,0]]){
    await page.locator('#formalReplay').evaluate((el,safe)=>{el.style.bottom=(28+safe)+'px';},safe);
    await page.setViewportSize({width,height});await page.evaluate(()=>{dispatchEvent(new Event('resize'));tick();});
    const observed=await page.evaluate(key=>{
     const call=artCalls[key],title=revealTitle.getBoundingClientRect(),value=fireScanValue.getBoundingClientRect(),rank=fireScanRank.getBoundingClientRect(),button=formalReplay.getBoundingClientRect();
     const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom});
     const renderer=call.instance,gl=renderer.gl||renderer.surface?.gl;
     return {box:call.box,envelope:ResultLayout.bounds(call.box,key),title:rect(title),value:rect(value),rank:rect(rank),button:rect(button),
      ok:call.ok,error:renderer.error||'',glError:gl?.getError?.()??0,
      placement:key==='water'?renderer.placement:null,
      result:checkSession.currentResult,same:checkSession.currentResult===committedResult,frozen:Object.isFrozen(committedResult),
      rankText:fireScanRank.textContent,valueText:fireScanValue.textContent,
      clickable:!!document.elementFromPoint(button.x+button.width/2,button.y+button.height/2)?.closest('#formalReplay')};
    },key);
    const label=key+' '+width+'x'+height+' safe'+safe;
    assert.equal(observed.ok,true,label+' actual renderer succeeds');assert.equal(observed.error,'');assert.equal(observed.glError,0);
    for(const name of ['title','value','rank','button']){const r=observed[name];assert.ok(r.x>=-1&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,label+' '+name+' fits');}
    assert.ok(observed.title.bottom<observed.value.y&&observed.value.bottom<observed.rank.y&&observed.rank.bottom<observed.button.y,label+' text rows do not overlap');
    if(width>=height*1.35){assert.ok(observed.envelope.right<Math.min(observed.title.x,observed.value.x,observed.rank.x)-6,label+' left subject clears right readout');}
    else{assert.ok(observed.envelope.bottom<=observed.title.y-20,label+' complete subject clears attribute title');}
    if(observed.placement)assert.ok(observed.placement.rootY<=observed.envelope.bottom,label+' actual water root included in envelope');
    assert.equal(observed.same,true);assert.equal(observed.frozen,true);assert.deepEqual(observed.result,{type:'magic',element,rank:'SS',mana:999});
    assert.equal(observed.rankText,'SS');assert.equal(observed.valueText,'999');assert.equal(observed.clickable,true);
    await page.screenshot({path:path.resolve('artifacts/result-composition-'+key+'-'+width+'x'+height+'-safe'+safe+'.png')});
   }
   const before=await page.evaluate(()=>beginCount);await page.locator('#formalReplay').click({force:true});
   assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),true);assert.equal(await page.evaluate(()=>beginCount),before);
   await page.locator('#btnGoHome').click({force:true});assert.equal(await page.locator('body').getAttribute('data-state'),'SETTINGS');
  }
  assert.deepEqual(errors,[]);console.log('PASS real six-element SS renderer envelopes clear title/readout, three viewports with 34px safe area, immutable 999 SS results and accessible action menu.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
