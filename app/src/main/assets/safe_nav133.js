(function(){
'use strict';
function safeGo(id){
  try{
    document.querySelectorAll('.page').forEach(x=>x.classList.toggle('on',x.id===id));
    document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('on',x.dataset.page===id));
    if(id==='work'&&typeof renderQueue==='function')renderQueue();
    if(id==='export'){
      if(typeof renderExportStats==='function')renderExportStats();
      try{if(window.BoxMeasure132Export&&typeof BoxMeasure132Export.installUi==='function')BoxMeasure132Export.installUi()}catch(e){}
    }
    if(id==='settings'&&typeof renderSettings==='function')renderSettings();
    const sub=document.querySelector('header .sub');
    if(sub){
      let v='1.3.3';
      try{if(window.AndroidBridge&&typeof AndroidBridge.getVersion==='function')v=AndroidBridge.getVersion()||v}catch(e){}
      sub.textContent='Warehouse Measurement & Pick Verification '+v;
    }
  }catch(e){
    console.error('BoxMeasure safe navigation error',e);
  }
}
window.go=safeGo;
window.BoxMeasureSafeNav133={go:safeGo};
})();
