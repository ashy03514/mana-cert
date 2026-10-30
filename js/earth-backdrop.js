/* Luminous mana pressure behind the earth material. Contact uses the mountain's
 * action clock; quiet 2-second pulses use active host time. No extra timers. */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const vertex='attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
  const fragment=`
    precision highp float;
    varying vec2 vUv;
    uniform float uTime,uAspect,uStrength,uInward,uAge,uEcho,uFormation;
    uniform vec2 uOrigin;
    uniform vec4 uFocus,uReadout;
    uniform vec3 uPulse;
    float shelter(vec2 p,vec4 r){return 1.-smoothstep(.55,1.35,length((p-r.xy)/max(r.zw,vec2(.01))));}
    vec2 pressure(vec2 p,float age,float strength,float seed){
      if(age<=0.||age>=2.35||strength<=0.)return vec2(0.);
      vec2 q=(p-uOrigin)/vec2(1.,.66);
      float radial=length(q),angle=atan(q.y,q.x);
      float travel=1.-exp(-age*2.15),radius=.07+travel*(.78+.98*strength);
      float envelope=smoothstep(0.,.11,age)*(1.-smoothstep(1.25,2.35,age));
      // A smooth luminous volume: no grain, cloud texture or emitted sand.
      // Slight travelling curvature keeps the front fluid without a hard rim.
      float bend=.018*sin(angle*3.-age*1.1+seed)+.010*sin(angle*5.+age*.7);
      float distance=radial-radius-bend;
      float width=.080+.055*strength+travel*.065;
      float crest=exp(-pow(distance/width,2.));
      float halo=exp(-pow(distance/(width*2.65),2.));
      float tail=exp(-pow((distance+width*.95)/(width*1.65),2.));
      float flow=.66+.34*pow(.5+.5*sin(angle*2.-age*1.4+seed),2.);
      float density=(crest*.67+halo*.20+tail*.22)*flow*envelope*strength;
      return vec2(density,crest*flow*envelope*strength);
    }
    void main(){
      vec2 p=vec2(vUv.x,(1.-vUv.y)*uAspect),q=p-uOrigin;
      float radial=length(q/vec2(1.,.66));
      float breath=.50+.50*sin(uTime*.924-1.);
      float ambient=exp(-pow((radial-(.48-.14*uInward))/.22,2.))*(.018+.045*uInward+.012*breath);
      vec2 wave=pressure(p,uAge,uStrength,2.7);
      wave+=pressure(p,uAge-.27,uStrength*.72,9.2)*uEcho*.52;
      // A much quieter, pale wave continues between rock contacts. Its phase
      // is sampled from active seconds, independent of rank and opening speed.
      float pulseDistance=radial-uPulse.x;
      float pulse=(.82*exp(-pow(pulseDistance/uPulse.y,2.))+
        .18*exp(-pow(pulseDistance/(uPulse.y*2.3),2.)))*uPulse.z;
      float protect=max(shelter(p,uFocus)*.72,shelter(p,uReadout)*.985);
      float base=wave.x+ambient*(.35+.65*uStrength);
      float density=(base+pulse)*(1.-protect)*uFormation;
      float alpha=1.-exp(-density*1.10);
      float illumination=wave.y/max(wave.x,.001);
      vec3 color=mix(vec3(.78,.43,.13),vec3(1.,.91,.65),clamp(illumination*.90,0.,1.));
      color=mix(color,vec3(.90,.85,.73),pulse/max(base+pulse,.0001));
      // Premultiplied transparent overlay leaves the accepted dark base intact.
      gl_FragColor=vec4(color*alpha,alpha);
    }
  `;
  class EarthBackdrop {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.ctx=this.patch.getContext('2d');
      this.gl=null;this.program=null;this.buffer=null;this.failed=false;this.lost=false;this.disposed=false;
      this.lastTime=-Infinity;this.lastActionTime=-Infinity;this.lastHostTime=-Infinity;this.lastKey='';this.drawCount=0;
      this.onLost=e=>{e.preventDefault();this.lost=true;};
      this.onRestored=()=>{if(this.disposed)return;this.gl=null;this.program=null;this.buffer=null;this.failed=false;this.lost=false;
        this.lastTime=this.lastActionTime=this.lastHostTime=-Infinity;this.lastKey='';};
      this.canvas.addEventListener?.('webglcontextlost',this.onLost);this.canvas.addEventListener?.('webglcontextrestored',this.onRestored);
    }
    static sample(time,profile={impact:1,starScale:1}){
      time=Math.max(0,finite(time));const cycle=Math.floor(time/6.8),phase=time-cycle*6.8,age=phase-4.18;
      const strength=Math.pow(clamp((finite(profile.impact,1)-.10)/.90),.7);
      const inward=smooth((phase-.3)/2.8)*(1-smooth((phase-3.9)/.28));
      const burst=age<=0?0:smooth(age/.11)*(1-smooth((age-1.25)/1.1));
      return{cycle,phase,age,inward,strength,echo:clamp(finite(profile.starScale,1)),burst,
        radius:.07+(1-Math.exp(-Math.max(0,age)*2.15))*(.78+.98*strength)};
    }
    static periodic(time){
      time=Math.max(0,finite(time));const cycle=Math.floor(time/2),age=time-cycle*2;
      const travel=1-Math.pow(1-clamp(age/1.8),2);
      return{cycle,age,radius:.035+travel*1.9,width:.10+travel*.08,
        opacity:.12*smooth(age/.18)*(1-smooth((age-1.05)/.75))};
    }
    regions(w,h,box,readout){
      const valid=r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
      const b=valid(box)?box:{x:w*.02,y:h*.06,width:w*.96,height:w*.96};
      return{origin:{x:b.x+b.width*.5,y:b.y+b.height*.67},
        focus:{x:b.x+b.width*.13,y:b.y+b.height*.10,width:b.width*.74,height:b.height*.76},
        readout:valid(readout)?readout:{x:w*.27,y:h*.57,width:w*.46,height:h*.28}};
    }
    shelter(x,y,r){return 1-smooth((Math.hypot((x-r.x-r.width/2)/(r.width/2),(y-r.y-r.height/2)/(r.height/2))-.55)/.8);}
    init(){
      if(this.disposed||this.lost||this.failed)return false;if(this.program)return true;
      let gl,program;const shaders=[];
      try{
        gl=this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,depth:false,antialias:false,stencil:false});
        if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();
        for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
        }
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
        this.program=program;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        this.position=gl.getAttribLocation(program,'aPosition');this.uniforms={};
        for(const name of ['uTime','uAspect','uStrength','uInward','uAge','uEcho','uFormation','uOrigin','uFocus','uReadout','uPulse'])this.uniforms[name]=gl.getUniformLocation(program,name);
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);return true;
      }catch(error){if(program)gl?.deleteProgram(program);this.program=null;this.failed=true;this.diagnostic=String(error);return false;}
      finally{if(gl)for(const shader of shaders)gl.deleteShader(shader);}
    }
    fallback(ctx,w,h,time,m,regions,formation,pulse=EarthBackdrop.periodic(time)){
      const {origin,focus,readout}=regions;
      const wave=(radius,width,alpha,pale=false)=>{
        if(alpha<=0)return;const extent=radius+width*2.8;
        ctx.save();ctx.translate(origin.x,origin.y);ctx.scale(1,.66);
        const g=ctx.createRadialGradient(0,0,0,0,0,extent);
        for(const [offset,gain,color] of [[-2.8,0,'199,110,33'],[-1,.32,'220,155,66'],[0,1,'255,232,166'],[1,.26,'220,155,66'],[2.8,0,'199,110,33']])
          g.addColorStop(clamp((radius+offset*width)/extent),`rgba(${pale?'230,217,186':color},${alpha*gain*formation})`);
        ctx.fillStyle=g;ctx.fillRect(-extent,-extent,extent*2,extent*2);ctx.restore();
      };
      wave(w*(.48-.14*m.inward),w*.16,(.018+.045*m.inward)*(.35+.65*m.strength));
      if(m.burst*m.strength>0){
        const travel=1-Math.exp(-Math.max(0,m.age)*2.15);
        wave(m.radius*w,w*(.080+.055*m.strength+travel*.065),m.burst*m.strength*.48);
      }
      if(m.echo>0&&m.strength>0&&m.age>.27){
        const lag=EarthBackdrop.sample(time-.27,{impact:.1+.9*Math.pow(m.strength*.72,1/.7),starScale:0});
        wave(lag.radius*w,w*.15,lag.burst*lag.strength*m.echo*.25);
      }
      wave(pulse.radius*w,pulse.width*w,pulse.opacity,true);
      // The retained patch is private, so subtracting these soft masks cannot
      // erase the mountain or any text painted by the host.
      ctx.save();ctx.globalCompositeOperation='destination-out';
      for(const [rect,strength] of [[focus,.72],[readout,.985]]){
        ctx.save();ctx.translate(rect.x+rect.width/2,rect.y+rect.height/2);ctx.scale(rect.width/2,rect.height/2);
        const g=ctx.createRadialGradient(0,0,0,0,0,1.35);g.addColorStop(0,`rgba(0,0,0,${strength})`);
        g.addColorStop(.55/1.35,`rgba(0,0,0,${strength})`);g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g;ctx.fillRect(-1.35,-1.35,2.7,2.7);ctx.restore();
      }ctx.restore();
    }
    draw(ctx,w,h,{time=0,actionTime=time,hostTime=time,profile,box,readout,formation=1}={}){
      if(this.disposed||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return false;
      time=Math.max(0,finite(time));actionTime=Math.max(0,finite(actionTime,time));hostTime=Math.max(0,finite(hostTime,time));formation=smooth(clamp(finite(formation,1)));
      const m=EarthBackdrop.sample(actionTime,profile),pulse=EarthBackdrop.periodic(hostTime),regions=this.regions(w,h,box,readout),f=regions.focus,r=regions.readout;
      const key=[w,h,actionTime,formation,m.strength,m.echo,...Object.values(f),...Object.values(r)].join(':');
      const refresh=!this.lastKey||time<this.lastTime||actionTime<this.lastActionTime||hostTime<this.lastHostTime||w!==this.width||h!==this.height||
        hostTime-this.lastHostTime>=1/30-1e-6||(hostTime===this.lastHostTime&&(key!==this.lastKey||time!==this.lastTime));
      const gpu=this.init();
      if(refresh){
        const pw=Math.max(1,Math.round(Math.min(320,w,640*w/h))),ph=Math.max(1,Math.round(pw*h/w));
        if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=this.patch.width=pw;this.canvas.height=this.patch.height=ph;}
        this.ctx.clearRect(0,0,pw,ph);
        if(gpu){
          const gl=this.gl,u=this.uniforms;gl.viewport(0,0,pw,ph);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
          gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
          gl.uniform1f(u.uTime,time);gl.uniform1f(u.uAspect,h/w);gl.uniform1f(u.uStrength,m.strength);
          gl.uniform1f(u.uInward,m.inward);gl.uniform1f(u.uAge,m.age);gl.uniform1f(u.uEcho,m.echo);gl.uniform1f(u.uFormation,formation);
          gl.uniform2f(u.uOrigin,regions.origin.x/w,regions.origin.y/w);
          gl.uniform3f(u.uPulse,pulse.radius,pulse.width,pulse.opacity);
          for(const [name,rect] of [['uFocus',f],['uReadout',r]])gl.uniform4f(u[name],(rect.x+rect.width/2)/w,(rect.y+rect.height/2)/w,rect.width/2/w,rect.height/2/w);
          gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
          this.ctx.drawImage(this.canvas,0,0);
        }
        this.ctx.save();this.ctx.scale(pw/w,ph/h);
        if(!gpu)this.fallback(this.ctx,w,h,actionTime,m,regions,formation,pulse);
        this.ctx.restore();
        this.lastTime=time;this.lastActionTime=actionTime;this.lastHostTime=hostTime;this.lastKey=key;this.width=w;this.height=h;this.drawCount++;
        this.frame=m;this.periodicFrame=pulse;this.currentRegions=regions;
      }
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.drawImage(this.patch,0,0,w,h);ctx.restore();return true;
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;
      this.canvas.removeEventListener?.('webglcontextlost',this.onLost);this.canvas.removeEventListener?.('webglcontextrestored',this.onRestored);
      if(this.gl&&!this.lost){if(this.program)this.gl.deleteProgram(this.program);if(this.buffer)this.gl.deleteBuffer(this.buffer);}
      this.gl=null;this.program=null;this.buffer=null;this.canvas.width=this.canvas.height=this.patch.width=this.patch.height=1;
    }
  }
  root.EarthBackdrop=EarthBackdrop;
})(globalThis);
