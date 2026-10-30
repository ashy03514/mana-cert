/* Articulated feather wings. Geometry is sampled from host time, never from
 * certification randomness. Flight feathers overlap from wrist to shoulder. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const flights=[
    [.79,-.46,1.07,-1.26,.058], [.77,-.43,1.21,-1.09,.066],
    [.73,-.39,1.31,-.88,.072], [.68,-.34,1.35,-.65,.076],
    [.62,-.29,1.31,-.43,.080], [.55,-.23,1.22,-.22,.083],
    [.48,-.18,1.09,-.035,.082], [.40,-.12,.94,.105,.079],
    [.33,-.07,.76,.20,.074], [.26,-.01,.58,.24,.065],
    [.19,.045,.40,.23,.053]
  ];
  function feather(ctx,base,tip,width,id,time,shade){
    const dx=tip[0]-base[0],dy=tip[1]-base[1],length=Math.hypot(dx,dy);
    const nx=-dy/length,ny=dx/length;
    // Delayed flexibility is confined to the tip; the quill stays attached.
    const bend=(.018+id%3*.004)*Math.sin(time*.85+id*.71);
    const p=(t,offset)=>{
      const curve=bend*t*t+Math.sin(t*Math.PI)*(.016+id%4*.006);
      return [base[0]+dx*t+nx*(curve+offset),base[1]+dy*t+ny*(curve+offset)];
    };
    const at=(method,t,offset)=>ctx[method](...p(t,offset));
    const bez=(a,b,c)=>ctx.bezierCurveTo(...p(...a),...p(...b),...p(...c));
    ctx.beginPath();at('moveTo',0,0);
    bez([.13,-width*.72],[.52,-width*.98],[.81,-width*.46]);
    bez([.94,-width*.21],[1.015,-width*.15],[.995,width*.045]);
    bez([.975,width*.20],[.93,width*.36],[.85,width*.48]);
    bez([.71,width*.91],[.50,width*1.02],[.24,width*.73]);
    bez([.10,width*.53],[.02,width*.16],[0,0]);ctx.closePath();
    const g=ctx.createLinearGradient(...p(.4,-width),...p(.4,width));
    g.addColorStop(0,shade?'#c4b38b':'#cfc1a3');g.addColorStop(.24,shade?'#e6d6b3':'#f1e8d4');
    g.addColorStop(.52,shade?'#fff4d6':'#fffff6');g.addColorStop(.77,shade?'#f5e5bd':'#faf4e4');g.addColorStop(1,shade?'#bfa97c':'#cbb994');
    ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle=shade?'#947d5028':'#ab976b38';ctx.lineWidth=.002;ctx.stroke();
    // Feather vane: fine oblique barbs meeting a gently curved central quill.
    ctx.save();ctx.clip();ctx.lineWidth=.00125;
    for(let j=2;j<23;j++){
      const t=j/24,w=width*Math.sin(Math.PI*Math.pow(t,.76))*.84;
      ctx.strokeStyle=j%3?'#9e8f6e22':'#ffffff66';ctx.beginPath();
      at('moveTo',t-.065,-w);ctx.quadraticCurveTo(...p(t-.02,-w*.25),...p(t,0));
      ctx.quadraticCurveTo(...p(t-.025,w*.32),...p(t-.08,w));ctx.stroke();
    }
    ctx.beginPath();at('moveTo',.02,0);ctx.quadraticCurveTo(...p(.48,-width*.025),...p(.97,0));
    ctx.strokeStyle=shade?'#fff6d4b0':'#ffffffd0';ctx.lineWidth=.003;ctx.stroke();ctx.restore();
  }
  function wing(ctx,time,layer,side,open){
    ctx.save();ctx.translate(side*.075,.02+layer*.155);ctx.scale(side,1);
    const scale=[.94,.76,.58][layer],angle=[-.04,.30,.64][layer];
    const sway=Math.sin(time*(.42+layer*.055)+layer*1.1+side*.17)*(.026+layer*.005);
    ctx.rotate(angle+sway+(1-open)*-.83);ctx.scale(scale*(.32+.68*open),scale*(.82+.18*open));
    // Solid shoulder/arm beneath the feathers gives the wing a bent anatomy.
    ctx.beginPath();ctx.moveTo(0,.12);ctx.bezierCurveTo(.10,-.13,.40,-.29,.72,-.46);
    ctx.bezierCurveTo(.89,-.57,1.02,-.94,1.07,-1.16);
    ctx.bezierCurveTo(1.17,-.55,1.01,-.09,.62,.12);
    ctx.bezierCurveTo(.40,.30,.12,.32,0,.12);ctx.closePath();
    const shoulder=ctx.createLinearGradient(.18,-.4,.6,.23);
    shoulder.addColorStop(0,'#fffbe8');shoulder.addColorStop(.65,'#e6d8b6');shoulder.addColorStop(1,'#bda77c');ctx.fillStyle=shoulder;ctx.fill();
    for(let i=0;i<flights.length;i++){
      const [x,y,tx,ty,w]=flights[i];feather(ctx,[x,y],[tx,ty],w,i+layer*17,time,layer===2);
    }
    // Two rows of shorter coverts conceal the long feather roots and soften
    // the shoulder. Their staggered tips create a layered, recognisable wing.
    for(let row=0;row<2;row++)for(let i=0;i<10;i++){
      const q=i/9,x=.13+q*.63,y=.10-q*.49-row*.023;
      const dx=.16+q*.10,dy=.09-q*.22;
      feather(ctx,[x,y],[x+dx,y+dy],.047-row*.010,i+row*11+layer*29,time+row,.0);
    }
    ctx.restore();
  }
  function draw(ctx,art,sample){
    if(sample.wings<=0)return;
    ctx.save();ctx.translate(art.cx,art.cy);ctx.scale(art.unit,art.unit);
    for(const layer of [2,1,0]){
      const open=smooth((sample.wings-layer*.07)/(.85-layer*.035));
      ctx.save();ctx.globalAlpha*=open;
      wing(ctx,sample.time,layer,-1,open);wing(ctx,sample.time,layer,1,open);ctx.restore();
    }
    // Warm scattering in front of the joined roots avoids a cut-out seam.
    const glow=ctx.createRadialGradient(0,0,.015,0,0,.29);
    glow.addColorStop(0,'#fffdeee0');glow.addColorStop(.32,'#fff5bf78');glow.addColorStop(1,'#fff6cc00');
    ctx.fillStyle=glow;ctx.globalAlpha*=sample.core;ctx.beginPath();ctx.arc(0,0,.29,0,TAU);ctx.fill();ctx.restore();
  }
  root.LightHolyWings=Object.freeze({draw});
})(globalThis);
