'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
    page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
    await page.addInitScript(()=>{
      let next=1,clock=0;const frames=new Map();
      window.requestAnimationFrame=callback=>{const id=next++;frames.set(id,callback);return id;};
      window.cancelAnimationFrame=id=>frames.delete(id);
      window.advanceAngel=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=50){clock+=Math.min(50,ms-elapsed);const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(clock));}};
      window.angelFrames=()=>frames.size;
      window.angelHash=()=>{const c=document.querySelector('#angel'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(let i=0;i<p.length;i+=4)hash=Math.imul(hash^p[i],16777619)>>>0;return hash;};
    });
    await page.goto(pathToFileURL(path.join(root,'light-angel-motion-study.html')).href);
    await page.waitForFunction(()=>!lightAngelMotionStudy.state.loading||lightAngelMotionStudy.state.failed);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.state.failed),false);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.meshes.length),2,'exactly one articulated pair');
    const phases=[];
    for(const time of [1.72,2.38,3.15,6.3]){
      await page.evaluate(t=>lightAngelMotionStudy.renderAt(t),time);
      assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.gl.getError()),0,'valid textured draw');
      const file=path.join(root,`artifacts/light-angel-motion-${time}.png`);await page.screenshot({path:file});phases.push(file);
    }
    const contact=createCanvas(390*4,844),contactCtx=contact.getContext('2d');
    for(let i=0;i<phases.length;i++)contactCtx.drawImage(await loadImage(phases[i]),i*390,0);
    fs.writeFileSync(path.join(root,'artifacts/light-angel-motion-phases.png'),contact.toBuffer('image/png'));
    console.log('Captured four motion phases.');
    const final=await page.evaluate(()=>angelHash());
    await page.evaluate(()=>advanceAngel(500));assert.equal(await page.evaluate(()=>angelHash()),final,'paused frame remains identical');
    await page.evaluate(()=>lightAngelMotionStudy.renderAt(5.2));assert.notEqual(await page.evaluate(()=>angelHash()),final,'living wings continue moving after unfold');
    const fixed=await page.evaluate(()=>angelHash());
    await page.evaluate(()=>{lightAngelMotionStudy.renderAt(.8);lightAngelMotionStudy.renderAt(5.2);});
    assert.equal(await page.evaluate(()=>angelHash()),fixed,'replay samples identical pose, glow and light');
    const rays=await page.evaluate(()=>{
      const r=lightAngelMotionStudy.renderer,gl=r.gl,u=r.bgUniforms;
      const take=(time,motion,burst)=>{
        gl.useProgram(r.program);gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,r.quad);
        gl.enableVertexAttribArray(r.bgPosition);gl.vertexAttribPointer(r.bgPosition,2,gl.FLOAT,false,0,0);
        if(r.meshUv!==r.bgPosition)gl.disableVertexAttribArray(r.meshUv);
        gl.uniform1f(u.uTime,time);gl.uniform1f(u.uCrown,0);gl.uniform1f(u.uGodRays,1);gl.uniform1f(u.uRayMotion,motion);gl.uniform1f(u.uRayBurst,burst);
        gl.drawArrays(gl.TRIANGLES,0,6);
        const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
      };
      const a=take(5,1,0),b=take(7.5,1,0),quiet=take(2.2,1,0),burst=take(2.2,1,1);
      const sums=Array(36).fill(0),counts=Array(36).fill(0);let boost=0,total=0;
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,art=r.art;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const dx=(x/w*innerWidth-art.cx)/art.unit,dy=((1-y/h)*innerHeight-art.cy)/art.unit,d=Math.hypot(dx,dy);
        if(d<.7||d>2||dy>.5)continue;
        const sector=Math.min(35,Math.floor((Math.atan2(dy,dx)+Math.PI)/(Math.PI*2)*36)),i=(y*w+x)*4;
        sums[sector]+=(b[i]+b[i+1]+b[i+2]-a[i]-a[i+1]-a[i+2])/3;counts[sector]++;
        boost+=(burst[i]+burst[i+1]+burst[i+2]-quiet[i]-quiet[i+1]-quiet[i+2])/3;total++;
      }
      const changes=sums.map((s,i)=>counts[i]>50?s/counts[i]:0);
      r.lastTime=-Infinity;lightAngelMotionStudy.renderAt(5.2);
      return {brightening:changes.filter(v=>v>1).length,dimming:changes.filter(v=>v< -1).length,boost:boost/total};
    });
    assert.ok(rays.brightening>=3&&rays.dimming>=3,'separate light sectors brighten and dim independently');
    assert.ok(rays.boost>5,'explosive release strengthens the backlight');console.log('Dynamic backlight',rays);
    const idle=await page.evaluate(()=>{
      const r=lightAngelMotionStudy.renderer,canvas=document.querySelector('#angel'),ctx=canvas.getContext('2d');
      const core=document.createElement('canvas');core.width=core.height=320;const c=core.getContext('2d');
      const captureCore=t=>{c.clearRect(0,0,320,320);r.paintCore(c,{cx:160,cy:160,width:300},LightAngelMotion.sample(t));return c.getImageData(0,0,320,320).data;};
      const a=captureCore(5.1),b=captureCore(5.8);let coreChanges=0;
      for(let i=3;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>8)coreChanges++;
      lightAngelMotionStudy.renderAt(5.2);const withDust=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const paint=r.paintAmbient;r.paintAmbient=()=>{};r.lastTime=-Infinity;lightAngelMotionStudy.renderAt(5.2);
      const withoutDust=ctx.getImageData(0,0,canvas.width,canvas.height).data;let dustPixels=0;
      for(let i=0;i<withDust.length;i+=4)if(withDust[i]+withDust[i+1]+withDust[i+2]-withoutDust[i]-withoutDust[i+1]-withoutDust[i+2]>12)dustPixels++;
      r.paintAmbient=paint;r.lastTime=-Infinity;lightAngelMotionStudy.renderAt(5.2);
      return {coreChanges,dustPixels};
    });
    assert.ok(idle.coreChanges>100,'central glare and its spikes visibly fluctuate during idle');
    assert.ok(idle.dustPixels>100,'outgoing background light dots render during idle');console.log('Idle light layers',idle);
    const stars=await page.evaluate(()=>{
      const r=lightAngelMotionStudy.renderer,c=document.querySelector('#angel'),x=c.getContext('2d');
      const events=[],core=r.paintCore,foreground=r.paintForegroundStars;
      r.paintCore=function(...args){events.push('core');return core.apply(this,args);};
      r.paintForegroundStars=function(...args){events.push('foreground');return foreground.apply(this,args);};
      r.lastTime=-Infinity;lightAngelMotionStudy.renderAt(6.3);
      const withStars=x.getImageData(0,0,c.width,c.height).data;
      const frames=r.sparkleFrames(innerWidth,innerHeight,r.art,r.frame);
      r.paintCore=core;r.paintForegroundStars=()=>{};r.lastTime=-Infinity;lightAngelMotionStudy.renderAt(6.3);
      const withoutStars=x.getImageData(0,0,c.width,c.height).data;let changed=0;
      for(let i=0;i<withStars.length;i+=4)if(Math.abs(withStars[i]-withoutStars[i])+Math.abs(withStars[i+1]-withoutStars[i+1])+Math.abs(withStars[i+2]-withoutStars[i+2])>10)changed++;
      r.paintForegroundStars=foreground;r.lastTime=-Infinity;lightAngelMotionStudy.renderAt(6.3);
      return {events,visible:frames.filter(p=>p.alpha>.2&&p.radius>1).length,changed};
    });
    assert.deepEqual(stars.events,['core','foreground'],'shared fire stars draw after the central glare');
    assert.ok(stars.visible>=5&&stars.changed>50,'foreground star layer is visible during idle');console.log('Foreground fire glints',stars);
    for(const time of [5.2,6.1,7.2]){
      await page.evaluate(t=>lightAngelMotionStudy.renderAt(t),time);
      assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.frame.burst),0);
      await page.screenshot({path:path.join(root,`artifacts/light-angel-idle-${time}.png`)});
    }
    await page.evaluate(()=>lightAngelMotionStudy.renderAt(2.38));
    for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>lightAngelMotionStudy.resize());
      assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.gl.getError()),0);
      for(const selector of ['#pause','#replay','[data-time="3.15"]']){
        const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=viewport.width+1&&b.y>=0&&b.y+b.height<=viewport.height+1,'accessible controls at '+viewport.width+'x'+viewport.height);
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
      await page.screenshot({path:path.join(root,`artifacts/light-angel-motion-${viewport.width}x${viewport.height}.png`)});
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>lightAngelMotionStudy.resize());
    await page.locator('#replay').click();assert.equal(await page.evaluate(()=>lightAngelMotionStudy.time),0);
    await page.evaluate(()=>advanceAngel(150));assert.ok(Math.abs(await page.evaluate(()=>lightAngelMotionStudy.time)-.1)<1e-8);
    await page.locator('[data-speed="1.5"]').click();await page.evaluate(()=>advanceAngel(150));
    assert.ok(Math.abs(await page.evaluate(()=>lightAngelMotionStudy.time)-.25)<1e-8,'speed changes host clock');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));advanceAngel(500);});
    assert.ok(Math.abs(await page.evaluate(()=>lightAngelMotionStudy.time)-.25)<1e-8,'hidden page freezes time');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));advanceAngel(100);});
    assert.ok(Math.abs(await page.evaluate(()=>lightAngelMotionStudy.time)-.325)<1e-8,'return has no catch-up jump');
    await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));advanceAngel(500);});
    assert.ok(Math.abs(await page.evaluate(()=>lightAngelMotionStudy.time)-.325)<1e-8,'bfcache freezes time');
    await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));lightAngelMotionStudy.renderAt(5.2);});
    const restoredHash=await page.evaluate(()=>angelHash());
    await page.evaluate(()=>{window.loss=lightAngelMotionStudy.renderer.gl.getExtension('WEBGL_lose_context');loss.loseContext();});
    await page.waitForFunction(()=>lightAngelMotionStudy.state.waiting);
    await page.evaluate(()=>advanceAngel(500));assert.equal(await page.evaluate(()=>lightAngelMotionStudy.time),5.2);
    await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!lightAngelMotionStudy.state.waiting);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.state.failed),false);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.gl.getError()),0);
    assert.equal(await page.evaluate(()=>angelHash()),restoredHash,'context recovery preserves pose and texture');
    await page.evaluate(()=>lightAngelMotionStudy.renderAt(3600));assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.gl.getError()),0);
    await page.evaluate(()=>lightAngelMotionStudy.dispose());
    assert.equal(await page.evaluate(()=>angelFrames()),0,'RAF cleaned up');
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.gl),null);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.meshes.length),0);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.dustProgram),null);
    assert.equal(await page.evaluate(()=>lightAngelMotionStudy.renderer.dustBuffer),null);
    assert.deepEqual(errors,[]);assert.equal(requests.filter(url=>/^https?:/.test(url)).length,0,'local file works without remote assets');
    console.log('Angel motion browser passed: local texture, one pair, deterministic phases, responsive controls, playback, visibility, context restore and disposal.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
