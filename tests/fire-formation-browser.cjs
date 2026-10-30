'use strict';
// Real shader silhouettes and production flow; desktop evidence, not iPhone acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const output=name=>path.resolve(__dirname,'../artifacts',name);
// Compare decoded pixels, not PNG encodings (encoders can keep different
// RGB values beneath fully transparent pixels without changing the image).
async function samePixels(first,second,message,topRows=null){
  const image=await loadImage(first),canvas=createCanvas(image.width,image.height),c=canvas.getContext('2d');
  const rows=topRows??image.height;
  c.drawImage(image,0,0);const a=Buffer.from(c.getImageData(0,0,image.width,rows).data);
  c.clearRect(0,0,image.width,image.height);c.drawImage(await loadImage(second),0,0);
  const b=Buffer.from(c.getImageData(0,0,image.width,rows).data);
  assert.ok(a.equals(b),message);
}
async function baseProfile(uri){
  const image=await loadImage(uri),canvas=createCanvas(image.width,image.height),c=canvas.getContext('2d');
  c.drawImage(image,0,0);const w=image.width,h=image.height,d=c.getImageData(0,0,w,h).data;
  const start=Math.ceil((1.35+.38)*w/2),end=Math.floor((1.35+.84)*w/2);
  const edge=(x,threshold)=>{let last=-1;for(let y=start;y<=end;y++)if(d[(y*w+x)*4+3]>threshold)last=y;return last;};
  const widths=[];for(let x=Math.round(w*.38);x<=Math.round(w*.62);x+=3){
    const faint=edge(x,32),bright=edge(x,192);if(bright>=0)widths.push(faint-bright);
  }
  const edges=[-.24,-.12,0,.12,.24].map(x=>edge(Math.round((x+1)*w/2),64));
  let boundaryAlpha=0;for(let y=Math.ceil((1.35+.84)*w/2);y<h;y++)for(let x=0;x<w;x++)boundaryAlpha=Math.max(boundaryAlpha,d[(y*w+x)*4+3]);
  return {softWidth:widths.reduce((sum,n)=>sum+n,0)/widths.length,edges,boundaryAlpha};
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.setContent('<canvas id="scene" width="780" height="1688"></canvas>');
    for(const name of ['element-material-matter','element-material-energy'])await page.addScriptTag({content:read('js/'+name+'.js')});
    await page.addScriptTag({content:read('artifacts/fire-formation-baseline/element-material-fluids.js')});
    await page.addScriptTag({content:read('artifacts/fire-formation-baseline/element-material-renderer.js')});
    await page.evaluate(()=>{
      window.oldMaterial=new ElementMaterialRenderer();oldMaterial.init();
      for(const key of Object.keys(ElementMaterialRenderer.names))oldMaterial.compile(key);
    });
    for(const name of ['element-material-fluids','element-material-renderer'])await page.addScriptTag({content:read('js/'+name+'.js')});
    await page.evaluate(()=>{
      window.newMaterial=new ElementMaterialRenderer();
      window.paintFireTest=(key,formation,old=false,time=2)=>{
        const canvas=document.getElementById('scene'),c=canvas.getContext('2d');
        c.setTransform(2,0,0,2,0,0);c.fillStyle='#080915';c.fillRect(0,0,390,844);
        const m=old?oldMaterial:newMaterial;m.select(key);m.lastRender=-Infinity;
        const ok=m.draw(c,canvas,390,844,{time,phase:.35,opacity:1,formation});
        const {width:w,height:h}=m.patch,d=m.patchCtx.getImageData(0,0,w,h).data;
        let area=0,maxAlpha=0,minX=w,minY=h,maxX=-1,maxY=-1,rootPixels=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const alpha=d[(y*w+x)*4+3];maxAlpha=Math.max(maxAlpha,alpha);
          if(alpha>128){area++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
          const px=x/w*2-1,py=((h-1-y)/h-.5)*2*h/w;
          if(alpha>96&&Math.abs(px)<.10&&py>-.72&&py<-.58)rootPixels++;
        }
        return {ok,error:m.error,gl:m.gl.getError(),formation,area,maxAlpha,rootPixels,
          width:maxX-minX+1,height:maxY-minY+1,centerX:(minX+maxX)/2/w,
          bottom:((h-1-maxY)/h-.5)*2*h/w,
          patch:m.patch.toDataURL(),image:canvas.toDataURL()};
      };
    });
    const paint=(key,formation,old=false,time=2)=>page.evaluate(v=>paintFireTest(...v),[key,formation,old,time]);
    const frames=[];
    for(const progress of [0,.2,.4,.65,1]){
      const f=await paint('fire',progress);
      assert.ok(f.ok,f.error);assert.equal(f.gl,0);assert.ok(f.area>0,'the initial seed is already visible');
      assert.ok(f.maxAlpha>220,'a small flame has a bright local body, not a faded full-size body');
      frames.push(f);
    }
    const full=frames.at(-1);
    assert.ok(frames[0].height<full.height*.2&&frames[0].width<full.width*.2,'ignition is a small flame in both dimensions');
    assert.ok(frames[0].area<full.area*.03,'ignition cannot show a broad ready-made flame');
    assert.ok(Math.abs(frames[0].bottom+.66)<.04,'ignition root meets the fixed fuel source');
    assert.ok(Math.abs(frames[0].centerX-.5)<.04,'ignition starts in the horizontal centre');
    for(const f of frames)assert.ok(f.rootPixels>10,'the growing fire remains connected to the fixed fuel source');
    for(let i=1;i<frames.length;i++){
      assert.ok(frames[i].height>frames[i-1].height,'fire grows upward through formation');
      assert.ok(frames[i].width>frames[i-1].width,'the fuel bed and side tongues expand');
      assert.ok(frames[i].area>frames[i-1].area,'burning area increases through the growth');
    }
    const mature=await paint('fire',1,true);
    // Only the fuel root changed: y > -.22 (first 376 rows) remains the
    // established flame, including its upper tongues and floating embers.
    await samePixels(full.patch,mature.patch,'upper fire stays pixel-identical above the new fuel roots',376);
    const beforeBase=await baseProfile(mature.patch),afterBase=await baseProfile(full.patch);
    console.log('Fuel edge profiles',{before:beforeBase,after:afterBase});
    assert.ok(afterBase.softWidth>beforeBase.softWidth*1.5,'layered fuel has a visible translucent thickness instead of a common cut edge');
    assert.equal(afterBase.boundaryAlpha,0,'the root dies away before the shader coarse boundary');
    assert.ok(afterBase.edges[2]>(afterBase.edges[0]+afterBase.edges[4])/2+3,'the connected gas volume retains a rounded underside');
    const baseSheet=createCanvas(390*2,844),baseCtx=baseSheet.getContext('2d');
    baseCtx.drawImage(await loadImage(mature.image),0,0,390,844);
    baseCtx.drawImage(await loadImage(full.image),390,0,390,844);
    fs.writeFileSync(output('fire-base-before-after.png'),baseSheet.toBuffer('image/png'));
    const baseMotion=createCanvas(240*4,350),bc=baseMotion.getContext('2d'),shapes=[];
    bc.fillStyle='#080915';bc.fillRect(0,0,baseMotion.width,baseMotion.height);
    for(const [i,time] of [1.4,2,2.6,3.2].entries()){
      const f=await paint('fire',1,false,time),profile=await baseProfile(f.patch);
      assert.equal(profile.boundaryAlpha,0,'moving fuel never reaches the coarse lower cutoff');
      shapes.push(profile.edges.map(y=>y-profile.edges[2]).join(','));
      bc.fillStyle='#e7deca';bc.font='16px sans-serif';bc.fillText(time.toFixed(1)+' s',i*240+12,24);
      bc.drawImage(await loadImage(f.image),150,400,480,640,i*240,30,240,320);
    }
    assert.equal(new Set(shapes).size,4,'the underside changes shape locally rather than moving one fixed arc');
    fs.writeFileSync(output('fire-base-motion.png'),baseMotion.toBuffer('image/png'));
    // Only free embers occupy this strip above the flame. Growth must not
    // magnify or move them as the old coordinate-scale implementation did.
    await samePixels((await paint('fire',.95)).patch,full.patch,
      'free embers keep the same size and position as the fuel bed grows',100);
    for(const key of ['water','wind','earth','light','dark'])for(const formation of [.35,1]){
      const before=await paint(key,formation,true),after=await paint(key,formation);
      await samePixels(after.patch,before.patch,key+' formation and mature appearance stay pixel-identical');
    }
    const pauseA=await paint('fire',.4,false,.48),pauseB=await paint('fire',.4,false,.48);
    assert.equal(pauseA.patch,pauseB.patch,'same formation clock renders the same frame');
    assert.notEqual((await paint('fire',1,false,2.4)).patch,full.patch,'formed fire continues flickering');
    const sheet=createCanvas(390*5,884),sc=sheet.getContext('2d');sc.fillStyle='#080915';sc.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<frames.length;i++){
      sc.fillStyle='#e7deca';sc.font='18px sans-serif';sc.fillText((frames[i].formation*100)+'% growth',i*390+16,28);
      sc.drawImage(await loadImage(frames[i].image),i*390,40,390,844);
    }
    fs.writeFileSync(output('fire-formation-growth.png'),sheet.toBuffer('image/png'));
    const sequence=createCanvas(240*7,350),seq=sequence.getContext('2d');
    seq.fillStyle='#080915';seq.fillRect(0,0,sequence.width,sequence.height);
    for(let i=0;i<7;i++){
      const seconds=i*.2,f=await paint('fire',seconds/1.2,false,seconds);
      // Its translucent edge now flickers. Test the fixed fuel region itself
      // instead of requiring the opaque lower contour to stay motionless.
      assert.ok(f.rootPixels>10,'burning gas remains at the fixed source throughout the actual animation');
      seq.fillStyle='#e7deca';seq.font='16px sans-serif';seq.fillText(seconds.toFixed(1)+' s',i*240+12,24);
      seq.drawImage(await loadImage(f.image),150,400,480,640,i*240,30,240,320);
    }
    fs.writeFileSync(output('fire-formation-natural-sequence.png'),sequence.toBuffer('image/png'));
    console.log('Fire shader: small bright ignition, growing rooted fuel volume, upper fire and other five materials pixel-identical.');
    if(process.env.MANA_SHADER_ONLY==='1')return;
    // Exercise the same new formation in the actual formal and preview entrypoints.
    await page.addInitScript(()=>{
      let now=0,id=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
      window.advanceFire=ms=>{do{const dt=Math.min(ms,50);ms-=dt;now+=dt;const q=[...callbacks.values()];callbacks.clear();q.forEach(cb=>cb(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const draw=ElementMaterialRenderer.prototype.draw;
      ElementMaterialRenderer.prototype.draw=function(...args){window.fireFrame=args[4];window.fireElement=this.element;return draw.apply(this,args);};
    });
    const advance=ms=>page.evaluate(ms=>advanceFire(ms),ms);
    const draw=async()=>{await page.mouse.move(100,260);await page.mouse.down();await page.mouse.move(250,410,{steps:12});await page.mouse.up();};
    await page.locator('label[aria-label="總開關"]').click();
    await page.locator('label[aria-label="火屬性開關"]').click();
    assert.equal(await page.locator('#s_fire').isChecked(),true);
    await page.locator('#btnStart').click();await advance(0);
    await draw();await advance(3850);
    let frame=await page.evaluate(()=>fireFrame);assert.equal(await page.evaluate(()=>fireElement),'fire');
    assert.equal(frame.opacity,1);assert.ok(frame.formation<.1,'formal entry starts with an actual small flame');
    await advance(550);frame=await page.evaluate(()=>fireFrame);assert.ok(frame.formation>.45&&frame.formation<.55);
    await page.screenshot({path:output('fire-formation-formal-half.png')});
    await advance(650);frame=await page.evaluate(()=>fireFrame);assert.equal(frame.formation,1);assert.equal(frame.opacity,1);
    assert.equal(await page.locator('body').getAttribute('data-state'),'ELEMENT_REVEAL');
    await advance(2400);assert.equal(await page.locator('#revealTitle').textContent(),'火屬性');
    assert.equal(await page.locator('body').getAttribute('data-state'),'MANA_SCAN');
    assert.equal(await page.locator('#formalReplay').isVisible(),false,'fire replay waits for the numeric rise');
    await advance(3200);assert.ok(await page.locator('#formalReplay').isVisible());
    await page.locator('#effectPreviewBack').click();await page.locator('#tab_effects').click();
    await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#flowPreviewOpen').click();await advance(0);
    await draw();await advance(4400);frame=await page.evaluate(()=>fireFrame);
    assert.equal(frame.opacity,1);assert.ok(frame.formation>.45&&frame.formation<.55,'preview uses the same growth');
    await page.locator('#materialPause').click();const paused=await page.locator('#particleCanvas').evaluate(c=>c.toDataURL());
    await advance(1000);assert.equal(await page.locator('#particleCanvas').evaluate(c=>c.toDataURL()),paused,'pausing freezes the flame at its current growth');
    await page.locator('#materialPause').click();await advance(3300);
    assert.equal(await page.locator('#materialStatus').textContent(),'魔力攀升');
    await advance(3000);assert.equal(await page.locator('#materialStatus').textContent(),'階段完成');
    assert.equal(await page.locator('#materialError').isVisible(),false);assert.deepEqual(errors,[]);
    console.log('Fire integration: formal and preview both grow for 1.2 seconds, pause exactly, and enter the fire numeric transition.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
