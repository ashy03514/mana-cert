'use strict';
// Capture both production renderers with the same clock and viewport.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
global.window=globalThis;global.document={createElement:()=>createCanvas(1,1)};
for(const name of ['config','fire-scan-transition','lightning-rank-effects','lightning-discharge','lightning-storm-renderer'])
  require(path.join(__dirname,'..','js',name+'.js'));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mana-lightning-motion-'));
const width=220,height=476,header=32;
const sheet=createCanvas(width*2,height+header),g=sheet.getContext('2d');
const panes=['S','SS'].map(rank=>({rank,canvas:createCanvas(width,height),renderer:new LightningStormRenderer(23)}));
for(let frame=0;frame<96;frame++){
  const time=frame/20;g.fillStyle='#080b17';g.fillRect(0,0,sheet.width,sheet.height);
  panes.forEach(({rank,canvas,renderer},i)=>{
    renderer.draw(canvas.getContext('2d'),canvas,width,height,{time,lightningEffects:LightningRankEffects.preview(time,rank)});
    g.drawImage(canvas,i*width,header);g.fillStyle='#ffe7af';g.font='bold 17px sans-serif';
    g.fillText(rank+(rank==='SS'?' v170':''),i*width+12,23);
  });
  fs.writeFileSync(path.join(folder,String(frame).padStart(3,'0')+'.png'),sheet.toBuffer('image/png'));
}
panes.forEach(pane=>pane.renderer.dispose());
const output=path.join(__dirname,'lightning-v170-motion.gif');
const python=process.env.MANA_PYTHON||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
execFileSync(python,['-c',[
  'from PIL import Image',
  'import pathlib, sys',
  'frames=[Image.open(p).convert("RGB") for p in sorted(pathlib.Path(sys.argv[1]).glob("*.png"))]',
  'frames[0].save(sys.argv[2],save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=False)',
  'check=Image.open(sys.argv[2])',
  'assert check.n_frames == 96',
  'print(str(check.n_frames)+" frames / 4.8 seconds / "+str(check.size))'
].join('\n'),folder,output],{stdio:'inherit'});
console.log(output);
