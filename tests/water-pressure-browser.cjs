'use strict';
// Read the opaque liquid silhouette from real WebGL frames. These checks
// distinguish short local impacts from a persistently wavy or breathing sphere.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function deltas(a,b){return a.map((r,i)=>r===null||b[i]===null?null:r-b[i]);}
require('../js/element-material-renderer.js');
const pokes=globalThis.ElementMaterialRenderer.waterPokes;
assert.equal(typeof pokes,'function');
const events=[];
for(let lane=0;lane<4;lane++){
  let previous=0,event=null;
  for(let step=0;step<=6000;step++){
    const time=step*.002,p=pokes(time),amplitude=p[lane*4+2];
    assert.ok(p.length===16&&p.every(Number.isFinite));
    assert.deepEqual(p,pokes(time),'sampling a paused time is deterministic');
    if(step>0)assert.ok(Math.abs(amplitude-previous)<.02,'impact amplitude is continuous across cycles');
    if(amplitude>0&&previous<=0)event={lane,start:time,peak:time,amplitude};
    if(event&&amplitude>event.amplitude)Object.assign(event,{peak:time,amplitude,x:p[lane*4],y:p[lane*4+1]});
    if(event&&amplitude<=0){
      event.end=time;
      if(event.start>.01){
        assert.ok(event.peak-event.start<.12,'a poke reaches its tip quickly');
        assert.ok(event.end-event.start<.40,'the tip retracts promptly');
        assert.ok(event.amplitude>.18,'short impacts have clear extension');
        events.push(event);
      }
      event=null;
    }
    previous=amplitude;
  }
}
assert.ok(events.length>50,'repeated independent impacts continue throughout the animation');
const candidates=events.filter(e=>e.start>1&&e.y<-.25&&Math.abs(e.x)>.35&&Math.abs(e.x)<.85).filter(e=>{
  const p=pokes(e.end+.11);
  let disturbance=0;
  for(let j=0;j<4;j++)disturbance+=Math.abs(p[j*4+2])*Math.exp(-(1-e.x*p[j*4]-e.y*p[j*4+1])/(p[j*4+3]**2));
  return disturbance<.006;
}).sort((a,b)=>a.peak-b.peak);
assert.ok(candidates.length>=3);
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const errors=[],results=[];
  try{
    async function setup(baseline){
      const page=await browser.newPage({viewport:{width:390,height:844}});
      page.on('pageerror',e=>errors.push(String(e)));
      await page.setContent('<canvas id="scene"></canvas>');
      await page.addScriptTag({content:read('js/fire-scan-transition.js')});
      for(const name of ['element-material-fluids.js','element-material-renderer.js'])await page.addScriptTag({content:read((baseline?'artifacts/water-pressure-baseline/':'js/')+name)});
      await page.evaluate(()=>{
        window.r=new ElementMaterialRenderer();r.select('water');
        window.paint=({width,height,power,time,center})=>{
          const c=document.querySelector('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
          ctx.fillStyle='#061522';ctx.fillRect(0,0,width,height);
          const layout=FireScanTransition.layout(width,height,r.layout(width,height),1),box=layout.box;
          const ok=r.draw(ctx,c,width,height,{time,waterPower:power,formation:1,phase:.5,opacity:1,box});
          const p=r.patch,b=r.renderBox,pw=p.width,ph=p.height,data=r.patchCtx.getImageData(0,0,pw,ph).data;
          const sx=b.width/pw,sy=b.height/ph,rootY=box.y+box.height/2+box.width*.33;
          // Keep the largest connected dense component; detached droplets
          // cannot count as swelling of the main liquid body.
          const seen=new Uint8Array(pw*ph);let body=[];
          for(let start=0;start<seen.length;start++){
            if(seen[start]||data[start*4+3]<150)continue;
            const stack=[start],part=[];seen[start]=1;
            while(stack.length){
              const i=stack.pop(),x=i%pw,y=Math.floor(i/pw);part.push(i);
              for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
                const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=pw||ny>=ph)continue;
                const n=ny*pw+nx;if(!seen[n]&&data[n*4+3]>=150){seen[n]=1;stack.push(n);}
              }
            }
            if(part.length>body.length)body=part;
          }
          const mask=new Uint8Array(pw*ph);let top=Infinity,bottom=-Infinity,left=Infinity,right=-Infinity;
          for(const i of body){mask[i]=1;const x=b.x+(i%pw+.5)*sx,y=b.y+(Math.floor(i/pw)+.5)*sy;
            top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
          const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
          const radius=.12+(.65-.12)*Math.pow(Math.min(power,1),.82)
            +.22*Math.max(0,Math.min(1,(power-1)/.94))+.15*smooth((power-1.94)/.58)+.03*smooth((power-2.52)/.48);
          center=center||{x:box.x+box.width/2,y:rootY-radius*box.width/2};
          const rays=[];
          for(let i=0;i<120;i++){
            const a=i*Math.PI*2/120;let distance=0,clipped=false;
            for(let rad=0;rad<width;rad+=.5){
              const x=Math.floor((center.x+Math.cos(a)*rad-b.x)/sx),y=Math.floor((center.y+Math.sin(a)*rad-b.y)/sy);
              if(x<2||x>=pw-2||y<2||y>=ph-2){clipped=true;break;}
              if(!mask[y*pw+x])break;distance=rad;
            }
            rays.push(clipped?null:distance);
          }
          let patchHash=2166136261;for(const byte of data)patchHash=Math.imul(patchHash^byte,16777619);
          const final=ctx.getImageData(0,0,width,height).data;let hash=2166136261;
          for(const byte of final)hash=Math.imul(hash^byte,16777619);
          return {ok,error:r.error,diagnostic:r.diagnostic,gl:r.gl.getError(),hash:hash>>>0,patchHash:patchHash>>>0,center,rays,
            rootY,top,bottom,left,right,area:body.length*sx*sy,titleY:layout.numbers.labelY-layout.numbers.labelFontSize-13,
            scene:c.toDataURL()};
        };
      });return page;
    }
    const baseline=await setup(true),current=await setup(false);
    const paint=(page,args)=>page.evaluate(args=>paint(args),args);
    for(const power of [0,1,1.94,2.4]){
      for(const time of [1.6,3.4]){
        const args={width:390,height:844,power,time},before=await paint(baseline,args),after=await paint(current,args);
        assert.ok(after.ok,after.error+' '+after.diagnostic);assert.equal(after.gl,0);
        assert.equal(after.hash,before.hash,'non-SS visible water pixels stay unchanged');
      }
    }
    const images=[];
    const impact=candidates[0];
    // Shader coordinates point up, whereas the sampled canvas rays point down.
    const impactAngle=(Math.atan2(-impact.y,impact.x)+Math.PI*2)%(Math.PI*2);
    const impactRay=Math.round(impactAngle/(Math.PI*2)*120)%120;
    const tipRays=[-2,-1,0,1,2].map(offset=>(impactRay+offset+120)%120);
    for(const [width,height] of [[390,844],[320,568]]){
      const frames=[];
      const phases=[['before',impact.start-.01],['peak',impact.peak],['returned',impact.end+.11]];
      for(const [phase,time] of phases){
        const args={width,height,power:3,time},before=await paint(baseline,args),after=await paint(current,{...args,center:before.center});
        assert.ok(after.ok,after.error+' '+after.diagnostic);assert.equal(after.gl,0);
        assert.ok(after.area>before.area*.70,'pressurized water remains a substantial cohesive volume');
        assert.ok(after.bottom<after.titleY-8,'water body leaves the attribute title clear');
        const displacement=deltas(after.rays,before.rays),valid=displacement.filter(v=>v!==null);
        const roundFraction=valid.filter(v=>Math.abs(v)<=3).length/valid.length;
        assert.ok(roundFraction>=.65,'at least 65% of the visible rim retains the circular body: '+roundFraction);
        const tip=tipRays.map(i=>displacement[i]).filter(v=>v!==null);
        assert.ok(tip.length>=3,'the selected impact must remain on screen');
        const tipPush=Math.max(...tip);
        if(phase==='peak')assert.ok(tipPush>10,'the selected localized impact visibly thrusts outward: '+tipPush);
        if(phase==='returned')assert.ok(tip.every(v=>Math.abs(v)<=3),'the same tip returns to the round body: '+tip.join(', '));
        const repeat=await paint(current,{...args,center:before.center});assert.equal(repeat.patchHash,after.patchHash,'paused pressure shape stays pixel-identical');
        results.push({width,height,phase,time,roundFraction,tipPush,maxPush:Math.max(...valid),top:after.top,bottom:after.bottom,titleY:after.titleY});
        frames.push({tipPush});if(width===390)images.push(after.scene);
      }
      assert.ok(frames[1].tipPush-frames[2].tipPush>10,'the observed tip extends and retracts, rather than remaining as a permanent bulge');
      results.push({width,height,impactDuration:impact.end-impact.start,attackDuration:impact.peak-impact.start});
    }
    assert.deepEqual(errors,[]);
    const sheet=createCanvas(390*3,844),ctx=sheet.getContext('2d');
    for(let i=0;i<images.length;i++)ctx.drawImage(await loadImage(images[i]),i*390,0);
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    fs.writeFileSync(path.join(root,'artifacts/water-pressure-motion.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(root,'artifacts/water-pressure-motion.json'),JSON.stringify(results,null,2));
    console.log('water pressure GPU circular body / local thrust and retraction / pause / text clearance / lower-rank regression passed',JSON.stringify(results));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
