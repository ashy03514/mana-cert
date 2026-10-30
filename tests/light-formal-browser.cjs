/* Formal light outcomes remain immutable while the same feather meshes grow. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const pending=new Map();Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...pending.values()];pending.clear();run.forEach(fn=>fn(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const Original=LightAngelLayeredGrowthRenderer;window.lightHistory=[];window.readoutHistory=[];
      window.LightAngelLayeredGrowthRenderer=class extends Original{
        constructor(...args){super(...args);window.formalLight=this;}
        draw(...args){this.hostArgs=args;const f=args[3];if(Number.isFinite(f.growth))lightHistory.push({growth:f.growth,time:f.motionTime,starMana:f.starMana,rank:f.rank});
          readoutHistory.push(document.getElementById('fireScanRank').textContent);
          if(window.realLightPaint)return super.draw(...args);return !this.error&&!this.lost;}
      };
      const legacy=ElementMaterialRenderer.prototype.draw;window.legacyLightDraws=0;
      ElementMaterialRenderer.prototype.draw=function(...args){if(this.element==='light')legacyLightDraws++;return legacy.apply(this,args);};
      const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.lightFlow=this;return reset.apply(this,args);};
      const begin=ManaResults.Session.prototype.begin;window.beginCalls=0;window.targetLight={rank:'A',mana:800};
      ManaResults.Session.prototype.begin=function(settings){
        beginCalls++;lightHistory.length=0;readoutHistory.length=0;
        const {rank,mana}=targetLight,[min,max]=ManaConfig.ranks[rank].range;
        const draws=[0,{A:.30,S:.75,SS:.95}[rank],(mana-min+.25)/(max-min+1)];let i=0;
        const result=begin.call(this,settings,()=>draws[i++]??.5);window.originalOutcome=result;window.observedSession=this;return result;
      };
      window.renderFormalLight=()=>{
        const r=formalLight;Original.prototype.draw.apply(r,r.hostArgs);
        const p=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;let hash=2166136261,texturePixels=0;
        for(let i=0;i<p.length;i+=4){hash=Math.imul(hash^p[i],16777619);if(p[i+2]>180&&p[i+1]>180)texturePixels++;}
        return {growth:r.growthState,layer:r.layerState,frame:r.frame,error:r.error,gl:r.gl.getError(),hash:hash>>>0,texturePixels,
          finite:r.meshes.length===2&&r.meshes.every(m=>Array.from(m.vertices).every(Number.isFinite)),args:r.hostArgs[3]};
      };
      window.sampleGrowth=growth=>{
        const r=formalLight,[ctx,w,h,frame]=r.hostArgs;
        Original.prototype.draw.call(r,ctx,w,h,{...frame,time:6,motionTime:5,growth,growthTransition:undefined,growthExposure:0,
          rank:growth<1?'A':growth<2?'S':'SS',starMana:growth<1?950*growth:950+(growth-1)*50});
        return {image:r.patch.toDataURL(),finite:r.meshes.length===2&&r.meshes.every(m=>Array.from(m.vertices).every(Number.isFinite)),state:r.growthState};
      };
      window.growthPixelDifference=(a,b)=>{
        const r=formalLight;sampleGrowth(a);const p=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        sampleGrowth(b);const q=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        let sum=0,peak=0;for(let i=0;i<p.length;i++){const d=Math.abs(p[i]-q[i]);sum+=d;peak=Math.max(peak,d);}return {mean:sum/p.length,peak};
      };
    });
    const click=id=>require('./result-action-helpers.cjs')(page,'#'+id);
    const advance=ms=>page.evaluate(ms=>window.advance(ms),ms);
    const render=()=>page.evaluate(()=>renderFormalLight());
    await click('tab_switches');await page.locator('#s_master').uncheck({force:true});await page.locator('#s_light').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
    for(const target of [{rank:'A',mana:750},{rank:'S',mana:900},{rank:'S',mana:950},{rank:'SS',mana:1000},{rank:'SS',mana:9999}]){
      await page.evaluate(target=>{window.targetLight=target;window.realLightPaint=false;},target);await click('btnStart');
      await page.waitForFunction(()=>window.formalLight?.loaded,null,{polling:100});await advance(0);
      assert.deepEqual(await page.evaluate(()=>({rank:originalOutcome.rank,mana:originalOutcome.mana,element:originalOutcome.element})),{...target,element:'光'});
      assert.deepEqual(await page.evaluate(()=>Object.keys(formalLight.images).sort()),['A','S','SS']);
      assert.equal(await page.locator('#materialControls').isVisible(),false);
      await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(270,385,{steps:6});await page.mouse.up();
      for(let i=0;i<160;i++){await advance(50);if(await page.evaluate(()=>lightFlow.state==='REVEAL'))break;}
      assert.equal(await page.evaluate(()=>lightFlow.state),'REVEAL');const early=await render();
      assert.ok(early.args.growth<.001,'every outcome starts with A juvenile wings');assert.equal(early.error,'');assert.equal(early.gl,0);
      await advance(1100);assert.equal(await page.locator('#fireScanReadout').isVisible(),true);assert.equal(await page.locator('#fireScanReadout').getAttribute('data-element'),'light');
      await advance(4800);const final=await render();
      assert.equal(final.args.growth,{A:0,S:1,SS:2}[target.rank]);assert.equal(final.error,'');assert.equal(final.gl,0);assert.ok(final.finite);assert.ok(final.texturePixels>1000);
      assert.equal(final.layer.to,target.rank);assert.equal(final.layer.progress,1);assert.equal(final.layer.exposure,0);
      assert.deepEqual(await page.evaluate(()=>Object.keys(formalLight.outlines)),[],'formal never invokes envelope distortion');
      assert.equal(await page.locator('#fireScanValue').textContent(),String(target.mana));assert.equal(await page.locator('#fireScanRank').textContent(),target.rank);
      assert.equal(await page.evaluate(()=>document.body.dataset.state),'MANA_SCAN');assert.equal(await page.locator('#formalReplay').isVisible(),true);
      const check=await page.evaluate(()=>({same:originalOutcome===observedSession.currentResult,frozen:Object.isFrozen(originalOutcome),legacy:legacyLightDraws,history:lightHistory,readouts:readoutHistory}));
      assert.equal(check.same,true);assert.equal(check.frozen,true);assert.equal(check.legacy,0);
      assert.ok(check.readouts.every(r=>['—','A','S','SS'].includes(r)),'light never shows a lower rank');
      assert.ok(check.history.every((v,i,a)=>Number.isFinite(v.time)&&(!i||v.time>=a[i-1].time)),'integrated material clock stays continuous');
      assert.ok(check.history.every((v,i,a)=>!i||v.growth>=a[i-1].growth),'wings only grow during the scan');
      assert.ok(check.history.every((v,i,a)=>!i||v.growth-a[i-1].growth<.2),'no whole-rank visual jump in one frame');
      await page.evaluate(()=>window.realLightPaint=true);await advance(50);await page.screenshot({path:path.join(root,`artifacts/light-formal-${target.rank}-${target.mana}.png`)});
      await page.evaluate(()=>window.realLightPaint=false);const before=await render();await advance(400);const after=await render();assert.notEqual(after.hash,before.hash,'completed light stays alive');
      await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const stopped=await page.evaluate(()=>lightFlow.elapsed);await advance(1000);assert.equal(await page.evaluate(()=>lightFlow.elapsed),stopped);
      await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(100);
      if(target.mana===9999){
        // Exercise both approved transitions through the actual formal host,
        // including the full high-exposure silhouette and settled color.
        const stages=await page.evaluate(()=>LightRankGrowth.timeline(originalOutcome));
        await page.evaluate(()=>{window.savedStageTime=lightFlow.elapsed;lightFlow.paused=true;});
        for(const event of stages){
          for(const [name,elapsed,exposure] of [['forming',event.at+.6,1],['bright',event.formedAt,1],['normal',event.completeAt,0]]){
            await page.evaluate(elapsed=>{lightFlow.elapsed=elapsed;},elapsed);await advance(0);const phase=await render();
            assert.equal(phase.layer.from,event.from);assert.equal(phase.layer.to,event.to);assert.ok(Math.abs(phase.layer.exposure-exposure)<1e-8);
            if(name!=='forming')assert.equal(phase.layer.progress,1);
            await page.evaluate(()=>window.realLightPaint=true);await advance(0);
            await page.screenshot({path:path.join(root,`artifacts/light-formal-${event.from}-${event.to}-${name}.png`)});
            await page.evaluate(()=>window.realLightPaint=false);
          }
        }
        await page.evaluate(()=>{lightFlow.elapsed=FireScanTransition.timing.complete;});await advance(0);
        assert.equal(await page.locator('#fireScanValue').textContent(),'9999');assert.equal(await page.locator('#formalReplay').isVisible(),false,'numeric completion does not skip final wing/color reveal');
        await page.evaluate(()=>{lightFlow.elapsed=LightRankGrowth.sample(10,originalOutcome).completeAt+.05;});await advance(0);
        assert.equal(await page.locator('#formalReplay').isVisible(),true);
        await page.evaluate(()=>{lightFlow.elapsed=savedStageTime;lightFlow.paused=false;});await advance(0);
        // Restore the separate growth program/buffers at an actual host-driven
        // midway pose, not only after the renderer has settled on an endpoint.
        await page.evaluate(()=>{
          window.savedLightElapsed=lightFlow.elapsed;lightFlow.paused=true;
          let lo=0,hi=FireScanTransition.timing.complete;
          for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(LightRankGrowth.sample(mid,originalOutcome).growth<.5)lo=mid;else hi=mid;}
          lightFlow.elapsed=(lo+hi)/2;
        });
        await advance(0);const restoreBefore=await render();
        assert.ok(Math.abs(restoreBefore.args.growth-.5)<1e-7);
        await page.evaluate(()=>{window.lightLoss=formalLight.gl.getExtension('WEBGL_lose_context');lightLoss.loseContext();});
        await page.waitForFunction(()=>formalLight.lost,null,{polling:100});const held=await page.evaluate(()=>lightFlow.elapsed);await advance(300);assert.equal(await page.evaluate(()=>lightFlow.elapsed),held);
        await page.evaluate(()=>lightLoss.restoreContext());await page.waitForFunction(()=>!formalLight.lost&&!!formalLight.program,null,{polling:100});
        await advance(0);const restoreAfter=await render();
        assert.equal(restoreAfter.hash,restoreBefore.hash,'restored growth meshes retain the exact midway image');assert.equal(restoreAfter.gl,0);
        assert.equal(await page.evaluate(()=>formalLight.meshes.length),2);assert.equal(await page.locator('#materialError').isVisible(),false);
        await page.evaluate(()=>{lightFlow.elapsed=savedLightElapsed;lightFlow.paused=false;});await advance(0);
        const captures=[];
        for(const growth of [0,.25,.5,.75,1,1.25,1.5,1.75,2]){
          const sample=await page.evaluate(g=>sampleGrowth(g),growth);assert.ok(sample.finite);
          const file=path.join(root,`artifacts/light-formal-growth-${growth}.png`);fs.writeFileSync(file,Buffer.from(sample.image.split(',')[1],'base64'));captures.push({file,growth});
        }
        const sheet=createCanvas(780,1779),ctx=sheet.getContext('2d');ctx.fillStyle='#ead9a4';ctx.fillRect(0,0,780,1779);ctx.fillStyle='#60471f';ctx.font='18px sans-serif';
        for(let i=0;i<captures.length;i++){const {file,growth}=captures[i],x=i%3*260,y=Math.floor(i/3)*593;ctx.fillText('Growth '+growth,x+12,y+23);ctx.drawImage(await loadImage(file),x,y+30,260,563);}
        fs.writeFileSync(path.join(root,'artifacts/light-formal-growth.png'),sheet.toBuffer('image/png'));
        for(const [a,b] of [[0,.002],[.998,1.002],[1.998,2]]){
          const difference=await page.evaluate(([a,b])=>growthPixelDifference(a,b),[a,b]);assert.ok(difference.mean<3,'growth boundary '+a+'→'+b+' does not switch whole images: '+JSON.stringify(difference));
        }
        const capped=await page.evaluate(()=>{
          const r=formalLight,[ctx,w,h,frame]=r.hostArgs;
          r.draw(ctx,w,h,{...frame,growth:.2,motionTime:8,rank:'A'});const before=r.drawCount;
          for(let i=1;i<=12;i++)r.draw(ctx,w,h,{...frame,growth:.2+i*.02,motionTime:8+i/240,rank:'A'});
          return r.drawCount-before;
        });
        assert.ok(capped<=2,'continuous growing pose respects the material frame cap');
        await page.evaluate(()=>window.realLightPaint=true);
        for(const [width,height] of [[320,568],[844,390],[390,844]]){
          await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));await advance(50);
          const boxes=[];for(const id of ['revealTitle','fireScanLabel','fireScanValue','fireScanRank','formalReplay'])boxes.push(await page.locator('#'+id).boundingBox());
          for(const b of boxes)assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'formal light text fits '+width+'×'+height);
          assert.ok(boxes[0].y+boxes[0].height<boxes[1].y&&boxes[1].y+boxes[1].height<boxes[2].y&&boxes[2].y+boxes[2].height<boxes[3].y,'readout rows stay separate');
          assert.ok(boxes[3].y+boxes[3].height<boxes[4].y,'rank clears retry');
          await page.screenshot({path:path.join(root,`artifacts/light-formal-SS-${width}x${height}.png`)});
        }
        const begins=await page.evaluate(()=>{window.oldLight=formalLight;return beginCalls;});await click('formalReplay');assert.equal(await page.evaluate(()=>beginCalls),begins+1);assert.equal(await page.evaluate(()=>oldLight.disposed),true);assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      }
      await click('effectPreviewBack');assert.equal(await page.evaluate(()=>formalLight.disposed),true);assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      assert.equal(await page.evaluate(()=>formalLight.growthMeshes.length),0);assert.equal(await page.evaluate(()=>formalLight.growthProgram),null);
      console.log('Formal light '+target.rank+' '+target.mana+' passed.');
    }
    assert.deepEqual(errors,[]);console.log('PASS formal light: immutable A/S/SS outcomes, real stroke-to-scan, three wing assets, continuous growth snapshots/boundaries, midway GPU recovery, stable clocks, live completion, three layouts and replay/disposal.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
