'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const im=await loadImage(path.join(root,'assets/light-angel-wings-v1.png'));
  const c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);
  const data=ctx.getImageData(0,0,im.width,im.height).data;let transparent=0,body=0;
  for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]>220)body++;}
  assert.ok(transparent>im.width*im.height*.2,'genuine transparent outside region');assert.ok(body>im.width*im.height*.15,'readable solid feather bodies');
  for(const offset of [0,(im.width-1)*4,(im.width*(im.height-1))*4,(im.width*im.height-1)*4])assert.equal(data[offset+3],0,'no baked opaque background in the corners');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
    page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
    await page.goto(pathToFileURL(path.join(root,'light-angel-wing-study.html')).href);
    await page.waitForFunction(()=>lightAngelWingStudy.state.imageReady&&lightAngelWingStudy.state.glReady);
    const initial=await page.evaluate(()=>lightAngelWingStudy.state);assert.equal(initial.backgroundError,'');
    const radiance=await page.evaluate(()=>{
      const gl=lightAngelWingStudy.gl,program=gl.getParameter(gl.CURRENT_PROGRAM),rays=gl.getUniformLocation(program,'uGodRays');
      const take=()=>{const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
      const enabled=take();gl.uniform1f(rays,0);gl.drawArrays(gl.TRIANGLES,0,6);const disabled=take();let changed=0,peak=0;
      for(let i=0;i<enabled.length;i+=4){const delta=enabled[i]-disabled[i];if(delta>5)changed++;peak=Math.max(peak,delta);}
      lightAngelWingStudy.render();return {changed,peak,total:enabled.length/4};
    });
    assert.ok(radiance.changed>radiance.total*.08&&radiance.peak>15,'rays create visible soft light across the backdrop');
    const fixedCount=(await page.evaluate(()=>lightAngelWingStudy.state)).drawCount;
    const before=await page.screenshot();const after=await page.screenshot();assert.ok(before.equals(after),'static art remains pixel-identical');
    assert.equal((await page.evaluate(()=>lightAngelWingStudy.state)).drawCount,fixedCount,'no continuous render loop');
    for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>lightAngelWingStudy.resize());
      assert.equal(await page.evaluate(()=>lightAngelWingStudy.gl.getError()),0);
      assert.equal(await page.locator('#error').isVisible(),false);
      const fit=await page.evaluate(()=>{
        const stage=document.getElementById('stage').getBoundingClientRect(),image=document.getElementById('wings').getBoundingClientRect();
        return image.left>=stage.left-.5&&image.top>=stage.top-.5&&image.right<=stage.right+.5&&image.bottom<=stage.bottom+.5;
      });
      assert.ok(fit,'contain image box fits the art viewport with all feather tips visible');
      for(const selector of ['#composition','#detail']){
        const b=await page.locator(selector).boundingBox();assert.ok(b.y>=0&&b.y+b.height<=viewport.height+1,'controls fit '+viewport.width+'x'+viewport.height);
      }
      await page.screenshot({path:path.join(root,`artifacts/light-angel-wing-${viewport.width}x${viewport.height}.png`)});
    }
    // At a wide portrait viewport the stage has side margins: bloom must
    // continue across that former clipping edge, not stop at a rectangle.
    await page.setViewportSize({width:900,height:1000});await page.evaluate(()=>lightAngelWingStudy.resize());
    const stageRect=await page.locator('#stage').boundingBox();
    const free=await page.screenshot();await page.locator('#stage').evaluate(e=>e.style.overflow='hidden');const clipped=await page.screenshot();
    await page.locator('#stage').evaluate(e=>e.style.removeProperty('overflow'));
    const read=async bytes=>{const im=await loadImage(bytes),c=createCanvas(im.width,im.height),x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,im.width,im.height).data;};
    const freePixels=await read(free),clippedPixels=await read(clipped);let spread=0;
    for(let y=Math.ceil(stageRect.y+20);y<stageRect.y+stageRect.height-20;y++)for(let x=0;x<900;x++){
      if(x>=stageRect.x&&x<stageRect.x+stageRect.width)continue;
      const i=(y*900+x)*4;if(Math.abs(freePixels[i]-clippedPixels[i])>1)spread++;
    }
    assert.ok(spread>50,'soft bloom remains visible beyond both former stage edges');
    fs.writeFileSync(path.join(root,'artifacts/light-angel-wing-900x1000.png'),free);
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>lightAngelWingStudy.resize());
    await page.locator('#detail').click();assert.equal((await page.evaluate(()=>lightAngelWingStudy.state)).view,'detail');
    assert.equal(await page.locator('#detail').getAttribute('aria-pressed'),'true');
    assert.ok(await page.locator('#stage').evaluate(e=>e.scrollWidth>e.clientWidth&&e.scrollHeight>e.clientHeight),'detail view can scroll to all feathers');
    await page.screenshot({path:path.join(root,'artifacts/light-angel-wing-detail.png')});
    await page.locator('#composition').click();assert.equal((await page.evaluate(()=>lightAngelWingStudy.state)).view,'composition');
    assert.equal(await page.locator('#stage').evaluate(e=>e.scrollLeft+e.scrollTop),0);
    await page.evaluate(()=>{window.loss=lightAngelWingStudy.gl.getExtension('WEBGL_lose_context');loss.loseContext();});
    await page.waitForFunction(()=>lightAngelWingStudy.state.lost);assert.equal((await page.evaluate(()=>lightAngelWingStudy.state)).imageReady,true);
    await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!lightAngelWingStudy.state.lost&&lightAngelWingStudy.state.glReady);
    assert.equal(await page.evaluate(()=>lightAngelWingStudy.gl.getError()),0);
    await page.evaluate(()=>lightAngelWingStudy.dispose());assert.equal((await page.evaluate(()=>lightAngelWingStudy.state)).disposed,true);
    assert.deepEqual(errors,[]);assert.equal(requests.filter(url=>/^https?:/.test(url)).length,0,'file preview needs no remote assets');
    console.log('Angel wing art passed: transparent master, file entry, static frame, four responsive layouts, detail inspection, context restore and cleanup.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
