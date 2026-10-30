'use strict';

// Frozen rendering oracle copied verbatim from the user-approved ribbon preview.
// Source: C:/Users/ashy0/.codex/visualizations/2026/09/15/01a0a2c3-aa7a-7bb0-a1e2-305e5857f363/magic-trail-redesign.html
// Source SHA-256: 4719d917108566c997b2def4b1861f1961ca47b05ad4c293a57a55f059a416a7
// Only the DOM-bound constructor was replaced. Rendering helpers and methods below
// retain the preview formulas, coefficients, sampled routes, colors, and fade timings.
// renderStroke paints onto the preview's transparent stroke layer; callers should
// set round caps/joins, source-over blending, and composite the layer at alpha .86.
// The original reference uses a 390 x 600 CSS-pixel scene at a 2x backing resolution.

const TAU=Math.PI*2,W=390,H=600;
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const rand=(i,s=0)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const tint=(a,b,t)=>a.map((n,i)=>Math.round(n+(b[i]-n)*t));
  const rgba=(c,a)=>'rgba('+c.join(',')+','+clamp(a)+')';

class MagicTrailReference {
  constructor(options={}) {
    this.style='ribbon';
    this.options={color:'#7deaff',flow:80,detail:100,hold:2,...options};
    this.time=1.6;
  }
    makeExample(){
      const points=[];
      for(let i=0;i<=170;i++){
        const t=i/170*TAU;
        points.push({x:195+94*Math.sin(t)*Math.cos(t)*1.8,y:300-163*Math.sin(t),speed:.65});
      }
      return points;
    }
    route(stroke){
      if(stroke.route)return stroke.route;
      const src=stroke.points,points=[];let prev=src[0],length=0;
      const add=p=>{if(points.length)length+=Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y);points.push({...p,d:length});};
      add(src[0]);
      for(let i=1;i<src.length;i++){
        const ctrl=src[i],end=i===src.length-1?ctrl:{x:(ctrl.x+src[i+1].x)/2,y:(ctrl.y+src[i+1].y)/2,speed:ctrl.speed};
        const count=Math.max(1,Math.ceil((Math.hypot(prev.x-ctrl.x,prev.y-ctrl.y)+Math.hypot(end.x-ctrl.x,end.y-ctrl.y))/2.5));
        for(let j=1;j<=count;j++){const t=j/count,u=1-t;add({x:u*u*prev.x+2*u*t*ctrl.x+t*t*end.x,y:u*u*prev.y+2*u*t*ctrl.y+t*t*end.y,speed:prev.speed*u+end.speed*t});}
        prev=end;
      }
      for(let i=0;i<points.length;i++){
        const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
        const len=Math.hypot(after.x-before.x,after.y-before.y)||1;
        points[i].nx=-(after.y-before.y)/len;points[i].ny=(after.x-before.x)/len;
      }
      return stroke.route={points,length};
    }
    at(route,d){
      const arr=route.points;if(arr.length===1)return arr[0];
      let lo=1,hi=arr.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(arr[mid].d<d)lo=mid+1;else hi=mid;}
      const a=arr[lo-1],b=arr[lo],t=clamp((d-a.d)/Math.max(.001,b.d-a.d));
      return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,nx:a.nx+(b.nx-a.nx)*t,ny:a.ny+(b.ny-a.ny)*t};
    }
    line(c,pts,width,color,alpha){
      if(pts.length<2)return;c.lineWidth=width;c.strokeStyle=rgba(color,alpha);c.beginPath();c.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);c.stroke();
    }
    haze(c,x,y,size,color,alpha){
      const g=c.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,rgba(color,alpha));
      g.addColorStop(.35,rgba(color,alpha*.45));g.addColorStop(1,rgba(color,0));
      c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);
    }
    orb(c,x,y,r,color,alpha){c.fillStyle=rgba(color,alpha);c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.fill();}
    star(c,x,y,r,color,alpha){
      c.fillStyle=rgba(color,alpha);c.beginPath();c.moveTo(x,y-r);
      c.quadraticCurveTo(x+.8,y-.8,x+r*.65,y);c.quadraticCurveTo(x+.8,y+.8,x,y+r);
      c.quadraticCurveTo(x-.8,y+.8,x-r*.65,y);c.quadraticCurveTo(x-.8,y-.8,x,y-r);c.fill();
    }
    background(c){
      const g=c.createRadialGradient(W/2,H/2,25,W/2,H/2,410);
      g.addColorStop(0,'#080915');g.addColorStop(.6,'#101126');g.addColorStop(1,'#24223f');c.fillStyle=g;c.fillRect(0,0,W,H);
      for(let i=0;i<30;i++){
        const a=i/30*TAU+this.time*(.025+rand(i,1)*.025);
        this.haze(c,W/2+Math.cos(a)*190,H/2+Math.sin(a)*295,25+rand(i,3)*40,[100,87,162],.04+rand(i,2)*.07);
      }
      for(let i=0;i<55;i++){
        const a=i/55*TAU+this.time*(.02+rand(i,4)*.04),r=.92+rand(i,5)*.25;
        this.orb(c,W/2+Math.cos(a)*170*r,H/2+Math.sin(a)*260*r,.45+rand(i,6)*.5,[215,219,246],.18+rand(i,7)*.35);
      }
    }
    renderStroke(stroke,c){
      const route=this.route(stroke),points=route.points,len=route.length;
      const age=stroke.released===null?0:Math.max(0,this.time-stroke.released-this.options.hold);
      if(age>2.4)return;
      const fade=1-smooth(age/1.5),base=rgb(this.options.color),violet=tint(base,[172,114,243],.75);
      const core=tint(base,[240,247,255],.5),detail=this.options.detail/100;
      const ribbon=this.style==='ribbon';
      if(len<2){this.haze(c,points[0].x,points[0].y,12,base,.25*fade);this.orb(c,points[0].x,points[0].y,1.4,core,fade);return;}
      this.line(c,points,ribbon?20:11,base,.018*fade);
      this.line(c,points,ribbon?11:6,base,.035*fade);
      this.line(c,points,1.1,base,.23*fade);
      for(let i=1;i<points.length;i++){
        const p=points[i],last=points[i-1],s=p.d;
        const wave=(s-this.time*this.options.flow+stroke.seed*47)%190;
        const wrapped=(wave+285)%190-95,pulse=Math.exp(-wrapped*wrapped/(ribbon?1300:420));
        const edge=.25+.75*smooth(Math.min(s,len-s)/16);
        const breakUp=age>0?1-smooth((age-(.15+.35*Math.sin(s*.038+stroke.seed)))/1.3):1;
        const strength=edge*breakUp;
        const col=tint(violet,base,.4+.35*Math.sin(s*.013-this.time*.55));
        this.line(c,[last,p],(ribbon?6:3.2)+pulse*3,col,(.06+pulse*.23)*strength);
        this.line(c,[last,p],(.65+(1-p.speed)*.45+pulse*.45)*(.5+.5*fade),col,(.18+pulse*.48)*strength);
        if(pulse>.45)this.line(c,[last,p],.65,core,(pulse-.45)*.95*strength);
      }
      // Two continuously deforming, intermittent filaments; the drawing's center stays fixed.
      for(let strand=0;strand<2;strand++){
        const shifted=points.map(p=>{
          const tip=smooth(Math.min(p.d,len-p.d)/18);
          const offset=Math.sin(p.d*.046-this.time*(strand?1.7:2.1)+strand*2.4)*(ribbon?5.5:2.8)*detail*tip;
          return {x:p.x+p.nx*offset,y:p.y+p.ny*offset,d:p.d};
        });
        for(let i=1;i<shifted.length;i++){
          const p=shifted[i],patch=Math.pow(.5+.5*Math.sin(p.d*.023-this.time*1.2+strand*2.5),3);
          this.line(c,[shifted[i-1],p],strand?.55:.7,strand?violet:base,patch*.34*fade*detail);
        }
      }
      // Soft local eddies and short luminous packets travel along the same curve.
      const packets=Math.min(5,Math.ceil(len/150));
      for(let j=0;j<packets;j++){
        const d=(this.time*this.options.flow+len*(j+.2)/packets)%len,p=this.at(route,d);
        const edge=smooth(Math.min(d,len-d)/18);
        this.haze(c,p.x,p.y,ribbon?23:11,j%2?violet:base,(ribbon?.12:.15)*fade*edge);
        this.orb(c,p.x,p.y,.8,core,.85*fade*edge);
      }
      // Sparse loose wisps trail around the pulse without pulling the drawn silhouette.
      for(let j=0;j<Math.min(9,Math.ceil(len/100*detail));j++){
        const d=(rand(j,21)*len+this.time*this.options.flow*.35)%len;
        const phase=.5+.5*Math.sin(this.time*1.6+j*2.2),wisp=[];
        for(let k=0;k<=12;k++){
          const along=clamp(d-23+k*3,0,len),p=this.at(route,along);
          const offset=(j%2?1:-1)*(3+Math.sin(k/12*Math.PI)*(4+phase*3))*detail;
          wisp.push({x:p.x+p.nx*offset,y:p.y+p.ny*offset});
        }
        this.line(c,wisp,.6,j%2?base:violet,.2*phase*fade);
        const p=this.at(route,d);
        this.haze(c,p.x+p.nx*4,p.y+p.ny*4,ribbon?21:13,j%2?base:violet,.065*phase*fade);
      }
      const count=Math.min(65,Math.ceil(len/14*detail));
      for(let i=0;i<count;i++){
        const s=rand(i,stroke.seed+11)*len,p=this.at(route,s);
        const life=.9+rand(i,13)*.8,phase=(this.time*.7+rand(i,12)*life)%life/life;
        const sign=i%2?1:-1;
        const drift=sign*(2+phase*(ribbon?13:9));
        const x=p.x+p.nx*drift+Math.sin(phase*3+i)*2,y=p.y+p.ny*drift-phase*4;
        const dissolve=age>0?Math.sin(clamp(age/2.4)*Math.PI):0;
        const intensity=Math.sin(phase*Math.PI)**2*(.36*fade+.48*dissolve);
        const color=i%3===0?violet:base;
        this.orb(c,x,y,.45+rand(i,17)*.85,color,intensity);
        if(i%9===0&&phase>.3&&phase<.8){
          const a=smooth((phase-.3)/.2)*(1-smooth((phase-.6)/.2))*(fade+dissolve*.5);
          this.haze(c,x,y,10,color,.12*a);this.star(c,x,y,2.8+rand(i,18)*1.2,core,.8*a);
        }
      }
      if(stroke.released===null){
        const p=points.at(-1),breath=.9+.1*Math.sin(this.time*4);
        this.haze(c,p.x,p.y,12*breath,base,.28);this.haze(c,p.x,p.y,5,base,.35);
        this.orb(c,p.x,p.y,1.6,core,.9);
      }
    }
}

module.exports={MagicTrailReference,W,H};
