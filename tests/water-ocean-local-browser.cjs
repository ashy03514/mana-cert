'use strict';
// Reproduce the user's direct file:// entry with normal browser security.
// Run serially with other GPU suites; do not pass file-access/security overrides.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const embedded={};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/ocean-surface-v1.local.js'),'utf8'),embedded);
assert.ok(embedded.OceanSurfaceLocalTexture.startsWith('data:image/webp;base64,'));
assert.deepEqual(Buffer.from(embedded.OceanSurfaceLocalTexture.split(',')[1],'base64'),
  fs.readFileSync(path.join(root,'assets/ocean-surface-v1.webp')),'file mode embeds exactly the original WebP bytes');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);
    const errors=[],requests=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('request',request=>requests.push(request.url()));
    const localRequests=()=>requests.filter(url=>url.endsWith('/assets/ocean-surface-v1.local.js')).length;
    await page.addInitScript(()=>{
      let now=0,id=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
      cancelAnimationFrame=id=>callbacks.delete(id);
      window.advanceLocalOcean=ms=>{
        do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(callback=>callback(now));}while(ms>0);
      };
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const Original=WaterOceanReveal;
      window.localOceanInstances=[];
      window.WaterOceanReveal=class extends Original {
        constructor(...args){super(...args);localOceanInstances.push(this);window.localOcean=this;}
      };
      window.localOceanPixels=()=>{
        const gl=localOcean.surface.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
        const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let opaque=0,lit=0,hash=2166136261;
        for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
        for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>127)opaque++;if(pixels[i]+pixels[i+1]+pixels[i+2]>60)lit++;}
        return {opaque,lit,total:w*h,hash:hash>>>0,gl:gl.getError(),time:localOcean.lastTime};
      };
    });
    const click=selector=>page.locator(selector).click({force:true});
    const advance=ms=>page.evaluate(ms=>advanceLocalOcean(ms),ms);
    const pixels=()=>page.evaluate(()=>localOceanPixels());
    const ready=async()=>{
      await page.waitForFunction(()=>window.localOcean);
      const result=await page.evaluate(async()=>({ready:await localOcean.ready,loaded:localOcean.loaded,
        error:localOcean.error,diagnostic:localOcean.surface.diagnostic,embedded:localOcean.surface.image?.src.startsWith('data:image/webp;base64,')}));
      assert.equal(result.ready,true,result.diagnostic||result.error);
      assert.equal(result.loaded,true);assert.equal(result.error,'');assert.equal(result.embedded,true);
    };
    assert.equal(localRequests(),0,'settings do not eagerly load the local texture payload');
    await click('#tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click({force:true});
    await click('#materialPreviewOpen');await click('#material_water');await ready();await advance(0);await advance(1500);
    assert.equal(await page.locator('#materialError').isVisible(),false);
    let frame=await pixels();
    assert.equal(frame.gl,0);assert.ok(frame.opaque>frame.total*.10&&frame.lit>frame.total*.05,'local ocean renders visible texture pixels');
    assert.equal(localRequests(),1,'first water preview lazily loads one local texture script');
    assert.equal(requests.some(url=>url.startsWith('file:')&&url.endsWith('/assets/ocean-surface-v1.webp')),false,
      'file preview does not upload an opaque-origin sibling image');
    await click('#materialPause');const paused=await pixels();await advance(800);
    assert.deepEqual(await pixels(),paused,'paused file preview retains identical ocean pixels');
    await click('#materialPause');await advance(200);assert.ok((await pixels()).time>paused.time);
    await click('#materialReplay');await advance(0);assert.equal((await pixels()).time,0);
    await click('#effectPreviewBack');assert.equal(await page.evaluate(()=>localOcean.surface.disposed),true);

    await click('#flowPreviewOpen');await click('#material_water');await ready();await advance(0);
    assert.equal(await page.evaluate(()=>localOceanInstances.length),2,'reentering constructs a fresh renderer');
    assert.equal(localRequests(),1,'fresh renderer reuses the already loaded local payload');
    await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(260,385,{steps:10});await page.mouse.up();
    await advance(5000);const seed=await page.evaluate(()=>localOcean.placement.diameter);
    await advance(750);assert.equal(await page.locator('#fireScanValue').textContent(),'000');
    await advance(4300);
    assert.equal(await page.locator('#fireScanValue').textContent(),'9999');
    assert.equal(await page.locator('#fireScanRank').textContent(),'SS');
    assert.equal(await page.locator('#materialStatus').textContent(),'階段完成');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.ok(await page.evaluate(()=>localOcean.placement.diameter)>seed*2,'file reveal grows from seed to SS');
    frame=await pixels();assert.equal(frame.gl,0);assert.ok(frame.lit>frame.total*.05);
    await click('#materialPause');const held=await pixels();await advance(900);assert.deepEqual(await pixels(),held);
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(root,'artifacts/ocean-reveal-file-ss.png'),timeout:60000});
    await click('#materialReplay');await advance(0);
    assert.equal(await page.locator('#materialStatus').textContent(),'畫完後放開');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    await click('#effectPreviewBack');

    // Explicit overrides remain authoritative; file fallback must not silently
    // replace an intentional texture with the default ocean image.
    const override=await page.evaluate(async()=>{
      const source=document.createElement('canvas');source.width=2;source.height=2;
      const ctx=source.getContext('2d');ctx.fillStyle='#164d70';ctx.fillRect(0,0,2,2);
      const url=source.toDataURL(),renderer=new WaterOceanStudy(document.createElement('canvas'),{textureUrl:url});
      const loaded=await renderer.ready;renderer.resize(128,128,1);const drawn=renderer.draw(2);
      const result={loaded,drawn,original:renderer.image.src===url,gl:renderer.gl.getError()};renderer.dispose();return result;
    });
    assert.deepEqual(override,{loaded:true,drawn:true,original:true,gl:0});
    assert.equal(localRequests(),1);

    await page.goto(pathToFileURL(path.join(root,'water-ocean-study.html')).href);
    const standalone=await page.evaluate(async()=>{
      const renderer=waterOceanStudy.renderer,ready=await renderer.ready;
      waterOceanStudy.renderAt(112);
      const gl=renderer.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let lit=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>60)lit++;
      return {ready,error:renderer.error,diagnostic:renderer.diagnostic,gl:gl.getError(),lit,total:w*h};
    });
    assert.equal(standalone.ready,true,standalone.diagnostic||standalone.error);assert.equal(standalone.error,'');
    assert.equal(standalone.gl,0);assert.ok(standalone.lit>standalone.total*.05);
    assert.equal(await page.locator('#error').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('Local ocean browser passed: exact asset bytes, file entry in both previews, lazy load reuse, visible GPU texture, 9999/SS, pause/replay, explicit override and standalone study.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
