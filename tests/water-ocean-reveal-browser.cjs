'use strict';
// Exercise the real preview hosts over HTTP: the ocean image must be same-origin.
// The controlled RAF only advances the production active clock; no result or
// shader state is replaced. Run GPU tests serially with the other browser suites.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
  const server=http.createServer((request,response)=>{
    if(request.method!=='GET'){response.writeHead(405);return response.end();}
    let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400);return response.end();}
    const filename=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!filename.startsWith(root+path.sep)){response.writeHead(403);return response.end();}
    fs.readFile(filename,(error,data)=>{
      if(error){response.writeHead(404);return response.end();}
      response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});response.end(data);
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);
    const errors=[],requests=[],layouts=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('request',request=>requests.push(new URL(request.url()).pathname));
    await page.addInitScript(()=>{
      let now=0,id=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
      cancelAnimationFrame=id=>callbacks.delete(id);
      window.advanceOceanReveal=ms=>{
        do{
          const dt=Math.min(50,ms);ms-=dt;now+=dt;
          const pending=[...callbacks.values()];callbacks.clear();pending.forEach(callback=>callback(now));
        }while(ms>0);
      };
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
    const observe=()=>page.evaluate(()=>{
      // Observe lazy construction too: a flow preview waits for its texture
      // before FORM, so its first draw need not have happened yet.
      const OceanReveal=WaterOceanReveal;
      window.WaterOceanReveal=class ObservedOceanReveal extends OceanReveal {
        constructor(...args){super(...args);window.oceanAdapter=this;}
      };
      const draw=WaterOceanReveal.prototype.draw;
      window.oceanDraws=0;window.legacyDraws={};
      WaterOceanReveal.prototype.draw=function(...args){
        window.oceanAdapter=this;window.oceanFrame=args[4];window.oceanDraws++;
        return draw.apply(this,args);
      };
      const legacy=ElementMaterialRenderer.prototype.draw;
      ElementMaterialRenderer.prototype.draw=function(...args){
        window.legacyDraws[this.element]=(window.legacyDraws[this.element]||0)+1;
        return legacy.apply(this,args);
      };
      window.oceanSceneHash=()=>{
        const c=document.getElementById('particleCanvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let hash=2166136261;for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
        return hash>>>0;
      };
    });
    await observe();
    const click=selector=>page.locator(selector).click({force:true});
    const advance=ms=>page.evaluate(ms=>advanceOceanReveal(ms),ms);
    const hash=()=>page.evaluate(()=>oceanSceneHash());
    const state=()=>page.evaluate(()=>({draws:oceanDraws,time:oceanAdapter?.lastTime,
      loaded:oceanAdapter?.loaded,error:oceanAdapter?.error,lost:oceanAdapter?.lost,
      placement:oceanAdapter?.placement,frame:oceanFrame,gl:oceanAdapter?.surface.gl?.getError()}));
    const stroke=async()=>{
      await page.mouse.move(110,300);await page.mouse.down();
      await page.mouse.move(260,385,{steps:10});await page.mouse.up();
    };
    const ready=async()=>{
      await page.waitForFunction(()=>window.oceanAdapter);
      assert.equal(await page.evaluate(()=>oceanAdapter.ready),true,'same-origin ocean texture is ready');
      assert.equal((await state()).loaded,true);
    };

    // Both buttons in the section must reach the same ocean renderer.
    await click('#tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click({force:true});
    await click('#materialPreviewOpen');await click('#material_water');await ready();await advance(0);await advance(1500);
    assert.equal(await page.locator('body').getAttribute('data-state'),'ELEMENT_PREVIEW');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.ok((await state()).placement.diameter>50,'isolated preview draws a visible ocean planet');
    assert.equal((await state()).gl,0);
    assert.equal(await page.evaluate(()=>legacyDraws.water||0),0,'water preview does not also draw the legacy water body');
    for(const asset of ['/js/ocean-surface-shader.js','/js/ocean-spray-field.js','/js/ocean-spray.js','/js/water-ocean-study.js','/assets/ocean-surface-v1.webp'])
      assert.ok(requests.includes(asset),'preview loads '+asset);
    await click('#materialPause');const isolated=await state(),isolatedHash=await hash();
    await advance(1000);assert.equal((await state()).time,isolated.time);assert.equal(await hash(),isolatedHash);
    await click('#materialPause');await advance(200);assert.ok((await state()).time>isolated.time);
    await click('#materialReplay');await advance(0);assert.equal((await state()).time,0,'isolated replay resets ocean time');
    await click('#effectPreviewBack');

    await click('#flowPreviewOpen');await click('#material_water');await ready();await advance(0);
    assert.equal(await page.locator('body').getAttribute('data-state'),'FLOW_PREVIEW');
    await stroke();await advance(5000);
    const seed=await state();assert.ok(seed.placement.diameter>0,'the reveal forms a small water body');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    await advance(750);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),true);
    assert.equal(await page.locator('#fireScanValue').textContent(),'000');
    assert.equal(await page.locator('#revealTitle').textContent(),'水屬性');
    assert.equal(await page.locator('#fireScanLabel').textContent(),'預覽數值');
    await advance(1400);
    const partial=Number(await page.locator('#fireScanValue').textContent());
    assert.ok(partial>0&&partial<9999,'ocean growth follows the actual count-up');
    assert.ok((await state()).placement.diameter>seed.placement.diameter*2,'rising mana grows the ocean planet');
    await advance(2900);
    assert.equal(await page.locator('#fireScanValue').textContent(),'9999');
    assert.equal(await page.locator('#fireScanRank').textContent(),'SS');
    assert.equal(await page.locator('#fireScanReadout').getAttribute('data-element'),'water');
    assert.equal(await page.locator('#materialStatus').textContent(),'階段完成');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.equal((await state()).error,'');assert.equal((await state()).gl,0);
    const complete=await state(),completeHash=await hash();await advance(300);
    assert.ok((await state()).time>complete.time,'SS keeps animating after the readout finishes');
    assert.notEqual(await hash(),completeHash);
    await click('#materialPause');const paused=await state(),pausedHash=await hash();await advance(1200);
    assert.equal((await state()).time,paused.time);assert.equal(await hash(),pausedHash,'pause freezes ocean and surrounding effects');
    await click('#materialPause');await advance(100);assert.ok((await state()).time>paused.time);
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const hidden=await state(),hiddenHash=await hash();
    await advance(1800);assert.equal((await state()).time,hidden.time);assert.equal(await hash(),hiddenHash);
    await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(0);await advance(100);
    assert.ok((await state()).time>hidden.time,'page restore resumes from its existing ocean time');
    await click('#materialPause');

    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    for(const [width,height,name] of [[390,844,'portrait'],[320,568,'small'],[844,390,'landscape']]){
      const before=(await state()).time;
      await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));
      const geometry=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
        return {sphere:oceanAdapter.placement,controls:rect('#materialControls'),title:rect('#revealTitle'),
          readout:['#fireScanLabel','#fireScanValue','#fireScanRank'].map(rect)};
      });
      const p=geometry.sphere,orb={x:p.x,y:p.y,right:p.x+p.diameter,bottom:p.y+p.diameter};
      const apart=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
      assert.ok(p.diameter>40,'SS remains visible on '+name);
      assert.ok(orb.x>=-1&&orb.y>=-1&&orb.right<=width+1&&orb.bottom<=height+1,'ocean fits '+name);
      assert.ok(apart(orb,geometry.controls),'ocean clears playback controls on '+name);
      assert.ok(apart(orb,geometry.title),'ocean clears its attribute title on '+name);
      assert.ok(geometry.readout.every(r=>apart(orb,r)),'ocean clears mana and rank on '+name);
      assert.ok(geometry.readout.every(r=>apart(r,geometry.controls)),'mana and rank clear controls on '+name);
      assert.equal((await state()).time,before,'paused resizing preserves ocean time');
      assert.equal((await state()).gl,0);
      await page.screenshot({path:path.join(root,'artifacts','ocean-reveal-'+name+'.png'),timeout:60000});
      layouts.push({name,diameter:p.diameter});
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>dispatchEvent(new Event('resize')));
    await click('#materialReplay');await advance(0);
    assert.equal(await page.locator('#materialStatus').textContent(),'畫完後放開');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false,'replay clears previous SS readout');
    await click('#material_fire');const waterCalls=(await state()).draws;await advance(250);
    assert.equal((await state()).draws,waterCalls,'switching to fire stops the ocean path');
    await click('#effectPreviewBack');const returnedCalls=(await state()).draws;await advance(250);
    assert.equal((await state()).draws,returnedCalls,'returning to settings stops ocean rendering');

    // Formal water uses the identical ocean renderer and its immutable result.
    await click('#tab_switches');
    await page.locator('#s_master').uncheck({force:true});await page.locator('#s_water').check({force:true});
    await page.locator('#s_muggle').uncheck({force:true});
    const legacyBefore=await page.evaluate(()=>legacyDraws.water||0);
    await page.evaluate(()=>{
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(...args){const result=begin.apply(this,args);window.formalOceanResult=result;window.formalOceanSession=this;return result;};
    });
    await click('#btnStart');await ready();await advance(0);await stroke();await advance(5700);
    assert.equal(await page.evaluate(()=>legacyDraws.water||0),legacyBefore,'formal water does not also draw the legacy body');
    assert.ok((await state()).draws>returnedCalls,'formal water enters the shared ocean adapter');
    assert.ok(await page.evaluate(()=>Object.isFrozen(formalOceanResult)&&formalOceanResult===formalOceanSession.currentResult),'ocean presentation preserves the selected result');
    assert.equal((await state()).frame.waterEffects.profile.rank,'E','formal water starts with the E presentation');
    assert.equal(await page.locator('#materialError').isVisible(),false);

    // Verify the real service worker's precache, then reload and render without
    // a network connection. A cached HTML shell alone cannot pass this check.
    await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    const cached=await page.evaluate(async()=>{
      const paths=['./js/ocean-surface-shader.js','./js/ocean-spray-field.js','./js/ocean-spray.js','./js/water-ocean-study.js','./js/water-rank-effects.js','./js/water-ocean-reveal.js','./assets/ocean-surface-v1.webp'];
      return Promise.all(paths.map(async asset=>({asset,found:Boolean(await caches.match(new URL(asset,location.href).href))})));
    });
    assert.ok(cached.every(entry=>entry.found),'all ocean rendering resources are precached: '+JSON.stringify(cached));
    await page.context().setOffline(true);
    try{
      await page.reload({waitUntil:'domcontentloaded'});await observe();
      await click('#tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click({force:true});
      await click('#materialPreviewOpen');await click('#material_water');await ready();await advance(0);await advance(1500);
      assert.equal(await page.locator('#materialError').isVisible(),false,'ocean material loads and renders offline');
      assert.ok((await state()).placement.diameter>50);
      assert.equal((await state()).gl,0);
    }finally{await page.context().setOffline(false);}
    assert.deepEqual(errors,[]);
    assert.ok(!requests.some(url=>url.endsWith('/ocean-surface-v1.local.js')),'HTTP/PWA keeps using the original WebP without loading the local-file payload');
    console.log('Ocean reveal integration passed: both previews, image loading, small-to-SS growth, readout, controls, lifecycle, formal shared ocean and real offline reload.',JSON.stringify(layouts));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
