(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
  let installed=false;
  function batchUnit(it){try{const b=JSON.parse(localStorage.getItem('bm.importmeta.122')||'[]').find(x=>x.id===it.importBatchId);return b?String(b.dimensionUnit||''):''}catch(e){return ''}}
  function isUnknown(it){return !!(it&&it.importBatchId&&batchUnit(it)==='unspecified'&&!String(it.dimensionUnit||'').trim()&&(n(it.length)||n(it.width)||n(it.height)))}
  function ensureBlankOption(){const sel=$('dimensionUnit');if(!sel)return;if(![...sel.options].some(o=>o.value==='')){const o=document.createElement('option');o.value='';o.textContent='Choose MM or CM…';sel.insertBefore(o,sel.firstChild)}}
  function showUnknown(it){
    ensureBlankOption();const sel=$('dimensionUnit');if(sel)sel.value='';
    const preview=$('bm131DimPreview');if(preview)preview.innerHTML='<b>UNIT NOT CONFIRMED.</b> The source has dimension numbers, but BoxMeasure will not decide whether they are MM or CM. Choose the correct unit before relying on normalized values.';
    [['length','Length'],['width','Width'],['height','Height']].forEach(([id,label])=>{const el=$(id);if(el){const l=el.parentElement.querySelector('label');if(l)l.textContent=label+' — UNIT ? *'}});
    if(typeof draft!=='undefined'&&draft&&it&&draft.id===it.id)draft.dimensionUnit='';
  }
  function resolveCurrent(){
    try{if(typeof draft==='undefined'||!draft)return;const stored=items.find(x=>x.id===draft.id);if(stored&&isUnknown(stored))showUnknown(stored)}catch(e){}
  }
  function patchQueue(){
    if(typeof renderQueue!=='function'||renderQueue.__bmUnitGuard)return;
    const old=renderQueue;const wrapped=function(){old();try{document.querySelectorAll('.bmQueueCard[data-bm-id]').forEach(card=>{const it=items.find(x=>x.id===card.dataset.bmId);if(!isUnknown(it))return;const meta=card.querySelector('.bmCardMeta');if(meta){meta.innerHTML=`<b>${String(it.location||'NO LOCATION')}</b> · Item # ${String(it.sku||'—')}<br>${String(it.length||'—')} × ${String(it.width||'—')} × ${String(it.height||'—')} <b>UNIT NOT CONFIRMED</b><br>Gross ${String(it.weight||'—')} kg${it.netWeight?` · Net ${String(it.netWeight)}`:''}`}const miss=card.querySelector('.bmMissing');if(miss&&!miss.textContent.toLowerCase().includes('dimension unit'))miss.textContent=(miss.textContent?miss.textContent+' · ':'')+'dimension unit not confirmed'})}catch(e){}};wrapped.__bmUnitGuard=true;renderQueue=wrapped;
  }
  function patchFill(){
    if(typeof fillItem!=='function'||fillItem.__bmUnitGuard)return;
    const old=fillItem;const wrapped=function(){let unknown=null;try{if(typeof draft!=='undefined'&&draft){const stored=items.find(x=>x.id===draft.id);if(stored&&isUnknown(stored))unknown=stored}}catch(e){}old();ensureBlankOption();if(unknown)showUnknown(unknown)};wrapped.__bmUnitGuard=true;fillItem=wrapped;
  }
  function protectSelection(){
    ensureBlankOption();const sel=$('dimensionUnit');if(!sel||sel.__bmUnitGuard)return;sel.__bmUnitGuard=true;
    sel.addEventListener('change',()=>{try{if(typeof draft!=='undefined'&&draft&&sel.value){draft.dimensionUnit=sel.value;const ix=items.findIndex(x=>x.id===draft.id);if(ix>=0)items[ix].dimensionUnit=sel.value;persist()}}catch(e){}});
  }
  function install(){
    if(installed)return;
    if(!document.body||!window.BoxMeasure131||typeof fillItem!=='function'||typeof renderQueue!=='function'){setTimeout(install,160);return}
    installed=true;patchFill();patchQueue();protectSelection();resolveCurrent();
    if(typeof go==='function'&&!go.__bmUnitGuard){const old=go;const wrapped=function(id){old(id);if(id==='item')setTimeout(()=>{protectSelection();resolveCurrent()},0);if(id==='work')setTimeout(()=>renderQueue(),0)};wrapped.__bmUnitGuard=true;go=wrapped}
    if($('item'))new MutationObserver(()=>protectSelection()).observe($('item'),{childList:true,subtree:true});
    renderQueue();
  }
  install();
})();
