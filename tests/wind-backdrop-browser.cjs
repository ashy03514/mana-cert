'use strict';
// Real WebGL pixels and real preview/formal host calls. Keep fake host RAFs
// cheap, then render selected frames through the original wind renderer.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} vs ${b}`);
async function standalone(browser){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
    await page.setContent('<style>body{margin:0;background:#080915}</style><canvas id="scene" width="390" height="844"></canvas>');
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'js/wind-backdrop.js'),'utf8')});
    await page.evaluate(()=>{
      window.bg=new WindBackdrop();window.previousPixels=null;
      window.paintWind=({time,width=390,height=844,strength=1,opacity=1,focusShift=0,readoutShift=0})=>{
        const canvas=document.getElementById('scene');
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;previousPixels=null;}
        const c=canvas.getContext('2d',{willReadFrequently:true});c.fillStyle='#080915';c.fillRect(0,0,width,height);
        const focus={x:width*.26+focusShift,y:height*.23,width:width*.48,height:height*.44};
        const readout={x:width*.25+readoutShift,y:height*.78,width:width*.5,height:height*.14};
        const ok=bg.draw(c,width,height,{time,strength,opacity,focus,readout});
        const p=c.getImageData(0,0,width,height).data;
        const inside=(x,y,b,scale=1)=>Math.abs(x-b.x-b.width/2)<b.width*scale/2&&Math.abs(y-b.y-b.height/2)<b.height*scale/2;
        let centre=0,centreN=0,read=0,readN=0,edge=0,edgeN=0,changed=0,yEnergy=0,energy=0;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const i=(y*width+x)*4,l=p[i]*.2126+p[i+1]*.7152+p[i+2]*.0722;
          if(inside(x,y,focus,.32)){centre+=l;centreN++;}
          if(inside(x,y,readout,.6)){read+=l;readN++;}
          if(x<width*.12||x>width*.88){edge+=l;edgeN++;const e=Math.max(0,l-14);energy+=e;yEnergy+=e*y;}
          if(previousPixels&&Math.abs(p[i+1]-previousPixels[i+1])>2)changed++;
        }
        previousPixels=new Uint8ClampedArray(p);
        return {ok,diagnostic:bg.diagnostic,gl:bg.gl?.getError(),width:bg.canvas.width,height:bg.canvas.height,
          centre:centre/centreN,readout:read/readN,edge:edge/edgeN,changed,y:energy?yEnergy/energy:0,
          lastTime:bg.lastTime,drawCount:bg.drawCount,image:canvas.toDataURL()};
      };
    });
    const paint=options=>page.evaluate(options=>paintWind(options),options),shots=[];
    for(const [width,height] of [[390,844],[844,390]]){
      const frames=[];
      for(const time of [.22,.65,1.15,1.6]){
        const f=await paint({time,width,height,strength:1.2});
        assert.equal(f.ok,true);assert.ok(!f.diagnostic,f.diagnostic);assert.equal(f.gl,0,'actual shader compiles and draws');
        assert.ok(f.width<=320&&f.height<=640,'background buffer is bounded on either orientation');
        assert.ok(f.centre<24&&f.readout<24,'central wind and lower numbers remain dark');
        assert.ok(f.edge>f.centre+3&&f.edge>f.readout+3,'light remains concentrated at the perimeter');
        if(frames.length)assert.ok(f.changed>width*height*.006,'the mist actually travels between phases');
        frames.push(f);shots.push({...f,time,viewportWidth:width,viewportHeight:height});
      }
      const same=await paint({time:.65,width,height,strength:1.2});
      const paused=await paint({time:.65,width,height,strength:1.2});
      assert.equal(same.image,frames[1].image,'rewinding uses the absolute clock');
      assert.equal(paused.image,same.image,'paused frame is pixel-identical');
      assert.equal(paused.drawCount,same.drawCount,'pause reuses the retained shader image');
      const retained=await paint({time:.66,width,height,strength:1.2});
      assert.equal(retained.lastTime,.65,'sub-frame increments keep the last 30 fps sample');
      assert.equal(retained.drawCount,paused.drawCount);assert.equal(retained.image,paused.image);
      const next=await paint({time:.69,width,height,strength:1.2});
      assert.equal(next.drawCount,retained.drawCount+1,'the next 30 fps interval draws one new shader frame');
      assert.notEqual(next.image,retained.image);
      const low=await paint({time:.8,width,height,strength:.2});
      const high=await paint({time:.8,width,height,strength:1.2});
      assert.ok(high.edge>low.edge*1.15,'the same phase is brighter at greater continuous wind strength');
      assert.equal(high.drawCount,low.drawCount+1,'strength changes invalidate a paused frame');
      const focus=await paint({time:.8,width,height,strength:1.2,focusShift:width*.12});
      assert.equal(focus.drawCount,high.drawCount+1,'changed focus invalidates the retained shelter');
      assert.notEqual(focus.image,high.image);
      const readout=await paint({time:.8,width,height,strength:1.2,focusShift:width*.12,readoutShift:width*.12});
      assert.equal(readout.drawCount,focus.drawCount+1,'changed number position invalidates the retained shelter');
      assert.notEqual(readout.image,focus.image);
      console.log('Wind '+width+'x'+height+' GPU:',frames.map(({centre,readout,edge,changed,y})=>({centre,readout,edge,changed,y})));
    }
    // Resize at an unchanged clock must immediately refresh buffer and shelter.
    const before=await paint({time:1,width:390,height:844});
    const resized=await paint({time:1,width:320,height:568});
    assert.equal(resized.drawCount,before.drawCount+1);
    assert.ok(resized.width<=320&&resized.height<=640);assert.notEqual(resized.image,before.image);
    const sheet=createCanvas(390*4,40+844+40+181),c=sheet.getContext('2d');
    c.fillStyle='#080915';c.fillRect(0,0,sheet.width,sheet.height);c.font='17px sans-serif';
    for(let i=0;i<shots.length;i++){
      const shot=shots[i],column=i%4,row=i<4?0:1,top=row?884:0;
      c.fillStyle='#c5e7dc';c.fillText(shot.time.toFixed(2)+' s · '+shot.viewportWidth+'×'+shot.viewportHeight,column*390+12,top+27);
      c.drawImage(await loadImage(shot.image),column*390,top+40,390,row?181:844);
    }
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,'wind-backdrop-pulse.png'),sheet.toBuffer('image/png'));
    // Simulate the context events so the fallback/recovery contract is checked
    // without losing the whole browser's software GPU process.
    const recovery=await page.evaluate(()=>{
      const a=paintWind({time:.8}),before=bg.drawCount;
      bg.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
      const lost=paintWind({time:.8});
      bg.canvas.dispatchEvent(new Event('webglcontextrestored'));
      const restored=paintWind({time:.8});
      bg.dispose();bg.dispose();const disposed=paintWind({time:.8});
      return {a,lost,restored,disposed,before};
    });
    assert.equal(recovery.lost.ok,true,'context loss still paints the Canvas fallback');
    assert.equal(recovery.lost.drawCount,recovery.before,'a lost context is not used for GPU rendering');
    assert.equal(recovery.restored.ok,true);assert.equal(recovery.restored.gl,0);
    assert.equal(recovery.restored.image,recovery.a.image,'restoration reproduces the same absolute-time GPU image');
    assert.equal(recovery.disposed.ok,false,'disposed background stays inactive');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}
