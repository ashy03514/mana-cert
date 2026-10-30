/* Static SS art review. Authored wing and chain PNGs stay separate so later
 * skeletal articulation can own the membranes and ornaments independently. */
(()=>{
 'use strict';
 const canvas=document.querySelector('#demonWings'),ctx=canvas.getContext('2d'),stage=document.querySelector('#stage');
 const full=document.querySelector('#fullView'),detail=document.querySelector('#detailView'),toggle=document.querySelector('#chainsToggle'),status=document.querySelector('#status'),error=document.querySelector('#error');
 const wing=new Image(),chain=new Image();let loaded=false,failed=false,disposed=false,zoom=1,width=1,height=1,dpr=1,art=null,bounds=null,pan={x:0,y:0},drag=null;
 const seed=n=>{const x=Math.sin(n*127.1+23.1)*43758.5453;return x-Math.floor(x);};
 function state(){full.setAttribute('aria-pressed',String(zoom===1));detail.setAttribute('aria-pressed',String(zoom>1));full.disabled=detail.disabled=toggle.disabled=!loaded||failed;
  stage.style.cursor=zoom>1?'grab':'default';stage.style.touchAction=zoom>1?'none':'auto';
  status.textContent=failed?'素材暫時無法顯示':!loaded?'正在載入羽翼素材。':zoom>1?'拖曳羽翼，查看翼膜與鎖鏈細節。':'SS 靜態美術預覽';}
 function fail(e){failed=true;error.hidden=false;error.textContent='羽翼素材載入失敗，請重新整理。';canvas.dataset.error=String(e);state();}
 function layout(){const b=stage.getBoundingClientRect(),w=Math.min(b.width*.96,b.height*1.40),h=w*2/3;
  return {x:b.left+(b.width-w*zoom)/2+pan.x,y:b.top+(b.height-h*zoom)/2+pan.y,w:w*zoom,h:h*zoom,box:b};}
 function glow(x,y,r,stops){const g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [s,c] of stops)g.addColorStop(s,c);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 function backdrop(a){
  const x=a.x+a.w*.5,y=a.y+a.h*.43;
  const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#0a0b15');bg.addColorStop(.5,'#150d20');bg.addColorStop(1,'#090c16');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  glow(x,y,a.w*.70,[[0,'#703d7548'],[.3,'#442d6940'],[.7,'#30224a22'],[1,'#211c3700']]);
  // Static reflected light is placed behind, never painted over wing detail.
  for(let i=0;i<17;i++){
   const angle=-Math.PI+seed(i+10)*Math.PI,reach=a.w*(.45+seed(i+30)*.5),spread=.018+seed(i+90)*.08;
   ctx.save();ctx.translate(x,y);ctx.rotate(angle);const g=ctx.createLinearGradient(0,0,reach,0);g.addColorStop(0,'#cd9de91c');g.addColorStop(.32,'#a06bbd0e');g.addColorStop(1,'#9e77bb00');
   ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(reach,-reach*spread);ctx.quadraticCurveTo(reach*1.1,0,reach,reach*spread);ctx.closePath();ctx.fill();ctx.restore();
  }
  for(let i=0;i<56;i++){const angle=seed(i+160)*Math.PI*2,r=a.w*(.3+seed(i+220)*.65);ctx.globalAlpha=.16+seed(i+300)*.28;ctx.fillStyle=i%3?'#b79ac9':'#a9bad7';ctx.beginPath();ctx.arc(x+Math.cos(angle)*r,y+Math.sin(angle)*r*.8,.4+seed(i+410)*1.1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 }
 function chainPath(points,a,thickness=.016,opacity=.95,start=.18){
  const curve=[],steps=42;let length=0;
  for(let i=0;i<=steps;i++){
   const t=i/steps,mt=1-t,p={x:a.x+a.w*(mt*mt*points[0][0]+2*mt*t*points[1][0]+t*t*points[2][0]),y:a.y+a.h*(mt*mt*points[0][1]+2*mt*t*points[1][1]+t*t*points[2][1])};
   if(i)length+=Math.hypot(p.x-curve[i-1].x,p.y-curve[i-1].y);curve.push(p);
  }
  const thick=a.w*thickness,span=Math.min(bounds.w-2,length/thick*bounds.h),offset=(bounds.w-span)*start;let walked=0;
  ctx.save();ctx.globalAlpha=opacity;
  for(let i=0;i<steps;i++){
   const p=curve[i],q=curve[i+1],distance=Math.hypot(q.x-p.x,q.y-p.y),sx=bounds.x+offset+walked/length*span,sw=distance/length*span;
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(q.y-p.y,q.x-p.x));ctx.drawImage(chain,sx,bounds.y,sw,bounds.h,-.3,-thick*.5,distance+.6,thick);ctx.restore();walked+=distance;
  }ctx.restore();
 }
 function ornaments(a,behind=false){
  const mirror=points=>points.map(([x,y])=>[1-x,y]);
  for(const side of [0,1]){const p=points=>side?mirror(points):points;
   if(behind){chainPath(p([[.342,.153],[.373,.153],[.365,.185]]),a,.014,.55);continue;}
   // Catenary-like jewelry hangs between the outer elbow and a lower finger
   // bone; both ends belong to the wing, with no screen-edge restraints.
   chainPath(p([[.350,.177],[.335,.620+side*.025],[.210,.560]]),a,.013,.95,.18+side*.23);
   chainPath(p([[.350,.204],[.325,.480],[.450,.415]]),a,.009,.88,.43);
   chainPath(p([[.342,.153],[.337,.201],[.365,.185]]),a,.014,1,.35);
  }
 }
 function render(){
  if(disposed||!loaded||failed)return false;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);art=layout();backdrop(art);
  ctx.save();if(zoom>1){const b=art.box;ctx.beginPath();ctx.rect(b.left,b.top,b.width,b.height);ctx.clip();}
  if(toggle.checked)ornaments(art,true);
  ctx.drawImage(wing,art.x,art.y,art.w,art.h);
  if(toggle.checked)ornaments(art);
  // Restrained root light keeps the two inner attachments connected visually.
  ctx.globalCompositeOperation='screen';glow(art.x+art.w*.5,art.y+art.h*.43,art.w*.044,[[0,'#c2ccff35'],[.16,'#8d9eea20'],[1,'#5363ac00']]);ctx.restore();return true;
 }
 function resize(){if(disposed)return;width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);render();}
 function view(value){zoom=value;pan={x:0,y:0};state();render();}
 const onFull=()=>view(1),onDetail=()=>view(1.65),onToggle=()=>render();
 function down(e){if(zoom===1||e.target.closest('.error'))return;drag={x:e.clientX,y:e.clientY,pan:{...pan},id:e.pointerId};stage.setPointerCapture(e.pointerId);stage.style.cursor='grabbing';}
 function move(e){if(!drag||drag.id!==e.pointerId)return;const b=stage.getBoundingClientRect();pan.x=Math.max(-b.width*.5,Math.min(b.width*.5,drag.pan.x+e.clientX-drag.x));pan.y=Math.max(-b.height*.4,Math.min(b.height*.4,drag.pan.y+e.clientY-drag.y));render();}
 function up(e){if(!drag||drag.id!==e.pointerId)return;drag=null;stage.style.cursor='grab';if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);}
 function dispose(){disposed=true;removeEventListener('resize',resize);removeEventListener('scroll',render);full.removeEventListener('click',onFull);detail.removeEventListener('click',onDetail);toggle.removeEventListener('change',onToggle);stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);}
 full.addEventListener('click',onFull);detail.addEventListener('click',onDetail);toggle.addEventListener('change',onToggle);stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);addEventListener('resize',resize);addEventListener('scroll',render,{passive:true});
 window.darkDemonWingStudy={render,resize,dispose,getState:()=>({loaded,failed,zoom,pan:{...pan},chains:toggle.checked,disposed,art:art?{x:art.x,y:art.y,w:art.w,h:art.h}:null}),wing,chain};
 let remaining=2;function ready(){if(disposed||failed)return;if(--remaining)return;try{
  const c=document.createElement('canvas');c.width=chain.naturalWidth;c.height=chain.naturalHeight;const x=c.getContext('2d');x.drawImage(chain,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let left=c.width,right=0,top=c.height,bottom=0;
  for(let y=0;y<c.height;y++)for(let k=0;k<c.width;k++)if(d[(y*c.width+k)*4+3]>16){left=Math.min(left,k);right=Math.max(right,k);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  bounds={x:left,y:Math.max(0,top-2),w:right-left+1,h:bottom-top+5};loaded=true;state();resize();
 }catch(e){fail(e);}}
 wing.onload=chain.onload=ready;wing.onerror=chain.onerror=()=>fail('image loading');
 wing.src=globalThis.DarkDemonWingAsset||'./assets/dark-demon-wings-ss-v2.png';chain.src=globalThis.DarkChainAsset||'./assets/dark-chain-v1.png';state();resize();
})();
