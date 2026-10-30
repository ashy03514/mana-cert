'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});page.setDefaultTimeout(60000);
    await page.addInitScript(()=>{
      const native=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d')args[0]={...args[0],willReadFrequently:true};return native.call(this,type,...args);};
      let now=0,id=0;const callbacks=new Map();
      requestAnimationFrame=f=>{callbacks.set(++id,f);return id;};cancelAnimationFrame=i=>callbacks.delete(i);
      window.advanceHoly=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...callbacks.values()];callbacks.clear();run.forEach(f=>f(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'light-holy-study.html')).href);
    await page.waitForFunction(()=>window.lightHolyStudy?.renderer);
    await page.evaluate(()=>{window.holyStats=()=>{
      const r=lightHolyStudy.renderer,c=document.getElementById('holy'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let hash=2166136261,bright=0,white=0,left=0,right=0,bottomLight=0,gold=0;
      for(let i=0;i<pixels.length;i+=4){
        for(let j=0;j<4;j++)hash=Math.imul(hash^pixels[i+j],16777619);
        const x=i/4%c.width,y=Math.floor(i/4/c.width),luma=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
        if(y<r.art.bottom&&luma>218&&pixels[i]-pixels[i+2]<46){bright++;if(x<r.art.cx-r.art.unit*.25)left++;if(x>r.art.cx+r.art.unit*.25)right++;}
        if(luma>250){white++;if(y>r.art.bottom+20)bottomLight++;}
        if(luma>140&&pixels[i]>pixels[i+2]+30&&pixels[i+1]>pixels[i+2]+20)gold++;
      }
      return {error:r.error,diagnostic:r.diagnostic,gl:r.gl?.getError(),hash:hash>>>0,bright,white,left,right,bottomLight,gold,
        drawCount:r.drawCount,pixels:r.canvas.width*r.canvas.height,image:c.toDataURL()};
    };});
    const at=async time=>{await page.evaluate(t=>lightHolyStudy.renderAt(t),time);return page.evaluate(()=>holyStats());};
    const frames=[];
    for(const time of [.6,2.3,3.0,5.2]){
      const f=await at(time);frames.push({...f,time});assert.equal(f.error,'',f.diagnostic);assert.equal(f.gl,0);assert.ok(f.bright>100,'visible light at '+time);
      assert.ok(f.gold>390*844*.5,'background stays warm golden/ivory rather than dark');
      assert.ok(f.white<390*844*.05,'only feather highlights reach near-white');assert.equal(f.bottomLight,0,'readout background does not clip to white');
    }
    assert.ok(frames[3].bright>frames[0].bright*3,'six wings expand beyond the initial light core');
    assert.ok(frames[3].left>5000&&frames[3].right>5000,'both sides have substantial visible wings');
    const same=await at(5.2);assert.equal(same.image,frames[3].image,'paused composite pixel identical');assert.equal(same.drawCount,frames[3].drawCount);
    const moving=await at(6.3);assert.notEqual(moving.hash,same.hash,'light remains alive after the reveal');
    await at(180);assert.equal((await at(5.2)).image,same.image,'long-time playback and rewind preserve original artwork');
    const sheet=createCanvas(390*4,884),c=sheet.getContext('2d');c.fillStyle='#f1e6c8';c.fillRect(0,0,sheet.width,sheet.height);c.font='17px sans-serif';
    for(let i=0;i<frames.length;i++){c.fillStyle='#715621';c.fillText(frames[i].time.toFixed(1)+' s',i*390+12,26);c.drawImage(await loadImage(frames[i].image),i*390,40,390,844);}
    fs.writeFileSync(path.join(root,'artifacts/light-holy-phases.png'),sheet.toBuffer('image/png'));
    await page.screenshot({path:path.join(root,'artifacts/light-holy-390x844.png')});
    for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>lightHolyStudy.resize());const f=await at(5.2);
      assert.equal(f.gl,0);assert.ok(f.pixels<=561000,'bounded GPU render target');assert.ok(f.bright>500);
      for(const selector of ['#pause','#replay','[data-time="5.2"]']){
        const b=await page.locator(selector).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,'controls fit '+JSON.stringify(viewport)+': '+selector);
      }
      await page.screenshot({path:path.join(root,'artifacts/light-holy-'+viewport.width+'x'+viewport.height+'.png')});
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>lightHolyStudy.resize());
    await page.locator('[data-time="0.6"]').click();assert.equal(await page.evaluate(()=>lightHolyStudy.time),.6);
    assert.equal(await page.locator('[data-time="0.6"]').getAttribute('aria-pressed'),'true');
    await page.locator('#replay').click();assert.equal(await page.evaluate(()=>lightHolyStudy.time),0);
    await page.evaluate(()=>{advanceHoly(0);advanceHoly(100);});let active=await page.evaluate(()=>lightHolyStudy.time);assert.ok(Math.abs(active-.1)<1e-6);
    await page.locator('#pause').click();await page.evaluate(()=>advanceHoly(400));assert.equal(await page.evaluate(()=>lightHolyStudy.time),active);
    for(const speed of [.5,1.5]){
      await page.locator(`[data-speed="${speed}"]`).click();await page.evaluate(()=>lightHolyStudy.pause(false));
      await page.evaluate(()=>{advanceHoly(0);advanceHoly(100);});const next=await page.evaluate(()=>lightHolyStudy.time);
      assert.ok(Math.abs(next-active-.1*speed)<1e-6,'speed respects active clock');active=next;
    }
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const frozen=await page.evaluate(()=>lightHolyStudy.time);
    await page.evaluate(()=>advanceHoly(400));assert.equal(await page.evaluate(()=>lightHolyStudy.time),frozen);
    await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));advanceHoly(0);advanceHoly(100);});assert.ok(await page.evaluate(()=>lightHolyStudy.time)>frozen);
    const original=await at(5.2);
    await page.evaluate(()=>{lightHolyStudy.pause(false);window.holyLoss=lightHolyStudy.renderer.gl.getExtension('WEBGL_lose_context');holyLoss.loseContext();});
    await page.waitForFunction(()=>lightHolyStudy.renderer.lost);
    await page.evaluate(()=>advanceHoly(300));assert.equal(await page.evaluate(()=>lightHolyStudy.time),5.2,'context loss freezes active time');
    await page.evaluate(()=>holyLoss.restoreContext());await page.waitForFunction(()=>!lightHolyStudy.renderer.lost&&!!lightHolyStudy.renderer.program);
    const restored=await at(5.2);assert.equal(restored.gl,0);assert.equal(restored.hash,original.hash,'restoration reproduces shader and composite');
    await page.evaluate(()=>lightHolyStudy.dispose());assert.equal(await page.evaluate(()=>lightHolyStudy.renderer.disposed),true);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[],'file entry has no network asset dependencies');
    console.log('Light SS GPU passed: compile, visible six-wing reveal, bounded exposure, ongoing flow, pause/rewind, file entry, responsive controls, speeds, loss/restore and disposal.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
