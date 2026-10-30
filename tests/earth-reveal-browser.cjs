'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
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
      let now=0,serial=0;const frames=new Map();
      Object.defineProperty(performance,'now',{value:()=>now});
      requestAnimationFrame=f=>{frames.set(++serial,f);return serial;};cancelAnimationFrame=id=>frames.delete(id);
      window.advanceEarth=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const batch=[...frames.values()];frames.clear();batch.forEach(f=>f(now));}while(ms>0);};
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d')args[0]={...args[0],willReadFrequently:true};return get.call(this,type,...args);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const draw=EarthMountainRenderer.prototype.draw;
      EarthMountainRenderer.prototype.draw=function(...args){window.earthRenderer=this;this.sampleArgs=args;return draw.apply(this,args);};
      const reset=RevealFlow.prototype.reset;
      RevealFlow.prototype.reset=function(...args){window.earthFlow=this;return reset.apply(this,args);};
      window.earthStats=()=>{
        const r=earthRenderer,p=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        let hash=2166136261,visible=0,light=0;for(let i=0;i<p.length;i++){hash=Math.imul(hash^p[i],16777619);if(i%4===3&&p[i]>128){visible++;if(p[i-3]+p[i-2]+p[i-1]>75)light++;}}
        return {rank:r.profile.rank,hash:hash>>>0,visible,light,box:r.renderBox,time:r.time,formation:r.formation,meshes:r.meshes.length,
          gl:r.gl.getError(),error:r.error,draws:r.drawCount};
      };
      window.sampleEarth=(time,formation=1)=>{
        const r=earthRenderer,[ctx,bg,w,h,frame]=r.sampleArgs;
        draw.call(r,ctx,bg,w,h,{...frame,time,formation});return earthStats();
      };
    });
    const click=id=>page.locator('#'+id).click({force:true});
    const advance=ms=>page.evaluate(ms=>advanceEarth(ms),ms);
    const sample=t=>page.evaluate(t=>sampleEarth(t),t);
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await click('materialPreviewOpen');await click('material_earth');
    assert.ok(await page.locator('#materialEarthRanks').isVisible());
    assert.equal(await page.locator('#materialWindRanks').isVisible(),false);
    const frames=[],stats={};
    for(const rank of ['E','D','C','B','A','S','SS']){
      await click('earthRank_'+rank);
      const time=await page.evaluate(rank=>3.6/EarthRankEffects.forRank(rank).speed,rank);
      const s=await sample(time);stats[rank]=s;
      assert.equal(s.rank,rank);assert.equal(s.error,'');assert.equal(s.gl,0);assert.ok(s.visible>250,rank+' has a visible rock structure');
      assert.ok(s.light>s.visible*.40,rank+' has readable stone detail');
      assert.equal((await sample(time)).hash,s.hash,'paused rock is deterministic');
      assert.notEqual((await sample(time+.4)).hash,s.hash,'material keeps moving after the drawing ends');
      await sample(time);
      const filename=path.join(root,'artifacts/earth-rank-'+rank+'.png');await page.screenshot({path:filename});frames.push({rank,image:await loadImage(filename)});
    }
    assert.equal(new Set(Object.values(stats).map(s=>s.hash)).size,7);
    for(const s of Object.values(stats))assert.deepEqual(s.box,stats.SS.box,'all ranks share the same camera framing');
    assert.ok(stats.E.visible<stats.D.visible&&stats.D.visible<stats.C.visible&&stats.C.visible<stats.B.visible&&stats.B.visible<stats.A.visible);
    const sheet=createCanvas(390*7,878),c=sheet.getContext('2d');c.fillStyle='#111110';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#dfcaa8';c.font='20px sans-serif';
    frames.forEach(({rank,image},i)=>{c.drawImage(image,i*390,34);c.fillText(rank,i*390+16,25);});
    fs.writeFileSync(path.join(root,'artifacts/earth-ranks-overview.png'),sheet.toBuffer('image/png'));
    // Both the accepted standalone and main sample use identical geometry/shadow pixels.
    const shared=await page.evaluate(()=>{
      const live=earthRenderer,other=new EarthMountainRenderer(),canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;
      other.draw(canvas.getContext('2d'),null,390,844,{time:3.6,box:live.renderBox});
      const equal=other.patch.toDataURL()===live.patch.toDataURL();other.dispose();window.earthRenderer=live;return equal;
    });
    assert.ok(shared,'SS transplant preserves the accepted renderer exactly');
    // Varying assembly transforms rigid pieces and invalidates the retained frame even at fixed time.
    const assembled=await sample(0);
    const assembling=await page.evaluate(()=>sampleEarth(0,.3));assert.notEqual(assembled.hash,assembling.hash);
    assert.equal((await sample(0)).hash,assembled.hash);
    await click('materialPause');const paused=await page.evaluate(()=>earthRenderer.time);await advance(250);assert.equal(await page.evaluate(()=>earthRenderer.time),paused);
    await click('earthRank_C');assert.equal(await page.locator('#materialPause').textContent(),'暫停');assert.equal(await page.evaluate(()=>earthRenderer.time),0);
    // Recover shadow buffers and the selected non-SS geometry after actual GL context loss.
    const before=await sample(3);
    await page.evaluate(()=>{window.loss=earthRenderer.gl.getExtension('WEBGL_lose_context');loss.loseContext();});
    await page.waitForFunction(()=>earthRenderer.lost);await advance(100);
    await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!earthRenderer.lost&&!!earthRenderer.program);
    assert.equal((await sample(3)).hash,before.hash);
    // Real controls switch renderers without contaminating the other attribute's rank UI.
    await click('material_fire');assert.equal(await page.locator('#materialEarthRanks').isVisible(),false);
    await click('material_wind');assert.ok(await page.locator('#materialWindRanks').isVisible());
    await click('material_earth');assert.ok(await page.locator('#materialEarthRanks').isVisible());
    await page.evaluate(()=>window.oldEarth=earthRenderer);await click('effectPreviewBack');assert.ok(await page.evaluate(()=>oldEarth.disposed));
    await click('flowPreviewOpen');await click('material_earth');assert.equal(await page.locator('#earthRank_C').getAttribute('aria-pressed'),'true');
    await page.mouse.move(100,240);await page.mouse.down();await page.mouse.move(250,310,{steps:4});await page.mouse.up();
    await advance(5500);
    assert.equal(await page.evaluate(()=>earthFlow.state),'REVEAL');assert.equal(await page.evaluate(()=>earthRenderer.profile.rank),'C');
    const t=await page.evaluate(()=>earthRenderer.time);await advance(200);assert.ok(await page.evaluate(()=>earthRenderer.time)>t);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false,'rank samples do not invent committed numeric results');
    await click('materialPause');const frozen=await page.evaluate(()=>earthRenderer.time);await advance(100);assert.equal(await page.evaluate(()=>earthRenderer.time),frozen);
    await click('earthRank_SS');assert.equal(await page.locator('#materialStatus').textContent(),'畫完後放開');
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      // Presentation geometry check at the host's actual REVEAL state, avoiding repeated GPU simulation of the already-tested gathering.
      await page.evaluate(()=>{earthFlow.state='REVEAL';earthFlow.elapsed=2;earthFlow.paused=false;});await advance(50);
      const bounds=await page.evaluate(()=>{
        const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        return{controls:rect('materialControls'),title:rect('revealTitle'),ranks:['E','D','C','B','A','S','SS'].map(r=>rect('earthRank_'+r)),box:earthRenderer.renderBox};
      });
      for(const b of bounds.ranks)assert.ok(b.x>=0&&b.right<=viewport.width&&b.y>=0&&b.bottom<=viewport.height,'rank controls fit '+JSON.stringify(viewport));
      assert.ok(bounds.title.width>0&&bounds.title.bottom<=bounds.controls.y+1,'title remains separate from rank controls');
      if(viewport.width>viewport.height)assert.ok(bounds.box.x+bounds.box.width<=bounds.controls.x,'landscape keeps mountain clear of controls');
      await page.screenshot({path:path.join(root,'artifacts/earth-reveal-'+viewport.width+'x'+viewport.height+'.png')});
    }
    await click('effectPreviewBack');assert.ok(await page.evaluate(()=>earthRenderer.disposed));
    // A selected SS preview must not replace the committed formal rank.
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(...args){const result=begin.apply(this,args);window.earthSession=this;window.earthResult=result;return result;};
      const draw=ElementMaterialRenderer.prototype.draw;window.legacyEarthCount=0;
      ElementMaterialRenderer.prototype.draw=function(...args){if(this.element==='earth')legacyEarthCount++;return draw.apply(this,args);};
    });
    await click('tab_switches');await page.locator('#s_master').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
    for(const key of ['fire','water','wind','light','dark'])await page.locator('#s_'+key).uncheck({force:true});
    await click('btnStart');await advance(0);
    await page.mouse.move(100,240);await page.mouse.down();await page.mouse.move(250,310,{steps:4});await page.mouse.up();await advance(5500);
    const formal=await page.evaluate(()=>({legacy:legacyEarthCount,same:earthSession.currentResult===earthResult,frozen:Object.isFrozen(earthResult),
      effects:earthRenderer.sampleArgs[4].earthEffects,active:!earthRenderer.disposed,error:earthRenderer.error}));
    assert.equal(formal.legacy,0);assert.ok(formal.same&&formal.frozen&&formal.active&&formal.effects);assert.equal(formal.error,'');
    assert.equal(await page.locator('#materialControls').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('Earth reveal browser passed: seven ranks, SS parity, assembly, file entry, controls, pause/replay, context recovery, shared flow and three viewport layouts.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
