(function(){
'use strict';
const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
let installed=false;
function pack(v){const s=String(v||'').trim().toLowerCase();if(s==='box'||s==='carton'||s.includes('carton')||s.includes('case'))return 'Carton';if(s==='unit qty'||s==='unit'||s.includes('unit'))return 'Unit';return ''}
function hasDims(it){return !!(n(it&&it.length)&&n(it&&it.width)&&n(it&&it.height))}
function safeStatus(it){if(!it)return 'unmeasured';const p=pack(it.packType),classified=!!(it.zone&&p&&String(it.location||'').trim()),wt=n(it.weight)>0,dims=hasDims(it);if(p==='Carton'&&classified&&wt&&dims)return 'complete';if(p==='Unit'&&classified&&wt)return 'complete';return (wt||dims||String(it.netWeight||'').trim()||String(it.measuredAt||'').trim())?'partial':'unmeasured'}
function install(){if(installed)return;if(typeof statusOf!=='function'||typeof items==='undefined'){setTimeout(install,100);return}installed=true;if(!localStorage.getItem('bm.defaultDimUnit'))localStorage.setItem('bm.defaultDimUnit','cm');statusOf=safeStatus;try{if(typeof renderDashboard==='function')renderDashboard()}catch(e){}try{if(typeof renderQueue==='function')renderQueue()}catch(e){}window.BoxMeasureCompletion135={safeStatus,pack,hasDims}}
install();
})();
