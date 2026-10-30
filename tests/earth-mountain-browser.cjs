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
    page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
    await page.addInitScript(()=>{
      const native=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d')args[0]={...args[0],willReadFrequently:true};return native.call(this,type,...args);};
      let now=0,id=0;const callbacks=new Map();
      requestAnimationFrame=f=>{callbacks.set(++id,f);return id;};cancelAnimationFrame=i=>callbacks.delete(i);
      window.advanceEarth=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...callbacks.values()];callbacks.clear();run.forEach(f=>f(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'earth-mountain-study.html')).href);
    await page.waitForFunction(()=>window.earthMountainStudy?.renderer);
    await page.evaluate(()=>{window.earthStats=()=>{
      const r=earthMountainStudy.renderer,c=r.patchCtx,p=c.getImageData(0,0,r.patch.width,r.patch.height).data;
      let visible=0,light=0,hash=2166136261,minY=r.patch.height,maxY=0;
      for(let i=0;i<p.length;i++){hash=Math.imul(hash^p[i],16777619);if(i%4===3&&p[i]>128){visible++;const y=Math.floor(i/4/r.patch.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(p[i-3]+p[i-2]+p[i-1]>75)light++;}}
      return {error:r.error,diagnostic:r.diagnostic,gl:r.gl?.getError(),visible,light,hash:hash>>>0,minY,maxY,width:r.patch.width,height:r.patch.height,
        time:r.lastTime,drawCount:r.drawCount,image:document.getElementById('mountain').toDataURL()};
    };});
    const at=async time=>{await page.evaluate(t=>earthMountainStudy.renderAt(t),time);return page.evaluate(()=>earthStats());};
    const frames=[];
    for(const time of [1.3,3.6,4.43,4.75]){
      const f=await at(time);frames.push({...f,time});
      assert.equal(f.error,'',f.diagnostic);assert.equal(f.gl,0);assert.ok(f.visible>f.width*f.height*.12,'rock has a substantial visible silhouette');
      assert.ok(f.light>f.visible*.5,'stone surface has readable light and shade');
      assert.ok(f.minY>0&&f.maxY<f.height-1,`the whole mountain fits the art window at ${time}: ${f.minY}..${f.maxY}/${f.height}`);
    }
    assert.notEqual(frames[0].hash,frames[1].hash,'open strata produce a visibly different structure');
    assert.ok(frames[1].minY<frames[0].minY-12,'the upper strata lift visibly');
    const collision=await page.evaluate(()=>{
      const r=earthMountainStudy.renderer,canvas=document.createElement('canvas');canvas.width=390;canvas.height=430;
      const c=canvas.getContext('2d'),box={x:0,y:0,width:390,height:390};
      const particles=r.collisionParticles(4.43);
      for(const front of [false,true])r.drawCollision(c,box,particles,front);
      const p=c.getImageData(0,0,390,430).data;let visible=0,warm=0;
      for(let i=0;i<p.length;i+=4){if(p[i+3]>10)visible++;if(p[i]>180&&p[i+1]>80&&p[i+3]>30)warm++;}
      return {visible,warm,image:canvas.toDataURL()};
    });
    assert.ok(collision.visible>1800,'collision paints a broad visible cloud plus solid debris');
    assert.ok(collision.warm>20,'short friction sparks are visible among the rock chips');
    fs.writeFileSync(path.join(root,'artifacts/earth-impact-ejecta.png'),Buffer.from(collision.image.split(',')[1],'base64'));
    const pause=await at(3.6),same=await at(3.6);
    assert.equal(pause.image,same.image,'paused full composite stays pixel-identical');assert.equal(same.drawCount,pause.drawCount);
    await at(120);assert.equal((await at(3.6)).image,same.image,'future inspection and rewind do not stretch or mutate rock');
    const sheet=createCanvas(390*4,884),c=sheet.getContext('2d');c.fillStyle='#0d0e0f';c.fillRect(0,0,sheet.width,sheet.height);c.font='17px sans-serif';
    for(let i=0;i<frames.length;i++){c.fillStyle='#dfcaa8';c.fillText(frames[i].time.toFixed(2)+' s',i*390+12,26);c.drawImage(await loadImage(frames[i].image),i*390,40,390,844);}
    fs.writeFileSync(path.join(root,'artifacts/earth-mountain-phases.png'),sheet.toBuffer('image/png'));
    for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>earthMountainStudy.resize());const f=await at(3.6);
      assert.equal(f.gl,0);assert.ok(f.visible>1000);assert.ok(f.width<=700&&f.height<=700);
      for(const selector of ['#pause','#replay']){
        const b=await page.locator(selector).boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=viewport.height+1,'playback controls fit '+JSON.stringify(viewport));
      }
      await page.screenshot({path:path.join(root,'artifacts/earth-mountain-'+viewport.width+'x'+viewport.height+'.png')});
    }
    await page.locator('#replay').click();assert.equal(await page.evaluate(()=>earthMountainStudy.time),0);
    await page.evaluate(()=>advanceEarth(0));await page.evaluate(()=>advanceEarth(100));const active=await page.evaluate(()=>earthMountainStudy.time);assert.ok(active>.09);
    await page.locator('#pause').click();await page.evaluate(()=>advanceEarth(400));assert.equal(await page.evaluate(()=>earthMountainStudy.time),active);
    await page.locator('[data-speed="1.5"]').click();await page.locator('#pause').click();await page.evaluate(()=>advanceEarth(0));await page.evaluate(()=>advanceEarth(100));
    assert.ok(Math.abs(await page.evaluate(()=>earthMountainStudy.time)-active-.15)<1e-6,'1.5 speed uses the same active clock');
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const frozen=await page.evaluate(()=>earthMountainStudy.time);
    await page.evaluate(()=>advanceEarth(400));assert.equal(await page.evaluate(()=>earthMountainStudy.time),frozen);
    await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await page.evaluate(()=>advanceEarth(0));await page.evaluate(()=>advanceEarth(100));assert.ok(await page.evaluate(()=>earthMountainStudy.time)>frozen);
    const original=await at(3.6);
    await page.evaluate(()=>{window.earthLoss=earthMountainStudy.renderer.gl.getExtension('WEBGL_lose_context');earthLoss.loseContext();});
    await page.waitForFunction(()=>earthMountainStudy.renderer.lost);
    await page.evaluate(()=>advanceEarth(300));assert.equal(await page.evaluate(()=>earthMountainStudy.time),3.6,'context loss keeps the inspected time');
    await page.evaluate(()=>earthLoss.restoreContext());
    await page.waitForFunction(()=>!earthMountainStudy.renderer.lost&&!!earthMountainStudy.renderer.program);
    const restored=await at(3.6);assert.equal(restored.gl,0);assert.equal(restored.hash,original.hash,'restored depth and shadow resources reproduce the same stone');
    await page.evaluate(()=>earthMountainStudy.dispose());assert.equal(await page.evaluate(()=>earthMountainStudy.renderer.disposed),true);
    assert.deepEqual(errors,[]);console.log('Earth SS GPU passed: depth/shadows, distinct phase silhouettes, pause/rewind, file entry, responsive controls, speeds, lifecycle.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
