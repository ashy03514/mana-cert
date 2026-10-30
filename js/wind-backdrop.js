/* Wind pressure lives behind the material. Absolute active time is supplied by
 * the host; this module owns no timer, rank selection or certification result. */
(function(root){
  'use strict';
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const vertex='attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
  const fragment=`
    precision highp float;
    varying vec2 vUv;
    uniform float uTime,uAspect,uStrength;
    uniform vec4 uMotion,uFocus,uReadout;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    float fbm(vec2 p){float n=0.,a=.56;for(int i=0;i<3;i++){
      n+=noise(p)*a;p=mat2(.8,-.6,.6,.8)*p*2.06+9.7;a*=.5;}return n;}
    float shelter(vec2 p,vec4 region){
      return 1.-smoothstep(.42,1.45,length((p-region.xy)/max(region.zw,vec2(.015))));
    }
    void main(){
      // y increases down the screen. Both the broad mist and its fine folds
      // advect upwards; the orbital term bends them around the same column.
      vec2 p=vec2(vUv.x,(1.-vUv.y)*uAspect);
      float yn=p.y/uAspect;
      float body=shelter(p,uFocus),numbers=shelter(p,uReadout);
      float clear=max(body*.90,numbers*.98);
      float edge=pow(abs(vUv.x-.5)*2.,1.25);
      vec3 color=mix(vec3(.043,.080,.109),vec3(.020,.036,.052),smoothstep(.05,.70,yn));
      color+=vec3(.006,.012,.012)*edge;
      color=mix(color,vec3(.018,.030,.041),numbers*.68);
      float crown=exp(-pow((yn-.13)/.34,2.));
      color+=vec3(.025,.040,.043)*crown*(.35+.65*edge);
      float mist=0.,lit=0.;
      // Two opposed, long S-curves leave broad openings between the streams.
      // Keep the existing upward timing; reduce only the turns across the view.
      for(int i=0;i<2;i++){
        float layer=float(i),offset=layer*3.14159265;
        float angle=yn*4.4+uTime*2.55+offset+.08*sin(yn*4.4+uTime*.8+offset);
        float front=.5+.5*sin(angle);
        float radial=.56+.06*yn-.10*uMotion.x+.05*uMotion.z*uMotion.w;
        float center=uFocus.x+cos(angle)*radial;
        vec2 flow=vec2((p.x-center)*13.+offset,p.y*5.5+uTime*2.1);
        float folds=fbm(flow+vec2(sin(p.y*4.+uTime)*.5,0.));
        float grain=noise(flow*2.9+vec2(1.4,-uTime*.3));
        float displaced=p.x-center+(folds-.48)*.12;
        float width=mix(.070,.155,front)*(.80+.40*folds);
        float sheet=exp(-pow(displaced/width,2.));
        // A broad rising gust, followed by a much quieter residual circulation.
        // The two sides reach their crest at different times, avoiding a wipe.
        float head=1.10-1.38*uMotion.y+.07*sin(offset);
        float wake=exp(-pow((yn-head)/.31,2.));
        float gust=.045+.93*uMotion.w*wake;
        float torn=smoothstep(.30,.74,folds+grain*.16);
        float density=sheet*(.05+.95*torn)*gust*mix(.42,1.,front);
        mist+=density;
        lit+=density*smoothstep(.45,.87,folds+grain*.19)*(.32+.68*front);
      }
      vec3 air=vec3(.19,.28,.29)*mist+vec3(.13,.19,.18)*lit;
      color+=air*uStrength*(1.-clear);
      // The background has its own dark headroom; thunder remains inside the
      // existing SS cloud/funnel volume, and is never a full-screen flash.
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }
  `;
  class WindBackdrop {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.ctx=this.patch.getContext('2d');
      this.gl=null;this.program=null;this.buffer=null;this.failed=false;this.lost=false;this.disposed=false;
      this.lastTime=-Infinity;this.lastHostTime=-Infinity;this.lastKey='';this.drawCount=0;
      this.onLost=e=>{e.preventDefault();this.lost=true;};
      this.onRestored=()=>{if(this.disposed)return;this.gl=null;this.program=null;this.buffer=null;
        this.failed=false;this.lost=false;this.diagnostic=undefined;this.lastTime=this.lastHostTime=-Infinity;this.lastKey='';};
      this.canvas.addEventListener?.('webglcontextlost',this.onLost);
      this.canvas.addEventListener?.('webglcontextrestored',this.onRestored);
    }
    static sample(time){
      time=Math.max(0,finite(time));
      const cycle=Math.floor(time/2),age=time-cycle*2;
      const release=smooth((age-1.15)/.60);
      return {cycle,phase:age/2,inward:smooth(age/.30)*(1-release),
        rise:smooth((age-.22)/1.18),release,
        pulse:smooth(age/.20)*(1-smooth((age-1.28)/.47))};
    }
    init(){
      if(this.disposed||this.failed||this.lost)return false;
      if(this.program)return true;
      const shaders=[];let program=null,gl;
      try{
        gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
        if(!gl||typeof gl.createShader!=='function')throw Error('Wind background WebGL unavailable');
        this.gl=gl;program=gl.createProgram();
        for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
          gl.attachShader(program,shader);
        }
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
        this.program=program;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        this.position=gl.getAttribLocation(program,'aPosition');this.uniforms={};
        for(const name of ['uTime','uAspect','uStrength','uMotion','uFocus','uReadout'])this.uniforms[name]=gl.getUniformLocation(program,name);
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);return true;
      }catch(error){if(program)gl?.deleteProgram(program);this.program=null;this.failed=true;this.diagnostic=String(error);return false;}
      finally{if(gl)for(const shader of shaders)gl.deleteShader(shader);}
    }
    regions(w,h,focus,readout){
      const valid=r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
      return {
        focus:valid(focus)?focus:{x:w*.27,y:h*.10,width:w*.46,height:h*.50},
        readout:valid(readout)?readout:{x:w*.26,y:h*.58,width:w*.48,height:h*.27}
      };
    }
    shelter(x,y,rect){
      const distance=Math.hypot((x-rect.x-rect.width/2)/(rect.width/2),(y-rect.y-rect.height/2)/(rect.height/2));
      return 1-smooth((distance-.42)/(1.45-.42));
    }
    motes(ctx,w,h,time,strength,regions){
      const frame=WindBackdrop.sample(time);
      if(frame.pulse<.01)return;
      const cx=regions.focus.x+regions.focus.width/2;
      for(let i=0;i<9;i++){
        const phase=(time*.5+hash(i+11))%1,angle=phase*6.2+hash(i+27)*6.28;
        const x=cx+Math.cos(angle)*w*(.56-.10*frame.inward),y=h*(1.12-phase*1.35);
        const protect=Math.max(this.shelter(x,y,regions.focus)*.9,this.shelter(x,y,regions.readout));
        const alpha=smooth(phase/.14)*(1-smooth((phase-.8)/.2))*frame.pulse*(1-protect)*Math.min(1,strength)*.30;
        if(alpha<.01)continue;
        ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(angle+time*.7);
        ctx.fillStyle='#9dbcb5';const size=1.5+hash(i+39)*1.5;
        ctx.beginPath();ctx.moveTo(-size,0);ctx.quadraticCurveTo(0,-size*.55,size,0);
        ctx.quadraticCurveTo(0,size*.55,-size,0);ctx.fill();ctx.restore();
      }
    }
    fallback(ctx,w,h,time,strength,regions){
      const frame=WindBackdrop.sample(time),g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#0d1b24');g.addColorStop(.65,'#070e15');g.addColorStop(1,'#0b151d');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      const cx=regions.focus.x+regions.focus.width/2;
      for(let layer=0;layer<2;layer++)for(let j=0;j<28;j++){
        const yn=j/27,offset=layer*Math.PI,angle=yn*4.4+time*2.55+offset+.08*Math.sin(yn*4.4+time*.8+offset);
        const x=cx+Math.cos(angle)*w*(.56+.06*yn-.10*frame.inward+.05*frame.release*frame.pulse),y=yn*h;
        const front=.5+.5*Math.sin(angle),radius=w*(.065+.08*front);
        const head=1.10-1.38*frame.rise+.07*Math.sin(offset);
        const gust=.045+.93*frame.pulse*Math.exp(-(((yn-head)/.31)**2));
        const protect=Math.max(this.shelter(x,y,regions.focus)*.9,this.shelter(x,y,regions.readout)*.98);
        const alpha=gust*strength*(1-protect)*(.08+.08*front);
        const mist=ctx.createRadialGradient(x,y,0,x,y,radius);
        mist.addColorStop(0,`rgba(97,139,139,${alpha})`);mist.addColorStop(1,'rgba(97,139,139,0)');
        ctx.fillStyle=mist;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      }
      this.motes(ctx,w,h,time,strength,regions);
    }
    draw(ctx,w,h,{time=0,hostTime,strength=1,opacity=1,focus,readout}={}){
      if(this.disposed||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||!Number.isFinite(opacity)||opacity<=0)return false;
      time=Math.max(0,finite(time));hostTime=Math.max(0,finite(hostTime,time));
      strength=clamp(finite(strength,1),0,1.4);opacity=clamp(opacity);
      const regions=this.regions(w,h,focus,readout);
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha*=opacity;
      try{
        if(!this.init()){this.fallback(ctx,w,h,time,strength,regions);return true;}
        const pw=Math.max(1,Math.floor(Math.min(320,w,640*w/h))),ph=Math.max(1,Math.min(640,Math.round(pw*h/w)));
        const f=regions.focus,r=regions.readout;
        const key=[w,h,strength,f.x,f.y,f.width,f.height,r.x,r.y,r.width,r.height].join(':');
        // Smoothly changing strength must not turn the background into a second
        // unbounded GPU pass. A changed paused frame still redraws immediately.
        if(this.lastKey===''||time<this.lastTime||hostTime<this.lastHostTime||hostTime-this.lastHostTime>=1/30-1e-6||w!==this.width||h!==this.height||hostTime===this.lastHostTime&&(key!==this.lastKey||time!==this.lastTime)){
          if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=this.patch.width=pw;this.canvas.height=this.patch.height=ph;}
          const gl=this.gl,u=this.uniforms,m=WindBackdrop.sample(time);
          gl.viewport(0,0,pw,ph);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
          gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
          gl.uniform1f(u.uTime,time);gl.uniform1f(u.uAspect,h/w);gl.uniform1f(u.uStrength,strength);
          gl.uniform4f(u.uMotion,m.inward,m.rise,m.release,m.pulse);
          gl.uniform4f(u.uFocus,(f.x+f.width/2)/w,(f.y+f.height/2)/w,f.width/2/w,f.height/2/w);
          gl.uniform4f(u.uReadout,(r.x+r.width/2)/w,(r.y+r.height/2)/w,r.width/2/w,r.height/2/w);
          gl.drawArrays(gl.TRIANGLES,0,6);
          this.ctx.clearRect(0,0,pw,ph);this.ctx.drawImage(this.canvas,0,0);
          this.ctx.save();this.ctx.scale(pw/w,ph/h);this.motes(this.ctx,w,h,time,strength,regions);this.ctx.restore();
          this.lastTime=time;this.lastHostTime=hostTime;this.lastKey=key;this.width=w;this.height=h;this.drawCount++;
        }
        ctx.drawImage(this.patch,0,0,w,h);return true;
      }finally{ctx.restore();}
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;
      this.canvas.removeEventListener?.('webglcontextlost',this.onLost);
      this.canvas.removeEventListener?.('webglcontextrestored',this.onRestored);
      if(this.gl&&!this.lost){if(this.program)this.gl.deleteProgram(this.program);if(this.buffer)this.gl.deleteBuffer(this.buffer);}
      this.gl=null;this.program=null;this.buffer=null;this.canvas.width=this.canvas.height=this.patch.width=this.patch.height=1;
    }
  }
  root.WindBackdrop=WindBackdrop;
})(globalThis);
