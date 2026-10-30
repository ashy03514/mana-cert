'use strict';
// Run serially with the other WebGL suites. This exercises the user's normal
// file:// entry, without origin or browser security exceptions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      // These two displayed canvases are read repeatedly by this test. Fix
      // their readback backend on the FIRST context request: Chromium otherwise
      // migrates from GPU to CPU after several reads and changes line/leaf AA.
      // Leave the production WebGL and retained shader canvases untouched.
      const nativeContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if(type==='2d'&&(this.id==='tornado'||this.id==='particleCanvas'))args[0]={...args[0],willReadFrequently:true};
        return nativeContext.call(this,type,...args);
      };
      let now=0,id=0,hidden=false;const frames=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      Object.defineProperty(document,'hidden',{get:()=>hidden,configurable:true});
      requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
      cancelAnimationFrame=key=>frames.delete(key);
      window.advanceWind=ms=>{
        do{const dt=Math.min(50,ms);ms-=dt;now+=dt;
          const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));
        }while(ms>0);
      };
      window.windVisibility=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
      window.windCanvasStats=id=>{
        const canvas=document.getElementById(id),rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let hash=2166136261,visible=0;
        for(let i=0;i<rgba.length;i++)hash=Math.imul(hash^rgba[i],16777619);
        for(let i=3;i<rgba.length;i+=4)if(rgba[i]>16)visible++;
        return {hash:hash>>>0,visible,total:canvas.width*canvas.height};
      };
      window.windPixelStats=renderer=>{
        const gl=renderer.gl;if(!gl)return {error:renderer.error||'No WebGL context'};
        // The renderer intentionally does not preserve the WebGL back buffer.
        // Inspect the exact frame copied immediately after its actual GPU draw,
        // which is also the frame that remains visible while playback is paused.
        const width=renderer.patch.width,height=renderer.patch.height;
        const rgba=renderer.patchCtx.getImageData(0,0,width,height).data;
        let hash=2166136261,visible=0,lit=0,cloudHash=2166136261,wideCloudRows=0,leftCloudPixels=0,rightCloudPixels=0;
        const cloudRows=Math.max(1,Math.ceil(height*.35)),edgeColumns=Math.max(1,Math.ceil(width*.02));
        for(let i=0;i<rgba.length;i++)hash=Math.imul(hash^rgba[i],16777619);
        for(let i=0;i<rgba.length;i+=4){
          if(rgba[i+3]>16)visible++;
          if(rgba[i+3]>16&&rgba[i]+rgba[i+1]+rgba[i+2]>40)lit++;
        }
        // The cloud sea deliberately extends beyond the viewport. Its upper
        // region must reach BOTH screen sides with several broad, dense rows;
        // a small floating cap or a thin horizontal stripe is a regression.
        // These image-space bounds do not mirror the volume's shape formula.
        for(let y=0;y<cloudRows;y++){
          let opaque=0;
          for(let x=0;x<width;x++){
            const i=(y*width+x)*4;
            for(let c=0;c<4;c++)cloudHash=Math.imul(cloudHash^rgba[i+c],16777619);
            if(rgba[i+3]>64){
              opaque++;if(x<edgeColumns)leftCloudPixels++;if(x>=width-edgeColumns)rightCloudPixels++;
            }
          }
          if(opaque/width>.65)wideCloudRows++;
        }
        return {hash:hash>>>0,visible,lit,total:width*height,height,cloudHash:cloudHash>>>0,wideCloudRows,
          leftCloudCoverage:leftCloudPixels/(edgeColumns*cloudRows),rightCloudCoverage:rightCloudPixels/(edgeColumns*cloudRows),
          cloudBox:renderer.cloudBox?{...renderer.cloudBox}:null,viewportWidth:innerWidth,viewportHeight:innerHeight,gl:gl.getError(),
          linked:gl.getProgramParameter(renderer.program,gl.LINK_STATUS),
          error:renderer.error,time:renderer.time,lastTime:renderer.lastTime,visualTime:renderer.visualTime,playbackRate:renderer.playbackRate,
          shaderTime:gl.getUniform(renderer.program,renderer.uniforms.uTime),drawCount:renderer.drawCount};
      };
    });
    const click=selector=>page.locator(selector).click({force:true});
    const advance=ms=>page.evaluate(ms=>advanceWind(ms),ms);
    const validFrame=frame=>{
      assert.equal(frame.error,'');assert.equal(frame.linked,true,'the real shader compiled and linked');
      assert.equal(frame.gl,0,'shader draw has no WebGL errors');
      assert.ok(frame.visible>frame.total*.015,'tornado produces visible alpha, not an empty shader');
      assert.ok(frame.lit>frame.total*.01,'cloud volume contains visible light and shade');
      assert.ok(frame.cloudBox,'renderer exposes the full viewport cloud compositing rectangle');
      assert.equal(frame.cloudBox.x,0,'cloud sea starts at the left viewport boundary');
      assert.equal(frame.cloudBox.y,0,'cloud sea starts at the top viewport boundary');
      assert.ok(Math.abs(frame.cloudBox.width-frame.viewportWidth)<1,'cloud sea covers the entire viewport width');
      assert.ok(frame.cloudBox.height>0&&frame.cloudBox.height<=frame.viewportHeight+1,'cloud compositing height remains bounded by the viewport');
      assert.equal(frame.visualTime,frame.time*1.5*frame.playbackRate,'all wind layers share the baseline and selected playback speed');
      const expectedShaderTime=frame.lastTime*1.5*frame.playbackRate;
      assert.ok(Math.abs(frame.shaderTime-expectedShaderTime)<=Math.max(1e-6,Math.abs(expectedShaderTime)*1e-7),
        'the actual cloud shader receives the shared accelerated clock, including retained 30fps frames');
    };
    const validCloudSea=frame=>{
      assert.ok(frame.wideCloudRows>frame.height*.06,'the cloud sea has visible depth across rows covering most of the screen');
      assert.ok(frame.leftCloudCoverage>.04&&frame.rightCloudCoverage>.04,
        'upper cloud volume extends through both screen edges, not only around the central funnel');
    };

    await page.goto(pathToFileURL(path.join(root,'wind-tornado-study.html')).href);
    await page.waitForFunction(()=>window.windTornadoStudy?.renderer);
    assert.equal(await page.evaluate(()=>document.getElementById('tornado').getContext('2d').getContextAttributes().willReadFrequently),true,
      'standalone display uses one stable readback backend throughout the pixel comparisons');
    const studyFrame=async time=>page.evaluate(time=>{
      windTornadoStudy.renderAt(time);return windPixelStats(windTornadoStudy.renderer);
    },time);
    // Compare determinism before Canvas 2D unpremultiplies the retained frame.
    // Chromium can change that conversion's last bit when the first readback
    // migrates its backing store. Synchronous raw GPU reads avoid that rounding
    // and the browser's later clearing of a non-preserved WebGL drawing buffer.
    const [early,late,repeated]=await page.evaluate(()=>[2,3.2,2].map(time=>{
      windTornadoStudy.renderAt(time);
      const renderer=windTornadoStudy.renderer,gl=renderer.gl;
      const rgba=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      let rawHash=2166136261,rawVisible=0;
      for(let i=0;i<rgba.length;i++)rawHash=Math.imul(rawHash^rgba[i],16777619);
      for(let i=3;i<rgba.length;i+=4)if(rgba[i]>16)rawVisible++;
      return {...windPixelStats(renderer),rawHash:rawHash>>>0,rawVisible};
    }));
    validFrame(early);validFrame(late);validFrame(repeated);
    for(const frame of [early,late])validCloudSea(frame);
    assert.notEqual(late.cloudHash,early.cloudHash,'the upper cloud deck keeps moving with the funnel');
    assert.ok(early.rawVisible>early.total*.015&&repeated.rawVisible>repeated.total*.015,'determinism compares populated GPU frames');
    assert.ok(repeated.drawCount>late.drawCount&&late.drawCount>early.drawCount,'each deterministic sample is a fresh shader draw');
    assert.notEqual(late.hash,early.hash,'cloud volume changes as the tornado rotates');
    assert.notEqual(late.rawHash,early.rawHash,'GPU cloud motion changes with time');
    assert.equal(repeated.rawHash,early.rawHash,'revisiting a timestamp produces byte-identical shader pixels');
    await studyFrame(3.2);
    assert.equal((await studyFrame(2)).hash,repeated.hash,'retained frames remain byte-identical after the initial Canvas readback');
    const distant=await studyFrame(120);validFrame(distant);
    const distantCanvas=await page.evaluate(()=>windCanvasStats('tornado'));
    assert.ok(distantCanvas.visible>distantCanvas.total*.01,'the final cloud and surface-line composite remains visible at 120 seconds');
    await page.screenshot({path:path.join(artifacts,'wind-tornado-120s.png'),timeout:60000});
    const distantMoving=await studyFrame(120.6);validFrame(distantMoving);
    assert.notEqual(distantMoving.hash,distant.hash,'long-running cloud motion continues');
    assert.notEqual((await page.evaluate(()=>windCanvasStats('tornado'))).hash,distantCanvas.hash,
      'the final composite, including the surface lines, continues animating after two minutes');
    assert.equal((await studyFrame(120)).hash,distant.hash,'long-running shader state is reproducible at the same timestamp');
    assert.deepEqual(await page.evaluate(()=>windCanvasStats('tornado')),distantCanvas,
      'clouds, debris and surface lines share deterministic time without accumulated drift');
    await page.evaluate(()=>windTornadoStudy.pause(true));
    const pausedTime=await page.evaluate(()=>windTornadoStudy.time);
    const pausedComposite=await page.evaluate(()=>windCanvasStats('tornado'));
    await advance(700);assert.equal(await page.evaluate(()=>windTornadoStudy.time),pausedTime);
    assert.deepEqual(await page.evaluate(()=>windCanvasStats('tornado')),pausedComposite,
      'standalone pause freezes the final displayed Canvas, including surface lines');
    await page.evaluate(()=>windTornadoStudy.pause(false));await advance(0);await advance(200);
    assert.ok(await page.evaluate(()=>windTornadoStudy.time)>pausedTime,'standalone resumes animation');
    await page.evaluate(()=>windVisibility(true));
    const hiddenTime=await page.evaluate(()=>windTornadoStudy.time);
    await advance(800);assert.equal(await page.evaluate(()=>windTornadoStudy.time),hiddenTime,'hidden study cannot consume animation time');
    await page.evaluate(()=>windVisibility(false));await advance(0);await advance(50);
    assert.ok(await page.evaluate(()=>windTornadoStudy.time)-hiddenTime<.15,'visibility resume cannot jump by hidden time');
    await click('#replay');await advance(0);
    assert.equal(await page.evaluate(()=>windTornadoStudy.time),0,'standalone replay resets the animation clock');
    await click('[data-speed="1.5"]');await advance(0);
    const studySpeedStart=await page.evaluate(()=>windPixelStats(windTornadoStudy.renderer));
    assert.equal(studySpeedStart.playbackRate,1,'standalone owns its speed in its existing host clock');
    await advance(500);
    const studySpeedEnd=await page.evaluate(()=>windPixelStats(windTornadoStudy.renderer));
    const selectedVisualDelta=studySpeedEnd.visualTime-studySpeedStart.visualTime;
    assert.ok(Math.abs(selectedVisualDelta-1.125)<1e-8,'the standalone 1.5x option advances the existing wind baseline at 2.25 visual seconds per second');

    const shots=[];
    for(const time of [2,2.6,3.2]){
      validFrame(await studyFrame(time));
      shots.push({time,image:await loadImage(await page.screenshot({timeout:60000}))});
    }
    const sheet=createCanvas(shots[0].image.width*shots.length,shots[0].image.height+34),sheetCtx=sheet.getContext('2d');
    sheetCtx.fillStyle='#080d16';sheetCtx.fillRect(0,0,sheet.width,sheet.height);
    sheetCtx.font='15px sans-serif';sheetCtx.fillStyle='#d5e8e6';
    shots.forEach(({time,image},i)=>{sheetCtx.drawImage(image,i*image.width,34);sheetCtx.fillText(time.toFixed(1)+' s',i*image.width+14,23);});
    fs.writeFileSync(path.join(artifacts,'wind-tornado-motion.png'),sheet.toBuffer('image/png'));
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>windTornadoStudy.resize());
      validFrame(await studyFrame(3));
      const bounds=await page.evaluate(()=>['pause','replay'].map(id=>{
        const r=document.getElementById(id).getBoundingClientRect();
        return {id,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
      }));
      for(const r of bounds){
        assert.ok(r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=viewport.width+1&&r.bottom<=viewport.height+1,
          `${r.id} remains on screen at ${viewport.width} x ${viewport.height}`);
      }
    }
    // Context restoration must recreate GPU resources and retain the public owner.
    await page.evaluate(()=>{
      const renderer=windTornadoStudy.renderer,ext=renderer.gl.getExtension('WEBGL_lose_context');
      if(!ext)throw Error('Test environment does not expose WebGL context restoration');
      window.restoreWindContext=()=>ext.restoreContext();ext.loseContext();
    });
    await page.waitForFunction(()=>windTornadoStudy.renderer.lost);
    await page.evaluate(()=>restoreWindContext());
    await page.waitForFunction(()=>!windTornadoStudy.renderer.lost);
    validFrame(await studyFrame(3));
    await page.evaluate(()=>windTornadoStudy.dispose());
    assert.equal(await page.evaluate(()=>windTornadoStudy.renderer.disposed),true);

    await page.setViewportSize({width:390,height:844});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    assert.equal(await page.evaluate(()=>document.getElementById('particleCanvas').getContext('2d').getContextAttributes().willReadFrequently),true,
      'main preview display uses the same stable readback backend');
    await page.evaluate(()=>{
      const Original=WindTornadoRenderer;
      window.windInstances=[];window.legacyWindDraws=0;
      window.WindTornadoRenderer=class extends Original{
        constructor(...args){super(...args);windInstances.push(this);window.activeWind=this;}
      };
      const draw=ElementMaterialRenderer.prototype.draw;
      ElementMaterialRenderer.prototype.draw=function(...args){
        if(this.element==='wind')legacyWindDraws++;return draw.apply(this,args);
      };
    });
    const pixels=()=>page.evaluate(()=>windPixelStats(activeWind));
    await click('#tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click({force:true});
    await click('#materialPreviewOpen');await click('#material_wind');await advance(0);await advance(1800);
    const materialFrame=await pixels();validFrame(materialFrame);validCloudSea(materialFrame);
    assert.equal(materialFrame.playbackRate,1.5,'the material sample uses the approved standalone 1.5x setting');
    await advance(500);
    assert.ok(Math.abs((await pixels()).visualTime-materialFrame.visualTime-selectedVisualDelta)<1e-8,
      'material sample and standalone 1.5x advance equally over the same real-time interval');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.equal(await page.evaluate(()=>legacyWindDraws),0,'material preview never draws the old wind beneath the tornado');
    await click('#materialPause');const held=await pixels();
    const heldComposite=await page.evaluate(()=>windCanvasStats('particleCanvas'));await advance(600);
    assert.equal((await pixels()).hash,held.hash);assert.equal((await pixels()).time,held.time);
    assert.deepEqual(await page.evaluate(()=>windCanvasStats('particleCanvas')),heldComposite,
      'material preview pause retains the entire displayed cloud and wind-line composite');
    await click('#materialPause');await advance(200);assert.ok((await pixels()).time>held.time);
    await page.evaluate(()=>windVisibility(true));
    const hiddenMaterial=await pixels(),hiddenMaterialComposite=await page.evaluate(()=>windCanvasStats('particleCanvas'));
    await advance(600);assert.equal((await pixels()).time,hiddenMaterial.time);
    assert.deepEqual(await page.evaluate(()=>windCanvasStats('particleCanvas')),hiddenMaterialComposite,
      'backgrounding freezes the full material sample at the selected speed');
    await page.evaluate(()=>windVisibility(false));await advance(0);await advance(100);
    assert.ok((await pixels()).time-hiddenMaterial.time<.15,'material resume does not include hidden time');
    await click('#materialReplay');await advance(0);assert.equal((await pixels()).time,0);
    assert.equal((await pixels()).playbackRate,1.5,'material replay preserves the approved playback speed');
    const windDrawsBeforeSwitch=await page.evaluate(()=>activeWind.drawCount);
    for(const element of ['fire','water']){
      await click('#material_'+element);await advance(100);
      assert.equal(await page.evaluate(()=>activeWind.drawCount),windDrawsBeforeSwitch,
        'switching to '+element+' stops drawing the wind volume and backdrop');
    }
    await click('#effectPreviewBack');assert.equal(await page.evaluate(()=>activeWind.disposed),true);

    await click('#flowPreviewOpen');await click('#material_wind');await advance(0);
    assert.equal(await page.evaluate(()=>windInstances.length),2,'flow preview creates a fresh renderer after disposal');
    await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(260,385,{steps:10});await page.mouse.up();
    await advance(9500);const flowFrame=await pixels();validFrame(flowFrame);validCloudSea(flowFrame);
    assert.equal(flowFrame.playbackRate,1.5,'draw-to-reveal uses the same approved 1.5x playback setting');
    await advance(500);
    assert.ok(Math.abs((await pixels()).visualTime-flowFrame.visualTime-selectedVisualDelta)<1e-8,
      'draw-to-reveal and standalone 1.5x advance equally over the same real-time interval');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false,'wind SS prototype does not fabricate a rank readout');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.equal(await page.evaluate(()=>legacyWindDraws),0,'flow preview also exclusively draws the new renderer');
    const heldRevealTime=(await pixels()).time;await advance(1000);
    assert.ok((await pixels()).time>heldRevealTime+.8,'flow wind remains alive at its reveal endpoint');
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);await advance(100);
      const layout=await page.evaluate(()=>{
        const box=activeWind.renderBox,controls=document.getElementById('materialControls').getBoundingClientRect();
        const patch=activeWind.patch,rgba=activeWind.patchCtx.getImageData(0,0,patch.width,patch.height).data;
        let lastVisible=-1;
        for(let y=0;y<patch.height;y++)for(let x=0;x<patch.width;x++)if(rgba[(y*patch.width+x)*4+3]>16)lastVisible=y;
        return {box,lastVisible,visibleBottom:activeWind.cloudBox.y+(lastVisible+1)/patch.height*activeWind.cloudBox.height,
          controls:{top:controls.top,bottom:controls.bottom,left:controls.left,right:controls.right}};
      });
      assert.ok(layout.box.width>0&&layout.box.height>0,'resizing retains a finite tornado volume');
      assert.ok(layout.box.y<0,'enlarged storm cloud volume intentionally continues above the viewport');
      // The enlarged volume box contains transparent space below the ground.
      // Protect the actually visible cloud, including the ground dust fringe.
      assert.ok(layout.lastVisible>=0&&layout.visibleBottom<=layout.controls.top+1,
        `visible SS tornado leaves the rank controls unobstructed at ${viewport.width} x ${viewport.height}`);
      assert.ok(layout.controls.bottom<=viewport.height+1,'preview controls remain on screen');
    }
    await page.setViewportSize({width:390,height:844});await advance(150);
    await click('#materialPause');
    const flowComposite=await page.evaluate(()=>windCanvasStats('particleCanvas'));
    await advance(600);
    assert.deepEqual(await page.evaluate(()=>windCanvasStats('particleCanvas')),flowComposite,
      'flow preview pause also freezes the displayed surface lines and atmosphere');
    await click('#materialPause');await advance(100);
    await page.evaluate(()=>windVisibility(true));
    const hiddenFlow=await pixels(),hiddenFlowComposite=await page.evaluate(()=>windCanvasStats('particleCanvas'));
    await advance(600);assert.equal((await pixels()).time,hiddenFlow.time);
    assert.deepEqual(await page.evaluate(()=>windCanvasStats('particleCanvas')),hiddenFlowComposite,
      'backgrounding freezes the complete draw-to-reveal sample');
    await page.evaluate(()=>windVisibility(false));await advance(0);await advance(100);
    assert.ok((await pixels()).time-hiddenFlow.time<.15,'flow resume does not include hidden time');
    await click('#materialPause');
    await page.screenshot({path:path.join(artifacts,'wind-tornado-ss.png'),timeout:60000});
    await click('#materialReplay');await advance(0);
    assert.equal(await page.locator('#materialStatus').textContent(),'畫完後放開');
    await click('#effectPreviewBack');assert.equal(await page.evaluate(()=>activeWind.disposed),true);

    // Formal wind uses the same renderer with its committed result driving rank.
    await click('#tab_switches');await page.locator('#s_master').uncheck({force:true});
    await page.locator('#s_wind').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
    const owners=await page.evaluate(()=>windInstances.length);
    await click('#btnStart');await advance(0);
    await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(260,385,{steps:10});await page.mouse.up();
    await advance(8000);
    assert.equal(await page.evaluate(()=>legacyWindDraws),0,'formal wind never draws the retired material');
    assert.equal(await page.evaluate(()=>windInstances.length),owners+1,'formal wind creates a fresh shared renderer');
    assert.equal(await page.locator('#revealTitle').textContent(),'風屬性');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),true);
    assert.equal(await page.locator('#fireScanLabel').textContent(),'魔力值');
    await click('#effectPreviewBack');assert.deepEqual(errors,[]);
    console.log('Wind tornado browser passed: actual shader, shared 1.5x visual clock, visible deterministic motion at 120s, complete-canvas pause/replay/background, context restoration, three viewport layouts, preview disposal and shared formal wind.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
