'use strict';
// Small real WebGL patches: measure burning gas, not the background or free embers.
// Phone PWA pacing and visual acceptance remain a separate device check.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
require('../js/fire-scan-transition.js');
const values=[0,199,350,650,862,9999],times=[1.8,2.17,2.63,3.1];
const powers=values.map(value=>FireScanTransition.powerForValue(value));
assert.equal(powers[0],0,'zero displayed mana means the seed, even after formation finishes');
assert.equal(powers.at(-1),3,'maximum mana reaches the supported SS flame power');
for(let i=1;i<powers.length;i++)assert.ok(powers[i]>powers[i-1],'larger displayed values have stronger fire');

(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:320,height:460}}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.setContent('<canvas id="scene" width="320" height="460"></canvas>');
    for(const name of ['element-material-fluids','element-material-matter','element-material-energy','element-material-renderer']){
      await page.addScriptTag({content:read('js/'+name+'.js')});
    }
    await page.evaluate(()=>{
      window.manaMaterial=new ElementMaterialRenderer();
      window.paintManaFire=(key,power,time,extra={})=>{
        const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
        ctx.fillStyle='#080915';ctx.fillRect(0,0,canvas.width,canvas.height);
        const box={x:80,y:30,width:160,height:216};
        const frame={time,phase:.35,opacity:1,formation:1,box,...extra};
        if(power!==null)frame.firePower=power;
        manaMaterial.select(key);manaMaterial.lastRender=-Infinity;
        const ok=manaMaterial.draw(ctx,canvas,320,460,frame);
        const patch=manaMaterial.patch,w=patch.width,h=patch.height;
        const crop=manaMaterial.renderBox,unit=box.width/2;
        const world=(x,y)=>({px:(crop.x+x/w*crop.width-box.x-box.width/2)/unit,
          py:(box.y+box.height/2-crop.y-y/h*crop.height)/unit});
        const data=manaMaterial.patchCtx.getImageData(0,0,w,h).data;
        const mask=new Uint8Array(w*h),visited=new Uint8Array(w*h);
        let totalArea=0,maxAlpha=0,rootPixels=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const index=y*w+x,offset=index*4,a=data[offset+3];maxAlpha=Math.max(maxAlpha,a);
          if(a<=96||data[offset]+data[offset+1]<=140)continue;
          mask[index]=1;totalArea++;
          const {px,py}=world(x,y);
          if(Math.abs(px)<.12&&py>-.78&&py<-.55)rootPixels++;
        }
        // Free sparks can fly much higher than the flame. Retain the bright
        // connected component touching its fixed fuel source for the silhouette.
        let body={area:0,width:0,height:0,centerX:0,bottom:0};
        const stack=[];
        for(let start=0;start<mask.length;start++){
          if(!mask[start]||visited[start])continue;
          stack.push(start);visited[start]=1;
          let area=0,minX=w,maxX=-1,minY=h,maxY=-1,touchesFuel=false;
          while(stack.length){
            const index=stack.pop(),x=index%w,y=Math.floor(index/w);area++;
            minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
            const {px,py}=world(x,y);
            if(Math.abs(px)<.12&&py>-.78&&py<-.55)touchesFuel=true;
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
              const nx=x+dx,ny=y+dy;
              if(nx<0||nx>=w||ny<0||ny>=h)continue;
              const next=ny*w+nx;if(mask[next]&&!visited[next]){visited[next]=1;stack.push(next);}
            }
          }
          if(touchesFuel&&area>body.area)body={area,width:maxX-minX+1,height:maxY-minY+1,
            centerX:(minX+maxX)/2/w,bottom:world(0,maxY).py};
        }
        let cornerAlpha=0;
        for(const y of [0,1,h-2,h-1])for(const x of [0,1,w-2,w-1])cornerAlpha=Math.max(cornerAlpha,data[(y*w+x)*4+3]);
        return {ok,error:manaMaterial.error,diagnostic:manaMaterial.diagnostic,
          gl:manaMaterial.gl.getError(),box,crop,pixelSize:{width:w,height:h},totalArea,maxAlpha,rootPixels,
          cornerAlpha,body,patch:patch.toDataURL(),image:canvas.toDataURL()};
      };
    });
    const paint=(key,power,time,extra)=>page.evaluate(args=>paintManaFire(...args),[key,power,time,extra||{}]);
    const results=[],violations=[];
    const check=(condition,message)=>{if(!condition)violations.push(message);};
    for(let i=0;i<values.length;i++){
      const frames=[];
      for(const time of times){
        const frame=await paint('fire',powers[i],time);
        assert.ok(frame.ok,frame.error+' '+frame.diagnostic);assert.equal(frame.gl,0);
        assert.ok(frame.body.area>0,'a visible flame remains connected to its fuel at mana '+values[i]);
        assert.ok(frame.rootPixels>0,'the source is lit at mana '+values[i]);
        check(frame.maxAlpha>220,'even the seed is a local bright flame, not a transparent large flame: '+JSON.stringify({mana:values[i],time,maxAlpha:frame.maxAlpha,body:frame.body}));
        assert.ok(frame.body.bottom<-.55&&frame.body.bottom>-.83,'the rooted flame does not zoom away from its fuel source');
        assert.equal(frame.cornerAlpha,0,'the patch background stays transparent');
        assert.deepEqual(frame.box,{x:80,y:30,width:160,height:216},'power does not enlarge the material box');
        assert.ok(Math.abs(frame.pixelSize.width/frame.crop.width-1.5)<.01,'the expanded crop keeps the same world detail density');
        if(powers[i]<=1)assert.deepEqual(frame.pixelSize,{width:240,height:324},'ordinary fire retains the original crop');
        frames.push(frame);
      }
      const average=key=>frames.reduce((sum,frame)=>sum+frame.body[key],0)/frames.length;
      results.push({value:values[i],power:powers[i],area:average('area'),height:average('height'),width:average('width'),frames});
    }
    console.log('Mana flame connected-body averages:',results.map(({frames,...result})=>result));
    const first=results[0],last=results.at(-1);
    check(first.area<last.area*.08,'zero mana is a small tuft compared with a fully powered fire');
    check(first.height<last.height*.35,'the higher mana flame grows upward instead of only becoming brighter');
    for(let i=1;i<results.length;i++){
      check(results[i].area>results[i-1].area*1.02,'average burning area rises between mana '+values[i-1]+' and '+values[i]);
      check(results[i].height>results[i-1].height*1.02,'average rooted flame height rises between mana '+values[i-1]+' and '+values[i]);
    }
    const sameA=await paint('fire',powers[4],2.17),sameB=await paint('fire',powers[4],2.17);
    assert.equal(sameA.patch,sameB.patch,'sampling the same power and clock keeps the paused material exact');
    assert.notEqual(results[4].frames[0].patch,results[4].frames[1].patch,'the reached mana flame keeps burning');
    const clockA=await paint('fire',powers[4],2,{fireTime:3}),clockB=await paint('fire',powers[4],2,{fireTime:3.37});
    assert.notEqual(clockA.patch,clockB.patch,'the integrated fire clock drives actual flame motion independently of the render throttle clock');
    for(const key of ['water','wind','earth','light','dark']){
      const before=await paint(key,null,2),after=await paint(key,1,2,{fireTime:200});
      assert.ok(before.ok&&after.ok,key+' compiles');
      assert.equal(after.patch,before.patch,key+' pixels ignore fire-only power and clock');
    }
    const sheet=createCanvas(320*values.length,502),ctx=sheet.getContext('2d');
    ctx.fillStyle='#080915';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<results.length;i++){
      ctx.fillStyle='#e7deca';ctx.font='17px sans-serif';ctx.fillText('Mana '+results[i].value,i*320+12,24);
      ctx.fillStyle='#b5a289';ctx.font='12px sans-serif';ctx.fillText('Power '+results[i].power.toFixed(3),i*320+12,42);
      ctx.drawImage(await loadImage(results[i].frames[1].image),i*320,42);
    }
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    fs.writeFileSync(path.join(root,'artifacts/mana-fire-growth.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(root,'artifacts/mana-fire-growth-metrics.json'),JSON.stringify(results.map(({frames,...result})=>result),null,2)+'\n');
    assert.deepEqual(errors,[]);
    assert.deepEqual(violations,[],'flame visual invariants (artifact retained for review)');
    console.log('Mana fire WebGL passed: visible values drive a rooted growing fuel volume; stable box, live clock, pause and other five materials verified.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
