'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const deps='C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),{createCanvas,loadImage}=require(deps+'@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
    await page.addInitScript(()=>{
      let now=0,id=0;const frames=new Map();requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
      window.advance=ms=>{for(let i=0;i<=ms;i+=50){now+=50;const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(now));}};
    });
    await page.goto(pathToFileURL(path.join(root,'light-angel-growth-study.html')).href);
    await page.waitForFunction(()=>window.wingGrowthStudy?.getState().ready,null,{polling:100});
    const snapshots=[];let baseline;
    for(const g of [0,.20,.40,.60,.80,1]){
      const info=await page.evaluate(g=>{
        wingGrowthStudy.setProgress(g);const r=wingGrowthStudy.renderer;
        // Compare the same gentle pose at every growth value. A transition
        // must not stretch or remap the old column envelopes at all.
        r.lastTime=-Infinity;r.draw(document.querySelector('#angel').getContext('2d'),innerWidth,innerHeight,{growth:g,motionTime:5,time:5,box:r.artBox});
        return {error:r.error,diagnostic:r.diagnostic,gl:r.gl.getError(),outlines:Object.keys(r.outlines),meshes:r.meshes.map(m=>Array.from(m.vertices)),layer:r.layerState};
      },g);
      assert.equal(info.error,'',info.diagnostic);assert.equal(info.gl,0);assert.deepEqual(info.outlines,[],'no source-envelope morphing');
      if(!baseline)baseline=info.meshes;else assert.deepEqual(info.meshes,baseline,'all geometry and UVs stay registered throughout growth');
      assert.ok(info.meshes.flat().every(Number.isFinite));assert.equal(info.layer.progress,g);
      await page.evaluate(g=>wingGrowthStudy.setProgress(g),g);
      const file=path.join(root,`artifacts/light-layered-growth-${g}.png`);await page.screenshot({path:file});snapshots.push(file);
    }
    const sheet=createCanvas(390*3,844*2),sc=sheet.getContext('2d');
    for(let i=0;i<snapshots.length;i++)sc.drawImage(await loadImage(snapshots[i]),i%3*390,Math.floor(i/3)*844);
    fs.writeFileSync(path.join(root,'artifacts/light-layered-growth-contact.png'),sheet.toBuffer('image/png'));
    const appearances=await page.evaluate(()=>[.4,2.4/3.3,.88,1].map(p=>{wingGrowthStudy.setProgress(p);return wingGrowthStudy.getState();}));
    assert.ok(appearances[0].shape<1);assert.equal(appearances[0].exposure,1,'forming feathers stay overexposed');
    assert.equal(appearances[1].shape,1);assert.equal(appearances[1].exposure,1,'complete silhouette exists before exposure settles');
    assert.equal(appearances[2].shape,1);assert.ok(appearances[2].exposure>0&&appearances[2].exposure<1);
    assert.equal(appearances[3].shape,1);assert.equal(appearances[3].exposure,0);
    // Hold the exact same pose and only vary exposure. Restoring texture color
    // must not scale/morph the wing, change the background, or need clock ticks.
    const lightCheck=await page.evaluate(()=>{
      const r=wingGrowthStudy.renderer,ctx=document.querySelector('#angel').getContext('2d');
      const options={growth:1,motionTime:5,time:5};
      r.lastTime=-Infinity;r.draw(ctx,innerWidth,innerHeight,{...options,growthExposure:1});
      const bright=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data,geometry=r.meshes.map(m=>Array.from(m.vertices));
      r.draw(ctx,innerWidth,innerHeight,{...options,growthExposure:0});
      const normal=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
      let lighter=0;for(let i=0;i<bright.length;i+=4)if(bright[i]+bright[i+1]+bright[i+2]>normal[i]+normal[i+1]+normal[i+2]+24)lighter++;
      return {lighter,geometry,settledGeometry:r.meshes.map(m=>Array.from(m.vertices)),corner:[...bright.slice(0,4)],settledCorner:[...normal.slice(0,4)]};
    });
    assert.ok(lightCheck.lighter>1000,'high exposure is visible on the rendered feathers');assert.deepEqual(lightCheck.geometry,lightCheck.settledGeometry);assert.deepEqual(lightCheck.corner,lightCheck.settledCorner);
    await page.locator('[data-progress="0.7272727272727273"]').click();
    await page.screenshot({path:path.join(root,'artifacts/light-layered-high-exposure.png')});
    await page.locator('[data-progress="1"]').click();await page.screenshot({path:path.join(root,'artifacts/light-layered-settled-color.png')});
    // Slider is the real acceptance control; pausing freezes every effect.
    await page.locator('#progress').evaluate(el=>{el.value='370';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#progressValue').textContent(),'37%');
    const before=await page.evaluate(()=>({state:wingGrowthStudy.getState(),draws:wingGrowthStudy.renderer.drawCount}));
    await page.evaluate(()=>advance(1000));assert.deepEqual(await page.evaluate(()=>({state:wingGrowthStudy.getState(),draws:wingGrowthStudy.renderer.drawCount})),before);
    const recoveryBefore=await page.evaluate(()=>{
      const r=wingGrowthStudy.renderer;window.recoveryImage=r.patch.toDataURL();window.ext=r.gl.getExtension('WEBGL_lose_context');ext.loseContext();return !!ext;
    });assert.ok(recoveryBefore);
    await page.waitForFunction(()=>wingGrowthStudy.getState().waiting,null,{polling:100});
    await page.evaluate(()=>ext.restoreContext());await page.waitForFunction(()=>!wingGrowthStudy.getState().waiting,null,{polling:100});
    assert.equal(await page.evaluate(()=>wingGrowthStudy.renderer.patch.toDataURL()===recoveryImage),true,'exact paused frame restored');
    await page.locator('[data-speed="0.5"]').click();await page.locator('#replay').click();
    await page.evaluate(()=>advance(1000));const running=await page.evaluate(()=>wingGrowthStudy.getState());assert.ok(running.time>.45&&running.time<.6);assert.equal(running.speed,.5);
    await page.locator('#pause').click();
    for(const [width,height] of [[320,568],[844,390]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>{dispatchEvent(new Event('resize'));wingGrowthStudy.setProgress(.5);});
      const bounds=await page.locator('.controls').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.equal(await page.locator('#error').isVisible(),false);
      await page.screenshot({path:path.join(root,`artifacts/light-layered-layout-${width}.png`),fullPage:true});
    }
    assert.deepEqual(errors,[]);await page.evaluate(()=>wingGrowthStudy.dispose());assert.equal(await page.evaluate(()=>wingGrowthStudy.renderer.gl),null);
    console.log('PASS A→S layered study: fixed geometry/UV, exposure settles only after complete shape, visible high-light pixel difference, file loading, pause/scrub, half speed, context restoration, layouts, disposal.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
