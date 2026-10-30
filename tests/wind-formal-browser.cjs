/* Real formal results drive the shared wind renderer; GPU snapshots are sampled
 * between host updates so this test does not spend minutes raymarching every RAF. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      const nativeContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if(type==='2d')args[0]={...args[0],willReadFrequently:true};
        return nativeContext.call(this,type,...args);
      };
      let now=0,id=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;
        const run=[...callbacks.values()];callbacks.clear();run.forEach(fn=>fn(now));
      }while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const Original=WindTornadoRenderer;window.windHistory=[];window.windInstances=[];
      window.WindTornadoRenderer=class extends Original{
        constructor(...args){super(...args);window.formalWind=this;windInstances.push(this);}
        draw(...args){
          this.hostArgs=args;const frame=args[4],fx=frame.windEffects;
          if(fx)windHistory.push({value:fx.value,rank:fx.profile.rank,time:fx.time,hostTime:frame.time,
            speed:fx.profile.speed,starScale:fx.profile.starScale,cloudAmount:fx.profile.cloudAmount,
            sizeScale:fx.profile.sizeScale,heightScale:fx.profile.heightScale,populationScale:fx.profile.populationScale,vortexMix:fx.profile.vortexMix,cohesion:fx.profile.cohesion});
          if(window.realWindPaint)return super.draw(...args);
          return !this.error&&!this.lost;
        }
      };
      const legacy=ElementMaterialRenderer.prototype.draw;window.legacyWindDraws=0;
      ElementMaterialRenderer.prototype.draw=function(...args){if(this.element==='wind')legacyWindDraws++;return legacy.apply(this,args);};
      const begin=ManaResults.Session.prototype.begin;window.beginCalls=0;
      ManaResults.Session.prototype.begin=function(settings){
        beginCalls++;windHistory.length=0;
        const result=begin.call(this,settings,()=>.999999);
        window.originalOutcome=result;window.observedSession=this;return result;
      };
      window.renderFormalWind=()=>{
        const r=formalWind;Original.prototype.draw.apply(r,r.hostArgs);
        const pixels=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        let visible=0,hash=2166136261;
        for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===3&&pixels[i]>16)visible++;}
        return {rank:r.profile.rank,profile:r.profile,box:r.renderBox,time:r.time,visualTime:r.visualTime,
          error:r.error,gl:r.gl.getError(),visible,hash:hash>>>0,sparkleMana:r.sparkleMana,
          shaderTime:r.gl.getUniform(r.program,r.uniforms.uTime),cohesion:r.gl.getUniform(r.program,r.uniforms.uCohesion),frame:r.hostArgs[4]};
      };
    });
    const click=id=>require('./result-action-helpers.cjs')(page,'#'+id);
    const advance=ms=>page.evaluate(ms=>window.advance(ms),ms);
    const render=()=>page.evaluate(()=>renderFormalWind());
    // An SS choice in the study must not leak into the next E certification.
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await click('materialPreviewOpen');await click('material_wind');await click('windRank_SS');
    await click('effectPreviewBack');await click('tab_switches');
    await page.locator('#s_master').uncheck({force:true});await page.locator('#s_wind').check({force:true});
    await page.locator('#s_muggle').uncheck({force:true});
    const ranks=process.argv.includes('--ss-only')?['SS']:process.argv.includes('--lower-only')?['E','D','C']:['E','D','C','B','A','S','SS'];
    for(const rank of ranks){
      await click('tab_probabilities');
      await page.locator('#chance_'+rank).evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
      await click('btnStart');await advance(0);
      const outcome=await page.evaluate(()=>originalOutcome),begins=await page.evaluate(()=>beginCalls);
      assert.equal(outcome.element,'風');assert.equal(outcome.rank,rank);
      assert.equal(await page.locator('#materialControls').isVisible(),false,'formal hides all preview controls');
      await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(270,385,{steps:6});await page.mouse.up();
      await advance(4600);
      const seed=await render();assert.equal(seed.rank,'E','every formal result begins as the small wind');
      assert.equal(seed.profile.starScale,0);assert.equal(seed.profile.cloudAmount,0);
      assert.ok(Math.abs(seed.cohesion-.12)<1e-6,'the first visible wind begins as incomplete curls');
      await advance(1000);
      assert.equal(await page.locator('#fireScanReadout').isVisible(),true);
      assert.equal(await page.locator('#fireScanReadout').getAttribute('data-element'),'wind');
      assert.equal(await page.locator('#fireScanLabel').textContent(),'魔力值');
      await advance(4400);
      const frame=await render();
      assert.equal(frame.rank,rank);assert.equal(frame.error,'');assert.equal(frame.gl,0);
      assert.equal(frame.sparkleMana,outcome.mana,'formal star population follows the committed mana, not the preview rank');
      assert.ok(frame.visible>30,rank+' produces visible volumetric wind');
      assert.equal(frame.frame.windEffects.value,outcome.mana);
      assert.equal(await page.locator('#fireScanValue').textContent(),String(outcome.mana));
      assert.equal(await page.locator('#fireScanRank').textContent(),rank);
      assert.equal(await page.evaluate(()=>document.body.dataset.state),'MANA_SCAN');
      assert.equal(await page.locator('#formalReplay').isVisible(),true);
      const checks=await page.evaluate(()=>({same:originalOutcome===observedSession.currentResult,
        frozen:Object.isFrozen(originalOutcome),calls:beginCalls,legacy:legacyWindDraws,
        history:windHistory,expected:WindRankEffects.forRank(originalOutcome.rank)}));
      assert.equal(checks.same,true);assert.equal(checks.frozen,true);assert.equal(checks.calls,begins);assert.equal(checks.legacy,0);
      for(const key of ['speed','widthScale','swayScale','cloudAmount','vortexMix','sizeScale','heightScale','populationScale','starScale','stormFlash','cohesion'])
        assert.ok(Math.abs(frame.profile[key]-checks.expected[key])<1e-8,rank+' settles to its exact '+key);
      assert.ok(Math.abs(frame.cohesion-checks.expected.cohesion)<1e-6,rank+' actual shader reaches its structural endpoint');
      assert.ok(checks.history.every((v,i,a)=>!i||v.time>=a[i-1].time),'integrated material time never jumps backward during rank growth');
      assert.ok(checks.history.every((v,i,a)=>!i||v.cohesion>=a[i-1].cohesion),'actual rank growth progressively connects the wind structure');
      assert.ok(checks.history.every(v=>v.sizeScale===1),'formal growth never zooms the wind or its exterior details');
      assert.ok(checks.history.every(v=>v.vortexMix===0),'formal growth keeps the tornado shape from E through SS');
      assert.ok(Math.abs(frame.visualTime-frame.frame.windEffects.time*2.25)<1e-6,'formal uses the chosen 1.5x baseline on the integrated clock');
      // The normal test defers expensive volume painting into the material
      // buffer. Paint one actual host frame so screenshots include its final
      // composition, rather than only the background and DOM readout.
      await page.evaluate(()=>window.realWindPaint=true);await advance(50);
      if(rank==='SS'){
        for(const r of ['E','D','C','B','A','S','SS'])assert.ok(checks.history.some(f=>f.rank===r),'the real numeric climb passes '+r);
        await page.screenshot({path:path.join(root,'artifacts/wind-formal-SS.png')});
        for(const [width,height,name] of [[320,568,'small'],[844,390,'landscape'],[390,844,'portrait']]){
          await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));await render();
          const title=await page.locator('#revealTitle').boundingBox(),label=await page.locator('#fireScanLabel').boundingBox();
          const number=await page.locator('#fireScanValue').boundingBox(),grade=await page.locator('#fireScanRank').boundingBox();
          const replay=await page.locator('#formalReplay').boundingBox();
          for(const b of [title,label,number,grade,replay])assert.ok(b&&b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=height+1,'formal '+name+' readout stays on screen');
          assert.ok(title.y+title.height<label.y&&label.y+label.height<number.y&&number.y+number.height<grade.y,'formal '+name+' readout rows do not overlap');
          assert.ok(grade.y+grade.height<replay.y,'formal '+name+' rank clears retry button');
          await page.screenshot({path:path.join(root,'artifacts/wind-formal-SS-'+name+'.png')});
        }
      }
      await page.screenshot({path:path.join(root,'artifacts/wind-formal-'+rank+'.png')});
      await page.evaluate(()=>window.realWindPaint=false);
      const before=await render();await advance(400);const after=await render();
      assert.notEqual(after.hash,before.hash,'the completed '+rank+' effect keeps animating');
      await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
      const stopped=await page.evaluate(()=>({time:formalWind.hostArgs[4].windEffects.time,value:document.getElementById('fireScanValue').textContent}));
      await advance(3000);
      assert.deepEqual(await page.evaluate(()=>({time:formalWind.hostArgs[4].windEffects.time,value:document.getElementById('fireScanValue').textContent})),stopped);
      await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(0);await advance(50);
      if(rank==='SS'){
        const previous=await page.evaluate(()=>{window.oldWind=formalWind;return beginCalls;});
        await click('formalReplay');
        assert.equal(await page.evaluate(()=>beginCalls),previous+1,'replay alone selects the new immutable result');
        assert.equal(await page.evaluate(()=>oldWind.disposed),true,'replay disposes the previous GPU owner');
        assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      }
      await click('effectPreviewBack');
      assert.equal(await page.evaluate(()=>formalWind.disposed),true,'return disposes formal wind');
      assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      console.log('Formal wind '+rank+' passed at '+outcome.mana+'.');
    }
    assert.deepEqual(errors,[]);
    console.log(process.argv.includes('--ss-only')?'Formal wind SS browser passed: real host composition, shared glints, growth, pause/replay and three viewport layouts.':process.argv.includes('--lower-only')
      ?'Lower wind browser passed: E/D/C actual outcomes and GPU rendering, mana growth, immutable results, sustained motion, background suspension and disposal.'
      :'Formal wind browser passed: seven real outcomes, continuous actual mana-driven ranks, shared GPU rendering, 1.5x integrated clock, immutable results, background suspension, replay/disposal and three readout layouts.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
