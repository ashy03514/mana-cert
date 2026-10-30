'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHash}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const frames=new Map();Object.defineProperty(performance,'now',{value:()=>now});
      requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const batch=[...frames.values()];frames.clear();batch.forEach(f=>f(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const draw=LightAngelMotionRenderer.prototype.draw,select=ElementMaterialRenderer.prototype.select,reset=RevealFlow.prototype.reset;
      LightAngelMotionRenderer.prototype.draw=function(...args){window.angel=this;window.angelArgs=args;return draw.apply(this,args);};
      ElementMaterialRenderer.prototype.select=function(...args){window.materialClock=this;return select.apply(this,args);};
      RevealFlow.prototype.reset=function(...args){window.flowUnderTest=this;return reset.apply(this,args);};
    });
    const click=id=>page.locator('#'+id).click({force:true});
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await click('materialPreviewOpen');await click('material_light');await page.waitForFunction(()=>angel.loaded,null,{polling:100});
    const loaded=await page.evaluate(async()=>({ready:await angel.ready,error:angel.error,
      ranks:await Promise.all(Object.entries(angel.images).map(async([rank,image])=>{
        const bytes=Uint8Array.from(atob(image.src.split(',')[1]),c=>c.charCodeAt(0));
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
        return {rank,complete:image.complete,width:image.naturalWidth,height:image.naturalHeight,hash};
      }))}));
    assert.equal(loaded.ready,true);assert.equal(loaded.error,'');
    assert.deepEqual(loaded.ranks.map(r=>r.rank).sort(),['A','S','SS']);
    const files={A:'light-angel-wings-a-v1.png',S:'light-angel-wings-s-v1.png',SS:'light-angel-wings-v1.png'};
    for(const image of loaded.ranks){
      assert.equal(image.complete,true);assert.equal(image.width,1536);assert.equal(image.height,1024);
      assert.equal(image.hash,createHash('sha256').update(fs.readFileSync(path.join(root,'assets',files[image.rank]))).digest('hex'),image.rank+' loads the approved PNG exactly through file-compatible embedded data');
    }
    assert.equal(new Set(loaded.ranks.map(r=>r.hash)).size,3,'three distinct wing drawings, not scaled copies of the SS texture');
    // The controlled RAF must paint once after the asynchronous image decode.
    await page.evaluate(()=>advance(0));
    assert.equal(await page.locator('#materialError').isVisible(),false);
    const stats={},captures=[];
    for(const rank of ['A','S','SS']){
      await click('lightRank_'+rank);
      assert.equal(await page.locator('#lightRank_'+rank).getAttribute('aria-pressed'),'true');
      assert.equal(await page.evaluate(()=>materialClock.time),0);
      await page.evaluate(rank=>{materialClock.time=2.38/LightAngelMotion.profile(rank).speed;},rank);
      await click('materialPause');
      stats[rank]=await page.evaluate(()=>({rank:angel.frame.rank,time:angel.frame.time,art:angel.art,
        assetRank:angel.activeAssetRank,bound:angel.gl.getParameter(angel.gl.TEXTURE_BINDING_2D)===angel.textures[angel.frame.rank],
        textureCount:new Set(Object.values(angel.textures)).size,
        image:angel.patch.toDataURL(),stars:angel.sparkleFrames(innerWidth,innerHeight,angel.art,angel.frame).length,gl:angel.gl.getError()}));
      assert.equal(stats[rank].rank,rank);assert.equal(stats[rank].gl,0);assert.ok(Math.abs(stats[rank].time-2.38)<1e-8);
      assert.equal(stats[rank].assetRank,rank);assert.equal(stats[rank].bound,true,rank+' binds its own wing texture');assert.equal(stats[rank].textureCount,3);
      const file=path.join(root,`artifacts/light-angel-rank-${rank}.png`);await page.screenshot({path:file});captures.push(file);
      await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>angel.patch.toDataURL()),stats[rank].image);
      if(rank==='S'){
        await page.evaluate(()=>{window.loss=angel.gl.getExtension('WEBGL_lose_context');loss.loseContext();});
        await page.waitForFunction(()=>angel.lost);const time=await page.evaluate(()=>materialClock.time);
        await page.evaluate(()=>advance(200));assert.equal(await page.evaluate(()=>materialClock.time),time);
        await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!angel.lost&&!!angel.program);
        await page.evaluate(()=>advance(50));
        assert.equal(await page.locator('#lightRank_S').getAttribute('aria-pressed'),'true');
        assert.equal(await page.evaluate(()=>angel.activeAssetRank),'S');
        assert.equal(await page.evaluate(()=>angel.gl.getParameter(angel.gl.TEXTURE_BINDING_2D)===angel.textures.S),true);
        assert.equal(await page.evaluate(()=>angel.patch.toDataURL()),stats.S.image,'context restoration retains the exact paused S wing image');
        assert.equal(await page.evaluate(()=>angel.gl.getError()),0);
      }
      await click('materialReplay');assert.equal(await page.evaluate(()=>angel.frame.time),0);
      assert.equal(await page.evaluate(()=>angel.activeAssetRank),rank,'replay retains rank texture');
    }
    assert.deepEqual(stats.A.art,stats.S.art);assert.deepEqual(stats.S.art,stats.SS.art,'ranks share camera size');
    assert.equal(stats.A.stars,0);assert.ok(stats.S.stars<stats.SS.stars);
    assert.equal(new Set(Object.values(stats).map(s=>s.image)).size,3,'visually different material frames');
    const sheet=createCanvas(390*3,880),ctx=sheet.getContext('2d');ctx.fillStyle='#ead9a4';ctx.fillRect(0,0,1170,880);ctx.fillStyle='#60471f';ctx.font='22px sans-serif';
    for(let i=0;i<3;i++){ctx.drawImage(await loadImage(captures[i]),i*390,36);ctx.fillText(['A','S','SS'][i],i*390+14,27);}
    fs.writeFileSync(path.join(root,'artifacts/light-angel-ranks.png'),sheet.toBuffer('image/png'));
    for(const [width,height] of [[320,568],[844,390]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>{materialClock.time=6;});await click('materialPause');
      await page.screenshot({path:path.join(root,`artifacts/light-angel-ranks-${width}x${height}.png`)});
      const controls=await page.locator('#materialControls').boundingBox();assert.ok(controls.y>0&&controls.x>=0&&controls.y+controls.height<=height+1);
      for(const rank of ['A','S','SS']){const b=await page.locator('#lightRank_'+rank).boundingBox();assert.ok(b.width>=44&&b.height>=44);}
    }
    await page.setViewportSize({width:390,height:844});await click('material_wind');assert.equal(await page.locator('#materialLightRanks').isVisible(),false);
    await click('effectPreviewBack');await click('flowPreviewOpen');await click('material_light');await click('lightRank_S');
    assert.equal(await page.evaluate(()=>flowUnderTest.state),'DRAWING');
    await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(230,380,{steps:8});await page.mouse.up();
    for(let i=0;i<14;i++)await page.evaluate(()=>advance(500));
    assert.equal(await page.evaluate(()=>flowUnderTest.state),'REVEAL');assert.equal(await page.evaluate(()=>angel.frame.rank),'S');
    await click('lightRank_A');assert.equal(await page.evaluate(()=>flowUnderTest.state),'DRAWING');assert.equal(await page.locator('#revealTitle').isVisible(),false);
    await page.evaluate(()=>{flowUnderTest.state='REVEAL';flowUnderTest.elapsed=3;});await page.evaluate(()=>advance(50));
    assert.equal(await page.evaluate(()=>angel.frame.rank),'A');assert.equal(await page.evaluate(()=>angel.frame.burst),0);
    await click('effectPreviewBack');assert.equal(await page.locator('#materialControls').isVisible(),false);
    assert.deepEqual(errors,[]);console.log('PASS light A/S/SS: approved distinct embedded PNGs and GPU textures, same camera, fire rank stars, actual rank controls, pause/replay, S context recovery, phone/landscape layout and draw-to-reveal S / restart A.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
