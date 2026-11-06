'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/effect-settings.js');
require('../js/tap-stars.js');
const make=settings=>{const stars=new TapStars(()=>createCanvas(1,1),settings);stars.resize(390,844);return stars;};
const field=make({starEnabled:false});
const random=Math.random;
Math.random=()=>{throw Error('contact stars must not consume certification randomness');};
try {
  assert.equal(field.add(NaN,2),false);assert.equal(field.add(2,Infinity),false);
  assert.equal(field.stars.length,0);
  field.add(80,150);field.add(280,150);field.add(180,350);
  assert.equal(field.stars.length,3);assert.equal(field.linkCount,3);
  assert.deepEqual(field.stars.map(s=>[s.x,s.y]),[[80,150],[280,150],[180,350]],
    'each tap remains at its contact position');
  for(let i=0;i<1200;i++)field.step(.05);
  assert.equal(field.stars.length,3,'contact stars persist throughout mixed interaction');
  assert.deepEqual(field.stars.map(s=>[s.x,s.y]),[[80,150],[280,150],[180,350]]);
  const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  ctx.globalAlpha=.57;ctx.globalCompositeOperation='xor';
  field.draw(ctx);
  assert.ok(Math.abs(ctx.globalAlpha-.57)<.01);
  assert.equal(ctx.globalCompositeOperation,'xor','render restores the caller composite');
  const alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3];
  assert.ok(alpha(80,150)>180,'tap star core is visible even with ambient stars disabled');
  assert.ok(alpha(180,150)>5,'the first pair has a visible connection');
  assert.ok(alpha(130,250)>5,'the first and third stars connect');
  assert.ok(alpha(230,250)>5,'the second and third stars connect');
  assert.ok(alpha(10,700)===0,'the field leaves unrelated canvas regions clear');
  assert.equal(field.linksDirty,false,'connection geometry is cached between frames');
  const snapshot=field.captureParticles();
  assert.equal(snapshot.length,12,'three stars and nine connection samples feed the gather');
  assert.deepEqual(snapshot.slice(0,3).map(s=>[s.x,s.y]),[[80,150],[280,150],[180,350]]);
  field.resize(780,1688);
  assert.deepEqual(field.stars.map(s=>[s.x,s.y]),[[160,300],[560,300],[360,700]],
    'rotation/resizing scales the whole constellation');
  assert.deepEqual(snapshot.slice(0,3).map(s=>[s.x,s.y]),[[80,150],[280,150],[180,350]],
    'capture contains independent source particles');
  field.resize(NaN,1);assert.equal(field.width,780);
  field.reset();assert.equal(field.stars.length,0);assert.equal(field.linkCount,0);
  assert.deepEqual(field.captureParticles(),[]);
  assert.equal(field.time,0);
  for(let i=0;i<1024;i++)field.add(i%780,i%1688);
  assert.equal(field.stars.length,256,'extreme continuous tapping stays bounded');
  assert.equal(field.linkCount,256*255/2,'all retained stars remain interconnected');
  assert.equal(field.stars.at(-1).x,1023%780,'latest taps always receive a star');
  assert.equal(field.captureParticles().length,512,'gather capture has a fixed source budget');
  field.resize(10000,8000);assert.ok(field.links.width<=2048&&field.links.height<=2048);
  field.draw(ctx);
  field.reset();field.configure({starPalette:['#ff0000']});field.add(100,100);
  assert.equal(field.stars[0].color,'#ff0000','configured star palette supplies new tap feedback');
} finally {Math.random=random;}
console.log('PASS tap stars: persistent contacts, all-pairs connections, canvas pixels/state, resize, capture isolation, bounded dense fields and reset.');
