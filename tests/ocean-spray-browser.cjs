'use strict';
// Real file:// rendering with ordinary browser security. Run GPU suites serially.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),edge=440;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:edge,height:edge},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(pathToFileURL(path.join(root,'water-ocean-study.html')).href);
    assert.equal(await page.evaluate(()=>waterOceanStudy.renderer.ready),true,'the original sea texture loads through file mode');
    await page.evaluate(()=>waterOceanStudy.dispose());
    await page.setContent('<style>html,body{margin:0;background:#02121c}canvas{display:block;width:440px;height:440px}</style><canvas></canvas>');
    await page.evaluate(async()=>{
      window.spraySurface=new WaterOceanStudy(document.querySelector('canvas'));
      spraySurface.resize(440,440,1);
      if(!await spraySurface.ready)throw new Error(spraySurface.diagnostic||spraySurface.error);
      window.spraySnapshots=new Map();
      window.captureSpray=(time,{spray=1,surge=1,breakers=1,key='current',compare}={})=>{
        const r=spraySurface,gl=r.gl,originalSample=OceanSprayField.sample;
        let drawn,sampleTime=null;
        // Observe the real sampler call and uploaded shader uniform so the
        // sea and foam cannot accidentally run at different playback speeds.
        OceanSprayField.sample=function(time,options){sampleTime=time;return originalSample.call(this,time,options);};
        try{drawn=r.draw(time,{spray,surge,breakers});}
        finally{OceanSprayField.sample=originalSample;}
        const surfaceTime=gl.getUniform(r.waterProgram.program,r.waterProgram.uniforms.uTime);
        const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,data=new Uint8Array(w*h*4);
        gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
        let hash=2166136261,opaque=0,lit=0,clipped=0,translucent=0,changed=0,delta=0;
        for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);
        const reference=compare?spraySnapshots.get(compare):null;
        for(let i=0;i<data.length;i+=4){
          if(data[i+3]>127)opaque++;
          if(data[i]+data[i+1]+data[i+2]>60)lit++;
          if(data[i]>248&&data[i+1]>248&&data[i+2]>248)clipped++;
          if(data[i+3]>4&&data[i+3]<250)translucent++;
          if(reference){
            const difference=Math.abs(data[i]-reference[i])+Math.abs(data[i+1]-reference[i+1])+Math.abs(data[i+2]-reference[i+2]);
            if(difference>15)changed++;delta+=difference;
          }
        }
        spraySnapshots.set(key,data);
        return {drawn,time,hostTime:r.time,surfaceTime,sampleTime,hash:hash>>>0,opaque,lit,clipped,translucent,changed,meanDelta:delta/(w*h*3),
          pixels:w*h,count:r.spray.count,gl:gl.getError(),depthWrite:gl.getParameter(gl.DEPTH_WRITEMASK),
          depthTest:gl.isEnabled(gl.DEPTH_TEST),blend:gl.isEnabled(gl.BLEND),error:r.error,diagnostic:r.diagnostic};
      };
    });
    const capture=(time,options={})=>page.evaluate(([time,options])=>captureSpray(time,options),[time,options]);
    const check=frame=>{
      assert.equal(frame.drawn,true,frame.diagnostic||frame.error);assert.equal(frame.error,'');assert.equal(frame.gl,0);
      assert.equal(frame.depthWrite,true,'spray restores depth writes for the next surface frame');
      assert.equal(frame.depthTest,true,'water occludes particles through the same depth buffer');
      assert.equal(frame.blend,false,'spray restores the blend state for the next opaque surface draw');
      assert.equal(frame.hostTime,frame.time,'visual speed does not accelerate the host reveal clock');
      assert.ok(Math.abs(frame.surfaceTime-frame.time*3)<Math.max(1e-6,frame.time*3*1e-6),'the sea uses the requested 3x animation time');
      if(frame.sampleTime!==null)assert.equal(frame.sampleTime,frame.time*3,'foam follows the exact same 3x clock as the sea');
      assert.ok(frame.count>=0&&frame.count<=3200,'particle count stays bounded');
      assert.ok(frame.opaque>frame.pixels*.1&&frame.lit>frame.pixels*.05,'water remains visible');
      assert.ok(frame.clipped/Math.max(1,frame.opaque)<.04,'whitewater does not bleach the planet');
    };
    const baseline=await capture(.6,{spray:0,key:'baseline'}),active=await capture(.6,{compare:'baseline',key:'active'});
    check(baseline);check(active);
    assert.equal(baseline.count,0);assert.ok(active.count>0);
    assert.notEqual(active.hash,baseline.hash,'foam and spray add visible pixels');
    assert.ok(active.changed>50,'spray changes more than isolated noise pixels');
    const repeat=await capture(.6);check(repeat);assert.equal(repeat.hash,active.hash,'same time replays the same particle geometry and shading');
    const frames=[];
    for(const time of [0,.1,.3,.6,.9,1.2,3,112,1800]){
      const frame=await capture(time);check(frame);frames.push(frame);
    }
    assert.ok(new Set(frames.slice(0,6).map(frame=>frame.hash)).size>4,'successive frames keep the foam moving');

    // Replace only particle sampling in this fixture. The production water,
    // billboard shader, depth buffer and blend pass remain unchanged.
    const occlusion=await page.evaluate(()=>{
      const original=OceanSprayField.sample;
      try{
        const baseline=captureSpray(.6,{spray:0,key:'depth-baseline'});
        const particle={x:0,y:0,z:-1.1,radius:.1,angle:0,alpha:1,seed:.5,kind:0,life:.5};
        OceanSprayField.sample=()=>[{...particle}];
        const behind=captureSpray(.6,{compare:'depth-baseline'});
        particle.z=1.15;
        const front=captureSpray(.6,{compare:'depth-baseline'});
        return {baseline,behind,front};
      }finally{OceanSprayField.sample=original;}
    });
    check(occlusion.baseline);check(occlusion.behind);check(occlusion.front);
    assert.equal(occlusion.behind.hash,occlusion.baseline.hash,'a rear particle is hidden by the actual ocean depth');
    assert.notEqual(occlusion.front.hash,occlusion.baseline.hash,'the equivalent foreground particle is visible');
    assert.ok(occlusion.front.changed>50,'foreground foam forms a visible volume');
    const afterFixture=await capture(.6);check(afterFixture);assert.equal(afterFixture.hash,active.hash,'restoring the field restores the original full spray');

    const beforeRestore=await capture(1.2);
    const restored=await page.evaluate(async()=>{
      const r=spraySurface,extension=r.gl.getExtension('WEBGL_lose_context');
      if(!extension)return {supported:false};
      const prior=r.spray;
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('WebGL context restore timed out')),8000);
        r.canvas.addEventListener('webglcontextrestored',()=>{clearTimeout(timeout);resolve();},{once:true});
        r.canvas.addEventListener('webglcontextlost',()=>setTimeout(()=>extension.restoreContext(),50),{once:true});
        extension.loseContext();
      });
      return {supported:true,replaced:r.spray!==prior,textureReady:r.textureReady,error:r.error};
    });
    if(restored.supported){
      assert.equal(restored.replaced,true,'restoring context rebuilds the spray program and buffer');
      assert.equal(restored.textureReady,true);assert.equal(restored.error,'');
      const afterRestore=await capture(1.2);check(afterRestore);
      assert.equal(afterRestore.hash,beforeRestore.hash,'context restore preserves the same scene at the same time');
    }

    const sheet=createCanvas(edge*3,(edge+40)*2),ctx=sheet.getContext('2d');
    ctx.fillStyle='#02121c';ctx.fillRect(0,0,sheet.width,sheet.height);
    const tiles=[{time:.6,spray:0,label:'Surface foam only'},{time:.6,spray:1,label:'Volume foam + spray'},
      ...[0,.3,.6,.9].map(time=>({time,spray:1,label:'Motion '+time.toFixed(1)+' s'}))];
    for(const [index,tile]of tiles.entries()){
      const frame=await capture(tile.time,{spray:tile.spray});check(frame);
      const png=await page.screenshot({timeout:60000}),x=index%3*edge,y=Math.floor(index/3)*(edge+40);
      ctx.fillStyle='#d6f0fa';ctx.font='18px sans-serif';ctx.fillText(tile.label,x+16,y+27);
      ctx.drawImage(await loadImage(png),x,y+40,edge,edge);
    }
    const artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
    fs.writeFileSync(path.join(artifacts,'ocean-volume-spray.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(artifacts,'ocean-volume-spray-metrics.json'),JSON.stringify({baseline,active,frames,occlusion,restored},null,2));
    assert.deepEqual(errors,[]);
    const disposed=await page.evaluate(()=>{const spray=spraySurface.spray;spraySurface.dispose();return {surface:spraySurface.disposed,spray:spray.disposed,count:spray.count};});
    assert.deepEqual(disposed,{surface:true,spray:true,count:0});
    console.log('Ocean spray browser passed: visible volume, bounded white/count, shared 3x sea/foam clock, unchanged host clock, deterministic motion, real water occlusion, restored GL state, context recovery and disposal.');
    console.log(JSON.stringify({changed:active.changed,meanDelta:active.meanDelta,count:active.count,restore:restored.supported}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
