import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createOcean } from './water.js';
import { createWorld } from './world.js';
import { presets, ranges, readState, writeState } from './state.js';
import './style.css';

const $ = s => document.querySelector(s);
const state = readState(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches, elapsed = 14, drift = false, sound = null;
let toastTimer, frames = 0, fpsStart = performance.now(), stopped = false;
const canvas = $('#ocean');
let renderer;
try {
 renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
} catch {
 $('#loading').hidden=true;$('#error').hidden=false;
}
if (renderer) boot().catch(error=>{console.error(error);$('#loading').hidden=true;$('#error h1').textContent='The ocean couldn’t finish loading';$('#error p').textContent='Please reload to try the scene and its sky again.';$('#error').hidden=false;});

async function boot() {
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const viewport=$('#app');
 let width=viewport.clientWidth,height=viewport.clientHeight;
 renderer.setSize(width,height,false);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.08;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(48,width/height,.2,6000);
 // Keep the same perspective and orbit angle, with room for the scene on tall displays.
 const frameScale=()=>Math.max(1,1.1/(width/height));
 let framing=frameScale();
 const controls=new OrbitControls(camera,canvas);
 controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=8;controls.maxDistance=200*framing;
 controls.maxPolarAngle=Math.PI*.484;controls.minPolarAngle=.15;controls.panSpeed=.7;controls.rotateSpeed=.45;
 controls.target.set(-8,3,-15);
 const skyTexture=await new HDRLoader().loadAsync('/assets/sky.hdr');
 skyTexture.mapping=THREE.EquirectangularReflectionMapping;
 const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(skyTexture);scene.environment=env.texture;scene.environmentIntensity=.65;pmrem.dispose();
 const shared={uSky:{value:skyTexture},time:{value:elapsed},uSwell:{value:state.swell},uWind:{value:state.wind},uCloud:{value:state.cloud},uNight:{value:state.night},uWarmth:{value:state.warmth},sunDirection:{value:new THREE.Vector3(-.7,.6,-.6).normalize()}};
 const world=createWorld(scene,shared);
 const ocean=createOcean(shared);scene.add(ocean.mesh);
 const targetCamera=new THREE.Vector3(),targetLook=new THREE.Vector3();let moving=false;
 const views={
  cove:{pos:[43,17,41],target:[-3,3,-10],kicker:'01 / THE COVE',title:'Somewhere,<br> off the map.',description:'Nothing to do. Just a sea to get lost in.'},
  sea:{pos:[68,5,105],target:[110,2,-70],kicker:'02 / OPEN SEA',title:'Only the<br> horizon.',description:'A thousand little waves. No two quite alike.'},
  sail:{pos:[30,10,33],target:[8,5,0],kicker:'03 / UNDER SAIL',title:'Follow<br> the wind.',description:'A little ship, with nowhere it has to be.'},
 };
 function setView(view,instant=false){
  state.view=view;const config=views[view];
  targetCamera.set(...config.pos);targetLook.set(...config.target);
  targetCamera.sub(targetLook).multiplyScalar(framing).add(targetLook);
  if(instant){camera.position.copy(targetCamera);controls.target.copy(targetLook);controls.update();}else moving=true;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  $('#scene-kicker').textContent=config.kicker;$('#scene-title').innerHTML=config.title;$('#scene-description').textContent=config.description;
 }
 function updateControls(){
  for(const key of Object.keys(ranges)){$('#'+key).value=state[key];updateOutput(key);}
  document.querySelectorAll('[data-weather]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weather===state.weather)));
  $('#ship').checked=state.ship;$('#quality').value=state.quality;
 }
 function updateOutput(key){
  const v=state[key];const value=key==='wind'?`${v} m/s`:key==='swell'?`${v.toFixed(2).replace(/0$/,'')} m`:key==='sun'?`${v}°`:`${Math.round(v*100)}%`;
  $('#'+key+'-out').textContent=value;
 }
 setView(state.view,true);updateControls();
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 document.querySelectorAll('[data-weather]').forEach(b=>b.addEventListener('click',()=>{Object.assign(state,presets[b.dataset.weather],{weather:b.dataset.weather});updateControls();}));
 for(const key of Object.keys(ranges))$('#'+key).addEventListener('input',e=>{state[key]=Number(e.target.value);updateOutput(key);});
 $('#ship').addEventListener('change',e=>{state.ship=e.target.checked;});
 $('#drift').addEventListener('change',e=>{drift=e.target.checked;});
 function setQuality(){
  const ratios={balanced:1,high:1.5,ultra:2};renderer.setPixelRatio(Math.min(devicePixelRatio,ratios[state.quality]));ocean.setQuality(state.quality);
 }
 $('#quality').addEventListener('change',e=>{state.quality=e.target.value;setQuality();toast('Ocean detail updated');});setQuality();
 $('#reset').addEventListener('click',()=>setView(state.view));
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
 let down=null;const pointers=new Set();
 canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);down=pointers.size===1?{x:e.clientX,y:e.clientY,time:performance.now()}:null;moving=false;});
 canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7||performance.now()-down.time>500)return;
  const rect=canvas.getBoundingClientRect();
  pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
  if(ray.ray.intersectPlane(plane,hit)&&hit.distanceTo(camera.position)<250){ocean.ripple(hit.x,hit.z,elapsed);if(paused)toast('Resume the ocean to watch the ripple');}
  down=null;
 });
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;});
 controls.addEventListener('start',()=>moving=false);
 let last=performance.now();
 function tick(now){
  if(stopped)return;
  requestAnimationFrame(tick);
  if(document.hidden){last=now;return;}
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(!paused)elapsed+=dt;
  shared.time.value=elapsed;
  const smooth=1-Math.exp(-dt*2.2);
  for(const [uniform,key] of [['uSwell','swell'],['uWind','wind'],['uCloud','cloud'],['uNight','night'],['uWarmth','warmth']])shared[uniform].value=THREE.MathUtils.lerp(shared[uniform].value,state[key],smooth);
  const sunHeight=state.sun*Math.PI/180;
  const nextSun=new THREE.Vector3(-.7,Math.tan(sunHeight),-.7).normalize();shared.sunDirection.value.lerp(nextSun,smooth).normalize();
  ocean.uniforms.uFoam.value=THREE.MathUtils.lerp(ocean.uniforms.uFoam.value,state.foam,smooth);
  ocean.uniforms.uRain.value=state.rain;
  if(moving){camera.position.lerp(targetCamera,1-Math.exp(-dt*2.5));controls.target.lerp(targetLook,1-Math.exp(-dt*2.5));if(camera.position.distanceTo(targetCamera)<.08)moving=false;}
  controls.autoRotate=drift&&!paused&&!moving;controls.autoRotateSpeed=.24;controls.update(dt);
  // A sea-level camera stays above the highest local crests while preserving orbit control.
  camera.position.y=Math.max(camera.position.y,2.2+shared.uSwell.value*.35);
  world.update(elapsed,paused?0:dt,state,camera);
  scene.environmentIntensity=.65*(1-state.night*.9)*(1-state.cloud*.45);
  ocean.uniforms.uShip.value.set(world.ship.position.x,world.ship.position.z,world.ship.rotation.y,state.ship?1:0);
  renderer.render(scene,camera);
  frames++;
  if(now-fpsStart>1300){$('#fps').textContent=Math.round(frames*1000/(now-fpsStart));frames=0;fpsStart=now;}
 }
 renderer.compile(scene,camera);
 requestAnimationFrame(tick);
 requestAnimationFrame(()=>{renderer.render(scene,camera);$('#loading').style.opacity='0';setTimeout(()=>$('#loading').hidden=true,850);});
 const resizeObserver=new ResizeObserver(()=>{
  const nextWidth=viewport.clientWidth,nextHeight=viewport.clientHeight;
  if(!nextWidth||!nextHeight||(nextWidth===width&&nextHeight===height))return;
  width=nextWidth;height=nextHeight;
  const nextFraming=frameScale(),ratio=nextFraming/framing;
  camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
  targetCamera.sub(targetLook).multiplyScalar(ratio).add(targetLook);
  framing=nextFraming;controls.maxDistance=200*framing;
  camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);controls.update();
 });
 resizeObserver.observe(viewport);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;$('#error h1').textContent='The ocean lost its graphics context';$('#error p').textContent='Reload to bring the water back. Lowering Detail can help on a busy device.';$('#error').hidden=false;});
 $('#capture').addEventListener('click',()=>{
  renderer.render(scene,camera);canvas.toBlob(blob=>{
   if(!blob)return toast('Could not capture this frame');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`openwater-${state.weather}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('A little ocean, to keep.');
  });
 });
 $('#share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.search=writeState(state);url.hash='';
  history.replaceState(null,'',url);
  try{await navigator.clipboard.writeText(url.href);toast('Your ocean’s link is copied');}catch{toast('Copy the link from your address bar');}
 });
 document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,button')||$('#about').open)return;
  if(e.code==='Space'){e.preventDefault();togglePause();}
  if(e.key.toLowerCase()==='h')toggleUI();
  if(['1','2','3'].includes(e.key))setView(['cove','sea','sail'][Number(e.key)-1]);
 });
 // Read-only diagnostics for checking the real running scene, including shader failure reports.
 function screenBounds(object){
  const box=new THREE.Box3().setFromObject(object),point=new THREE.Vector3();
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   point.set(x,y,z).project(camera);left=Math.min(left,(point.x+1)*width/2);right=Math.max(right,(point.x+1)*width/2);top=Math.min(top,(1-point.y)*height/2);bottom=Math.max(bottom,(1-point.y)*height/2);
  }
  return {left,right,top,bottom};
 }
 window.openwater={getState:()=>({...state,paused,time:elapsed,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),camera:camera.position.toArray(),target:controls.target.toArray(),viewport:{width,height,aspect:camera.aspect,framing},bounds:{ship:screenBounds(world.ship),island:screenBounds(world.island)}})};
}

function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
function toggleSettings(open){$('#settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));$('#settings-toggle').setAttribute('aria-label',open?'Hide ocean controls':'Show ocean controls');}
$('#settings-toggle').addEventListener('click',()=>toggleSettings($('#settings').hidden));
$('#settings-close').addEventListener('click',()=>{toggleSettings(false);$('#settings-toggle').focus();});
function togglePause(){paused=!paused;updatePause();}
function updatePause(){$('#pause').textContent=paused?'Resume':'Pause';$('#pause').setAttribute('aria-label',paused?'Resume ocean':'Pause ocean');$('#pause').setAttribute('aria-pressed',String(paused));if(sound)sound.gain.gain.setTargetAtTime(paused?0:.18,sound.ctx.currentTime,.4);}
$('#pause').addEventListener('click',togglePause);updatePause();
function toggleUI(){const hidden=$('#app').classList.toggle('no-ui');$('#restore').hidden=!hidden;}
$('#hide').addEventListener('click',toggleUI);$('#restore').addEventListener('click',toggleUI);
$('#about-open').addEventListener('click',()=>$('#about').showModal());$('#about-close').addEventListener('click',()=>$('#about').close());
$('#about').addEventListener('click',e=>{if(e.target===$('#about')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleSettings(false);});
$('#sound').addEventListener('click',async()=>{
 if(sound){await sound.ctx.close();sound=null;$('#sound').setAttribute('aria-pressed','false');$('#sound').setAttribute('aria-label','Enable ocean sound');return;}
 try{
  const ctx=new AudioContext();await ctx.resume();const buffer=ctx.createBuffer(1,ctx.sampleRate*8,ctx.sampleRate),data=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*5;}
  const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
  const gain=ctx.createGain();gain.gain.value=paused?0:.18;source.connect(filter).connect(gain).connect(ctx.destination);source.start();
  const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=.12;depth.gain.value=260;lfo.connect(depth).connect(filter.frequency);lfo.start();
  sound={ctx,gain};$('#sound').setAttribute('aria-pressed','true');$('#sound').setAttribute('aria-label','Mute ocean sound');
 }catch{toast('Sound is unavailable in this browser');}
});
document.addEventListener('visibilitychange',()=>{if(sound){if(document.hidden)sound.ctx.suspend();else sound.ctx.resume();}});
