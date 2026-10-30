'use strict';
// Real WebGL silhouette checks. Noise changing inside a still tip is not motion.
// Measurements use CSS pixels at the actual phone layout, not GPU buffer pixels.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const output=name=>path.join(root,'artifacts',name),phone={width:390,height:844};
require('../js/fire-scan-transition.js');
const times=[1.8,2.17,2.63,3.1];

(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const errors=[];
  try{
    async function rendererPage(baseline=false){
      const page=await browser.newPage({viewport:phone});
      page.on('pageerror',e=>errors.push(String(e)));
      await page.setContent('<style>html,body{margin:0;background:#080915}canvas{display:block}</style><canvas id="scene" width="390" height="844"></canvas>');
      await page.addScriptTag({content:read('js/fire-scan-transition.js')});
      if(!baseline)await page.addScriptTag({content:read('js/fire-rank-sparkles.js')});
      for(const name of ['element-material-fluids.js','element-material-renderer.js']){
        await page.addScriptTag({content:read((baseline?'artifacts/fire-rounded-baseline/':'js/')+name)});
      }
      await page.evaluate(()=>{
        window.fireRenderer=new ElementMaterialRenderer();
        window.paintFire=(power,time)=>{
          const c=document.getElementById('scene'),ctx=c.getContext('2d');
          ctx.fillStyle='#080915';ctx.fillRect(0,0,c.width,c.height);
          const base=fireRenderer.layout(c.width,c.height);
          const layout=FireScanTransition.layout(c.width,c.height,base,1,{preview:false});
          const box=layout.box;
          const ok=fireRenderer.draw(ctx,c,c.width,c.height,{time,fireTime:time,firePower:power,
            phase:.5,formation:1,opacity:1,box});
          const patch=fireRenderer.patch,pw=patch.width,ph=patch.height;
          const renderBox=fireRenderer.renderBox||box;
          const sx=renderBox.width/pw,sy=renderBox.height/ph;
          const source={x:box.x+box.width*.5,y:box.y+box.height*.5+box.width*.33};
          const data=fireRenderer.patchCtx.getImageData(0,0,pw,ph).data;
          const mask=new Uint8Array(pw*ph),seen=new Uint8Array(pw*ph);
          for(let i=0;i<mask.length;i++){
            const offset=i*4;
            if(data[offset+3]>96&&data[offset]+data[offset+1]>140)mask[i]=1;
          }
          let body=null;const stack=[],components=[];
          for(let start=0;start<mask.length;start++){
            if(!mask[start]||seen[start])continue;
            stack.push(start);seen[start]=1;
            let minX=pw,maxX=-1,minY=ph,maxY=-1,touchesSource=false;
            const pixels=[];
            while(stack.length){
              const i=stack.pop(),x=i%pw,y=Math.floor(i/pw);pixels.push(i);
              minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
              const cssX=renderBox.x+(x+.5)*sx,cssY=renderBox.y+(y+.5)*sy;
              if(Math.abs(cssX-source.x)<18&&Math.abs(cssY-source.y)<20)touchesSource=true;
              for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
                const nx=x+dx,ny=y+dy;
                if(nx<0||nx>=pw||ny<0||ny>=ph)continue;
                const n=ny*pw+nx;if(mask[n]&&!seen[n]){seen[n]=1;stack.push(n);}
              }
            }
            components.push({area:pixels.length*sx*sy,minX,maxX,minY,maxY,pixels});
            if(!touchesSource||(body&&pixels.length<=body.pixelArea))continue;
            let tx=0,ty=0,tipCount=0,rx=0,ry=0,rootCount=0;
            const tipBand=Math.max(2,(maxY-minY)*.15),rootBand=Math.max(2,(maxY-minY)*.15);
            for(const i of pixels){
              const x=i%pw,y=Math.floor(i/pw);
              if(y<=minY+tipBand){tx+=x+.5;ty+=y+.5;tipCount++;}
              if(y>=maxY-rootBand){rx+=x+.5;ry+=y+.5;rootCount++;}
            }
            body={pixelArea:pixels.length,area:pixels.length*sx*sy,
              width:(maxX-minX+1)*sx,height:(maxY-minY+1)*sy,
              left:renderBox.x+minX*sx,right:renderBox.x+(maxX+1)*sx,
              top:renderBox.y+minY*sy,bottom:renderBox.y+(maxY+1)*sy,
              tip:{x:renderBox.x+tx/tipCount*sx,y:renderBox.y+ty/tipCount*sy},
              root:{x:renderBox.x+rx/rootCount*sx,y:renderBox.y+ry/rootCount*sy}};
          }
          // Fire naturally sheds substantial pieces from its tongues. Count
          // those hot gas volumes in the silhouette, while rejecting tiny
          // independent embers. Keep the source component for root/tip tests.
          let flame=body&&{...body};
          if(body){
            const cutoff=Math.max(20,body.area*.002);
            for(const part of components){
              if(part.area<cutoff)continue;
              flame.left=Math.min(flame.left,renderBox.x+part.minX*sx);
              flame.right=Math.max(flame.right,renderBox.x+(part.maxX+1)*sx);
              flame.top=Math.min(flame.top,renderBox.y+part.minY*sy);
              flame.bottom=Math.max(flame.bottom,renderBox.y+(part.maxY+1)*sy);
            }
            flame.width=flame.right-flame.left;flame.height=flame.bottom-flame.top;
            let centerTop=Infinity,sideTop=Infinity,centerBottom=-Infinity,leftBottom=-Infinity,rightBottom=-Infinity;
            for(const part of components){
              if(part.area<cutoff)continue;
              for(const i of part.pixels){
                const x=renderBox.x+(i%pw+.5)*sx-source.x,y=renderBox.y+(Math.floor(i/pw)+.5)*sy;
                if(Math.abs(x)<flame.width*.12){centerTop=Math.min(centerTop,y);centerBottom=Math.max(centerBottom,y);}
                if(Math.abs(x)>flame.width*.28)sideTop=Math.min(sideTop,y);
                if(Math.abs(x+flame.width*.32)<flame.width*.035)leftBottom=Math.max(leftBottom,y);
                if(Math.abs(x-flame.width*.32)<flame.width*.035)rightBottom=Math.max(rightBottom,y);
              }
            }
            flame.crown=sideTop-centerTop;
            flame.arc=centerBottom-(leftBottom+rightBottom)/2;
          }
          if(window.FireRankSparkles){
            const mana=power>=3?9999:power>=2.52?1000:power>=1.94?950:power>=1?862:0;
            FireRankSparkles.draw(ctx,c.width,c.height,{time,mana,box});
          }
          return {ok,error:fireRenderer.error,diagnostic:fireRenderer.diagnostic,
            gl:fireRenderer.gl.getError(),body,flame,source,box,renderBox,
            materialBox:fireRenderer.materialBox||box,numbers:layout.numbers,
            scene:c.toDataURL(),patch:patch.toDataURL()};
        };
      });
      return page;
    }
    const page=await rendererPage(),baseline=await rendererPage(true);
    const render=(page,power,time)=>page.evaluate(([power,time])=>paintFire(power,time),[power,time]);
    const violations=[];
    const check=(value,message)=>{if(!value)violations.push(message);};
    const valid=frame=>{assert.ok(frame.ok,frame.error+' '+frame.diagnostic);assert.equal(frame.gl,0);assert.ok(frame.body,'the visible flame must remain connected to its source');};
    const seeds=[];
    for(let i=0;i<=12;i++){
      // This is 1.5 seconds at the actual zero-mana clock rate, not sped-up shader time.
      const elapsed=i*.125,frame=await render(page,0,1.8+elapsed*.7);valid(frame);seeds.push(frame);
    }
    const spread=values=>Math.max(...values)-Math.min(...values);
    const seedMotion={tipX:spread(seeds.map(f=>f.body.tip.x)),tipY:spread(seeds.map(f=>f.body.tip.y)),
      rootX:spread(seeds.map(f=>f.body.root.x)),bottom:spread(seeds.map(f=>f.body.bottom))};
    check(seedMotion.tipX>=4,'the seed tip must visibly sway sideways over 1.5 seconds: '+JSON.stringify(seedMotion));
    check(seedMotion.tipY>=3,'the seed tip must breathe vertically, not retain a pointed still silhouette: '+JSON.stringify(seedMotion));
    check(seedMotion.rootX<5&&seedMotion.bottom<5,'the small flame stays rooted while its tip moves: '+JSON.stringify(seedMotion));
    const ranks=[];
    for(const [label,value] of [['A750',750],['A862',862],['S950',950],['SS1000',1000],['SS9999',9999]]){
      const power=FireScanTransition.powerForValue(value),frames=[];
      for(const time of times){const frame=await render(page,power,time);valid(frame);frames.push(frame);}
      const average=key=>frames.reduce((sum,f)=>sum+f.flame[key],0)/frames.length;
      ranks.push({label,value,power,area:average('area'),width:average('width'),height:average('height'),frames});
      for(const frame of frames){
        assert.deepEqual(frame.materialBox,frame.box,'opening the crop never rescales or moves the source material');
        check(frame.flame.bottom<frame.numbers.labelY-26,label+' leaves the title and mana readout below the fire');
      }
    }
    const minimum=[];for(const time of times){const frame=await render(page,0,time);valid(frame);minimum.push(frame);}
    const old=[];for(const time of times){const frame=await render(baseline,FireScanTransition.powerForValue(124),time);valid(frame);old.push(frame);}
    const oldAverage=key=>old.reduce((sum,f)=>sum+f.flame[key],0)/old.length;
    const [a750,a,s,ss1000,ss9999]=ranks;
    for(const key of ['area','width','height']){
      const ratio=minimum.reduce((sum,f)=>sum+f.flame[key],0)/minimum.length/oldAverage(key);
      check(ratio>=.78&&ratio<=1.28,'the minimum now matches the former E124 '+key+'; ratio='+ratio);
    }
    for(const rank of ranks){
      const crown=rank.frames.reduce((sum,f)=>sum+f.flame.crown,0)/rank.frames.length;
      const arc=rank.frames.reduce((sum,f)=>sum+f.flame.arc,0)/rank.frames.length;
      rank.crown=crown;rank.arc=arc;
      check(crown>rank.height*.12,rank.label+' has a visibly higher central crown: '+crown);
      check(arc>rank.width*.04,rank.label+' has a curved underside with lifted shoulders: '+arc);
    }
    check(s.width>a.width*1.20&&s.height>a.height*1.15,
      'S must burn materially wider and taller than A: '+JSON.stringify({a:{width:a.width,height:a.height},s:{width:s.width,height:s.height}}));
    for(const ss of [ss1000,ss9999]){
      check(ss.width>phone.width*.80,ss.label+' spans most of the upper phone width: '+ss.width);
      check(ss.height>phone.height*.38,ss.label+' grows through most of the phone upper half: '+ss.height);
      check(ss.frames.every(frame=>frame.flame.top<phone.height*.14),ss.label+' reaches high into the upper screen');
      check(ss.area>s.area*1.15,ss.label+' has a visibly stronger burning volume than S');
    }
    const sameA=await render(page,s.power,2.17),sameB=await render(page,s.power,2.17);
    assert.equal(sameA.patch,sameB.patch,'pause retains the precise high-rank flame pixels');
    assert.notEqual(ss9999.frames[0].patch,ss9999.frames[1].patch,'SS remains a moving fuel volume after reaching its rank');
    fs.mkdirSync(output('.'),{recursive:true});
    for(const rank of ranks)fs.writeFileSync(output('fire-rank-'+rank.label+'.png'),Buffer.from(rank.frames[1].scene.split(',')[1],'base64'));
    const sheet=createCanvas(390*4,884),ctx=sheet.getContext('2d');ctx.fillStyle='#080915';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(const [i,rank] of [{label:'Min E124',frames:minimum},a,s,ss9999].entries()){
      ctx.fillStyle='#ead9bc';ctx.font='22px sans-serif';ctx.fillText(rank.label.replace(/\d+/,''),i*390+18,29);
      ctx.drawImage(await loadImage(rank.frames[1].scene),i*390,40);
    }
    fs.writeFileSync(output('fire-rounded-growth.png'),sheet.toBuffer('image/png'));
    const seedSheet=createCanvas(180*7,200),seedCtx=seedSheet.getContext('2d');seedCtx.fillStyle='#080915';seedCtx.fillRect(0,0,seedSheet.width,seedSheet.height);
    for(let i=0;i<7;i++){
      const frame=seeds[i*2],img=await loadImage(frame.scene),source=frame.source;
      // The same fixed crop in every panel makes the tip's displacement readable.
      seedCtx.drawImage(img,source.x-45,source.y-75,90,95,i*180,10,180,190);
      seedCtx.fillStyle='#ead9bc';seedCtx.font='13px sans-serif';seedCtx.fillText((i*.25).toFixed(2)+' s',i*180+6,18);
    }
    fs.writeFileSync(output('fire-seed-tip-motion.png'),seedSheet.toBuffer('image/png'));
    const metrics={seedMotion,ranks:ranks.map(({frames,...rank})=>({...rank,
      top:Math.min(...frames.map(f=>f.flame.top)),bottom:Math.max(...frames.map(f=>f.flame.bottom))})),
      oldE124:{area:oldAverage('area'),width:oldAverage('width'),height:oldAverage('height')}};
    fs.writeFileSync(output('fire-rank-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
    console.log(JSON.stringify(metrics,null,2));assert.deepEqual(errors,[]);assert.deepEqual(violations,[],'phone-sized flame shape requirements (artifacts kept for review)');
    console.log('Fire rank WebGL passed: E-sized minimum, moving tip, central crown and round underside, larger S, upper-half SS, fixed roots and exact pause.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
