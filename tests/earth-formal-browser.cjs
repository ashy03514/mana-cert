'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const frames=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const batch=[...frames.values()];frames.clear();batch.forEach(f=>f(now));}while(ms>0);};
      const native=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d')args[0]={...args[0],willReadFrequently:true};return native.call(this,type,...args);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const Original=EarthMountainRenderer;window.earthHistory=[];
      EarthMountainRenderer=class extends Original{
        constructor(...args){super(...args);window.formalEarth=this;}
        draw(...args){this.hostArgs=args;const fx=args[4].earthEffects;
          if(fx)earthHistory.push({rank:fx.profile.rank,value:fx.value,time:fx.time,actionTime:fx.actionTime,
            hostTime:args[4].time,opening:Original.sample(fx.actionTime??fx.time).opening,level:fx.level,weights:fx.weights});
          if(window.realEarthPaint)return super.draw(...args);
          return !this.error&&!this.lost;
        }
      };
      const begin=ManaResults.Session.prototype.begin;window.beginCalls=0;
      ManaResults.Session.prototype.begin=function(settings){beginCalls++;earthHistory.length=0;const result=begin.call(this,settings,()=>.999999);window.originalOutcome=result;window.observedSession=this;return result;};
      const legacy=ElementMaterialRenderer.prototype.draw;window.legacyEarthDraws=0;
      ElementMaterialRenderer.prototype.draw=function(...args){if(this.element==='earth')legacyEarthDraws++;return legacy.apply(this,args);};
      window.renderEarth=()=>{
        const r=formalEarth;Original.prototype.draw.apply(r,r.hostArgs);
        const backdrop=r.earthBackdrop,frame=r.hostArgs[4],[,,w,h]=r.hostArgs;
        const formationDuration=new RevealFlow().reset('earth').formationDuration;
        const shift=FireScanTransition.sample(Math.max(0,frame.time-formationDuration),originalOutcome).shift;
        const expectedReadout=frame.readout?r.scanLayout(w,h,frame.earthEffects.profile,shift).readout:null;
        const pixels=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        let hash=2166136261,visible=0;for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===3&&pixels[i]>128)visible++;}
        return{hash:hash>>>0,visible,rank:r.profile.rank,profile:r.profile,time:r.time,gl:r.gl.getError(),error:r.error,
          meshes:r.meshes.filter(m=>m.count).length,frame,box:r.renderBox,retainedTime:r.lastTime,actionTime:r.actionTime,hostTime:r.hostTime,
          backdrop:backdrop?{failed:backdrop.failed,lost:backdrop.lost,program:!!backdrop.program,
            gl:backdrop.gl?.getError(),lastTime:backdrop.lastTime,lastActionTime:backdrop.lastActionTime,lastHostTime:backdrop.lastHostTime,
            readout:backdrop.currentRegions?.readout,forwardedReadout:r.backdropReadout,expectedReadout}:null};
      };
      window.probeGrowth=t=>{
        const r=formalEarth,frame=r.hostArgs[4],effects=EarthRankEffects.sample(t,originalOutcome,.8),ctx=r.hostArgs[0];
        const [,,w,h]=r.hostArgs,layout=r.scanLayout(w,h,effects.profile,1);
        Original.prototype.draw.call(r,ctx,null,w,h,{...frame,time:t+.8,earthEffects:effects,box:layout.box,formation:1,opacity:1});
        return{time:r.lastTime,actionTime:r.actionTime,pose:Original.sample(r.actionTime),
          impacts:r.collisionParticles(r.lastTime,r.actionTime).length,backdropAge:r.earthBackdrop.frame.age,
          level:effects.level,error:r.error,gl:r.gl.getError(),draws:r.drawCount,image:ctx.canvas.toDataURL()};
      };
      window.comparePreset=()=>{
        const live=formalEarth,canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;
        const r=new Original(),profile=EarthRankEffects.forRank(originalOutcome.rank);
        r.draw(canvas.getContext('2d'),null,390,844,{rank:profile.rank,box:live.renderBox,time:live.lastTime/profile.speed,actionTime:live.actionTime});
        const equal=live.patch.toDataURL()===r.patch.toDataURL();r.dispose();return equal;
      };
    });
    const click=id=>require('./result-action-helpers.cjs')(page,'#'+id),advance=ms=>page.evaluate(ms=>window.advance(ms),ms),render=()=>page.evaluate(()=>renderEarth());
    const checkBackdrop=(frame,{readout=false}={})=>{
      const b=frame.backdrop;assert.ok(b&&b.program,'formal earth compiles its backdrop shader');
      assert.equal(b.failed,false,'formal backdrop does not fall back after shader failure');
      assert.equal(b.lost,false,'formal backdrop retains its graphics context');assert.equal(b.gl,0,'formal backdrop has no GL error');
      assert.equal(b.lastTime,frame.retainedTime,'backdrop and mountain share the retained material clock');
      assert.equal(b.lastActionTime,frame.actionTime,'background pulse and rock contact share the result-triggered action clock');
      assert.ok(frame.frame.time-b.lastHostTime>=-1e-9&&frame.frame.time-b.lastHostTime<1/30+1e-6,'background samples active host seconds within its 30fps budget');
      if(readout){
        assert.deepEqual(frame.frame.readout,b.expectedReadout,'host forwards the current formal scanLayout protection rectangle');
        assert.deepEqual(b.forwardedReadout,b.expectedReadout,'mountain retains the current formal readout rectangle');
        assert.deepEqual(b.readout,b.expectedReadout,'background protects the actual formal numbers and rank');
      }
    };
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();await click('materialPreviewOpen');await click('material_earth');await click('earthRank_SS');
    await click('effectPreviewBack');await click('tab_switches');await page.locator('#s_master').uncheck({force:true});await page.locator('#s_earth').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
    const shots=[];
    const testedRanks=process.argv.includes('--ss-only')?['SS']:['E','D','C','B','A','S','SS'];
    for(const rank of testedRanks){
      await click('tab_probabilities');await page.locator('#chance_'+rank).evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
      await click('btnStart');await advance(0);
      const outcome=await page.evaluate(()=>originalOutcome),begins=await page.evaluate(()=>beginCalls);
      assert.equal(outcome.rank,rank);assert.equal(outcome.element,'土');
      assert.equal(await page.locator('#materialControls').isVisible(),false);
      await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(260,385,{steps:5});await page.mouse.up();
      await advance(4600);const first=await render();assert.equal(first.rank,'E');assert.equal(first.meshes,3);assert.equal(first.profile.starScale,0);checkBackdrop(first);
      await advance(1000);assert.equal(await page.locator('#fireScanReadout').isVisible(),true);assert.equal(await page.locator('#fireScanReadout').getAttribute('data-element'),'earth');
      assert.equal(await page.locator('#fireScanLabel').textContent(),'魔力值');
      // Include the result-triggered first action after the counter settles.
      await advance(6400);const full=await render();
      checkBackdrop(full,{readout:true});
      assert.equal(full.error,'');assert.equal(full.gl,0);assert.ok(full.visible>250);assert.equal(full.rank,rank);
      assert.equal(full.frame.earthEffects.value,outcome.mana);assert.equal(await page.locator('#fireScanValue').textContent(),String(outcome.mana));assert.equal(await page.locator('#fireScanRank').textContent(),rank);
      assert.equal(await page.locator('body').getAttribute('data-state'),'MANA_SCAN');assert.ok(await page.locator('#formalReplay').isVisible());
      const state=await page.evaluate(()=>({same:observedSession.currentResult===originalOutcome,frozen:Object.isFrozen(originalOutcome),calls:beginCalls,legacy:legacyEarthDraws,history:earthHistory,expected:EarthRankEffects.forRank(originalOutcome.rank)}));
      assert.ok(state.same&&state.frozen);assert.equal(state.calls,begins);assert.equal(state.legacy,0);
      for(const k of ['speed','opening','impact','mineral','dustCount','chipsCount','starScale','extent'])assert.ok(Math.abs(full.profile[k]-state.expected[k])<1e-9);
      assert.ok(state.history.every((v,i,a)=>!i||v.time>=a[i-1].time));assert.ok(state.history.every((v,i,a)=>!i||v.level>=a[i-1].level));
      const climbing=state.history.filter(f=>f.value>0&&f.value<outcome.mana);
      assert.ok(climbing.length>10&&climbing.some(f=>f.opening<.1)&&climbing.some(f=>f.opening>.6),'rocks spread gradually throughout the numeric climb');
      assert.ok(climbing.every((f,i,a)=>!i||f.opening>=a[i-1].opening),'the initial spreading does not close again before confirmation');
      const locked=state.history.find(f=>f.value===outcome.mana),contact=state.history.find(f=>f.actionTime>=4.18);
      assert.ok(locked&&locked.actionTime>=2.95&&locked.actionTime<2.98&&locked.opening>.79,'the final number retains the already-open rock pose');
      assert.ok(state.history.some(f=>f.hostTime>locked.hostTime&&f.actionTime<3.8&&f.opening>.99),'confirmation adds a small outward anticipation before compression');
      assert.ok(contact&&contact.hostTime-locked.hostTime<1,'first contact arrives within one second of the final number');
      assert.ok(await page.evaluate(()=>comparePreset()),rank+' exact accepted geometry and material survive formal growth');
      // Deferred GPU probes paint the host material buffer. Run one complete
      // host frame before taking a screenshot so its composition is visible.
      await page.evaluate(()=>window.realEarthPaint=true);await advance(50);
      const file=path.join(root,'artifacts/earth-formal-'+rank+'.png');await page.screenshot({path:file});shots.push({rank,image:await loadImage(file)});
      await page.evaluate(()=>window.realEarthPaint=false);
      if(rank==='SS'){
        for(const name of ['E','D','C','B','A','S','SS'])assert.ok(state.history.some(f=>f.rank===name),'actual numeric climb passes '+name);
        const times=[.9,1.15,1.35,1.55,1.75,2.0,2.3],sheet=createCanvas(390*times.length,560),c=sheet.getContext('2d');
        c.fillStyle='#121211';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#e1cda6';c.font='16px sans-serif';
        const bufferIdentity=await page.evaluate(()=>{window.growthBuffers=formalEarth.meshes.map(m=>m.buffer);return growthBuffers.length;});assert.equal(bufferIdentity,9);
        for(let i=0;i<times.length;i++){
          const frame=await page.evaluate(t=>probeGrowth(t),times[i]);assert.equal(frame.error,'');assert.equal(frame.gl,0);
          c.fillText(times[i]+'s · '+frame.level.toFixed(2),i*390+12,24);c.drawImage(await loadImage(frame.image),i*390,32,390,844);
        }
        fs.writeFileSync(path.join(root,'artifacts/earth-formal-growth.png'),sheet.toBuffer('image/png'));
        assert.ok(await page.evaluate(()=>formalEarth.meshes.every((m,i)=>m.buffer===growthBuffers[i])),'growth reuses fixed buffers');
        const budget=await page.evaluate(()=>{
          probeGrowth(1);const before=formalEarth.drawCount;
          for(let i=1;i<=60;i++)probeGrowth(1+i/60);
          return formalEarth.drawCount-before;
        });assert.ok(budget>=29&&budget<=31,'changing geometry respects the 30fps render budget');
        // Restore an intermediate morph, including buffers, shadows and rank weights.
        await page.evaluate(()=>probeGrowth(1.55));const old=await page.evaluate(()=>formalEarth.patch.toDataURL());
        await page.evaluate(()=>{window.loss=formalEarth.gl.getExtension('WEBGL_lose_context');loss.loseContext();});await page.waitForFunction(()=>formalEarth.lost);
        await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!formalEarth.lost&&!!formalEarth.program);
        await page.evaluate(()=>probeGrowth(1.55));assert.equal(await page.evaluate(()=>formalEarth.patch.toDataURL()),old);
        const actionTimes=[2.45,3.45,4.05,4.35,4.65,4.87,4.97],actionSheet=createCanvas(390*actionTimes.length,878),a=actionSheet.getContext('2d'),actionFrames=[];
        a.fillStyle='#121211';a.fillRect(0,0,actionSheet.width,actionSheet.height);a.font='17px sans-serif';a.fillStyle='#e1cda6';
        for(let i=0;i<actionTimes.length;i++){
          const frame=await page.evaluate(t=>probeGrowth(t),actionTimes[i]);actionFrames.push(frame);assert.equal(frame.gl,0);
          assert.ok(Math.abs(frame.backdropAge-(frame.actionTime%6.8-4.18))<1e-9,'result action keeps the energy wave synchronized');
          const offset=actionTimes[i]-4.05;
          a.fillText('Result '+(offset<0?'- ':'+ ')+Math.abs(offset).toFixed(2)+' s',i*390+12,24);a.drawImage(await loadImage(frame.image),i*390,34,390,844);
        }
        assert.ok(actionFrames[0].pose.opening>0&&actionFrames[0].pose.opening<actionFrames[1].pose.opening,'rocks are already moving apart while the counter grows');
        assert.ok(actionFrames[1].pose.opening<actionFrames[2].pose.opening&&actionFrames[2].pose.opening>.79,'spreading continues smoothly into the confirmed value');
        assert.ok(actionFrames[3].pose.opening>actionFrames[2].pose.opening&&actionFrames[4].pose.opening>.95,'confirmation slightly extends the existing opening');
        assert.equal(actionFrames[5].pose.opening,0,'the extended pose rapidly compresses');
        assert.ok(actionFrames[5].impacts>0&&actionFrames[6].impacts>0,'the first locked-result collision emits its existing debris');
        fs.writeFileSync(path.join(root,'artifacts/earth-result-action.png'),actionSheet.toBuffer('image/png'));
        await render();
        await page.evaluate(()=>window.realEarthPaint=true);
        for(const [width,height,name] of [[320,568,'small'],[844,390,'landscape'],[390,844,'portrait']]){
          await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));checkBackdrop(await render(),{readout:true});
          const boxes=await Promise.all(['revealTitle','fireScanLabel','fireScanValue','fireScanRank','formalReplay'].map(id=>page.locator('#'+id).boundingBox()));
          for(const b of boxes)assert.ok(b&&b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=height+1,name+' readout remains on screen');
          for(let i=0;i<boxes.length-1;i++)assert.ok(boxes[i].y+boxes[i].height<boxes[i+1].y,name+' rows do not overlap');
          await page.screenshot({path:path.join(root,'artifacts/earth-formal-SS-'+name+'.png')});
        }
        await page.evaluate(()=>window.realEarthPaint=false);
      }
      const before=await render();await advance(400);assert.notEqual((await render()).hash,before.hash,'completed stone stays animated');
      await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const frozen=await page.evaluate(()=>formalEarth.hostArgs[4]);await advance(1000);assert.deepEqual(await page.evaluate(()=>formalEarth.hostArgs[4]),frozen);
      await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(0);await advance(50);
      if(rank==='SS'){
        await page.evaluate(()=>{window.oldEarth=formalEarth;window.oldEarthBackdrop=formalEarth.earthBackdrop;});
        await click('formalReplay');assert.ok(await page.evaluate(()=>oldEarth.disposed));
        assert.ok(await page.evaluate(()=>oldEarthBackdrop.disposed&&oldEarthBackdrop.program===null&&oldEarthBackdrop.buffer===null&&oldEarthBackdrop.gl===null&&oldEarthBackdrop.patch.width===1&&oldEarth.earthBackdrop===null),'replay releases the previous backdrop resources');
        assert.equal(await page.evaluate(()=>beginCalls),begins+1);assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      }
      await page.evaluate(()=>window.closingEarthBackdrop=formalEarth.earthBackdrop);
      await click('effectPreviewBack');assert.ok(await page.evaluate(()=>formalEarth.disposed));
      assert.ok(await page.evaluate(()=>closingEarthBackdrop.disposed&&closingEarthBackdrop.program===null&&closingEarthBackdrop.buffer===null&&closingEarthBackdrop.gl===null&&closingEarthBackdrop.patch.width===1&&formalEarth.earthBackdrop===null),'returning to settings releases the backdrop resources');
      assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      console.log('Formal earth '+rank+' passed at '+outcome.mana+'.');
    }
    const sheet=createCanvas(390*7,878),c=sheet.getContext('2d');c.fillStyle='#121211';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#dfcaa8';c.font='20px sans-serif';shots.forEach(({rank,image},i)=>{c.drawImage(image,i*390,34);c.fillText(rank,i*390+16,25);});
    fs.writeFileSync(path.join(root,'artifacts/earth-formal-overview.png'),sheet.toBuffer('image/png'));
    assert.deepEqual(errors,[]);console.log('Earth formal browser passed: '+testedRanks.join('/')+' outcomes, continuous mesh growth, exact presets, prompt result action, rank/clock continuity, GPU budget, restore, shared backdrop timing/readout protection, lifecycle and readout layouts.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
