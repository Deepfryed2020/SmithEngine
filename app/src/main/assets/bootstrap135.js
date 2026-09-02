(function(){
'use strict';
function load(id,file){return new Promise((resolve,reject)=>{if(document.getElementById(id))return resolve();const s=document.createElement('script');s.id=id;s.async=false;s.src='file:///android_asset/'+file;s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+file));document.head.appendChild(s)})}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function wait(test,label){for(let i=0;i<80;i++){try{if(test())return}catch(e){}await sleep(75)}throw new Error('Timed out waiting for '+label)}
async function boot(){if(window.__bm136Booting||window.__bm136Ready)return;window.__bm136Booting=true;try{
 await load('bm-freezeguard136-script','freeze_guard_136.js');
 await wait(()=>window.__bm136FreezeGuardReady,'freeze guard');
 await load('bm-import-overlay-script','import_overlay.js');
 await wait(()=>window.BoxMeasureNativeImport,'importer');
 await wait(()=>window.BoxMeasureUltimate,'visual suite');
 await load('bm-sheet131-overlay-script','sheet131_overlay.js');
 await wait(()=>window.BoxMeasure131,'warehouse sheet layer');
 await load('bm-unitguard135-script','unit_guard_135.js');
 await wait(()=>window.BoxMeasureCompletion135,'completion rules');
 await load('bm-navigation135-script','navigation135.js');
 await wait(()=>window.__bm136NavReady,'navigation');
 await load('bm-pabrai137-script','pabrai137.js');
 await wait(()=>window.__bm137Ready,'Pabrai warehouse model');
 window.__bm136Ready=true;
}catch(e){console.error('BoxMeasure 1.3.8 startup error',e);const d=document.createElement('div');d.style='position:fixed;left:12px;right:12px;top:12px;z-index:9999;background:#291515;color:#ffdede;border:1px solid #b55;border-radius:12px;padding:12px';d.textContent='BoxMeasure 1.3.8 startup error: '+String(e&&e.message?e.message:e);document.body.appendChild(d)}finally{window.__bm136Booting=false}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
