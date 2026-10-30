'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.setContent('<canvas id="scene" width="390" height="844"></canvas>');
    for(const f of ['fire-scan-transition.js','element-material-fluids.js','element-material-renderer.js'])await page.addScriptTag({content:read('js/'+f)});
    await page.evaluate(()=>{
      window.waterRenderer=new ElementMaterialRenderer();waterRenderer.select('water');
      window.paintWater=(power,time,formation=1)=>{
        const c=document.querySelector('canvas'),ctx=c.getContext('2d');ctx.fillStyle='#061522';ctx.fillRect(0,0,390,844);
        const layout=FireScanTransition.layout(390,844,waterRenderer.layout(390,844),1),box=layout.box;
        const ok=waterRenderer.draw(ctx,c,390,844,{time,waterPower:power,formation,phase:.5,opacity:1,box});
        const patch=waterRenderer.patch,pw=patch.width,ph=patch.height,b=waterRenderer.renderBox;
        const data=waterRenderer.patchCtx.getImageData(0,0,pw,ph).data;
        const sx=b.width/pw,sy=b.height/ph,rootY=box.y+box.height*.5+box.width*.33;
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,count=0,hash=2166136261,blue=0;
        for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);}
        for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){
          const offset=(y*pw+x)*4,cy=b.y+(y+.5)*sy;
          // The main orb ends at the anchored bottom; detached droplets are
          // measured separately so they cannot make a round sphere seem tall.
          if(data[offset+3]<150||cy>rootY+2)continue;
          const cx=b.x+(x+.5)*sx;
          minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);count++;
          if(data[offset+2]>data[offset])blue++;
        }
        return {ok,error:waterRenderer.error,diagnostic:waterRenderer.diagnostic,gl:waterRenderer.gl.getError(),hash,area:count*sx*sy,
          width:maxX-minX,height:maxY-minY,top:minY,bottom:maxY,rootY,blue:blue/count,scene:c.toDataURL(),box,renderBox:b};
      };
      window.fireSnapshots=()=>{
        const r=new ElementMaterialRenderer(),c=document.querySelector('canvas'),ctx=c.getContext('2d'),frames=[];
        const box=FireScanTransition.layout(390,844,r.layout(390,844),1).box;
        for(const [power,time]of [[0,1.8],[1,2.17],[1.94,3.1],[2.52,2.17],[3,3.1]]){
          ctx.fillStyle='#061522';ctx.fillRect(0,0,390,844);
          const ok=r.draw(ctx,c,390,844,{time,fireTime:time,firePower:power,phase:.5,formation:1,opacity:1,box});
          if(!ok)throw new Error(r.diagnostic||r.error);
          frames.push(c.toDataURL());
        }
        r.dispose();return frames;
      };
    });
    const render=(p,t=2.17,f=1)=>page.evaluate(([p,t,f])=>paintWater(p,t,f),[p,t,f]);
    const ranks=[];
    for(const [label,power] of [['Seed',0],['A',1],['S',1.94],['SS',2.52],['SS max',3]]){
      const frame=await render(power);assert.ok(frame.ok,frame.error+' '+frame.diagnostic);assert.equal(frame.gl,0);
      assert.ok(Math.abs(frame.width/frame.height-1)<.10,label+' remains a round volume');
      assert.ok(Math.abs(frame.bottom-frame.rootY)<6,label+' stays anchored above the numeric display');
      assert.ok(frame.blue>.85,label+' water remains blue');ranks.push({label,...frame});
    }
    for(let i=1;i<ranks.length;i++)assert.ok(ranks[i].area>ranks[i-1].area*1.02,'liquid volume grows with mana');
    assert.ok(ranks[0].width<55&&ranks[0].width>25,'initial small water bead');
    assert.ok(ranks[3].width>390*.85&&ranks[3].height>844*.38,'SS fills the upper phone area');
    assert.ok(ranks[3].top<100,'SS extends upward');
    const a=await render(3,3.1),b=await render(3,3.1),moving=await render(3,3.5);
    assert.equal(a.hash,b.hash,'pause holds identical liquid pixels');assert.notEqual(a.hash,moving.hash,'SS currents continue moving');
    const birth=await render(0,4,.15),grown=await render(0,4,.8);
    assert.ok(birth.area<grown.area*.35,'formation grows actual liquid volume without a reveal wipe');
    const sheet=createCanvas(390*4,884),ctx=sheet.getContext('2d');ctx.fillStyle='#061522';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(const [i,rank]of ranks.slice(0,4).entries()){ctx.fillStyle='#c9f6ff';ctx.font='22px sans-serif';ctx.fillText(rank.label,i*390+20,28);ctx.drawImage(await loadImage(rank.scene),i*390,40);}
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    fs.writeFileSync(path.join(root,'artifacts/water-rank-growth.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(root,'artifacts/water-ss-material.png'),Buffer.from(a.scene.split(',')[1],'base64'));
    const legacy=await render(null,2.17);
    const fireBefore=await page.evaluate(()=>fireSnapshots());
    for(const f of ['element-material-fluids.js','element-material-renderer.js'])await page.addScriptTag({content:read('artifacts/water-before-portal49/'+f)});
    await page.evaluate(()=>{waterRenderer.dispose();waterRenderer=new ElementMaterialRenderer();waterRenderer.select('water');});
    const legacyBaseline=await render(null,2.17);
    fs.writeFileSync(path.join(root,'artifacts/water-legacy-current.png'),Buffer.from(legacy.scene.split(',')[1],'base64'));
    fs.writeFileSync(path.join(root,'artifacts/water-legacy-baseline.png'),Buffer.from(legacyBaseline.scene.split(',')[1],'base64'));
    // Compare the composited image: branch compilation can change unused RGB
    // channels under zero alpha while leaving every visible pixel identical.
    assert.equal(legacy.scene,legacyBaseline.scene,'isolated legacy water pixels are unchanged without mana power');
    const fireBaseline=await page.evaluate(()=>fireSnapshots());
    assert.deepEqual(fireBefore,fireBaseline,'all fire ranks retain identical visible pixels');
    assert.deepEqual(errors,[]);
    console.log('water material GPU growth / roundness / anchor / color / pause / formation passed',JSON.stringify(ranks.map(({label,width,height,area,top})=>({label,width,height,area,top}))));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
