(function(){
'use strict';
let installed=false;
function $(id){return document.getElementById(id)}
function stableGo(id){
  try{
    document.querySelectorAll('.page').forEach(function(x){x.classList.toggle('on',x.id===id)});
    document.querySelectorAll('.nav').forEach(function(x){x.classList.toggle('on',x.dataset.page===id)});

    if(id==='dashboard'&&typeof renderDashboard==='function')renderDashboard();
    if(id==='work'&&typeof renderQueue==='function')renderQueue();
    if(id==='export'){
      if(typeof renderExportStats==='function')renderExportStats();
      if(window.BoxMeasure132Export&&typeof window.BoxMeasure132Export.installUi==='function')window.BoxMeasure132Export.installUi();
    }
    if(id==='settings'&&typeof renderSettings==='function')renderSettings();
    if(id==='item'&&typeof fillItem==='function')fillItem();
    if(id==='measure'&&typeof renderMeasureChips==='function')renderMeasureChips();
    window.scrollTo(0,0);
  }catch(err){
    try{console.error('BoxMeasure navigation error',err)}catch(e){}
  }
}
function install(){
  if(installed)return;
  if(!document.body||!window.BoxMeasure132Core||!window.BoxMeasure132UI||!window.BoxMeasure132Export){setTimeout(install,120);return}
  installed=true;
  window.go=stableGo;
  document.querySelectorAll('.nav').forEach(function(btn){
    btn.onclick=function(){stableGo(btn.dataset.page)};
  });
  window.BoxMeasure132NavHotfix={go:stableGo};
}
install();
})();
