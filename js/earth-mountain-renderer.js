/* Earth art study and reveal preview. Geometry, shadows and rock colour share an absolute
 * active clock. The renderer does not select ranks or certification results. */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const norm=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const multiply=(a,b)=>{const out=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;};
  const translate=(x,y,z)=>{const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;};
  const turnY=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];};
  const turnZ=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];};
  const ortho=(l,r,b,t,n,f)=>[2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1];
  const lookAt=(eye,target)=>{const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
    return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];};
  const transform=(m,p)=>[0,1,2].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);
  const view=multiply(ortho(-1.38,1.38,-1.38,1.38,.1,14),lookAt([2.15,1.4,6],[0,.27,0]));
  const lightView=multiply(ortho(-2.3,2.3,-2.3,2.3,.1,13),lookAt([-3.5,5,4.5],[0,0,0]));

  const vertex=`
    attribute vec3 aPosition,aNormal;
    uniform mat4 uModel,uView,uLight;
    varying vec3 vLocal,vWorld,vNormal;
    varying vec4 vShadow;
    void main(){vec4 world=uModel*vec4(aPosition,1.);vLocal=aPosition;vWorld=world.xyz;
      vNormal=mat3(uModel)*aNormal;vShadow=uLight*world;gl_Position=uView*world;}
  `;
  const shadowVertex='attribute vec3 aPosition;uniform mat4 uModel,uLight;void main(){gl_Position=uLight*uModel*vec4(aPosition,1.);}';
  const shadowFragment=`precision highp float;void main(){
    vec3 enc=fract(gl_FragCoord.z*vec3(1.,255.,65025.));enc-=enc.yzz*vec3(1./255.,1./255.,0.);
    gl_FragColor=vec4(enc,1.);}`;
  const fragment=`
    precision highp float;
    uniform sampler2D uShadow;
    uniform float uSeed,uCharge,uOpening,uMineral;
    varying vec3 vLocal,vWorld,vNormal;
    varying vec4 vShadow;
    float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){return noise(p)*.57+noise(p*2.03+8.7)*.28+noise(p*4.11+17.1)*.15;}
    float shadow(vec3 n){vec3 q=vShadow.xyz/vShadow.w*.5+.5;
      if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)return 1.;
      float sum=0.;float bias=.0015+.0018*(1.-max(dot(n,normalize(vec3(-3.5,5.,4.5))),0.));
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        vec3 rgb=texture2D(uShadow,q.xy+vec2(float(x),float(y))/512.).rgb;
        float depth=dot(rgb,vec3(1.,1./255.,1./65025.));sum+=q.z-bias<=depth?1.:.18;
      }return sum/9.;}
    void main(){
      vec3 p=vLocal+vec3(uSeed*.31,0.,uSeed*.13);
      float broad=fbm(p*4.8),grain=noise(p*165.);
      float seam=fbm(vec3(p.x*7.,p.y*31.+broad*3.,p.z*7.));
      float layers=smoothstep(.43,.76,seam);
      vec3 n=normalize(vNormal);
      // Mineral relief is attached to each rigid stone. It never flows or
      // stretches with time as the strata pull apart.
      vec3 micro=vec3(noise(p*59.+vec3(.7,0,0)),noise(p*59.+vec3(0,.7,0)),noise(p*59.+vec3(0,0,.7)))-noise(p*59.);
      n=normalize(n+micro*.42);
      vec3 light=normalize(vec3(-3.5,5.,4.5)),eye=normalize(vec3(2.15,1.4,6.)-vWorld);
      float diffuse=max(dot(n,light),0.),shade=shadow(n);
      vec3 rock=mix(vec3(.105,.10,.091),vec3(.46,.421,.35),smoothstep(.14,.87,broad));
      rock*=.78+grain*.35;rock*=1.-layers*.21;
      float pits=smoothstep(.77,.92,noise(p*49.));rock*=1.-pits*.32;
      vec3 ambient=vec3(.22,.245,.28)*(.75+.25*n.y);
      vec3 color=rock*(ambient+vec3(1.14,1.02,.85)*diffuse*shade);
      float edge=pow(1.-max(dot(n,eye),0.),3.);
      color+=rock*vec3(.23,.28,.34)*edge*.6;
      // Thin quartz/mineral seams emit inside the broken faces. The warmth is
      // confined to stone veins rather than becoming a pool of molten rock.
      float vein=1.-smoothstep(.015,.052,abs(fbm(p*9.1+6.)-.51));
      float pockets=smoothstep(.46,.70,noise(p*18.3));
      float fracture=pow(abs(n.y),2.5);
      float glow=vein*pockets*(.10+.90*fracture)*(uCharge*.27+uOpening*.58)*uMineral;
      color+=vec3(.64,.38,.11)*glow;
      float crystal=pow(max(dot(reflect(-light,n),eye),0.),35.)*step(.81,grain)*shade;
      color+=vec3(.38,.32,.20)*crystal*.25;
      color=pow(max(color,vec3(0.)),vec3(.84));
      gl_FragColor=vec4(color,1.);
    }
  `;

  // Each body is an angular, eroded closed mesh with uneven fracture faces.
  // Broad coherent ridges are sampled at every ring, so layers have geological
  // silhouette rather than a stack of regular discs.
  function rockGeometry({width,height,depth,kind='layer',seed=1}){
    const sides=34,rows=12,vertices=[],rings=[];
    const radial=(a,v)=>{
      const ridge=.13*Math.sin(a*3+seed)+.08*Math.cos(a*5-seed*.7)+.035*Math.sin(a*9+seed*2);
      const chip=.018*Math.sin(v*25+a*13+seed)+.025*Math.sin(v*12-a*7);
      let profile;
      if(kind==='root')profile=.12+.88*Math.pow(v,.64);
      else if(kind==='peak')profile=.05+.95*Math.pow(1-v,.86);
      else if(kind==='boulder')profile=.12+.88*Math.pow(Math.sin(Math.PI*v),.62);
      else profile=.89+.11*Math.sin(Math.PI*v);
      return profile*(1+ridge+chip);
    };
    for(let j=0;j<=rows;j++){
      const v=j/rows,ring=[];
      for(let i=0;i<sides;i++){
        const a=i/sides*Math.PI*2,r=radial(a,v);
        const breakY=(.09*Math.sin(a*2+seed)+.048*Math.sin(a*5-seed))*(kind==='peak'?1-v:kind==='boulder'?height*1.3:1);
        ring.push([Math.cos(a)*width*r,(v-.5)*height+breakY+Math.sin(a*11+j*2.1)*.009,
          Math.sin(a)*depth*r]);
      }rings.push(ring);
    }
    const triangle=(a,b,c)=>{
      const normal=norm(cross(sub(b,a),sub(c,a)));
      for(const p of [a,b,c])vertices.push(...p,...normal);
    };
    for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){
      const k=(i+1)%sides,a=rings[j][i],b=rings[j][k],c=rings[j+1][i],d=rings[j+1][k];
      triangle(a,c,b);triangle(b,c,d);
    }
    // Rough radial faces continue all the way into the interior of a crack.
    for(const upper of [false,true]){
      const ring=rings[upper?rows:0],center=[.018*Math.sin(seed),(upper?.5:-.5)*height,0];
      for(let i=0;i<sides;i++){
        const a=ring[i],b=ring[(i+1)%sides];
        const innerA=a.map((v,k)=>k===1?center[1]+(v-center[1])*.32:v*.42);
        const innerB=b.map((v,k)=>k===1?center[1]+(v-center[1])*.32:v*.42);
        if(upper){triangle(a,innerA,b);triangle(b,innerA,innerB);triangle(innerA,center,innerB);}
        else{triangle(a,b,innerA);triangle(b,innerB,innerA);triangle(innerA,innerB,center);}
      }
    }
    return new Float32Array(vertices);
  }
  const stones=[
    {width:.99,height:.66,depth:.74,kind:'root',seed:2,position:[-.03,-.49,.02],lift:0,side:-.02},
    {width:1.02,height:.34,depth:.78,seed:3,position:[0,-.14,0],lift:.18,side:.09},
    {width:.89,height:.34,depth:.67,seed:4,position:[-.045,.17,-.02],lift:.35,side:-.10},
    {width:.56,height:.73,depth:.49,kind:'peak',seed:7,position:[-.16,.61,-.12],lift:.49,side:-.11},
    {width:.39,height:.51,depth:.36,kind:'peak',seed:9,position:[.48,.48,.02],lift:.38,side:.13},
    {width:.31,height:.40,depth:.35,kind:'peak',seed:13,position:[-.62,.35,.04],lift:.32,side:-.17},
    {width:.23,height:.41,depth:.20,seed:17,position:[.59,-.31,.47],lift:.16,side:.11},
    {width:.25,height:.35,depth:.22,seed:23,position:[-.45,-.03,.59],lift:.29,side:-.12},
    {width:.18,height:.26,depth:.20,seed:27,position:[.10,.22,.52],lift:.37,side:.02}
  ];
  const CLOSE_START=3.8,CLOSE_DURATION=.38,CONTACT=CLOSE_START+CLOSE_DURATION;
  const delay=spec=>(spec.seed%4)*.065;
  const collisionStones=[1,2,3,4,5];
  const hitEnvelope=age=>age<0?0:smooth(age/.022)*(1-smooth((age-.13)/.64));
  const defaultProfile=Object.freeze({rank:'SS',speed:1,opening:1,impact:1,mineral:1,dustCount:145,chipsCount:15,starScale:1,extent:1.12});
  const profileFor=rank=>root.EarthRankEffects?.forRank(rank)||defaultProfile;
  const rankNames=['E','D','C','B','A','S','SS'];
  // Stable structural slots: root, two strata, three peaks and three plates.
  // Low ranks inhabit just a few slots; new stone grows from within the core.
  const slots=[[0,7,6],[0,1,3,7],[0,1,3,7],[0,1,2,3,4],[0,1,2,3,4,6,7],[0,1,2,3,4,5,6,7],[0,1,2,3,4,5,6,7,8]];

  class EarthMountainRenderer {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.patchCtx=this.patch.getContext('2d');
      this.gl=null;this.error='';this.lost=false;this.disposed=false;this.lastTime=-Infinity;this.lastKey='';this.drawCount=0;
      this.profile=profileFor('SS');this.formation=1;
      this.meshMode='preset';this.hostTime=-Infinity;this.morphBanks=null;this.structureKey='';
      this.earthBackdrop=root.EarthBackdrop?new root.EarthBackdrop(createCanvas):null;
      this.onLost=e=>{e.preventDefault();this.lost=true;};
      this.onRestored=()=>{if(this.disposed)return;this.gl=null;this.program=null;this.shadowProgram=null;this.meshes=[];
        this.lost=false;this.error='';this.lastTime=-Infinity;this.lastKey='';this.init();};
      this.canvas.addEventListener?.('webglcontextlost',this.onLost);
      this.canvas.addEventListener?.('webglcontextrestored',this.onRestored);
      this.init();
    }
    static sample(time){
      time=Math.max(0,finite(time));const cycle=Math.floor(time/6.8),age=time-cycle*6.8;
      // The original 1.9 s lift is unchanged. Closing accelerates into contact
      // rather than easing to rest before the pieces meet.
      const closing=Math.pow(clamp((age-CLOSE_START)/CLOSE_DURATION),2.7);
      const opening=smooth((age-1.6)/1.9)*(1-closing);
      const impact=Math.max(...collisionStones.map(i=>hitEnvelope(age-CONTACT-delay(stones[i]))));
      return {cycle,phase:age/6.8,charge:smooth((age-.3)/1.2)*(1-smooth((age-4.3)/.7)),opening,
        impact};
    }
    static geometry(spec){return rockGeometry(spec);}
    static stonesForRank(rank){return profileFor(rank).stones||stones;}
    selectRank(rank){
      const next=profileFor(rank);if(this.meshMode==='preset'&&this.profile===next&&this.meshes?.length)return;
      this.meshMode='preset';this.structureKey='';this.morphing=false;
      this.profile=next;this.lastTime=-Infinity;this.lastKey='';
      if(this.gl&&this.program&&!this.lost)this.buildMeshes();
    }
    buildMeshes(){
      const gl=this.gl;(this.meshes||[]).forEach(mesh=>gl.deleteBuffer(mesh.buffer));
      if(this.meshMode==='growing'){
        this.meshes=Array.from({length:9},()=>({spec:null,buffer:gl.createBuffer(),count:0}));
        this.structureKey='';return;
      }
      this.meshes=EarthMountainRenderer.stonesForRank(this.profile.rank).map(spec=>{
        const data=rockGeometry(spec),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return{spec,buffer,count:data.length/6};
      });
    }
    growingMeshes(effects){
      const weights=effects.weights||rankNames.map((_,i)=>i===(effects.level??0)?1:0);
      if(!this.morphBanks){
        this.morphBanks=rankNames.map((rank,index)=>{
          const catalog=EarthMountainRenderer.stonesForRank(rank),bank=Array(9).fill(null);
          catalog.forEach((spec,i)=>{bank[slots[index][i]]={spec,data:rockGeometry(spec)};});return bank;
        });
      }
      if(this.meshMode!=='growing'){this.meshMode='growing';this.buildMeshes();}
      const key=weights.join(':');if(key===this.structureKey)return;
      const active=weights.map((w,i)=>({w,i})).filter(p=>p.w>0);
      this.morphing=active.length>1;
      for(let slot=0;slot<9;slot++){
        const mesh=this.meshes[slot],present=active.filter(({i})=>this.morphBanks[i][slot]);
        const presence=present.reduce((s,p)=>s+p.w,0);
        if(presence<1e-8){mesh.count=0;mesh.spec=null;continue;}
        const reference=this.morphBanks[present[present.length-1].i][slot],length=reference.data.length;
        if(!mesh.data)mesh.data=new Float32Array(length);mesh.data.fill(0);
        // Identical triangle topology allows actual strata to grow and join.
        // Camera, particles and glyph sizes are never scaled by the rank.
        for(const {i,w} of present){const data=this.morphBanks[i][slot].data;
          for(let n=0;n<length;n++)mesh.data[n]+=data[n]*w;
        }
        const spec={...reference.spec,position:[0,0,0],presence};
        for(const field of ['width','height','depth','lift','side','seed'])spec[field]=0;
        for(const {i,w} of active){
          const source=this.morphBanks[i][slot]?.spec;
          for(let n=0;n<3;n++)spec.position[n]+=w*(source?source.position[n]:n===1?-.22:0);
          for(const field of ['width','height','depth','lift','side'])spec[field]+=w*(source?.[field]||0);
          spec.seed+=w*(source?.seed??reference.spec.seed);
        }
        mesh.spec=spec;mesh.count=length/6;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER,mesh.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER,mesh.data,this.gl.DYNAMIC_DRAW);
      }
      this.structureKey=key;
    }
    makeProgram(vs,fs){
      const gl=this.gl,program=gl.createProgram(),shaders=[];
      try{
        for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
        }
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));return program;
      }catch(error){gl.deleteProgram(program);throw error;}
      finally{shaders.forEach(s=>gl.deleteShader(s));}
    }
    init(){
      if(this.disposed||this.lost||this.error)return false;if(this.program)return true;
      try{
        const gl=this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,depth:true,antialias:true,stencil:false,preserveDrawingBuffer:false});
        if(!gl)throw Error('WebGL unavailable');
        this.program=this.makeProgram(vertex,fragment);this.shadowProgram=this.makeProgram(shadowVertex,shadowFragment);
        this.uniforms={};for(const n of ['uModel','uView','uLight','uShadow','uSeed','uCharge','uOpening','uMineral'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
        this.attributes={position:gl.getAttribLocation(this.program,'aPosition'),normal:gl.getAttribLocation(this.program,'aNormal')};
        this.shadowUniforms={model:gl.getUniformLocation(this.shadowProgram,'uModel'),light:gl.getUniformLocation(this.shadowProgram,'uLight')};
        this.shadowPosition=gl.getAttribLocation(this.shadowProgram,'aPosition');
        this.buildMeshes();
        this.shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,512,512,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        this.shadowDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,this.shadowDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,512,512);
        this.shadowFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.shadowTexture,0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.shadowDepth);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow framebuffer incomplete');
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
        return true;
      }catch(error){this.error='目前無法顯示地脈之心，請重新整理後再試。';this.diagnostic=String(error);return false;}
    }
    layout(w,h){
      const wide=w>h*1.15&&h<600,size=wide?Math.min(w*.53,h*.94,640):Math.min(w*.96,h*.65,640);
      const x=wide?Math.max(6,(w*.55-size)/2):(w-size)/2,y=wide?(h-size)/2:Math.max(36,h*.06);
      return{x,y,width:size,height:size,gatherY:y+size*.59};
    }
    scanLayout(w,h,_profile,shift=1){
      const base=this.layout(w,h),sideBySide=w>h*1.15&&h<600;
      const box={...base},amount=clamp(finite(shift));
      // Reserve space for the full accepted SS silhouette from the outset;
      // advancing ranks changes stone geometry, never the camera distance.
      if(!sideBySide)box.y=base.y-Math.min(22,Math.max(0,base.y-18))*amount;
      const compact=h<700,fontSize=compact?36:52,rankFontSize=compact?22:26,labelFontSize=compact?14:18;
      const x=sideBySide?w*.75:w*.5;
      const y=sideBySide?h*.54:Math.min(h-156,Math.max(box.y+box.height+65,h*.69));
      return{box,sideBySide,readout:{x:x-135,y:y-fontSize-labelFontSize-36,width:270,height:fontSize+rankFontSize+labelFontSize+80},numbers:{x,y,fontSize,rankFontSize,labelFontSize,
        labelY:y-fontSize-labelFontSize*.35,rankY:y+rankFontSize+14}};
    }
    stoneFloat(spec,time,actionTime=time){
      const local=actionTime-delay(spec),phase=((local%6.8)+6.8)%6.8;
      // Meet firmly at each stone's own contact. After the short recoil, let
      // the joints breathe again; the end/start of a cycle both retain motion.
      const contactGate=phase<=CONTACT?1-smooth((phase-3.45)/.55)
        :smooth((phase-CONTACT-.12)/.60);
      const opening=EarthMountainRenderer.sample(Math.max(0,local)).opening;
      const amount=contactGate*(1-opening*.65);
      // Sample a smooth spatial field at the stone's assembly position. A
      // changing morph seed must never hash into a new random velocity/phase.
      const [px,py,pz]=spec.position,p=px*3.1+py*4.7+pz*5.3;
      const lightness=1-clamp(finite(spec.width,.6)*finite(spec.height,.4)*finite(spec.depth,.4)/.6);
      const amplitude=.014+lightness*.010;
      const a=Math.sin(time*.91+p)*.68+Math.sin(time*1.43-p*.73)*.32;
      const b=Math.sin(time*1.13+p*1.7+.9)*.72+Math.sin(time*.63-p*.81)*.28;
      const c=Math.sin(time*.77-p*1.3+2.1)*.7+Math.sin(time*1.27+p*.56)*.3;
      const direction=[px,(py+.22)*.75,pz],length=Math.sqrt(dot(direction,direction)+.08*.08);
      const breath=.024*(.85+.15*Math.sin(time*.69+p));
      return {amount,x:amount*(amplitude*a*.8+direction[0]/length*breath),
        y:amount*(amplitude*b+direction[1]/length*breath+finite(spec.lift)*.045),
        z:amount*(amplitude*c*.65+direction[2]/length*breath),
        tilt:amount*b*.009,twist:amount*c*.007};
    }
    model(spec,time,actionTime=time){
      const profile=this.profile||defaultProfile,sample=EarthMountainRenderer.sample(Math.max(0,actionTime-delay(spec)));
      const opening=sample.opening*profile.opening,formation=this.formation??1;
      const age=actionTime%6.8-CONTACT-delay(spec);
      const kick=age<0?0:Math.sin(age*48)*Math.exp(-age*13)*profile.impact;
      const recoil=kick*(.018+spec.lift*.025);
      const assembled=smooth((formation-hash(spec.seed)*.18)/.82),loose=1-assembled;
      const drift=this.stoneFloat(spec,time,actionTime);
      // Lower ranks have little or no strata lift. Pull their individual rigid
      // stones away from the assembly centre so E/D also visibly gather force.
      // This moves centres only; stone size and camera distance stay unchanged.
      // SS retains its accepted full lift, and all offsets close at contact.
      const direction=[spec.position[0],(spec.position[1]+.22)*.75,spec.position[2]];
      const separation=sample.opening*.14*(1-profile.opening)/Math.sqrt(dot(direction,direction)+.08*.08);
      const y=spec.position[1]+spec.lift*opening+direction[1]*separation+.022*Math.sin(time*.7)-recoil-loose*(.30+hash(spec.seed+6)*.35)+drift.y*assembled;
      const x=spec.position[0]+spec.side*opening+direction[0]*separation+kick*.010*Math.sin(spec.seed)+loose*Math.sin(spec.seed)*.28+drift.x*assembled;
      const body=multiply(turnY(.13*Math.sin(time*.18)),translate(x,y,spec.position[2]+direction[2]*separation+opening*.04*Math.sin(spec.seed)+loose*Math.cos(spec.seed)*.24+drift.z*assembled));
      const tilt=turnZ(opening*.04*Math.sin(spec.seed)+Math.sin(time*.6+spec.seed)*.004+kick*.012*Math.sin(spec.seed)+loose*Math.sin(spec.seed)*.35+drift.tilt*assembled);
      return multiply(body,multiply(tilt,turnY(drift.twist*assembled)));
    }
    project(point,model,box){const q=transform(multiply(view,model),point);return{x:box.x+(q[0]*.5+.5)*box.width,y:box.y+(1-(q[1]*.5+.5))*box.height,z:q[2]};}
    backdrop(ctx,w,h,box,time){
      const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#181715');bg.addColorStop(.55,'#0c0d0e');bg.addColorStop(1,'#191612');
      ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      const x=box.x+box.width*.46,y=box.y+box.height*.38;
      const glow=ctx.createRadialGradient(x,y,box.width*.20,x,y,box.width*.82);
      glow.addColorStop(0,'rgba(92,82,64,.15)');glow.addColorStop(.7,'rgba(55,50,41,.10)');glow.addColorStop(1,'rgba(22,20,18,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    }
    dust(ctx,box,time,front){
      const phase=EarthMountainRenderer.sample(this.actionTime??time),baseAlpha=ctx.globalAlpha;
      const profile=this.profile||defaultProfile;
      for(let i=0;i<profile.dustCount;i++){
        const seed=hash(i+8);if((seed>.52)!==front)continue;
        const age=(time*(.14+hash(i+7)*.15)+seed)%1;
        const extent=profile.extent/1.12,birthY=(.28+hash(i+14)*.65)*extent;
        const pull=phase.charge*(1-phase.opening)*.16;
        const p=[(hash(i+22)-.5)*(1.9-pull)*extent,birthY-age*age*1.8*extent-(1-extent)*.25,front?.8*extent:-.9*extent];
        const q=this.project(p,identity(),box);
        const alpha=smooth(age/.12)*(1-smooth((age-.7)/.3))*(.13+phase.impact*.5*profile.impact);
        ctx.globalAlpha=baseAlpha*alpha*clamp(profile.dustCount-i);
        const r=.35+Math.pow(hash(i+33),3)*1.4;
        ctx.fillStyle=i%5?'#b2a081':'#e2cda4';ctx.fillRect(q.x,q.y,r,r*(1.1+hash(i+46)));
      }
      ctx.globalAlpha=baseAlpha;
    }
    collisionParticles(time,actionTime=time){
      time=Math.max(0,finite(time));actionTime=Math.max(0,finite(actionTime));const cycle=Math.floor(actionTime/6.8),particles=[];
      const profile=this.profile||defaultProfile,catalog=EarthMountainRenderer.stonesForRank(profile.rank);
      if(profile.impact<=0||(this.formation??1)<1||this.morphing)return particles;
      const indices=profile.rank==='SS'?collisionStones:catalog.map((s,i)=>i).filter(i=>catalog[i].lift>0);
      for(const index of indices){
        const spec=catalog[index],contact=cycle*6.8+CONTACT+delay(spec),elapsed=actionTime-contact;
        if(elapsed<0||elapsed>1.28)continue;
        // Contact is sampled in the action clock, but its source must retain
        // the ambient orientation at that exact instant rather than jump back.
        const contactAmbient=Number.isFinite(this.actionOrigin)
          ?this.actionOrigin+root.EarthRankEffects.actionElapsedForTime(contact,this.actionSpeed)*this.actionSpeed:contact;
        const model=this.model(spec,contactAmbient,contact);
        for(let i=0;i<64;i++){
          const seed=spec.seed*173+i*3.7+cycle*29;
          const type=i<25?'dust':i<51?'chip':'spark';
          if(hash(seed+81)>profile.impact||(type==='spark'&&profile.mineral<.5))continue;
          const age=elapsed-hash(seed+1)*.035;if(age<0)continue;
          const life=type==='dust'?.82+hash(seed+3)*.40:type==='chip'?.52+hash(seed+3)*.35:.19+hash(seed+3)*.22;
          if(age>=life)continue;
          const angle=i*2.39996+hash(seed+2)*.46;
          // Use the actual lower fracture rim, including the geometry's broad
          // ridge and uneven face height. Birth positions are frozen at contact.
          const ridge=.13*Math.sin(angle*3+spec.seed)+.08*Math.cos(angle*5-spec.seed*.7)+.035*Math.sin(angle*9+spec.seed*2);
          const chip=.018*Math.sin(angle*13+spec.seed)+.025*Math.sin(-angle*7);
          const radius=(spec.kind==='peak'?1:spec.kind==='boulder'?.12:.89)*(1+ridge+chip);
          const breakScale=spec.kind==='boulder'?spec.height*1.3:1;
          const source=transform(model,[Math.cos(angle)*spec.width*radius,
            -spec.height/2+(.09*Math.sin(angle*2+spec.seed)+.048*Math.sin(angle*5-spec.seed))*breakScale+.009*Math.sin(angle*11),
            Math.sin(angle)*spec.depth*radius]);
          const direction=norm(transform(turnY(.13*Math.sin(contactAmbient*.18)),[Math.cos(angle),0,Math.sin(angle)]));
          const speed=(type==='dust'?.7+hash(seed+7)*.7:type==='chip'?1.1+hash(seed+7)*1.8:1.9+hash(seed+7)*2.1)*(.35+.65*profile.impact);
          const lift=(hash(seed+9)-.32)*(type==='spark'?1.5:.9),gravity=type==='dust'?.30:type==='chip'?2.8:1.5;
          const positionAt=t=>{
            const travel=(1-Math.exp(-t*(type==='dust'?4:1.8)))/(type==='dust'?4:1.8)*speed;
            return [source[0]+direction[0]*travel,source[1]+lift*t-gravity*t*t*.5,source[2]+direction[2]*travel];
          };
          const position=positionAt(age),tail=positionAt(Math.max(0,age-.027));
          const alpha=smooth(age/(type==='dust'?.055:.012))*(1-smooth((age/life-.35)/.65));
          particles.push({type,age,life,alpha,position,tail,source,contact,
            front:direction[0]*.33+direction[2]*.94>0,
            size:type==='dust'?.055+hash(seed+12)*.07:type==='chip'?1+Math.pow(hash(seed+12),2)*2.3:.6+hash(seed+12)*.65,
            rotation:seed+age*(hash(seed+13)-.5)*19});
        }
      }
      return particles;
    }
    drawCollision(ctx,box,particles,front){
      const unit=box.width/2.76;
      // Broad overlapping dust is painted first; solid chips and short-lived
      // friction sparks remain distinct over it. Rear jets pass behind rock.
      for(const type of ['dust','chip','spark'])for(const particle of particles){
        if(particle.front!==front||particle.type!==type||particle.alpha<.005)continue;
        const p=this.project(particle.position,identity(),box),a=particle.alpha;
        ctx.save();ctx.globalAlpha*=a;
        if(type==='dust'){
          const size=unit*particle.size*(.35+particle.age*3.2);
          ctx.translate(p.x,p.y);ctx.rotate(particle.rotation*.12);ctx.scale(1.45,.70);
          const g=ctx.createRadialGradient(0,0,0,0,0,size);
          g.addColorStop(0,'rgba(173,148,110,.24)');g.addColorStop(.4,'rgba(133,112,80,.15)');g.addColorStop(1,'rgba(101,87,67,0)');
          ctx.fillStyle=g;ctx.fillRect(-size,-size,size*2,size*2);
        }else if(type==='chip'){
          const s=particle.size;ctx.translate(p.x,p.y);ctx.rotate(particle.rotation);
          ctx.fillStyle='#aa9471';ctx.beginPath();ctx.moveTo(-s,-s*.3);ctx.lineTo(s*.3,-s*.65);ctx.lineTo(s,s*.2);ctx.lineTo(-s*.15,s*.7);ctx.closePath();ctx.fill();
          ctx.fillStyle='#5f5140';ctx.beginPath();ctx.moveTo(-s,-s*.3);ctx.lineTo(s*.15,s*.1);ctx.lineTo(-s*.15,s*.7);ctx.closePath();ctx.fill();
        }else{
          const tail=this.project(particle.tail,identity(),box);
          ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.strokeStyle='#ba5c19';ctx.lineWidth=particle.size*2.9;
          ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(p.x,p.y);ctx.stroke();
          ctx.strokeStyle='#ffd999';ctx.lineWidth=particle.size*.85;ctx.stroke();
        }
        ctx.restore();
      }
    }
    chips(ctx,box,time,front){
      const sample=EarthMountainRenderer.sample(this.actionTime??time),profile=this.profile||defaultProfile,extent=profile.extent/1.12;
      for(let i=0;i<profile.chipsCount;i++){
        const a=i*2.399+time*(.055+hash(i+23)*.07),z=Math.sin(a)*.92*extent;
        if((z>0)!==front)continue;
        const r=(1.12+hash(i+50)*.22+sample.opening*.10*profile.opening-sample.charge*(1-sample.opening)*.08)*extent;
        const q=this.project([Math.cos(a)*r,-.2+Math.sin(i*4.2)*.54*extent+.04*Math.sin(time*.7+i),z],identity(),box);
        const s=2+hash(i+31)*4.2;
        ctx.save();ctx.translate(q.x,q.y);ctx.rotate(a*.6+i);ctx.globalAlpha*=(front?.85:.45)*clamp(profile.chipsCount-i);
        ctx.fillStyle='#827564';ctx.beginPath();ctx.moveTo(-s,-s*.45);ctx.lineTo(s*.1,-s*.8);ctx.lineTo(s,s*.1);ctx.lineTo(s*.3,s*.7);ctx.lineTo(-s*.8,s*.42);ctx.closePath();ctx.fill();
        ctx.fillStyle='#423b32';ctx.beginPath();ctx.moveTo(-s*.8,s*.42);ctx.lineTo(s*.1,0);ctx.lineTo(s,s*.1);ctx.lineTo(s*.3,s*.7);ctx.closePath();ctx.fill();ctx.restore();
      }
    }
    sparkleFrames(box,time,{width=this.viewportWidth||390,height=this.viewportHeight||844,mana=this.sparkleMana}={}){
      const shared=root.FireRankSparkles;if(!shared)return [];
      const profile=this.profile||defaultProfile,formed=smooth(((this.formation??1)-.7)/.3);
      if(!formed)return [];
      const candidates=(this.meshes||[]).filter(mesh=>mesh.count&&mesh.spec);if(!candidates.length)return [];
      const value=Number.isFinite(mana)?mana:shared.manaForRank(profile.rank);
      const ambient=finite(this.lastTime,time),motion=this.actionTime??ambient;
      return shared.samples({time,mana:value,referenceWidth:shared.referenceWidth(width,height)}).map(p=>{
        // Keep the glints on the stone faces, but distribute the shared fire
        // population across them instead of piling stars onto seven anchors.
        const spec=candidates[p.id%candidates.length].spec;
        const q=this.project([(hash(p.seed+1)-.5)*spec.width*1.6,
          (hash(p.seed+2)-.5)*spec.height*.5,spec.depth*.7],this.model(spec,ambient,motion),box);
        const top=Math.max(4,box.y),bottom=Math.min(height-4,box.y+box.height);
        const rise=Math.min(p.rise,Math.max(0,bottom-top-p.glow*2));
        const startY=clamp(q.y,top+p.glow+rise,bottom-p.glow);
        return {...p,x:clamp(q.x,p.glow+2,width-p.glow-2),y:startY-p.age*rise,
          alpha:p.alpha*formed,color:'#ead6a5'};
      });
    }
    sparkles(ctx,box,time){
      root.FireRankSparkles?.drawFrames(ctx,this.sparkleFrames(box,time),ctx.globalAlpha);
    }
    draw(ctx,_background,w,h,{time=0,box,opacity=1,rank='SS',formation=1,earthEffects,readout,actionTime}={}){
      if(this.disposed||this.lost||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||!Number.isFinite(opacity)||opacity<=0||!this.init())return false;
      const hostTime=Math.max(0,finite(time)),profile=earthEffects?.profile||profileFor(rank);
      const formed=clamp(finite(formation,1));
      if(!earthEffects)this.selectRank(rank);
      time=earthEffects?Math.max(0,finite(earthEffects.time)):hostTime*profile.speed;box=box||this.layout(w,h);
      const motionTime=Math.max(0,finite(earthEffects?.actionTime??actionTime,time));
      if(![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0)return false;
      const scale=Math.min(root.devicePixelRatio||1,1.5,700/box.width,700/box.height),pw=Math.max(1,Math.round(box.width*scale)),ph=Math.max(1,Math.round(box.height*scale));
      const key=[rank,formed,earthEffects?.level,earthEffects?.actionTime??actionTime,w,h,...Object.values(box),...Object.values(readout||{}),pw,ph].join(':');
      const resized=this.viewportWidth!==w||this.viewportHeight!==h;
      const refresh=!this.renderBox||time<this.lastTime||resized||this.lastTime===-Infinity||
        (earthEffects?hostTime-this.hostTime>=1/30-1e-6||hostTime===this.hostTime&&key!==this.lastKey:
          time-this.lastTime>=1/30-1e-6||key!==this.lastKey);
      if(refresh){
        this.profile=profile;this.formation=formed;
        this.sparkleMana=Number.isFinite(earthEffects?.value)?earthEffects.value:root.FireRankSparkles?.manaForRank(rank);
        this.actionTime=motionTime;this.actionOrigin=earthEffects?.actionOrigin;this.actionSpeed=earthEffects?.actionSpeed;
        if(earthEffects)this.growingMeshes(earthEffects);
        const gl=this.gl,m=EarthMountainRenderer.sample(motionTime);
        if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=this.patch.width=pw;this.canvas.height=this.patch.height=ph;}
        const models=this.meshes.map(mesh=>mesh.count?this.model(mesh.spec,time,motionTime):null);
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFbo);gl.viewport(0,0,512,512);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.shadowProgram);gl.uniformMatrix4fv(this.shadowUniforms.light,false,lightView);
        // Changing rank replaces the mesh buffers. Disable the previous lit
        // pass's attributes before the shadow pass can reference a deleted one.
        gl.disableVertexAttribArray(this.attributes.position);gl.disableVertexAttribArray(this.attributes.normal);
        gl.enableVertexAttribArray(this.shadowPosition);
        for(let i=0;i<this.meshes.length;i++){
          const mesh=this.meshes[i];if(!mesh.count)continue;
          gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.vertexAttribPointer(this.shadowPosition,3,gl.FLOAT,false,24,0);
          gl.uniformMatrix4fv(this.shadowUniforms.model,false,models[i]);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);const u=this.uniforms;
        gl.uniformMatrix4fv(u.uView,false,view);gl.uniformMatrix4fv(u.uLight,false,lightView);
        gl.uniform1f(u.uCharge,m.charge);gl.uniform1f(u.uOpening,m.opening);gl.uniform1f(u.uMineral,this.profile.mineral);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);gl.uniform1i(u.uShadow,0);
        gl.disableVertexAttribArray(this.shadowPosition);
        gl.enableVertexAttribArray(this.attributes.position);gl.enableVertexAttribArray(this.attributes.normal);
        for(let i=0;i<this.meshes.length;i++){
          const mesh=this.meshes[i];if(!mesh.count)continue;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
          gl.vertexAttribPointer(this.attributes.position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(this.attributes.normal,3,gl.FLOAT,false,24,12);
          gl.uniformMatrix4fv(u.uModel,false,models[i]);gl.uniform1f(u.uSeed,mesh.spec.seed);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
        }
        this.patchCtx.clearRect(0,0,pw,ph);this.patchCtx.drawImage(this.canvas,0,0);
        this.lastTime=time;this.lastKey=key;this.drawCount++;this.renderBox={...box};
        this.hostTime=hostTime;this.viewportWidth=w;this.viewportHeight=h;
        this.backdropReadout=readout?{...readout}:undefined;
      }
      this.time=time;const retained=this.lastTime,paintBox=this.renderBox;
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha*=clamp(opacity);
      const collision=this.collisionParticles(retained,this.actionTime);
      this.backdrop(ctx,w,h,paintBox,retained);
      this.earthBackdrop?.draw(ctx,w,h,{time:retained,actionTime:this.actionTime,hostTime,profile:this.profile,box:paintBox,readout:this.backdropReadout,formation:this.formation});
      this.dust(ctx,paintBox,retained,false);this.chips(ctx,paintBox,retained,false);this.drawCollision(ctx,paintBox,collision,false);
      ctx.drawImage(this.patch,paintBox.x,paintBox.y,paintBox.width,paintBox.height);
      this.chips(ctx,paintBox,retained,true);this.dust(ctx,paintBox,retained,true);this.drawCollision(ctx,paintBox,collision,true);this.sparkles(ctx,paintBox,this.hostTime);ctx.restore();return true;
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;
      this.canvas.removeEventListener?.('webglcontextlost',this.onLost);this.canvas.removeEventListener?.('webglcontextrestored',this.onRestored);
      if(this.gl&&!this.lost){const gl=this.gl;(this.meshes||[]).forEach(mesh=>gl.deleteBuffer(mesh.buffer));
        if(this.program)gl.deleteProgram(this.program);if(this.shadowProgram)gl.deleteProgram(this.shadowProgram);
        if(this.shadowTexture)gl.deleteTexture(this.shadowTexture);if(this.shadowDepth)gl.deleteRenderbuffer(this.shadowDepth);if(this.shadowFbo)gl.deleteFramebuffer(this.shadowFbo);}
      this.gl=null;this.program=null;this.shadowProgram=null;this.meshes=[];
      this.morphBanks=null;this.structureKey='';
      this.earthBackdrop?.dispose();this.earthBackdrop=null;
      this.canvas.width=this.canvas.height=this.patch.width=this.patch.height=1;
    }
  }
  root.EarthMountainRenderer=EarthMountainRenderer;
})(globalThis);
