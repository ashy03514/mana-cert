'use strict';
// Validate calm burning alternating with occasional SS surges. Measure actual
// hot-gas pixels across multiple cycles; small detached embers cannot fake
// stronger movement. Portal 46 still anchors unchanged non-SS rendering.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const output=name=>path.join(root,'artifacts',name),phone={width:390,height:844};
require('../js/fire-scan-transition.js');

(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const errors=[];
  try{
    async function setup(baseline){
      const page=await browser.newPage({viewport:phone});
      page.on('pageerror',e=>errors.push(String(e)));
      await page.setContent('<style>html,body{margin:0;background:#080915}canvas{display:block}</style><canvas id="scene" width="390" height="844"></canvas>');
      await page.addScriptTag({content:read('js/fire-scan-transition.js')});
      for(const name of ['element-material-fluids.js','element-material-renderer.js']){
        await page.addScriptTag({content:read((baseline?'artifacts/ss-inferno-baseline/':'js/')+name)});
      }
      await page.evaluate(()=>{
        window.renderer=new ElementMaterialRenderer();
        window.paint=(power,time,measure=false,force=false)=>{
          const c=document.getElementById('scene'),ctx=c.getContext('2d');
          ctx.fillStyle='#080915';ctx.fillRect(0,0,c.width,c.height);
          const layout=FireScanTransition.layout(c.width,c.height,renderer.layout(c.width,c.height),1,{preview:false});
          const box=layout.box;
          // Boundary samples below 1/30 second must reach the shader, rather
          // than silently reusing the material renderer's capped frame cache.
          if(force)renderer.lastRender=-Infinity;
          const ok=renderer.draw(ctx,c,c.width,c.height,{time,fireTime:time,firePower:power,phase:.5,formation:1,opacity:1,box});
          const patch=renderer.patch,pw=patch.width,ph=patch.height,rect=renderer.renderBox;
          const data=renderer.patchCtx.getImageData(0,0,pw,ph).data;
          // Always read RGBA before serializing. Mixing a GPU-backed PNG read
          // with the canvas's post-getImageData readback can encode differently.
          let pixelHash=2166136261;
          for(const value of data)pixelHash=Math.imul(pixelHash^value,16777619);
          const result={ok,error:renderer.error,gl:renderer.gl.getError(),box,materialBox:renderer.materialBox,
            renderBox:renderer.renderBox,pixelHash:pixelHash>>>0,patch:patch.toDataURL(),scene:c.toDataURL()};
          if(!measure)return result;
          const sx=rect.width/pw,sy=rect.height/ph,sourceX=box.x+box.width/2,sourceY=box.y+box.height/2+box.width*.33;
          const mask=new Uint8Array(pw*ph),seen=new Uint8Array(pw*ph),body=new Uint8Array(pw*ph),stack=[];
          for(let i=0;i<mask.length;i++)if(data[i*4+3]>80&&data[i*4]+data[i*4+1]>150)mask[i]=1;
          let rootBottom=-Infinity,rootX=0,rootCount=0;
          for(let first=0;first<mask.length;first++){
            if(!mask[first]||seen[first])continue;
            stack.push(first);seen[first]=1;const pixels=[];let atRoot=false;
            while(stack.length){
              const i=stack.pop(),x=i%pw,y=Math.floor(i/pw);pixels.push(i);
              const cssX=rect.x+(x+.5)*sx,cssY=rect.y+(y+.5)*sy;
              if(Math.abs(cssX-sourceX)<16&&Math.abs(cssY-sourceY)<24)atRoot=true;
              for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
                const nx=x+dx,ny=y+dy;if(nx<0||nx>=pw||ny<0||ny>=ph)continue;
                const n=ny*pw+nx;if(mask[n]&&!seen[n]){seen[n]=1;stack.push(n);}
              }
            }
            // A spark's pin and halo occupy fewer than 80 dense pixels at this
            // render scale; freely detached large flame tongues still count.
            if(pixels.length*sx*sy>=80)for(const i of pixels)body[i]=1;
            if(atRoot)for(const i of pixels){
              const cssX=rect.x+(i%pw+.5)*sx,cssY=rect.y+(Math.floor(i/pw)+.5)*sy;
              rootBottom=Math.max(rootBottom,cssY);
              if(cssY>sourceY-8){rootX+=cssX;rootCount++;}
            }
          }
          const frame={data,body,pw,ph,rect,sourceX,sourceY,rootBottom,rootX:rootX/Math.max(1,rootCount)};
          const prev=window.previousFrame;let change=0,active=0;
          if(prev){
            if(prev.pw!==pw||prev.ph!==ph)throw new Error('The fire crop changed during a constant-rank run');
            for(let y=0;y<ph;y++){
              const cssY=rect.y+(y+.5)*sy;
              // Keep the stable root and the readout outside the motion score.
              if(cssY<Math.max(18,sourceY-330)||cssY>sourceY-72)continue;
              for(let x=0;x<pw;x++){
                const cssX=rect.x+(x+.5)*sx;if(Math.abs(cssX-sourceX)>170)continue;
                const i=y*pw+x;if(!body[i]&&!prev.body[i])continue;
                const j=i*4,alpha=data[j+3]/255,pa=prev.data[j+3]/255;
                change+=(Math.abs(data[j]*alpha-prev.data[j]*pa)+Math.abs(data[j+1]*alpha-prev.data[j+1]*pa)+Math.abs(data[j+2]*alpha-prev.data[j+2]*pa))/3;
                active++;
              }
            }
          }
          window.previousFrame=frame;
          return {...result,rootBottom,rootX:frame.rootX,motion:active?change/active:0,active};
        };
      });
      return page;
    }
    const baseline=await setup(true),current=await setup(false);
    const render=(page,power,time,measure=false,force=false)=>page.evaluate(args=>paint(...args),[power,time,measure,force]);
    const valid=frame=>{assert.ok(frame.ok,frame.error);assert.equal(frame.gl,0);assert.deepEqual(frame.materialBox,frame.box,'fire fuel stays at the same world-space scale');};
    for(const power of [0,1,1.94])for(const time of [1.8,3.1]){
      const before=await render(baseline,power,time),after=await render(current,power,time);valid(before);valid(after);
      assert.equal(after.pixelHash,before.pixelHash,'non-SS power '+power+' must retain the portal 46 pixels');
    }
    const metrics=[],runs=[],period=9.5;
    const spread=values=>Math.max(...values)-Math.min(...values);
    for(const mana of [1000,9999]){
      const power=FireScanTransition.powerForValue(mana),clock=FireScanTransition.speedForPower(power),windows=[];
      // The tail of every randomized slot is intentionally ordinary burning.
      // Interior samples are fixed independently of each random gust's peak.
      const phases=[.20,.35,.50,.65,.93],slots=3;
      for(let slot=0;slot<slots;slot++)for(const phase of phases){
        const start=(slot+phase)*period,sets=[];
        for(const page of [baseline,current]){
          await page.evaluate(()=>{window.previousFrame=null;});
          const frames=[];
          for(let i=0;i<2;i++){
            const frame=await render(page,power,start+i*.06*clock,true);valid(frame);frames.push(frame);
          }
          sets.push(frames);
        }
        const [before,after]=sets;
        const sample={slot,phase,start,calm:phase===.93,before:before[1].motion,after:after[1].motion,
          ratio:after[1].motion/before[1].motion,
          exact:before.every((frame,i)=>frame.pixelHash===after[i].pixelHash)};
        windows.push(sample);runs.push({mana,...sample,beforeFrames:before,afterFrames:after});
        const paused=await render(current,power,start+.06*clock);
        assert.equal(paused.pixelHash,after[1].pixelHash,'paused SS keeps identical fire pixels');
      }
      const rankRuns=runs.filter(run=>run.mana===mana),frames=rankRuns.flatMap(run=>run.afterFrames);
      const before=rankRuns.flatMap(run=>run.beforeFrames),calm=windows.filter(sample=>sample.calm);
      const active=windows.filter(sample=>!sample.calm).sort((a,b)=>b.ratio-a.ratio);
      const strongest=active.slice(0,Math.max(1,Math.ceil(active.length/3)));
      metrics.push({mana,power,clock,windows,
        calmMotion:calm.reduce((sum,sample)=>sum+sample.after,0)/calm.length,
        surgeRatio:strongest.reduce((sum,sample)=>sum+sample.ratio,0)/strongest.length,
        rootBottomRange:spread(frames.map(frame=>frame.rootBottom)),
        originalRootBottomRange:spread(before.map(frame=>frame.rootBottom)),
        rootMaxDelta:Math.max(...frames.map((frame,i)=>Math.abs(frame.rootBottom-before[i].rootBottom))),
        rootCentroidRange:spread(frames.map(frame=>frame.rootX)),
        rootMeanDelta:frames.reduce((sum,frame,i)=>sum+frame.rootBottom-before[i].rootBottom,0)/frames.length});
    }
    // The analytic gust phase crosses randomized slots without resetting the
    // flame. Force real shader draws either side of these tiny boundaries.
    const boundaries=[];
    for(const time of [period,period*2,period*3]){
      await current.evaluate(()=>{window.previousFrame=null;});
      const before=await render(current,3,time-.001,true,true),after=await render(current,3,time+.001,true,true);
      valid(before);valid(after);boundaries.push({time,motion:after.motion,changed:before.pixelHash!==after.pixelHash});
    }
    const ss=runs.filter(run=>run.mana===9999);
    const strongest=ss.filter(run=>!run.calm).sort((a,b)=>b.ratio-a.ratio)[0];
    const calm=ss.find(run=>run.calm&&run.slot===strongest.slot);
    const selected=[{label:'Calm',run:calm},{label:'Surge',run:strongest}];
    const sheet=createCanvas(390*4,500*2),ctx=sheet.getContext('2d');
    ctx.fillStyle='#080915';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(const [row,{label,run}] of selected.entries())for(let col=0;col<4;col++){
      const revised=col>=2,index=col%2,frame=(revised?run.afterFrames:run.beforeFrames)[index];
      ctx.drawImage(await loadImage(frame.scene),0,0,390,460,col*390,row*500+40,390,460);
      ctx.fillStyle='#ead9bc';ctx.font='18px sans-serif';
      ctx.fillText(label+' / '+(revised?'revised':'ordinary')+' / '+(index*.06).toFixed(2)+' s',col*390+12,row*500+27);
    }
    fs.mkdirSync(output('.'),{recursive:true});
    fs.writeFileSync(output('ss-inferno-motion.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(output('ss-inferno-motion.json'),JSON.stringify({metrics,boundaries},null,2)+'\n');
    console.log(JSON.stringify({metrics,boundaries},null,2));
    assert.deepEqual(errors,[]);
    for(const metric of metrics){
      assert.ok(metric.windows.filter(sample=>sample.calm).every(sample=>sample.exact),
        'SS '+metric.mana+' must return to the original calm burning between gusts');
      assert.ok(metric.calmMotion>1,'calm SS still burns and moves instead of pausing');
      assert.ok(metric.surgeRatio>1.08,'SS '+metric.mana+' has occasional stronger hot-gas motion: '+metric.surgeRatio);
      // Across three full cycles the original gas fringe itself breathes by
      // more than eight pixels. Bound the added displacement against the same
      // ordinary-fire frames instead of a short-run absolute range.
      assert.ok(metric.rootMaxDelta<4,'SS gusts keep the original rooted curved underside: '+metric.rootMaxDelta);
      assert.ok(Math.abs(metric.rootMeanDelta)<4,'SS gusts do not shift the root toward the mana readout');
    }
    for(const boundary of boundaries){
      assert.ok(boundary.changed,'boundary draws must reach the shader instead of passing via the 30fps cache');
      assert.ok(boundary.motion<1.5,'randomized gust slot stays visually continuous: '+JSON.stringify(boundary));
    }
    console.log('SS inferno WebGL passed: calm burning between stronger gusts, continuous randomized cycles, unchanged non-SS fire, fixed source and exact pause.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
