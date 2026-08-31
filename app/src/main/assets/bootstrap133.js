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
function ready(){
  return !!(window.BoxMeasureNativeImport&&window.BoxMeasure131&&window.BoxMeasureCompletion134);
}
function finish(attempt){
  if(ready()){
    window.__bm133Ready=true;
    return;
  }
  if(attempt<80)setTimeout(()=>finish(attempt+1),100);
  else console.error('BoxMeasure 1.3.4 stable runtime did not finish loading');
}
function boot(){
  if(window.__bm134Booted)return;
  window.__bm134Booted=true;
  // This deliberately mirrors the last phone-confirmed working v1.3.1 runtime.
  // The v1.3.2/v1.3.3 UI, export and navigation controllers are not loaded.
  inject('bm-import-overlay-script','import_overlay.js');
  inject('bm-sheet131-overlay-script','sheet131_overlay.js');
  inject('bm-unitguard131-script','unit_guard_131.js');
  finish(0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
