'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if(type==='2d')args[0]={...args[0],willReadFrequently:true};
        return getContext.call(this,type,...args);
      };
      let time=0,id=0;const frames=new Map();
      Object.defineProperty(performance,'now',{value:()=>time});
      requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=i=>frames.delete(i);
      window.advanceRanks=ms=>{do{const dt=Math.min(50,ms);ms-=dt;time+=dt;
        const callbacks=[...frames.values()];frames.clear();callbacks.forEach(f=>f(time));
      }while(ms>0);};
    });
    if(!process.argv.includes('--standalone-only')){
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const Original=WindTornadoRenderer;
      WindTornadoRenderer=class extends Original{
        draw(...args){window.rankRenderer=this;this.sampleArgs=args;return super.draw(...args);}
      };
      window.sampleRank=time=>{
        const r=rankRenderer,[ctx,bg,w,h,frame]=r.sampleArgs;
        Original.prototype.draw.call(r,ctx,bg,w,h,{...frame,time});
        const p=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        let hash=2166136261,visible=0,upperEdge=0;
        for(const v of p)hash=Math.imul(hash^v,16777619);
        for(let y=0;y<r.patch.height;y++)for(let x=0;x<r.patch.width;x++){
          if(p[(y*r.patch.width+x)*4+3]>32){visible++;
            if(y<r.patch.height*.18&&(x<r.patch.width*.12||x>r.patch.width*.88))upperEdge++;
          }
        }
        const canvas=document.getElementById('particleCanvas'),rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let composite=2166136261;for(const v of rgba)composite=Math.imul(composite^v,16777619);
        return {rank:r.profile.rank,profile:r.profile,box:r.renderBox,time:r.time,visualTime:r.visualTime,
          shaderTime:r.gl.getUniform(r.program,r.uniforms.uTime),shape:[...r.gl.getUniform(r.program,r.uniforms.uShape)],
          cohesion:r.gl.getUniform(r.program,r.uniforms.uCohesion),detailScale:r.detailScale(r.renderBox,r.profile),
          visible,upperEdge,hash:hash>>>0,composite:composite>>>0,error:r.error,gl:r.gl.getError()};
      };
      window.probeSky=rank=>{
        const r=rankRenderer,[ctx,bg]=r.sampleArgs;
        // Expose empty sky ABOVE the funnel. Its wide, cropped mouth can
        // legitimately reach a side edge in the normal close-up framing.
        Original.prototype.draw.call(r,ctx,bg,390,844,{rank,time:3,formation:1,playbackRate:1.5,
          box:{x:0,y:200,width:390,height:522}});
        const pixels=r.patchCtx.getImageData(0,0,r.patch.width,40).data;
        let cloud=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>32)cloud++;
        return cloud;
      };
    });
    const click=id=>page.locator('#'+id).click({force:true});
    const sample=t=>page.evaluate(t=>sampleRank(t),t);
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await click('materialPreviewOpen');await click('material_wind');
    const shots=[],values={};
    for(const rank of ['E','D','C','B','A','S','SS']){
      await click('windRank_'+rank);
      const frame=await sample(3);values[rank]=frame;
      assert.equal(frame.rank,rank);assert.equal(frame.error,'');assert.equal(frame.gl,0);
      assert.ok(frame.visible>40,rank+' draws an actual visible cloud volume');
      assert.ok(Math.abs(frame.shaderTime-3*2.25*frame.profile.speed)<1e-6,rank+' actual shader receives the relative speed');
      const expected=[frame.profile.widthScale,frame.profile.swayScale,frame.profile.cloudAmount,frame.profile.vortexMix];
      expected.forEach((v,i)=>assert.ok(Math.abs(frame.shape[i]-v)<1e-6,rank+' actual shape uniforms match its selected profile'));
      assert.ok(Math.abs(frame.cohesion-frame.profile.cohesion)<1e-6,rank+' shader receives its actual structural cohesion');
      assert.equal((await sample(3)).composite,frame.composite,rank+' complete frame is reproducible when paused');
      assert.notEqual((await sample(3.3)).hash,frame.hash,rank+' material continues moving');
      await sample(3);
      const file=path.join(artifacts,'wind-rank-'+rank+'.png');await page.screenshot({path:file});
      shots.push({rank,image:await loadImage(file)});
    }
    assert.ok(values.S.upperEdge>500&&values.SS.upperEdge>500,'S/SS retain the edge-to-edge cloud ceiling');
    for(const rank of ['E','D','C','B','A','S','SS']){
      const sky=await page.evaluate(rank=>probeSky(rank),rank);
      if(rank==='S'||rank==='SS')assert.ok(sky>500,'high ranks fill the sky above the funnel');
      else assert.equal(sky,0,rank+' has no thick cloud above the funnel');
    }
    const ground=box=>box.y+box.height/2+1.05*box.height/2.68;
    for(const rank of ['E','D','C','B','A','S','SS']){
      const frame=values[rank];
      assert.equal(frame.profile.vortexMix,0,rank+' uses the developing column rather than the retired wind ring');
      assert.equal(frame.profile.sizeScale,1,rank+' keeps the same camera/world scale');
      assert.ok(Math.abs(frame.detailScale-values.SS.detailScale)<1e-6,rank+' preserves external leaf and line thickness');
      assert.ok(Math.abs(ground(frame.box)-ground(values.SS.box))<1e-6,rank+' retains the same ground contact');
      assert.ok(Math.abs(frame.box.height/values.SS.box.height-frame.profile.sizeScale*frame.profile.heightScale)<1e-6,rank+' receives its independent height scale');
    }
    assert.ok(values.E.box.height<values.D.box.height&&values.D.box.height<values.C.box.height&&values.C.box.height<values.B.box.height,'the developing wind rises into a complete column');
    assert.ok(values.E.cohesion<values.D.cohesion&&values.D.cohesion<values.C.cohesion,'E/D grow structurally rather than as uniform miniatures');
    const sheet=createCanvas(390*7,878),paint=sheet.getContext('2d');paint.fillStyle='#08131c';paint.fillRect(0,0,sheet.width,sheet.height);
    paint.fillStyle='#dbefe9';paint.font='20px sans-serif';
    shots.forEach(({rank,image},i)=>{paint.drawImage(image,i*390,34);paint.fillText(rank,i*390+16,25);});
    fs.writeFileSync(path.join(artifacts,'wind-ranks-overview.png'),sheet.toBuffer('image/png'));
    // Rank controls use the real host: pausing and selecting another rank
    // resets playback, and the selected preset persists into the flow preview.
    await click('materialPause');await click('windRank_D');
    assert.equal(await page.locator('#materialPause').textContent(),'暫停');
    assert.equal(await page.evaluate(()=>rankRenderer.time),0);
    await click('effectPreviewBack');await click('flowPreviewOpen');await click('material_wind');
    assert.equal(await page.locator('#windRank_D').getAttribute('aria-pressed'),'true');
    await page.mouse.move(100,250);await page.mouse.down();await page.mouse.move(240,330,{steps:4});await page.mouse.up();
    await page.evaluate(()=>advanceRanks(5500));
    assert.equal(await page.evaluate(()=>rankRenderer.profile.rank),'D');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false,'the preset selection cannot fabricate a numeric result');
    await click('windRank_SS');assert.equal(await page.locator('#materialStatus').textContent(),'畫完後放開');
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      const strokeY=Math.min(220,viewport.height*.22);
      await page.mouse.move(90,strokeY);await page.mouse.down();await page.mouse.move(220,strokeY+25,{steps:2});await page.mouse.up();
      await page.evaluate(()=>advanceRanks(5500));
      const boxes=await page.evaluate(()=>{
        const rect=id=>{const b=document.getElementById(id).getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
        return {controls:rect('materialControls'),title:rect('revealTitle'),ranks:['E','D','C','B','A','S','SS'].map(r=>rect('windRank_'+r))};
      });
      assert.ok(boxes.title.bottom>boxes.title.top,'the actual completed reveal title is visible');
      assert.ok(boxes.title.bottom<=boxes.controls.top,'wind title stays above the expanded control panel');
      for(const r of boxes.ranks)assert.ok(r.left>=0&&r.right<=viewport.width&&r.top>=0&&r.bottom<=viewport.height,'rank buttons remain on screen');
      await click('materialReplay');
    }
    console.log('Main wind ranks passed: seven shaders, structural E/D, fixed detail scale, cloud gates, speed ratios, shared ground, rank controls and three flow layouts.');
    }
    await page.goto(pathToFileURL(path.join(root,'wind-tornado-study.html')).href);
    for(const rank of ['E','D','C','B','A','S','SS']){
      await page.locator('[data-rank="'+rank+'"]').click({force:true});
      const info=await page.evaluate(()=>{windTornadoStudy.renderAt(3);const r=windTornadoStudy.renderer;return {rank:r.profile.rank,error:r.error,gl:r.gl.getError()};});
      assert.equal(info.rank,rank);assert.equal(info.error,'');assert.equal(info.gl,0);
    }
    assert.deepEqual(errors,[]);console.log(process.argv.includes('--standalone-only')
      ?'Standalone wind ranks passed: seven rank selections render without shader or browser errors.'
      :'Wind ranks browser passed: seven real shaders, speed/shape uniforms, cloud gates, moving E/D, pause, rank controls, flow restart and three viewport layouts.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
