(function(){
'use strict';
function inject(id,file){
  if(document.getElementById(id))return;
  const s=document.createElement('script');
  s.id=id;
  s.async=false;
  s.src='file:///android_asset/'+file;
  document.head.appendChild(s);
}
function ready(){return !!(window.BoxMeasureNativeImport&&window.BoxMeasure131&&window.BoxMeasureCompletion134);}
function finish(attempt){
  if(ready()){window.__bm134Ready=true;return;}
  if(attempt<80)setTimeout(()=>finish(attempt+1),100);
  else console.error('BoxMeasure 1.3.4 stable runtime did not finish loading');
}
function boot(){
  if(window.__bm134Booted)return;
  window.__bm134Booted=true;
  inject('bm-import-overlay-script','import_overlay.js');
  inject('bm-sheet131-overlay-script','sheet131_overlay.js');
  inject('bm-unitguard134-script','unit_guard_134.js');
  finish(0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
