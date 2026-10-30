'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const output=name=>path.resolve(__dirname,'../artifacts',name);
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.setContent('<canvas id="scene" width="390" height="844"></canvas>');
    for(const name of ['element-material-fluids','element-material-renderer','element-reveal-backdrop'])
      await page.addScriptTag({content:fs.readFileSync(path.resolve(__dirname,'../js/'+name+'.js'),'utf8')});
    await page.evaluate(()=>{
      window.fixture={bg:new ElementRevealBackdrop(),material:new ElementMaterialRenderer()};
      window.paintBackdrop=(time,withFire=false)=>{
        const canvas=document.getElementById('scene'),c=canvas.getContext('2d'),{bg,material}=fixture;
        const w=canvas.width,h=canvas.height,box=material.layout(w,h);
        c.fillStyle='#080915';c.fillRect(0,0,w,h);
        const ok=bg.draw(c,w,h,{element:'fire',time,focus:box});
        const pixels=c.getImageData(0,0,w,h).data;
        let change=0,totalY=0,energy=0,centre=0,centreCount=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4,d=fixture.baseline?Math.max(0,pixels[i]-fixture.baseline[i]):0;
          if(d>8){change++;totalY+=y*d;energy+=d;}
          if(Math.abs(x-w/2)<40&&Math.abs(y-(box.y+box.height/2))<100){centre+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;centreCount++;}
        }
        if(!fixture.baseline)fixture.baseline=new Uint8ClampedArray(pixels);
        if(withFire){material.select('fire');material.draw(c,canvas,w,h,{time:2.6,phase:.4,formation:1,opacity:1});}
        return {ok,error:bg.diagnostic,gl:bg.gl?.getError(),width:bg.canvas.width,height:bg.canvas.height,
          change,y:energy?totalY/energy:0,centre:centre/centreCount,lastTime:bg.lastTime,image:canvas.toDataURL()};
      };
    });
    await page.evaluate(()=>paintBackdrop(1.8));
    const frames=[];
    for(const time of [.45,.8,1.15]){
      const f=await page.evaluate(t=>paintBackdrop(t),time);
      assert.equal(f.ok,true);assert.equal(f.error,undefined);assert.equal(f.gl,0);
      assert.ok(f.width<=320&&f.height<=640);assert.ok(f.change>1800,'surge has visible screen coverage');
      assert.ok(f.centre<22,'warm surge keeps the material focal region dark');
      frames.push({...f,time});
    }
    assert.ok(frames[0].y>frames[1].y+120&&frames[1].y>frames[2].y+120,'actual shader energy travels from bottom to top');
    const pausedA=await page.evaluate(()=>paintBackdrop(.8)),pausedB=await page.evaluate(()=>paintBackdrop(.8));
    assert.equal(pausedA.image,pausedB.image,'same material clock preserves the exact background pixels');
    assert.equal(pausedA.lastTime,pausedB.lastTime);
    const next=await page.evaluate(()=>paintBackdrop(2.8));
    assert.ok(Math.abs(next.y-frames[1].y)<50&&next.change>1800,'a new pulse reaches the same height after two seconds');
    const sheet=createCanvas(390*3,884),ctx=sheet.getContext('2d');ctx.fillStyle='#080915';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<frames.length;i++){
      const f=await page.evaluate(t=>paintBackdrop(t,true),frames[i].time);
      ctx.fillStyle='#eedbcc';ctx.font='17px sans-serif';ctx.fillText(frames[i].time.toFixed(2)+' s',i*390+14,28);
      ctx.drawImage(await loadImage(f.image),i*390,40,390,844);
    }
    fs.writeFileSync(output('fire-backdrop-surge.png'),sheet.toBuffer('image/png'));
    assert.deepEqual(errors,[]);
    console.log('Fire backdrop GPU: bounded buffers, bottom-to-top luminous front, two-second repeat, dark centre and deterministic paused pixels passed.',frames.map(({time,change,y,centre})=>({time,change,y,centre})));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
