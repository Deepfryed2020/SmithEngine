(function(){
  'use strict';
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
  let installed=false;
  function batchUnit(it){try{const b=JSON.parse(localStorage.getItem('bm.importmeta.122')||'[]').find(x=>x.id===it.importBatchId);return b?String(b.dimensionUnit||''):''}catch(e){return ''}}
  function hasDims(it){return !!(n(it&&it.length)&&n(it&&it.width)&&n(it&&it.height))}
  function unitConfirmed(it){
    if(!hasDims(it))return true;
    const u=String(it&&it.dimensionUnit||'').toLowerCase();
    if(u!=='mm'&&u!=='cm')return false;
    if(it&&it.importBatchId&&batchUnit(it)==='unspecified'&&!it.dimensionUnitConfirmed&&u==='cm')return false;
    return true;
  }
  function repairUnconfirmed(){
    let changed=false;
    try{items.forEach(it=>{if(it&&it.importBatchId&&batchUnit(it)==='unspecified'&&hasDims(it)&&!it.dimensionUnitConfirmed&&String(it.dimensionUnit||'').toLowerCase()==='cm'){it.dimensionUnit='';changed=true}});if(changed)persist()}catch(e){}
  }
  function safeStatus(it){
    const dims=hasDims(it),wt=n(it&&it.weight)>0,unitOk=unitConfirmed(it);
    if(dims&&wt&&it.zone&&it.packType&&unitOk)return 'complete';
    if(dims||wt)return 'partial';
    return 'unmeasured';
  }
  function markExplicit(){
    const sel=document.getElementById('dimensionUnit');if(!sel||sel.__bmCompletionGuard)return;sel.__bmCompletionGuard=true;
    sel.addEventListener('change',()=>{if(!sel.value)return;try{if(typeof draft!=='undefined'&&draft){draft.dimensionUnit=sel.value;draft.dimensionUnitConfirmed=true;const ix=items.findIndex(x=>x.id===draft.id);if(ix>=0){items[ix].dimensionUnit=sel.value;items[ix].dimensionUnitConfirmed=true}persist()}}catch(e){}});
  }
  function install(){
    if(installed)return;
    if(!window.BoxMeasure131||typeof statusOf!=='function'||typeof items==='undefined'){setTimeout(install,160);return}
    installed=true;repairUnconfirmed();statusOf=safeStatus;markExplicit();
    if(typeof renderQueue==='function')renderQueue();
    if(typeof renderDashboard==='function')renderDashboard();
    if(typeof go==='function'&&!go.__bmCompletionGuard){const old=go;const wrapped=function(id){old(id);if(id==='item')setTimeout(markExplicit,0);if(id==='work')setTimeout(()=>renderQueue(),0);if(id==='dashboard')setTimeout(()=>renderDashboard(),0)};wrapped.__bmCompletionGuard=true;go=wrapped}
    const item=document.getElementById('item');if(item)new MutationObserver(markExplicit).observe(item,{childList:true,subtree:true});
    window.BoxMeasureCompletion131={unitConfirmed,safeStatus};
  }
  install();
})();
