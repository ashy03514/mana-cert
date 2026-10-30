'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.setContent('<canvas id="scene" width="390" height="844"></canvas>');
    await page.addScriptTag({content:fs.readFileSync(path.resolve(__dirname,'../js/element-reveal-backdrop.js'),'utf8')});
    await page.evaluate(()=>{
      window.bg=new ElementRevealBackdrop();
      window.paint=(time,element='water',power=1)=>{
        const canvas=document.getElementById('scene'),c=canvas.getContext('2d'),w=390,h=844;
        c.fillStyle='#080915';c.fillRect(0,0,w,h);
        const ok=bg.draw(c,w,h,{element,time,waterPower:power,focus:{x:80,y:190,width:230,height:400}});
        const pixels=c.getImageData(0,0,w,h).data;
        let change=0,totalY=0,energy=0,centre=0,centreCount=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4,d=window.baseline?Math.max(0,pixels[i+2]-baseline[i+2]):0;
          if(d>8){change++;totalY+=y*d;energy+=d;}
          if(Math.abs(x-w/2)<35&&Math.abs(y-390)<80){centre+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;centreCount++;}
        }
        if(!window.baseline)window.baseline=new Uint8ClampedArray(pixels);
        return {ok,error:bg.diagnostic,gl:bg.gl?.getError(),change,y:energy?totalY/energy:0,centre:centre/centreCount,lastKey:bg.lastKey,image:canvas.toDataURL()};
      };
    });
    await page.evaluate(()=>paint(1.8));
    const frames=[];
    for(const time of [.45,.8,1.15]){
      const f=await page.evaluate(t=>paint(t),time);
      assert.equal(f.ok,true);assert.equal(f.error,undefined);assert.equal(f.gl,0);
      assert.ok(f.change>1800,'waterfall covers the screen perimeter');
      assert.ok(f.centre<18,'water material focus stays dark');
      frames.push({...f,time});
    }
    assert.ok(frames[0].y+120<frames[1].y&&frames[1].y+120<frames[2].y,'actual shader energy falls from top to bottom');
    const a=await page.evaluate(()=>paint(.8)),b=await page.evaluate(()=>paint(.8));
    assert.equal(a.image,b.image,'paused waterfall is pixel-identical');
    const fire=await page.evaluate(()=>paint(.8,'fire'));
    assert.notEqual(a.image,fire.image,'same timestamp switches attribute background');
    const water=await page.evaluate(()=>paint(.8));assert.equal(a.image,water.image,'attribute cache invalidation redraws water');
    const next=await page.evaluate(()=>paint(2.8));
    assert.ok(Math.abs(next.y-frames[1].y)<50,'next waterfall crosses the same height two seconds later');
    const sheet=createCanvas(390*3,884),c=sheet.getContext('2d');c.fillStyle='#080915';c.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<frames.length;i++){
      c.fillStyle='#c5f5ff';c.font='17px sans-serif';c.fillText(frames[i].time.toFixed(2)+' s',i*390+14,28);
      c.drawImage(await loadImage(frames[i].image),i*390,40,390,844);
    }
    fs.writeFileSync(path.resolve(__dirname,'../artifacts/water-backdrop-fall.png'),sheet.toBuffer('image/png'));
    assert.deepEqual(errors,[]);
    console.log('Water backdrop GPU passed:',frames.map(({time,change,y,centre})=>({time,change,y,centre})));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
