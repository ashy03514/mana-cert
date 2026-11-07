/* Production UI, Canvas rendering and offline cache. Physical-device visuals remain separate. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const repository=path.resolve(__dirname,'..'),prefix='/mana-cert/';
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(!pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
  const file=path.resolve(repository,pathname.slice(prefix.length)||'index.html');
  if(!file.startsWith(repository+path.sep)){response.writeHead(403);response.end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){response.writeHead(404);response.end();return;}
    const types={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp'};
    response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');response.end(data);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+prefix+'index.html';
  const browser=await chromium.launch({executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
    await context.addInitScript(()=>{
      let now=0,serial=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
      window.requestAnimationFrame=callback=>{callbacks.set(++serial,callback);return serial;};
      window.cancelAnimationFrame=id=>callbacks.delete(id);
      window.advanceLightningUpgrade=milliseconds=>{
        do{const dt=Math.min(50,milliseconds);milliseconds-=dt;now+=dt;
          const pending=[...callbacks.values()];callbacks.clear();pending.forEach(callback=>callback(now));
        }while(milliseconds>0);
      };
    });
    const page=await context.newPage(),errors=[],failures=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('response',response=>{if(response.status()>=400)failures.push(response.url());});
    await page.goto(url);
    const click=id=>page.locator('#'+id).click({force:true,noWaitAfter:true});
    const checked=(id,value)=>page.locator('#'+id).setChecked(value,{force:true});
    const input=(id,value)=>page.locator('#'+id).evaluate((element,value)=>{element.value=String(value);element.dispatchEvent(new Event('input',{bubbles:true}));},value);
    const advance=async milliseconds=>{
      do{const step=Math.min(500,milliseconds);milliseconds-=step;
        await page.evaluate(ms=>window.advanceLightningUpgrade(ms),step);
      }while(milliseconds>0);
    };
    const canvasImage=()=>page.locator('#particleCanvas').evaluate(canvas=>canvas.toDataURL());
    await page.evaluate(()=>{
      const observed=window.lightningUpgrade={begins:0,frames:[],draws:0};
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(...args){
        const result=begin.apply(this,args);observed.begins++;observed.session=this;
        observed.result=result;observed.json=JSON.stringify(result);observed.frames=[];return result;
      };
      const step=RevealFlow.prototype.step;
      RevealFlow.prototype.step=function(...args){observed.flow=this;return step.apply(this,args);};
      const draw=LightningStormRenderer.prototype.draw;
      LightningStormRenderer.prototype.draw=function(...args){
        observed.renderer=this;observed.frame=args[4];observed.draws++;
        const phase=LightningStormRenderer.stateAt(args[4].time,this.seed,args[4].lightningEffects);
        observed.phase=phase;
        observed.frames.push({rank:phase.profile.rank,plasma:phase.plasmaGain,
          burst:phase.plasmaState?.burst,flash:phase.flash,
          active:phase.strokes.filter(stroke=>stroke.strength>.03&&stroke.upper>0&&(stroke.impactAge<0||stroke.afterglow>.03||stroke.flash>.01)).length});
        return draw.apply(this,args);
      };
    });
    const snapshot=()=>page.evaluate(()=>{
      const o=window.lightningUpgrade,p=o.phase;
      return {profile:p?.profile,plasma:p?.plasmaGain,burst:p?.plasmaState?.burst,flash:p?.flash,
        salvos:p?.salvos.length,box:o.frame?.box,
        mode:p?.name,result:o.session?.currentResult,begins:o.begins,state:o.session?.state,flow:o.flow?.state,
        stable:o.result===o.session?.currentResult&&Object.isFrozen(o.result)&&o.json===JSON.stringify(o.result)};
    });

    await click('tab_effects');
    await page.locator('details').filter({has:page.locator('#materialPreviewOpen')}).locator('summary').click({force:true});
    await click('materialPreviewOpen');await click('material_lightning');
    const previews={};
    for(const [rank,scale] of [['E',.6],['S',1.8],['SS',2]]){
      await page.evaluate(()=>{lightningUpgrade.frames=[];});
      await click('lightningRank_'+rank);await advance(650);
      const s=await snapshot();
      assert.equal(s.profile.rank,rank);assert.equal(s.profile.orbScale,scale);
      assert.equal(await page.locator('#lightningRank_'+rank).getAttribute('aria-pressed'),'true');
      if(rank==='E'){assert.equal(s.plasma,0);assert.equal(s.profile.skyStrength,0);}
      if(rank==='S'){
        assert.equal(s.plasma,0);assert.equal(s.salvos,3);assert.equal(s.mode,'連續雷暴');
        assert.ok(await page.evaluate(()=>lightningUpgrade.frames.filter(frame=>frame.rank==='S').every(frame=>frame.active>0)),
          'S retains visible falling channels throughout consecutive rendered frames');
      }
      if(rank==='SS'){
        assert.equal(s.plasma,1);assert.equal(s.salvos,0);assert.equal(s.mode,'電漿貫流');
        assert.equal(await page.evaluate(()=>LightningDischarge.plasmaPaths(390,495,2).length),4);
        await advance(1400);
        const pulses=await page.evaluate(()=>lightningUpgrade.frames.filter(frame=>frame.rank==='SS'));
        assert.ok(pulses.every(frame=>frame.plasma===1),'all four channels remain energized throughout the overload');
        assert.ok(Math.max(...pulses.map(frame=>frame.burst))>.85,'SS reaches a distinct overload peak');
        assert.ok(Math.min(...pulses.map(frame=>frame.burst))<.08,'SS releases energy between peaks');
        assert.ok(Math.max(...pulses.map(frame=>frame.flash))>Math.min(...pulses.map(frame=>frame.flash))+.4,
          'the core and surrounding illumination respond to the travelling energy');
      }
      previews[rank]=await canvasImage();
    }
    assert.notEqual(previews.S,previews.SS,'the two top ranks have different rendered effects');
    await click('materialPause');const paused=await canvasImage();await advance(500);assert.equal(await canvasImage(),paused);
    await click('materialReplay');await advance(0);
    assert.ok(await page.evaluate(()=>lightningUpgrade.frame.time<.01),'preview replay resets the animation clock');
    console.log('PASS E/S/SS preview, sustained plasma channels, overload rhythm and pause/replay');
    await click('effectPreviewBack');await click('tab_switches');
    await checked('s_master',false);await checked('s_lightning',true);

    const screenshots=[];
    for(const rank of ['S','SS']){
      await click('tab_probabilities');await input('chance_'+rank,100);await click('btnStart');await advance(0);
      const start=await snapshot();assert.equal(start.result.element,'雷');assert.equal(start.result.rank,rank);
      await page.mouse.move(150,320);await page.mouse.down();await page.mouse.move(250,430,{steps:6});await page.mouse.up();
      await advance(11000);
      const s=await snapshot();
      assert.ok(s.stable);assert.equal(s.begins,start.begins);assert.equal(s.state,'MANA_SCAN');assert.equal(s.flow,'REVEAL');
      assert.equal(s.profile.rank,rank);assert.ok(Math.abs(s.profile.orbScale-(rank==='S'?1.8:2))<1e-8);
      assert.ok(Math.abs(s.plasma-(rank==='SS'?1:0))<1e-8);assert.equal(s.salvos,rank==='SS'?0:3);
      assert.equal(await page.locator('#fireScanValue').textContent(),String(s.result.mana).padStart(3,'0'));
      assert.equal(await page.locator('#fireScanRank').textContent(),rank);
      assert.equal(await page.locator('#materialError').isVisible(),false);assert.equal(await page.locator('#formalReplay').isVisible(),true);
      const title=await page.locator('#revealTitle').boundingBox(),value=await page.locator('#fireScanValue').boundingBox(),grade=await page.locator('#fireScanRank').boundingBox(),button=await page.locator('#formalReplay').boundingBox();
      assert.ok(title.y+title.height<value.y&&value.y+value.height<grade.y&&grade.y+grade.height<button.y);
      assert.ok(await page.evaluate(()=>ResultLayout.bounds(lightningUpgrade.frame.box,'lightning').bottom)<title.y,
        'the enlarged core and arc envelope remain clear of the result readout');
      if(rank==='SS'){
        const images={};
        for(const kind of ['baseline','peak']){
          // Seek forwards to the requested portion of the real animation clock,
          // then let the production RAF path render every intervening frame.
          const delay=await page.evaluate(kind=>{
            const start=lightningUpgrade.phase.plasmaTime;
            for(let ms=20;ms<=2500;ms+=10){
              const burst=LightningDischarge.plasmaState(start+ms/1000).burst;
              if(kind==='peak'?burst>.95:burst<.02)return ms;
            }
            throw Error('No '+kind+' plasma phase within 2.5 seconds');
          },kind);
          await advance(delay);
          const pulse=await snapshot();
          assert.ok(pulse.stable,'overload pulses never reroll or mutate the result');
          assert.equal(pulse.plasma,1);assert.equal(pulse.salvos,0);
          assert.ok(kind==='peak'?pulse.burst>.9:pulse.burst<.05,'rendered '+kind+' matches the plasma clock');
          assert.equal(await page.locator('#fireScanValue').textContent(),String(s.result.mana).padStart(3,'0'));
          images[kind]=await canvasImage();
          const screenshot=path.join(os.tmpdir(),'lightning-upgrade-SS-'+kind+'.png');
          await page.screenshot({path:screenshot});screenshots.push(screenshot);
        }
        assert.notEqual(images.baseline,images.peak,'the overload peak changes actual Canvas pixels');
      }else{
        const screenshot=path.join(os.tmpdir(),'lightning-upgrade-'+rank+'.png');
        await page.screenshot({path:screenshot});screenshots.push(screenshot);
      }
      const moving=await canvasImage();await advance(250);assert.notEqual(await canvasImage(),moving);
      await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const hidden=await canvasImage();await advance(500);
      assert.equal(await canvasImage(),hidden,'background pause freezes the actual Canvas');
      await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(0);
      console.log('PASS formal '+rank+' enlarged core, '+s.mode+', immutable result and readout clearance');
      await click('formalReplay');await click('btnGoHome');
    }
    const version=await page.locator('#appVersion').getAttribute('data-version');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{polling:50});
    await context.setOffline(true);await page.reload();
    assert.equal(await page.locator('#appVersion').getAttribute('data-version'),version);
    assert.equal(await page.evaluate(()=>LightningRankEffects.forRank('SS').orbScale),2);
    assert.equal(await page.evaluate(()=>LightningStormRenderer.stateAt(2,0,LightningRankEffects.preview(2,'SS')).plasmaGain),1);
    assert.equal(await page.evaluate(()=>typeof LightningDischarge.plasmaState),'function');
    assert.equal(await page.evaluate(()=>LightningStormRenderer.stateAt(2,0,LightningRankEffects.preview(2,'S')).salvos.length),3);
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    console.log(JSON.stringify({version,screenshots,result:'PASS E/S/SS preview, continuous S storms, sustained SS plasma and overload peaks, formal S/SS, pause/replay, immutable outcomes, layout and offline cache'}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
