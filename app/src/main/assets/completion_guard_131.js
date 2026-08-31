(function(){
  'use strict';
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
  let installed=false;

  function canonicalPack(v){
    const s=String(v||'').trim().toLowerCase();
    if(s==='box'||s==='carton'||s.includes('carton')||s.includes('case'))return 'Carton';
    if(s==='unit qty'||s==='unit'||s.includes('unit'))return 'Unit';
    return '';
  }
  function hasDims(it){return !!(n(it&&it.length)&&n(it&&it.width)&&n(it&&it.height));}
  function hasWeight(it){return n(it&&it.weight)>0;}
  function safeStatus(it){
    if(!it)return 'unmeasured';
    const pack=canonicalPack(it.packType);
    const classified=!!(it.zone&&pack&&String(it.location||'').trim());
    const wt=hasWeight(it),dims=hasDims(it);
    if(pack==='Carton'&&classified&&wt&&dims)return 'complete';
    if(pack==='Unit'&&classified&&wt)return 'complete';
    const worked=wt||dims||String(it.netWeight||'').trim()||String(it.measuredAt||'').trim();
    return worked?'partial':'unmeasured';
  }
  function install(){
    if(installed)return;
    if(!window.BoxMeasure131||typeof statusOf!=='function'||typeof items==='undefined'){setTimeout(install,120);return;}
    installed=true;
    if(!localStorage.getItem('bm.defaultDimUnit'))localStorage.setItem('bm.defaultDimUnit','cm');
    statusOf=safeStatus;
    try{if(typeof renderDashboard==='function')renderDashboard();}catch(e){}
    try{if(typeof renderQueue==='function')renderQueue();}catch(e){}
    window.BoxMeasureCompletion134={safeStatus,canonicalPack,hasDims,hasWeight};
  }
  install();
})();
