/* Quiet idle life. Reuses the real field particles; no timers, RNG or result access. */
(function(root){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  class StandbyMagic {
    constructor(){this.target={x:0,y:0,alpha:1};this.reset();}
    reset(){this.time=0;this.weight=1;this.event=-1;this.age=0;this.next=2.6;this.serial=0;this.pulse=0;}
    place(field){
      field.particles.forEach((q,i)=>{
        const p=this.home(q,i,field.width,field.height);
        q.x=q.px=p.x;q.y=q.py=p.y;q.vx=q.vy=0;q.idleAlpha=p.alpha;
      });
    }
    step(dt,idle){
      dt=Math.max(0,Math.min(dt,0.05));
      this.weight=clamp(this.weight+(idle?1:-1)*dt*2);
      if(!idle)return;
      this.time+=dt;this.pulse=0;
      if(this.event<0&&this.time>=this.next){this.event=this.serial%5;this.age=0;this.serial++;}
      if(this.event>=0){
        this.age+=dt;
        const duration=this.event===4?0.9:this.event===3?3.2:2.6;
        if(this.event===0)this.pulse=Math.exp(-Math.pow((this.age-2.1)/0.28,2))*0.1;
        if(this.event===3)this.pulse=Math.sin(Math.PI*clamp(this.age/duration))*0.12;
        if(this.age>=duration){this.event=-1;this.next=this.time+3.4+(Math.sin(this.serial*2.17)+1)*1.3;}
      }
    }
    home(q,index,width,height){
      const t=this.time,s=q.seed,r=q.radial*18,group=index%4;
      const a=s+t*(group===2?0.008:0.024+q.depth*0.015);
      const breath=1+0.045*Math.sin(t*0.48+s)-this.pulse*0.45;
      let x=Math.cos(a)*r*breath,y=Math.sin(a)*r*1.13*breath;
      if(index>=3){
        // Distribute across both viewport axes, with local drifting instead of a central orbit.
        x=(((index*0.61803398875)%1)-0.5)*Math.max(0,width-44)+Math.cos(a)*10;
        y=(((index*0.75487766625)%1)-0.5)*Math.max(0,height-64)+Math.sin(a)*14;
      }
      if(group===1){x+=Math.sin(t*0.37+s*3)*16;y+=Math.cos(t*0.29+s)*13;}
      if(group===2){x+=Math.sin(t*0.16+s)*7;y+=Math.sin(t*0.31+s*2)*19;}
      if(group===3){x+=Math.sin(t*0.53+s)*10;y+=Math.cos(t*0.41+s*2)*8;}
      let alpha=1;
      // A single existing medium mote inhales; three existing dust motes exhale.
      if(this.event===0&&index===300){
        const p=clamp(this.age/2.3),d=(1-p)*Math.min(width*0.29,135);
        x=Math.cos(s+p*1.6)*d;y=Math.sin(s+p*1.6)*d;
        alpha=this.age>2?Math.max(0,1-(this.age-2)/0.4):1+p*0.5;
      }
      if(this.event===1&&index<3){
        const p=clamp(this.age/2.6),a=index*2.1+p*1.2;
        x=Math.cos(a)*(12+p*70);y=Math.sin(a)*(12+p*70);alpha=0.7+Math.sin(p*Math.PI)*0.4;
      }
      if(this.event===4&&index%13===0){const pulse=Math.sin(Math.PI*clamp(this.age/0.9));x+=Math.cos(s-this.age*5)*12*pulse;y+=Math.sin(s-this.age*5)*12*pulse;}
      this.target.x=width/2+x;this.target.y=height/2+y;this.target.alpha=alpha;
      return this.target;
    }
  }
  root.StandbyMagic=StandbyMagic;
})(globalThis);
