'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
  await page.addInitScript(()=>{
   let now=0,id=0;const frames=new Map();Object.defineProperty(performance,'now',{value:()=>now});
   requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(now));}while(ms>0);};
  });
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.evaluate(()=>{
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.f=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(...args){window.session=this;window.outcome=begin.apply(this,args);return outcome;};
   const Original=DarkDemonWingGrowthRenderer;window.realPaint=true;window.wingDraws=0;
   window.DarkDemonWingGrowthRenderer=class extends Original{constructor(){super();window.r=this;}draw(...args){wingDraws++;window.lastWingArgs=args;return realPaint?super.draw(...args):true;}};
   window.cues=[];const play=AudioManager.prototype.play;AudioManager.prototype.play=function(slot){cues.push(slot);return play.call(this,slot);};
   window.hash=()=>document.querySelector('canvas').toDataURL();
   const dark=DarkAwakening;window.fireCalls=[];window.skipFire=false;
   window.DarkAwakening={...dark,get error(){return dark.error;},get lost(){return dark.lost;},
    draw(ctx,args){window.awakeningTarget=args.target;return dark.draw(ctx,args);},
    drawFlame(ctx,args){const pose=skipFire?dark.flamePose(args):dark.drawFlame(ctx,args);window.lastFire={...pose,art:args.art,elapsed:args.elapsed,state:f.state};fireCalls.push(lastFire);return pose;}};
   window.firePixels=()=>{
    const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
    skipFire=false;advance(0);const before=ctx.getImageData(0,0,canvas.width,canvas.height).data.slice();
    skipFire=true;advance(0);const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let changed=0;for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>12)changed++;
    skipFire=false;advance(0);return changed;
   };
   window.wingTint=()=>{
    // Inspect the actual wing-only GPU result; exclude background/fire/DOM.
    const c=document.createElement('canvas');c.width=r.canvas.width;c.height=r.canvas.height;const ctx=c.getContext('2d');ctx.drawImage(r.canvas,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data;let opaque=0,purple=0,white=0;
    for(let i=0;i<d.length;i+=4){if(d[i+3]<100)continue;opaque++;if(d[i+2]>d[i+1]*1.35&&d[i]>d[i+1]*1.10&&d[i+2]>45)purple++;if(d[i]>175&&d[i+1]>175&&d[i+2]>175)white++;}
    return {opaque,purple,white};
   };
   window.wingCoverage=()=>{
    const c=document.createElement('canvas');c.width=r.canvas.width;c.height=r.canvas.height;const ctx=c.getContext('2d');ctx.drawImage(r.canvas,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data,a=r.lastArt,scale=c.width/innerWidth,reach=[];let outer=0,hash=2166136261;
    for(let i=0;i<d.length;i+=4){hash=Math.imul(hash^d[i],16777619)>>>0;hash=Math.imul(hash^d[i+3],16777619)>>>0;if(d[i+3]<100)continue;
     const pixel=i/4,x=(pixel%c.width)/scale,y=Math.floor(pixel/c.width)/scale;
     const radius=Math.hypot((x-a.cx)/a.w,(y-a.cy)/a.w)/.55;reach.push(radius);if(radius>.45)outer++;
    }
    reach.sort((a,b)=>a-b);return {opaque:reach.length,outer,radius95:reach[Math.floor(reach.length*.95)]||0,hash};
   };
   window.frameStats=()=>{
    const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let total=0,hash=2166136261,count=0,inner=0,innerCount=0,around=0,aroundCount=0;
    const sx=canvas.width/innerWidth,sy=canvas.height/innerHeight,target=awakeningTarget,unit=Math.min(innerWidth,innerHeight);
    // Read the rendered canvas, excluding DOM controls. Sparse pixel samples
    // avoid a screenshot file comparison while still catching empty frames.
    for(let p=0;p<canvas.width*canvas.height;p+=7){const i=p*4;const luma=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;total+=luma;count++;hash=Math.imul(hash^Math.round(luma),16777619)>>>0;
     const radius=Math.hypot((p%canvas.width)/sx-target.x,Math.floor(p/canvas.width)/sy-target.y);
     if(radius<unit*.05){inner+=luma;innerCount++;}else if(radius>unit*.14&&radius<unit*.25){around+=luma;aroundCount++;}
    }
    return {mean:total/count,hash,core:inner/innerCount,annulus:around/aroundCount};
   };
  });
  await page.locator('#s_master').uncheck({force:true});await page.locator('#s_dark').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
  await page.locator('#tab_probabilities').click();await page.locator('#rareChance_SS').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#btnStart').click();await page.waitForFunction(()=>r.loaded,null,{polling:100});
  const sketch=async()=>{await page.mouse.move(100,280);await page.mouse.down();await page.mouse.move(240,365,{steps:8});await page.mouse.up();};
  const awaken=async()=>{for(let i=0;i<100;i++){await page.evaluate(()=>advance(50));if(await page.evaluate(()=>f.state==='AWAKEN'))return;}throw Error('Awakening not entered');};
  await sketch();await awaken();
  assert.equal(await page.evaluate(()=>session.state),'GATHER');assert.equal(await page.evaluate(()=>f.materialFrame),null);
  assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.equal(await page.locator('#revealTitle').isVisible(),false);
  assert.equal(await page.evaluate(()=>wingDraws),0);assert.equal(await page.evaluate(()=>cues.filter(x=>x==='darkAwaken').length),1);assert.equal(await page.evaluate(()=>cues.includes('lightAwaken')),false);
  const saved=await page.evaluate(()=>JSON.stringify(outcome));
  await page.evaluate(()=>{f.paused=true;f.elapsed=.7;advance(0);});const held=await page.evaluate(()=>hash());
  await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>hash()),held);
  await page.evaluate(()=>{f.paused=false;dispatchEvent(new Event('pagehide'));});const time=await page.evaluate(()=>f.elapsed);
  await page.evaluate(()=>advance(500));assert.equal(await page.evaluate(()=>f.elapsed),time);
  await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));f.paused=true;});
  for(const [width,height]of [[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));
   const snapshots={};
   for(const [name,time]of [['illuminate',.25],['suction',.95],['swallowed',1.55],['flames',2.35],['contract',2.85],['root-flame',3.15]]){
    await page.evaluate(time=>{f.state='AWAKEN';f.elapsed=time;advance(0);},time);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.equal(await page.locator('#revealTitle').isVisible(),false);
    snapshots[name]=await page.evaluate(()=>({...frameStats(),fire:lastFire}));
    assert.equal(await page.evaluate(()=>DarkAwakening.error),'','black flame shader compiles/draws');
    assert.equal(await page.evaluate(()=>DarkAwakening.lost),false);
    assert.equal(await page.evaluate(()=>wingDraws),0,'wings remain absent throughout the interlude');
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-awakening-'+name+'-'+width+'x'+height+'.png')});
   }
   assert.ok(snapshots.flames.fire.size>snapshots.contract.fire.size&&snapshots.contract.fire.size>snapshots['root-flame'].fire.size,'flame contracts before wings appear');
   assert.equal(snapshots['root-flame'].fire.opacity,1,'contracted fire remains visible');
   assert.ok(snapshots.suction.core+10<snapshots.suction.annulus,'black core visibly occludes surrounding light');
   assert.equal(new Set(Object.values(snapshots).map(s=>s.hash)).size,6,'illumination, swallowing, eruption and contraction visibly differ');
   assert.ok(snapshots.illuminate.mean>snapshots.swallowed.mean+3,'the illuminated background visibly loses light');
   await page.evaluate(()=>{f.elapsed=.95;advance(0);});const inhale=await page.evaluate(()=>frameStats());
   await page.evaluate(()=>{f.elapsed=1.05;advance(0);});const moving=await page.evaluate(()=>frameStats());
   assert.notEqual(inhale.hash,moving.hash,'the swallowing phase continuously moves');
   console.log('Dark awakening '+width+'x'+height+':',JSON.stringify(Object.fromEntries(Object.entries(snapshots).map(([key,value])=>[key,{luma:Math.round(value.mean),fireSize:Math.round(value.fire.size)}]))));
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{dispatchEvent(new Event('resize'));f.state='AWAKEN';f.elapsed=3.15;f.paused=false;advance(50);});
  assert.equal(await page.evaluate(()=>f.state),'FORM');assert.equal(await page.evaluate(()=>session.state),'ELEMENT_REVEAL');
  assert.ok(await page.evaluate(()=>f.materialFrame.time<1e-7));
  const formStart=await page.evaluate(()=>lastFire);assert.ok(Math.abs(formStart.elapsed-3.2)<1e-6);assert.equal(formStart.opacity,1);
  assert.ok(await page.evaluate(()=>firePixels()>20),'root fire is actually painted as wings begin');
  await page.evaluate(()=>{f.paused=true;f.elapsed=0;advance(0);});
  assert.deepEqual(await page.evaluate(()=>r.layerState),{from:'A',to:'A',progress:0,birth:true,exposure:1,mode:'registered-membrane-reveal'});
  assert.equal(await page.evaluate(()=>wingCoverage().opaque),0,'initial A has no complete older texture beneath the root-out mask');
  const births=[];
  for(const at of [.22,.38,.64,.8]){
   await page.evaluate(at=>{f.elapsed=at;advance(0);},at);
   const coverage=await page.evaluate(()=>({...wingCoverage(),pair:r.layerState,fire:lastFire}));births.push(coverage);
   assert.equal(coverage.pair.birth,true);assert.equal(coverage.pair.from,'A');assert.equal(coverage.pair.to,'A');
   assert.equal(coverage.fire.opacity,1);assert.ok(Math.abs(coverage.fire.size-formStart.size)<.01,'birth retains the contracted fire at the wing root');
   await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-A-birth-'+Math.round(at*1000)+'.png')});
  }
  assert.ok(births[0].opaque>0&&births[3].opaque>births[0].opaque*2,'visible A membrane grows outward instead of appearing as a whole faded image');
  assert.ok(births[0].outer<births[3].outer*.05,'outer tips stay hidden while the central wing roots emerge');
  assert.ok(births[0].radius95+.1<births[3].radius95,'actual pixel extent advances away from the black fire');
  assert.ok(births[1].opaque>births[0].opaque&&births[2].opaque>births[1].opaque,'intermediate masks progressively reveal the silhouette');
  console.log('Initial dark A root-out coverage:',JSON.stringify(births.map(({opaque,outer,radius95})=>({opaque,outer,radius95}))));
  await page.evaluate(()=>{f.state='REVEAL';f.elapsed=0;advance(0);});
  assert.equal(await page.evaluate(()=>wingCoverage().hash),births[3].hash,'completed birth joins settled A without replacing or stretching its image');
  await page.evaluate(()=>{f.state='FORM';f.elapsed=.4;advance(0);});await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-awakening-handoff.png')});
  assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.ok(await page.evaluate(()=>wingDraws>0));
  assert.equal(await page.evaluate(()=>r.error),'');assert.equal(await page.evaluate(()=>r.gl.getError()),0);
  const midForm=await page.evaluate(()=>lastFire);assert.ok(Math.abs(midForm.size-formStart.size)<.01,'initial wing handoff preserves contracted fire size');
  assert.equal(midForm.opacity,1);assert.ok(await page.evaluate(()=>firePixels()>20),'fire persists over the forming wings');
  await page.evaluate(()=>{f.paused=true;f.state='REVEAL';});
  const events=await page.evaluate(()=>DarkRankGrowth.timeline(outcome)),rankPoses=[];
  for(const [name,at]of [['A',0],['S',events[0].completeAt+.01],['SS',events[1].completeAt+.01]]){
   await page.evaluate(at=>{f.elapsed=at;advance(0);},at);
   const pose=await page.evaluate(()=>lastFire);rankPoses.push(pose);
   assert.equal(pose.opacity,1);assert.ok(Math.abs(pose.y-pose.size*.20-pose.art.cy)<.01,'fire remains centered in '+name+' wings');
   assert.ok(await page.evaluate(()=>firePixels()>20),'actual black fire remains visible for '+name);
   await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-root-fire-'+name+'.png')});
  }
  assert.ok(rankPoses[0].size<rankPoses[1].size&&rankPoses[1].size<rankPoses[2].size,'root fire grows A to S to SS');
  for(const event of events){
   await page.evaluate(at=>{f.elapsed=at;advance(0);},event.at+event.duration*.65);
   const tint=await page.evaluate(()=>wingTint());
   assert.ok(tint.opaque>500,'actual wing mesh visible during evolution');
   assert.ok(tint.purple>tint.opaque*.10,'evolution carries saturated violet');
   assert.ok(tint.white<tint.opaque*.03,'evolution avoids the former white exposure wash');
   console.log('Dark evolution '+event.from+'→'+event.to+' tint:',JSON.stringify(tint));
   await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-violet-evolution-'+event.to+'.png')});
  }
  await page.evaluate(()=>{f.state='FORM';f.elapsed=.4;f.paused=false;});
  await page.evaluate(()=>{realPaint=false;advance(12000);realPaint=true;advance(0);});
  assert.equal(await page.evaluate(()=>session.currentResult===outcome&&Object.isFrozen(outcome)),true);assert.equal(await page.evaluate(()=>JSON.stringify(outcome)),saved);
  assert.equal(await page.locator('#fireScanValue').textContent(),'999');assert.equal(await page.locator('#fireScanRank').textContent(),'SS');
  assert.equal(await page.evaluate(()=>cues.filter(x=>x==='darkAwaken').length),1);
  assert.equal(await page.locator('#formalReplay').isVisible(),true);
  await page.locator('#formalReplay').click({force:true});
  assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),true);
  await page.locator('#btnGoHome').click({force:true});
  await page.locator('#tab_effects').click();await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#flowPreviewOpen').click();await page.locator('#material_dark').click();
  await page.waitForFunction(()=>r.loaded,null,{polling:100});await page.locator('#darkRank_A').click();await page.waitForFunction(()=>r.loaded,null,{polling:100});await sketch();await awaken();
  await page.evaluate(()=>{f.state='FORM';f.elapsed=.22;f.paused=true;advance(0);});
  const previewBirth=await page.evaluate(()=>({pair:r.layerState,coverage:wingCoverage(),fire:lastFire}));
  assert.equal(previewBirth.pair.birth,true);assert.ok(previewBirth.pair.progress>0&&previewBirth.pair.progress<.3,'A reveal preview shares the initial growth front');
  assert.ok(previewBirth.coverage.opaque>0);assert.equal(previewBirth.fire.opacity,1);
  await page.evaluate(()=>{f.state='AWAKEN';f.elapsed=.2;f.paused=false;advance(0);});
  await page.locator('#materialPause').click();const paused=await page.evaluate(()=>f.elapsed);await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>f.elapsed),paused);
  await page.locator('#materialReplay').click();assert.equal(await page.evaluate(()=>f.state),'DRAWING');assert.equal(await page.evaluate(()=>f.elapsed),0);
  await page.locator('#material_fire').click();assert.equal(await page.evaluate(()=>f.awakeningEnabled),false);
  await sketch();await page.evaluate(()=>{realPaint=false;advance(3900);});assert.equal(await page.evaluate(()=>f.state),'FORM');
  assert.deepEqual(errors,[]);
  console.log('PASS dark awakening: real stroke to illumination/suction/black flames, contraction into a persistent growing wing-root fire, violet A/S/SS evolution, immutable SS999, three viewports, pause/background/replay/basic pacing.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
