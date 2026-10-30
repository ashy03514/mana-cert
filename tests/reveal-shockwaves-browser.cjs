/* Actual shared preview/formal entrypoints, with deterministic RAF timing. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const artifact=name=>path.join(__dirname,'../artifacts',name);
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const pending=new Map();
      Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
      requestAnimationFrame=cb=>{pending.set(++id,cb);return id;};cancelAnimationFrame=id=>pending.delete(id);
      window.advanceWave=ms=>{do{const dt=Math.min(25,ms);ms-=dt;now+=dt;
        const q=[...pending.values()];pending.clear();q.forEach(cb=>cb(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const draw=RevealShockwaves.draw;
      RevealShockwaves.draw=function(ctx,frame){
        window.waveFrame={...frame,sample:this.sample(frame)};return draw.call(this,ctx,frame);
      };
      const step=RevealAtmosphere.prototype.step;
      RevealAtmosphere.prototype.step=function(...args){
        const result=step.apply(this,args),q={x:350,y:422,seed:9,angle:0,depth:.5};
        window.pressurePose={mist:this.point(q,'mist',390,844),dot:this.point(q,'dot',390,844)};
        return result;
      };
    });
    const advance=ms=>page.evaluate(ms=>advanceWave(ms),ms);
    const frame=()=>page.evaluate(()=>waveFrame);
    const snapshot=()=>page.locator('#particleCanvas').evaluate(c=>c.toDataURL());
    const draw=async()=>{
      await page.mouse.move(120,450);await page.mouse.down();
      for(const [x,y] of [[110,350],[145,280],[195,245],[235,280],[250,360],[220,420],[170,390],[180,330],[240,460]])
        await page.mouse.move(x,y,{steps:5});
      await advance(50);await page.mouse.up();await advance(0);
    };
    await page.locator('#tab_effects').click();
    await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await page.locator('#flowPreviewOpen').click();await advance(0);await draw();
    const shots=[];let time=0;
    for(const [at,id] of [[.62,1],[.75,1],[.98,2],[1.11,2],[1.3,null],[1.68,null],[1.77,3],[1.9,3]]){
      await advance(Math.round((at-time)*1000));time=at;const f=await frame();
      assert.equal(f.sample?.id??null,id,'correct wave or quiet hold at '+at);
      assert.equal(f.state,id===3?'GATHER':'WAITING');
      if(id===null)assert.equal(await page.locator('#materialStatus').textContent(),'魔力蓄勢');
      shots.push({at,id,image:await snapshot(),radius:f.sample?.radius,pressure:await page.evaluate(()=>pressurePose)});
      if(at===.98||at===1.3){
        await page.locator('#materialPause').click();const paused=await snapshot(),before=await frame();
        await advance(1000);assert.equal(await snapshot(),paused);assert.deepEqual(await frame(),before);
        await page.locator('#materialPause').click();
      }
    }
    assert.ok(shots[0].radius>shots[1].radius&&shots[2].radius>shots[3].radius&&shots[6].radius<shots[7].radius);
    assert.notEqual(shots[4].image,shots[5].image,'the half-second pressure hold retains live atmospheric motion');
    assert.ok(shots[4].pressure.mist.x>shots[5].pressure.mist.x+10,'the actual host continues pulling mist toward the centre before the burst');
    assert.equal(shots[4].pressure.dot.x,shots[5].pressure.dot.x,'additional inward movement applies only to the mist');
    await advance(250);assert.equal((await frame()).sample,null,'third wave clears without touching the rest of the burst');
    const sheet=createCanvas(390*4,884*2),ctx=sheet.getContext('2d');
    ctx.fillStyle='#080915';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<shots.length;i++){
      const s=shots[i],x=(i%4)*390,y=Math.floor(i/4)*884;
      ctx.fillStyle='#d6f5ff';ctx.font='17px sans-serif';ctx.fillText((s.id?'Wave '+s.id:'Hold')+' / '+s.at.toFixed(2)+' s',x+12,y+26);
      ctx.drawImage(await loadImage(s.image),x,y+40,390,844);
    }
    fs.writeFileSync(artifact('reveal-shockwaves-sequence.png'),sheet.toBuffer('image/png'));
    // Resuming input during anticipation cancels both rings immediately.
    await page.locator('#materialReplay').click();await advance(0);await draw();await advance(650);
    assert.equal((await frame()).sample.id,1);
    await page.mouse.move(140,370);await page.mouse.down();await advance(30);
    assert.equal((await frame()).state,'DRAWING');assert.equal((await frame()).sample,null);
    await page.mouse.up();
    // The same light-blue sequence enters from the production start button.
    await page.locator('#effectPreviewBack').click();await page.locator('#btnStart').click();await advance(0);await draw();
    await advance(680);assert.equal((await frame()).sample.id,1);
    await advance(360);assert.equal((await frame()).sample.id,2);
    await advance(240);assert.equal((await frame()).sample,null);assert.equal((await frame()).state,'WAITING');
    await advance(500);assert.equal((await frame()).sample.id,3);
    assert.equal(await page.locator('body').getAttribute('data-state'),'GATHER');
    await page.screenshot({path:artifact('reveal-shockwaves-formal.png')});
    assert.deepEqual(errors,[]);
    console.log('Shockwaves browser: soft inward waves, half-second mist compression before explosion, outward wave, pause/resume/cancel and formal entry passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
