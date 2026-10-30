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
    await page.addInitScript(()=>{requestAnimationFrame=()=>1;cancelAnimationFrame=()=>{};});
    await page.goto(pathToFileURL(path.join(root,'earth-mountain-study.html')).href);
    const frames=[];
    for(const time of [1.3,3.6,4.2,4.45,4.8,5.4,6.6]){
      const f=await page.evaluate(t=>{
        earthMountainStudy.renderAt(t);const b=earthMountainStudy.renderer.earthBackdrop;
        return{failed:b.failed,lost:b.lost,diagnostic:b.diagnostic,gl:b.gl?.getError(),time:b.lastTime,image:document.getElementById('mountain').toDataURL()};
      },time);
      assert.equal(f.failed,false,f.diagnostic);assert.equal(f.lost,false);assert.equal(f.gl,0);assert.equal(f.time,time);
      frames.push({time,image:await loadImage(f.image)});
    }
    const sheet=createCanvas(390*frames.length,878),paint=sheet.getContext('2d');paint.fillStyle='#111110';paint.fillRect(0,0,sheet.width,sheet.height);paint.font='18px sans-serif';paint.fillStyle='#dfcaa8';
    frames.forEach((f,i)=>{paint.fillText(f.time+' s',i*390+12,25);paint.drawImage(f.image,i*390,34);});
    fs.writeFileSync(path.join(root,'artifacts/earth-backdrop-phases.png'),sheet.toBuffer('image/png'));
    await page.evaluate(()=>{
      const r=earthMountainStudy.renderer;window.probeBackdrop=(rank,time,hostTime=time,readout={x:110,y:440,width:170,height:220},actionTime=time)=>{
        const canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;
        r.earthBackdrop.draw(canvas.getContext('2d'),390,844,{time,actionTime,hostTime,profile:EarthRankEffects.forRank(rank),box:{x:8,y:40,width:374,height:374},readout});
        const b=r.earthBackdrop,p=b.ctx.getImageData(0,0,b.patch.width,b.patch.height).data;
        let alpha=0,hash=2166136261,bright=0;
        for(let i=0;i<p.length;i++){hash=Math.imul(hash^p[i],16777619);if(i%4===3){alpha+=p[i];if(p[i]>20)bright++;}}
        return {alpha,bright,hash:hash>>>0,draws:b.drawCount,pulse:b.periodicFrame,width:b.patch.width,height:b.patch.height,image:canvas.toDataURL(),gl:b.gl?.getError(),failed:b.failed};
      };
    });
    const sample=(rank,time,host=time)=>page.evaluate(([r,t,h])=>probeBackdrop(r,t,h),[rank,time,host]);
    const periodic=host=>page.evaluate(t=>probeBackdrop('E',.5,t,undefined,.3),host);
    const resting=await periodic(0),regular=await periodic(.5),repeat=await periodic(2.5);
    assert.ok(regular.alpha>resting.alpha*3,'E has a visible wave while the rock action is neutral');
    assert.equal(regular.image,repeat.image,'regular pulse repeats after exactly two active seconds');
    const paused=await periodic(2.5);assert.equal(paused.image,repeat.image);assert.equal(paused.draws,repeat.draws);
    const otherRank=await page.evaluate(()=>probeBackdrop('SS',37,.5,undefined,4.43));assert.deepEqual(otherRank.pulse,regular.pulse);
    await page.evaluate(()=>{
      const c=document.getElementById('mountain'),r=earthMountainStudy.renderer;
      const rect=c.getBoundingClientRect();r.draw(c.getContext('2d'),null,rect.width,rect.height,{time:.5,actionTime:.3,rank:'SS',box:r.renderBox});
    });
    await page.screenshot({path:path.join(root,'artifacts/earth-periodic-wave.png')});
    const quiet=await sample('E',4.8),impact=await sample('SS',4.8);
    assert.ok(impact.alpha>regular.alpha*3,'contact wave remains much stronger than the quiet pulse');
    assert.ok(impact.alpha>quiet.alpha*3,'SS pressure is visibly stronger than E breathing');assert.ok(impact.bright>3000,'shock paints a broad soft mass');
    fs.writeFileSync(path.join(root,'artifacts/earth-backdrop-isolated.png'),Buffer.from(impact.image.split(',')[1],'base64'));
    const same=await sample('SS',4.8);assert.equal(same.image,impact.image);assert.equal(same.draws,impact.draws,'pause reuses the cached overlay');
    await sample('SS',123.4);assert.equal((await sample('SS',4.8)).image,impact.image,'absolute sampling is history-independent');
    const noProtect=await page.evaluate(()=>probeBackdrop('SS',4.8,4.8,{x:-9999,y:-9999,width:170,height:220}));
    assert.ok(noProtect.alpha>impact.alpha,'readout protection removes dust behind the text');
    await sample('SS',4.2,0);const before=await sample('SS',4.2,0);
    for(let i=1;i<=60;i++)await sample('SS',4.2+i/60,i/60);
    const after=await sample('SS',5.2,1);assert.ok(after.draws-before.draws>=29&&after.draws-before.draws<=31,'overlay keeps 30fps budget');
    const baseline=await sample('SS',4.8);
    await page.evaluate(()=>{window.dustLoss=earthMountainStudy.renderer.earthBackdrop.gl.getExtension('WEBGL_lose_context');dustLoss.loseContext();});
    await page.waitForFunction(()=>earthMountainStudy.renderer.earthBackdrop.lost);
    const fallback=await sample('SS',4.9);assert.ok(fallback.alpha>1000,'context loss keeps a visible Canvas fallback');
    await page.evaluate(()=>dustLoss.restoreContext());await page.waitForFunction(()=>!earthMountainStudy.renderer.earthBackdrop.lost);
    const restored=await sample('SS',4.8);assert.equal(restored.failed,false);assert.equal(restored.gl,0);assert.equal(restored.image,baseline.image);
    for(const [width,height] of [[320,568],[844,390]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>{earthMountainStudy.resize();earthMountainStudy.renderAt(4.8);});
      const b=await page.evaluate(()=>{const b=earthMountainStudy.renderer.earthBackdrop;return{gl:b.gl.getError(),width:b.patch.width,height:b.patch.height};});
      assert.equal(b.gl,0);assert.ok(b.width<=320&&b.height<=640);
      await page.screenshot({path:path.join(root,'artifacts/earth-backdrop-'+width+'x'+height+'.png')});
    }
    await page.evaluate(()=>{window.oldDust=earthMountainStudy.renderer.earthBackdrop;earthMountainStudy.dispose();});
    assert.ok(await page.evaluate(()=>oldDust.disposed&&oldDust.gl===null&&oldDust.patch.width===1));assert.deepEqual(errors,[]);
    console.log('Earth backdrop browser passed: real shader, impact strength, soft coverage, text protection, pause/rewind, 30fps, fallback/restore, resize and disposal.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
