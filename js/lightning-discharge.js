(() => {
  'use strict';
  let cached;

  function randomStream(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function contact(width, height, cycle) {
    const random = randomStream(Math.imul(cycle + 17, 2654435761));
    return { x: width * (.45 + .17 * random()), y: height * (.40 + .06 * random()) };
  }

  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = t => Math.max(0, Math.min(1, t));

  function strikeType(cycle) {
    const random=randomStream(Math.imul(cycle+79,2246822519));
    random(); random();
    const choice=random();
    if (choice<.30) return 'medium';
    if (choice<.60) return 'large';
    return choice<.82 ? 'double' : 'triple';
  }

  function strikeDelays(cycle) {
    const type=strikeType(cycle);
    const count=type==='triple' ? 3 : type==='double' ? 2 : 1;
    const random=randomStream(Math.imul(cycle+143,1597334677));
    const delays=[0];
    for (let i=1;i<count;i++) delays.push(delays[i-1]+.20+.08*random());
    return delays;
  }

  // Geometry, core exposure, sparks and the sky all use the same local clock.
  function strikePhases(cycle, impactAge) {
    return strikeDelays(cycle).map(delay=>{
      const age=impactAge-delay;
      const descent=clamp(1+age/.16);
      const fade=clamp(age/1.06);
      return {
        impactAge:age,upper:clamp(descent/.56),lower:clamp((descent-.56)/.44),
        returnReach:clamp(age/.10),
        flash:age<0 ? 0 : Math.exp(-Math.max(0,age-.07)*9.2),
        afterglow:age<0 ? 0 : 1-fade*fade*(3-2*fade)
      };
    });
  }

  // Displace perpendicular to each section. Reuse the finished channel for the
  // leaders and return stroke, so contact never teleports to a new zigzag.
  function makeChannel(knots, random, unit, roughness) {
    const points = [{...knots[0]}];
    function subdivide(a, b, level) {
      const dx = b.x-a.x, dy = b.y-a.y;
      const length = Math.hypot(dx, dy);
      if (length < 5*unit || level === 6) { points.push({...b}); return; }
      const t = .35 + .3*random();
      const kink = (random()-.5)*roughness;
      const elbow = { x: a.x+dx*t-dy*kink, y: a.y+dy*t+dx*kink };
      subdivide(a, elbow, level+1);
      subdivide(elbow, b, level+1);
    }
    for (let i=1;i<knots.length;i++) subdivide(knots[i-1],knots[i],0);
    let length = 0;
    points[0].s = 0;
    for (let i=1;i<points.length;i++) {
      length += Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
      points[i].s = length;
    }
    return {points, length};
  }

  function sample(channel, t) {
    const s = clamp(t)*channel.length;
    const points = channel.points;
    let lo=1, hi=points.length-1;
    while (lo<hi) {
      const mid=(lo+hi)>>1;
      if (points[mid].s<s) lo=mid+1; else hi=mid;
    }
    const a=points[lo-1], b=points[lo];
    const f=(s-a.s)/Math.max(.00001,b.s-a.s);
    return { x: mix(a.x,b.x,f), y: mix(a.y,b.y,f) };
  }

  function scene(width, height, cycle) {
    if (cached && cached.width===width && cached.height===height && cached.cycle===cycle) return cached;
    const rnd=randomStream(Math.imul(cycle+5, 1597334677));
    const unit=Math.max(.52, Math.min(width/390, height/495));
    const span=Math.min(width*.49, height*.61);
    const hit=contact(width,height,cycle);
    const side=hit.x>width*.52 ? -1 : 1;
    const core={x:width*.5,y:height*.76};
    function trunk(from, upper, target) {
      const dy=target.y-from.y, dx=target.x-from.x;
      const offsets=upper ? [-.17,.14,.02,.18,-.06] : [.11,-.17,-.06,.10];
      const knots=[from];
      for (let i=0;i<offsets.length;i++) {
        const t=(i+.78+.32*rnd())/(offsets.length+1);
        knots.push({x:from.x+dx*t+side*span*(offsets[i]+(rnd()-.5)*.13),
          y:from.y+dy*t});
      }
      knots.push(target);
      return makeChannel(knots,rnd,unit,.38);
    }
    function forks(main, upper) {
      const branches=[];
      const n=upper ? 8 : 6;
      for (let i=0;i<n;i++) {
        const attach=.07+(.83/n)*(i+.67*rnd());
        const origin=sample(main,attach);
        const hand=(i%2===0 ? side : -side);
        const strong=i%3!==1;
        const reach=span*(strong ? .34+.57*rnd() : .14+.28*rnd());
        const dx=hand*reach;
        const dy=(upper?1:-1)*reach*(.19+.48*rnd());
        const tip={x:origin.x+dx, y:origin.y+dy};
        const elbow={x:origin.x+dx*(.32+.18*rnd()), y:origin.y+dy*(.62+.34*rnd())};
        const section=makeChannel([origin,elbow,tip],rnd,unit,.39);
        const end=Math.min(.99, attach+.12+.16*reach/span);
        branches.push({section, attach, end, backStart:1-attach, width:strong?1:.65});
        if (strong) {
          for (let j=0;j<2;j++) {
            const split=.30+.42*rnd();
            const root=sample(section,split);
            const child=makeChannel([root,{x:root.x+dx*(.19+.24*rnd()),y:root.y+dy*(j===0?-.52:.84)}],rnd,unit,.38);
            const start=mix(attach,end,split);
            branches.push({section:child,attach:start,end:Math.min(1,start+.10),backStart:1-attach+(end-attach)*split,width:.43});
          }
        }
      }
      return branches;
    }
    const type=strikeType(cycle);
    const count=type==='triple' ? 3 : type==='double' ? 2 : 1;
    const strokes=[];
    for (let i=0;i<count;i++) {
      const spread=count===1 ? 0 : i/(count-1)-.5;
      const target={x:hit.x+spread*width*.50,y:hit.y+(rnd()-.5)*height*.07};
      const skyX=count===1 ? hit.x+span*side*(.30+.42*rnd())
        : width*(.5+spread*.80+(rnd()-.5)*.08);
      const top=trunk({x:skyX,y:-.055*height},true,target);
      const upward=trunk(core,false,target);
      // Each sky-to-core path stays independent until they meet in the orb.
      const bottom={
        points:upward.points.slice().reverse().map(p=>({x:p.x,y:p.y,s:upward.length-p.s})),
        length:upward.length
      };
      strokes.push({top,bottom,upper:forks(top,true),lower:forks(bottom,false),
        thickness:type==='medium' ? .58 : type==='large' ? 1.25 : .78+.22*rnd()});
    }
    const sparks = Array.from({length:57}, (_,i) => {
      const fast = i < 15;
      const count = fast ? 15 : 42;
      const angle = ((fast ? i : i-15) + .85*rnd()) / count * Math.PI*2;
      // Fast fragments carry enough momentum to clear the bloom in the first exposure.
      const speed = (fast ? 1040+560*rnd() : 100+340*rnd())*unit;
      return {
        fast, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed*.93-48*unit,
        gravity:(240+275*rnd())*unit, life:fast ? .29+.20*rnd() : .32+.49*rnd(),
        advance:fast ? .059+.027*rnd() : .025+.042*rnd(),
        trail:fast ? .034+.025*rnd() : .014+.035*rnd(),
        size:(fast ? 1.2+1.0*rnd() : .38+1.35*rnd()**2)*unit
      };
    });
    cached={width,height,cycle,unit,core,strokes,type,sparks};
    return cached;
  }

  function trace(ctx,ch,from,to) {
    const start=sample(ch,from), end=sample(ch,to);
    const lo=from*ch.length, hi=to*ch.length;
    ctx.moveTo(start.x,start.y);
    for (const p of ch.points) if (p.s>lo && p.s<hi) ctx.lineTo(p.x,p.y);
    ctx.lineTo(end.x,end.y);
  }

  function glowStroke(ctx, size, color, opacity) {
    if (opacity<.008) return;
    ctx.globalAlpha=clamp(opacity);
    ctx.lineWidth=size;
    ctx.strokeStyle=color;
    ctx.stroke();
  }

  // Each discharge keeps its branched path for its lifetime, including brief restrikes.
  const coronaLanes = Array.from({length:16}, (_,i) => {
    // Two alternating channels per sector overlap so no direction goes dark.
    const random=randomStream(Math.imul(i%8+217,2246822519));
    return {period:.24+.29*random(), offset:random()+Math.floor(i/8)*.5, event:-1, channel:null};
  });

  function coronaChannel(lane,event) {
    const random=randomStream(Math.imul(event+53,2654435761)+Math.imul(lane+1,2246822519));
    const angle=(lane%8)*Math.PI/4+(random()-.5)*.26;
    const length=64+random()**1.45*61;
    const bend=(random()-.5)*length*.77;
    const dx=Math.cos(angle), dy=Math.sin(angle);
    function knot(along,across) {
      return {x:dx*along-dy*across,y:dy*along+dx*across};
    }
    const main=makeChannel([knot(4,0),knot(length*.38,bend*.72),knot(length*.68,bend),
      knot(length,(random()-.5)*length*.20)],random,.95,.56);
    const count=2+(random()<.55 ? 1 : 0);
    const forks=[];
    for (let i=0;i<count;i++) {
      const at=.17+(i+.65*random())*.63/count;
      const root=sample(main,at);
      const spread=angle+(i%2===0 ? -1 : 1)*(.28+.96*random());
      const reach=length*(.14+.38*random());
      const end={x:root.x+Math.cos(spread)*reach,y:root.y+Math.sin(spread)*reach};
      forks.push({at,path:makeChannel([root,end],random,1,.60)});
    }
    return {main,forks,width:.67+1.05*random()**2,life:.86+.13*random(),
      rise:.12+.22*random(),restrike:.48+.27*random(),hot:.65+.35*random()};
  }

  function drawCorona(ctx,art,time,cycle,phase) {
    ctx.save();
    ctx.translate(art.core.x,art.core.y);
    ctx.scale(art.unit,art.unit);
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    ctx.lineJoin='round';
    for (let i=0;i<coronaLanes.length;i++) {
      const lane=coronaLanes[i];
      const clock=time/lane.period+lane.offset, event=Math.floor(clock);
      if (event!==lane.event) {
        lane.channel=coronaChannel(i,event);
        lane.event=event;
      }
      const ch=lane.channel;
      const age=(clock-event)/ch.life;
      if (age>=1) continue;
      const lead=clamp(age/ch.rise);
      const echo=Math.exp(-((age-ch.restrike)**2)/.0018);
      const strength=ch.hot*clamp(age/.055)*clamp((1-age)/.23)*
        (.53+.27*phase.charge+.45*echo+.40*phase.flash);
      if (strength<.025) continue;
      const tail=.32*clamp((age-.76)/.24);
      ctx.beginPath();
      trace(ctx,ch.main,tail,lead);
      glowStroke(ctx,ch.width*4.8,'#ffa52c',strength*.13);
      glowStroke(ctx,ch.width*1.8,'#ffbd39',strength*.68);
      glowStroke(ctx,ch.width,'#fff2bb',strength);
      // Branches share a stroke batch; only the advancing leader reveals them.
      ctx.beginPath();
      for (const fork of ch.forks) {
        if (lead>fork.at) trace(ctx,fork.path,0,clamp((lead-fork.at)/.30));
      }
      glowStroke(ctx,ch.width*1.35,'#eeb044',strength*.38);
      glowStroke(ctx,ch.width*.63,'#ffeb9f',strength*.84);
    }
    ctx.restore();
  }


  function drawEnergyOrb(ctx, art, time, phase) {
    const flutter=.5+.3*Math.sin(time*8.1)+.2*Math.sin(time*13.7+.8);
    const radius=(10.8+2.4*phase.charge+2.1*phase.flash+.85*flutter)*art.unit;
    const hotX=-.14+.12*Math.sin(time*2.6), hotY=-.10+.10*Math.sin(time*3.7);
    ctx.save();
    ctx.translate(art.core.x,art.core.y);
    ctx.scale(radius,radius);
    ctx.globalCompositeOperation='lighter';
    const halo=ctx.createRadialGradient(0,0,.4,0,0,2.3);
    halo.addColorStop(0,'#ffbc3b80');
    halo.addColorStop(.48,'#ff9b2329');
    halo.addColorStop(1,'#ed840000');
    ctx.fillStyle=halo;
    ctx.globalAlpha=.69+.19*flutter+.12*phase.flash;
    ctx.fillRect(-2.3,-2.3,4.6,4.6);

    // A slightly off-axis hot pocket leaves a darker gold crescent on the far side.
    const body=ctx.createRadialGradient(hotX,hotY,.035,0,0,1);
    body.addColorStop(0,'#ffffee');
    body.addColorStop(.17,'#fff5bdfa');
    body.addColorStop(.40,'#ffbf49c2');
    body.addColorStop(.71,'#b45d234d');
    body.addColorStop(.90,'#ffc85f8c');
    body.addColorStop(1,'#f9af3812');
    ctx.globalAlpha=1;
    ctx.fillStyle=body;
    ctx.beginPath();
    ctx.arc(0,0,1,0,Math.PI*2);
    ctx.fill();

    // The interior filaments crawl from the moving hot pocket onto the surface.
    ctx.lineCap='round';
    ctx.lineJoin='round';
    for (let i=0;i<5;i++) {
      const seed=i*2.40;
      const angle=seed+.31*Math.sin(time*(1.9+i*.17)+seed);
      ctx.beginPath();
      ctx.moveTo(hotX,hotY);
      for (let j=1;j<=9;j++) {
        const t=j/9;
        const bend=Math.sin(Math.PI*t)*(.41*Math.sin(seed+3.2*t+time*2.8)+.16*Math.sin(j*4.1-time*7.1+seed));
        ctx.lineTo((1-t)*hotX+t*Math.cos(angle+bend),(1-t)*hotY+t*Math.sin(angle+bend));
      }
      const current=.53+.26*Math.sin(time*(6.4+i*.3)+seed)+.16*phase.charge;
      glowStroke(ctx,.12,'#ffad40',current*.39);
      glowStroke(ctx,.049,'#fff2b3',current);
    }
    ctx.restore();
  }

  const mainWidth = 3;

  function drawTree(ctx, main, branches, growth, returning, phase, s) {
    if (growth <= 0) return;
    const {flash, afterglow, impactAge} = phase;
    const landed = impactAge >= 0;
    const traceLight = landed ? Math.max(flash, afterglow*.67) : 1;
    for (const b of branches) {
      const portion = clamp((growth-b.attach)/(b.end-b.attach));
      if (portion <= 0) continue;
      const branchLight = landed ? Math.max(flash, .68*Math.pow(afterglow,1.1+b.attach)) : .85;
      ctx.beginPath();
      trace(ctx,b.section,0,portion);
      glowStroke(ctx,(2.3+b.width)*s,'#f69516',branchLight*.13);
      glowStroke(ctx,Math.max(.38,b.width*1.12*s),'#ffd85c',branchLight*(.40+.40*b.width));
      const lit = clamp((returning-b.backStart)/(b.end-b.attach));
      if (lit > 0 && flash > .01) {
        ctx.beginPath();
        trace(ctx,b.section,0,lit);
        glowStroke(ctx,(1.1+b.width)*s,'#ffe993',flash*.67*b.width);
      }
    }

    ctx.beginPath();
    trace(ctx,main,0,growth);
    const attenuate = traceLight*(1-.62*flash);
    ctx.save();
    // A single blurred envelope avoids hard edges from stacking wide opaque strokes.
    ctx.shadowColor = '#ffb017';
    ctx.shadowBlur = (6+10*flash)*s*ctx.getTransform().a;
    glowStroke(ctx,1.02*mainWidth*s,'#ffca26',attenuate);
    if (flash > .008) glowStroke(ctx,2.35*mainWidth*s,'#ffcd38',flash);
    ctx.restore();
    glowStroke(ctx,1.02*mainWidth*s,'#ffda45',attenuate*.86);
    if (flash > .008) {
      // The whole conductive path ionises at impact. A hotter return then races up it.
      glowStroke(ctx,3.65*mainWidth*s,'#ffb90a',flash*.45);
      glowStroke(ctx,2.35*mainWidth*s,'#fff8db',flash*.98);
      if (returning > 0) {
        ctx.beginPath();
        trace(ctx,main,1-returning,1);
        glowStroke(ctx,2.35*mainWidth*s,'#fffff2',flash*.62);
      }
    }
    if (!landed && growth < 1) {
      const tip = sample(main,growth);
      const r = 9*s;
      const glow = ctx.createRadialGradient(tip.x,tip.y,0,tip.x,tip.y,r);
      glow.addColorStop(0,'#fff9ce');
      glow.addColorStop(.24,'#ffd13fc9');
      glow.addColorStop(1,'#ed970000');
      ctx.globalAlpha=1;
      ctx.fillStyle=glow;
      ctx.fillRect(tip.x-r,tip.y-r,2*r,2*r);
    }
  }

  function impactLight(ctx, art, age, flash) {
    if (flash < .005) return;
    const {x,y} = art.core;
    const size = Math.min(art.width,art.height);
    const radius = size*(.28+.18*Math.min(1,age*8));
    const bloom = ctx.createRadialGradient(x,y,0,x,y,radius);
    bloom.addColorStop(0,'#ffffff');
    bloom.addColorStop(.085,'#fffff8');
    bloom.addColorStop(.15,'#fff9d5e0');
    bloom.addColorStop(.29,'#ffe15d82');
    bloom.addColorStop(.56,'#ffb62745');
    bloom.addColorStop(1,'#f69c0100');
    ctx.globalAlpha=flash;
    ctx.fillStyle=bloom;
    ctx.fillRect(x-radius,y-radius,2*radius,2*radius);
  }

  function drawSparks(ctx, art, age) {
    const {x,y}=art.core;
    for (const p of art.sparks) {
      if (age >= p.life) continue;
      // The first displayed instant already contains flying trails close to the core.
      const head=age+p.advance, tail=Math.max(0,head-p.trail);
      const fade=clamp((p.life-age)/(.64*p.life));
      // Hot projectiles slow down as they leave the pressure front.
      const travel=t => p.fast ? -Math.expm1(-3.8*t)/3.8 : t;
      const dt=travel(tail), dh=travel(head);
      const x1=x+p.vx*dt, y1=y+p.vy*dt+.5*p.gravity*tail*tail;
      const x2=x+p.vx*dh, y2=y+p.vy*dh+.5*p.gravity*head*head;
      if (p.fast) {
        const dx=x2-x1, dy=y2-y1, length=Math.max(.01,Math.hypot(dx,dy));
        const nx=-dy/length*p.size, ny=dx/length*p.size;
        const bx=mix(x1,x2,.91), by=mix(y1,y2,.91);
        const heat=ctx.createLinearGradient(x1,y1,x2,y2);
        heat.addColorStop(0,'#ff9e0700');
        heat.addColorStop(.32,'#ffbd43b0');
        heat.addColorStop(.77,'#ffe07c');
        heat.addColorStop(1,'#fffcef');
        ctx.fillStyle=heat;
        ctx.globalAlpha=fade;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(bx+nx,by+ny);ctx.lineTo(x2,y2);ctx.lineTo(bx-nx,by-ny);ctx.closePath();ctx.fill();
      } else {
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
        glowStroke(ctx,p.size*2.8,'#ff9214',fade*.23);
        glowStroke(ctx,p.size,'#ffce43',fade);
      }
      ctx.beginPath();ctx.moveTo(mix(x1,x2,.80),mix(y1,y2,.80));ctx.lineTo(x2,y2);
      glowStroke(ctx,p.size*.78,'#ffffde',fade*.95);
    }
  }

  function draw(ctx,width,height,time,cycle,phase) {
    if (width <= 0 || height <= 0) return;
    const art=scene(width,height,cycle);
    drawCorona(ctx,art,time,cycle,phase);
    drawEnergyOrb(ctx,art,time,phase);
    const phases=phase.strokes || strikePhases(cycle,phase.impactAge);
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round'; ctx.lineJoin='round';
    for (let i=0;i<art.strokes.length;i++) {
      const stroke=art.strokes[i], local=phases[i];
      if (!(local.upper>0 || local.lower>0)) continue;
      if (local.afterglow<=0 && local.flash<.005 && local.impactAge>0) continue;
      const lowerShare=stroke.bottom.length/(stroke.top.length+stroke.bottom.length);
      const lowerReturn=clamp(local.returnReach/lowerShare);
      const upperReturn=clamp((local.returnReach-lowerShare)/(1-lowerShare));
      drawTree(ctx,stroke.top,stroke.upper,local.upper,upperReturn,local,art.unit*stroke.thickness);
      drawTree(ctx,stroke.bottom,stroke.lower,local.lower,lowerReturn,local,art.unit*stroke.thickness);
    }
    for (const local of phases) {
      if (local.impactAge>=0) {
        impactLight(ctx,art,local.impactAge,local.flash*(art.type==='medium' ? .58 : 1));
        drawSparks(ctx,art,local.impactAge);
      }
    }
    ctx.restore();
  }
  window.LightningDischarge={draw,contact,strikeType,strikeDelays,strikePhases};
})();

