'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:435,height:941},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
  await page.addInitScript(()=>{
   let t=0,id=0;const jobs=new Map();requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};cancelAnimationFrame=id=>jobs.delete(id);
   Object.defineProperty(performance,'now',{value:()=>t});window.tick=()=>{t+=16;const frames=[...jobs.values()];jobs.clear();frames.forEach(fn=>fn(t));};
  });
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.evaluate(()=>{
   window.artCalls={};window.layoutCalls={};window.beginCount=0;
   const layout=ResultLayout;window.ResultLayout={...layout,compose(...args){
    const result=layout.compose(...args),options=args[3];
    layoutCalls[options.element]={source:{...args[2].box},box:{...result.box},composition:result.composition};return result;
   }};
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.checkFlow=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(settings){beginCount++;begin.call(this,settings);this.currentResult=Object.freeze({type:'magic',element:window.target,rank:'SS',mana:999});window.checkSession=this;window.committedResult=this.currentResult;return this.currentResult;};
   const hook=(C,key,index)=>{const draw=C.prototype.draw;C.prototype.draw=function(...args){const ok=draw.apply(this,args),frame=args[index];if(ok&&frame?.box)artCalls[key||this.element]={box:{...frame.box},ok,instance:this};return ok;};};
   hook(ElementMaterialRenderer,null,4);hook(WaterOceanReveal,'water',4);hook(WindTornadoRenderer,'wind',4);hook(EarthMountainRenderer,'earth',4);
   hook(LightAngelLayeredGrowthRenderer,'light',3);hook(DarkDemonWingGrowthRenderer,'dark',3);
  });
  const elements=[['火','fire'],['水','water'],['風','wind'],['土','earth'],['光','light'],['暗','dark']];
  for(const [element,key]of elements){
   await page.evaluate(e=>{window.target=e;window.artCalls={};window.layoutCalls={};},element);await page.locator('#btnStart').click({force:true});
   await page.evaluate(()=>{checkFlow.state='REVEAL';checkFlow.elapsed=20;tick();});
   await page.waitForFunction(key=>{tick();return !!artCalls[key]?.ok;},key,{polling:100});
   for(const [width,height,safe]of [[435,941,34]]){
    await page.locator('#formalReplay').evaluate((el,safe)=>{el.style.bottom=(28+safe)+'px';},safe);
    await page.setViewportSize({width,height});await page.evaluate(()=>{dispatchEvent(new Event('resize'));tick();});
    const observed=await page.evaluate(key=>{
     const call=artCalls[key],title=revealTitle.getBoundingClientRect(),value=fireScanValue.getBoundingClientRect(),rank=fireScanRank.getBoundingClientRect(),button=formalReplay.getBoundingClientRect();
     const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom});
     const renderer=call.instance,gl=renderer.gl||renderer.surface?.gl;
     return {box:call.box,layout:layoutCalls[key],envelope:ResultLayout.bounds(call.box,key),title:rect(title),value:rect(value),rank:rect(rank),button:rect(button),
      ok:call.ok,error:renderer.error||'',glError:gl?.getError?.()??0,
      placement:key==='water'?renderer.placement:null,
      circleBottom:key==='light'?(()=>{const art=renderer.layout(innerWidth,innerHeight,call.box);return art.cy+art.unit*.89;})():null,
      result:checkSession.currentResult,same:checkSession.currentResult===committedResult,frozen:Object.isFrozen(committedResult),
      rankText:fireScanRank.textContent,valueText:fireScanValue.textContent,
      clickable:!!document.elementFromPoint(button.x+button.width/2,button.y+button.height/2)?.closest('#formalReplay')};
    },key);
    const label=key+' '+width+'x'+height+' safe'+safe;
    await page.screenshot({path:path.resolve('artifacts/result-composition-'+key+'-'+width+'x'+height+'-safe'+safe+'.png')});
    console.log(label,JSON.stringify({native:observed.layout.source,rendered:observed.box,effectBottom:observed.envelope.bottom,
     title:observed.title.y,value:observed.value.y,rank:observed.rank.y,button:observed.button.y}));
    assert.equal(observed.box.width,observed.layout.source.width,label+' preserves original attribute width');
    assert.equal(observed.box.height,observed.layout.source.height,label+' preserves original attribute height');
    assert.equal(observed.ok,true,label+' actual renderer succeeds');assert.equal(observed.error,'');assert.equal(observed.glError,0);
    for(const name of ['title','value','rank','button']){const r=observed[name];assert.ok(r.x>=-1&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,label+' '+name+' fits');}
    assert.ok(observed.title.bottom<observed.value.y&&observed.value.bottom<observed.rank.y&&observed.rank.bottom<observed.button.y,label+' text rows do not overlap');
    const subjectGap=observed.title.y-observed.envelope.bottom;
    assert.ok(subjectGap>=12,label+' full-sized subject clears the title');
    assert.ok(subjectGap<=36,label+' title stays close to the visible subject instead of leaving a large empty band');
    if(observed.placement)assert.ok(observed.placement.rootY<=observed.envelope.bottom,label+' actual water root included in envelope');
    if(observed.circleBottom!==null)assert.ok(observed.circleBottom<=observed.title.y-12,label+' actual holy halo clears attribute title');
    assert.equal(observed.same,true);assert.equal(observed.frozen,true);assert.deepEqual(observed.result,{type:'magic',element,rank:'SS',mana:999});
    assert.equal(observed.rankText,'SS');assert.equal(observed.valueText,'999');assert.equal(observed.clickable,true);
    const decorative=await page.evaluate(()=>{
     const host=fireScanRank,number=fireScanValue.getBoundingClientRect(),button=formalReplay.getBoundingClientRect(),violations=[];
     for(let time=20;time<=26;time+=.2){
      RankLettering.apply(host,'SS',time);
      for(const star of host.querySelectorAll('.rankSpark')){
       if(Number(star.style.opacity)<.04)continue;
       const b=star.getBoundingClientRect();
       if(b.top-6<number.bottom+2||b.bottom+6>button.top-16||b.left<0||b.right>innerWidth)
        violations.push({time,x:b.x,y:b.y,bottom:b.bottom,numberBottom:number.bottom,buttonTop:button.top});
      }
     }
     RankLettering.apply(host,'SS',checkFlow.elapsed);return violations;
    });
    assert.deepEqual(decorative,[],label+' rotating rank sparkles clear the mana and star action');

   }
   const before=await page.evaluate(()=>beginCount);await page.locator('#formalReplay').click({force:true});
   assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),true);assert.equal(await page.evaluate(()=>beginCount),before);
   await page.locator('#btnGoHome').click({force:true});assert.equal(await page.locator('body').getAttribute('data-state'),'SETTINGS');
  }
  assert.deepEqual(errors,[]);console.log('PASS six full-sized SS effects at 435x941/DPR2, compact separate title/readout, 34px safe area, immutable 999 SS and accessible action menu.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