async function host(browser){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
  page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
  try{
    await page.addInitScript(()=>{
      let now=0,id=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=f=>{callbacks.set(++id,f);return id;};cancelAnimationFrame=i=>callbacks.delete(i);
      window.advanceWind=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;
        const run=[...callbacks.values()];callbacks.clear();run.forEach(f=>f(now));
      }while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const original=WindTornadoRenderer.prototype.draw,backdrop=WindBackdrop.prototype.draw;
      window.windHistory=[];
      WindBackdrop.prototype.draw=function(...args){this.observedOptions={...args[3]};return backdrop.apply(this,args);};
      WindTornadoRenderer.prototype.draw=function(...args){
        window.windOwner=this;this.hostArgs=args;const frame=args[4];
        if(frame.windEffects)windHistory.push({time:frame.windEffects.time,speed:frame.windEffects.profile.speed,rank:frame.windEffects.profile.rank});
        return !this.error&&!this.lost;
      };
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(settings){
        window.outcome=begin.call(this,settings,()=>.999999);window.observedSession=this;windHistory.length=0;return outcome;
      };
      window.renderWindHost=(override={})=>{
        const r=windOwner,args=[...r.hostArgs];args[4]={...args[4],...override};
        const ok=original.apply(r,args),bg=r.stormBackdrop,frame=args[4];
        const patch=bg.patch.getContext('2d',{willReadFrequently:true}),p=patch.getImageData(0,0,bg.patch.width,bg.patch.height).data;
        let hash=2166136261;for(const v of p)hash=Math.imul(hash^v,16777619);
        return {ok,rank:r.profile.rank,speed:r.profile.speed,frame,options:bg.observedOptions,lastTime:bg.lastTime,drawCount:bg.drawCount,
          hash:hash>>>0,gl:bg.gl?.getError(),error:bg.diagnostic,rendererError:r.error,rendererGl:r.gl.getError(),
          image:document.getElementById('particleCanvas').toDataURL()};
      };
    });
    const click=id=>page.locator('#'+id).click({force:true});
    const advance=ms=>page.evaluate(ms=>advanceWind(ms),ms);
    const render=override=>page.evaluate(override=>renderWindHost(override),override||{});
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await click('materialPreviewOpen');await click('material_wind');
    const preview=[];
    for(const rank of ['E','SS']){
      await click('windRank_'+rank);const first=await render({time:3});
      assert.equal(first.rank,rank);assert.equal(first.ok,true);assert.equal(first.gl,0);assert.equal(first.rendererGl,0);
      assert.ok(!first.error&&!first.rendererError,'main preview uses valid background and wind shaders');
      close(first.options.time,3*first.speed*1.5,'preview background follows rank speed and host playback');
      close(first.options.strength,.2+(first.speed-.3)/.7,'preview strength grows continuously with the speed profile');
      const same=await render({time:3});assert.equal(same.hash,first.hash);assert.equal(same.drawCount,first.drawCount);
      const retained=await render({time:3.01});assert.equal(retained.hash,first.hash,'background holds with the 30 fps geometry frame');
      assert.equal(retained.lastTime,first.lastTime);assert.equal(retained.drawCount,first.drawCount);
      const next=await render({time:3.04});assert.notEqual(next.hash,first.hash,'slow wind still animates at the host frame cadence');
      assert.equal(next.drawCount,first.drawCount+1,'E does not throttle the background using its slower visual time');
      await render({time:3});await page.screenshot({path:path.join(artifacts,'wind-backdrop-preview-'+rank+'.png')});
      preview.push(first);
    }
    assert.ok(preview[1].options.time>preview[0].options.time&&preview[1].options.strength>preview[0].options.strength,
      'SS changes the shared atmosphere through speed and strength');
    await click('materialPause');const paused=await render();await advance(1500);
    assert.equal((await render()).hash,paused.hash,'preview pause freezes the background');
    await click('materialReplay');const replay=await render();close(replay.frame.time,0,'preview replay resets its host clock');
    await click('effectPreviewBack');
    assert.equal(await page.evaluate(()=>windOwner.disposed),true,'return disposes the integrated wind owner');

    // A real SS certification climbs from E while the integrated clock drives
    // both the funnel and its perimeter; the result remains session-owned.
    await click('tab_switches');await page.locator('#s_master').uncheck({force:true});
    await page.locator('#s_wind').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
    await click('tab_probabilities');
    await page.locator('#chance_SS').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await click('btnStart');await advance(0);
    await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(270,385,{steps:6});await page.mouse.up();
    await advance(4600);const samples=[];
    for(const dt of [0,1000,2000,2400]){
      if(dt)await advance(dt);const sample=await render();samples.push(sample);
      close(sample.options.time,sample.frame.windEffects.time*sample.frame.playbackRate,'formal atmosphere consumes the integrated mana clock');
      close(sample.options.strength,.2+(sample.frame.windEffects.profile.speed-.3)/.7,'formal brightness follows the current continuous profile');
      assert.equal(sample.gl,0);assert.equal(sample.rendererGl,0);
      assert.ok(!sample.error&&!sample.rendererError);
    }
    assert.equal(samples[0].rank,'E');assert.equal(samples.at(-1).rank,'SS');
    assert.ok(samples.every((s,i)=>!i||s.options.time>samples[i-1].options.time),'formal backdrop clock advances throughout rank growth');
    assert.ok(samples.at(-1).options.readout?.width>0,'formal numeric readout supplies an explicit dark shelter');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),true);
    const result=await page.evaluate(()=>({same:outcome===observedSession.currentResult,frozen:Object.isFrozen(outcome),
      mana:outcome.mana,value:document.getElementById('fireScanValue').textContent,history:windHistory}));
    assert.equal(result.same,true);assert.equal(result.frozen,true);assert.equal(result.value,String(result.mana));
    assert.ok(result.history.every((v,i,a)=>!i||v.time>=a[i-1].time),'mana growth never rewinds the integrated clock');
    const before=await render();await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await advance(2000);
    const hidden=await render();assert.equal(hidden.hash,before.hash);assert.equal(hidden.options.time,before.options.time);
    await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(0);await advance(400);
    assert.notEqual((await render()).hash,before.hash,'foreground resumes the held circulation');
    for(const viewport of [{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>dispatchEvent(new Event('resize')));
      const resized=await render();assert.equal(resized.gl,0);assert.ok(resized.options.readout?.width>0);
      await page.screenshot({path:path.join(artifacts,'wind-backdrop-formal-'+viewport.width+'x'+viewport.height+'.png')});
    }
    await page.evaluate(()=>{window.previousBackdrop=windOwner.stormBackdrop;});
    await click('formalReplay');
    assert.equal(await page.evaluate(()=>previousBackdrop.disposed),true,'formal replay releases the previous backdrop GPU owner');
    assert.deepEqual(errors,[]);
    console.log('Wind backdrop host passed: E/SS preview, shared 30 fps frames, actual mana clock, immutable result, readout shelters, pause, resume, replay and disposal.');
  }finally{await page.close();}
}
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    if(!process.argv.includes('--host-only'))await standalone(browser);
    if(!process.argv.includes('--standalone-only'))await host(browser);
    console.log('Wind backdrop browser checks passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
