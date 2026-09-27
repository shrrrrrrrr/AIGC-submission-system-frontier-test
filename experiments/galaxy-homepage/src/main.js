import './base-main.js';
import './hero-ring.js';
import './style.css';
import { GalaxyHomepageRenderer } from './presentation.js';
let renderer,raf=0;
try{
 renderer=new GalaxyHomepageRenderer(document.querySelector('#galaxy-canvas'));
 const initialized=renderer.initialize();
 const tick=now=>{renderer.render(now);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
 if(import.meta.env.DEV)window.__galaxyHomepage=renderer;
 await initialized;
}catch(error){
 console.error('Galaxy homepage initialization failed:',error);
 for(const s of document.querySelectorAll('.galaxy-chapter')){
  s.style.backgroundImage=`url(${import.meta.env.BASE_URL}galaxies/${s.dataset.galaxySection}/residual.webp)`;s.style.backgroundSize='cover';
 }
}
window.addEventListener('pagehide',event=>{if(!event.persisted){cancelAnimationFrame(raf);renderer?.dispose();}else if(renderer)renderer.lastTime=0;});
