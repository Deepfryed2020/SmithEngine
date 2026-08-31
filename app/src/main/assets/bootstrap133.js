(function(){
'use strict';
const head=document.head;
function marker(id){if(document.getElementById(id))return;const m=document.createElement('meta');m.id=id;head.appendChild(m)}
function unmark(id){const e=document.getElementById(id);if(e&&e.tagName==='META')e.remove()}
function load(id,file){return new Promise((resolve,reject)=>{if(document.getElementById(id))return resolve();const s=document.createElement('script');s.id=id;s.async=false;s.src='file:///android_asset/'+file;s.onload=()=>resolve();s.onerror=()=>reject(new Error('Failed to load '+file));head.appendChild(s)})}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function waitFor(test,label,limit=60){for(let i=0;i<limit;i++){try{if(test())return true}catch(e){}await sleep(50)}throw new Error('Timed out waiting for '+label)}
async function boot(){
  if(window.__bm133Booting||window.__bm133Ready)return;
  window.__bm133Booting=true;
  try{
    // import_overlay normally launches these three scripts itself. Placeholders stop
    // that asynchronous fan-out so this bootstrap can load everything in one order.
    marker('bm-safety-overlay-script');
    marker('bm-ultimate-overlay-script');
    marker('bm-visual-export-overlay-script');
    await load('bm-import-overlay-script','import_overlay.js');
    unmark('bm-safety-overlay-script');unmark('bm-ultimate-overlay-script');unmark('bm-visual-export-overlay-script');

    await load('bm-safety-overlay-script','safety_overlay.js');
    await waitFor(()=>document.getElementById('bmSafetyCard'),'safety overlay');
    await load('bm-ultimate-overlay-script','ultimate_overlay.js');
    await waitFor(()=>window.BoxMeasureUltimate&&document.getElementById('bmUltimateStyles'),'visual overlay');
    await load('bm-visual-export-overlay-script','visual_export_overlay.js');
    await waitFor(()=>document.getElementById('bmVisualExportNote'),'visual export overlay');

    // v1.3.1 used a broad MutationObserver on the item page. In some WebViews,
    // characterData rewrites can retrigger the observer indefinitely. Keep child
    // insertion observation but suppress characterData for that one legacy target.
    const NativeMO=window.MutationObserver;
    if(NativeMO){
      window.MutationObserver=function(cb){
        const inner=new NativeMO(cb);
        this.observe=function(target,opts){const o=Object.assign({},opts||{});if(target&&target.id==='item')o.characterData=false;return inner.observe(target,o)};
        this.disconnect=()=>inner.disconnect();
        this.takeRecords=()=>inner.takeRecords();
      };
      window.MutationObserver.prototype=NativeMO.prototype;
    }
    await load('bm-sheet131-overlay-script','sheet131_overlay.js');
    await waitFor(()=>window.BoxMeasure131,'sheet 1.3.1 compatibility layer');
    if(NativeMO)window.MutationObserver=NativeMO;

    await load('bm-core132-script','core132.js');
    await waitFor(()=>window.BoxMeasure132Core,'1.3.2 core');
    await load('bm-ui132-script','ui132.js');
    await waitFor(()=>window.BoxMeasure132UI,'1.3.2 UI');
    await load('bm-export132-script','export132.js');
    await waitFor(()=>window.BoxMeasure132Export,'1.3.2 export');
    await load('bm-safe-nav133-script','safe_nav133.js');
    await waitFor(()=>window.BoxMeasureSafeNav133,'1.3.3 navigation fuse');

    window.__bm133Ready=true;
    try{go('dashboard')}catch(e){}
  }catch(e){
    console.error('BoxMeasure bootstrap failed',e);
    const d=document.createElement('div');d.style='position:fixed;inset:20px;z-index:9999;background:#291515;color:#ffdede;border:1px solid #b55;border-radius:12px;padding:16px;overflow:auto';d.innerHTML='<b>BoxMeasure startup error</b><br><br>'+String(e&&e.message?e.message:e);document.body.appendChild(d);
  }finally{window.__bm133Booting=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
