(function(){
  'use strict';
  const VERSION='1.3.1';
  function bridgeGlobal(name){
    if(Object.prototype.hasOwnProperty.call(window,name))return;
    try{Object.defineProperty(window,name,{configurable:true,get:function(){try{return eval(name)}catch(e){return undefined}},set:function(value){try{eval(name+' = value')}catch(e){}}})}catch(e){}
  }
  bridgeGlobal('draft');bridgeGlobal('items');
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
  function canonicalPack(v){const s=String(v||'').trim().toLowerCase();if(s==='box'||s==='carton'||s.includes('carton')||s.includes('case'))return 'Carton';if(s==='unit qty'||s==='unit'||s.includes('unit'))return 'Unit';return ''}
  function batchUnit(it){try{const b=JSON.parse(localStorage.getItem('bm.importmeta.122')||'[]').find(x=>x.id===it.importBatchId);return b?String(b.dimensionUnit||''):''}catch(e){return ''}}
  function unitOf(it){
    const raw=String(it&&it.dimensionUnit ? it.dimensionUnit : '').toLowerCase();
    if(raw==='mm'||raw==='cm')return raw;
    if(it&&it.importBatchId&&batchUnit(it)==='unspecified'&&(n(it.length)||n(it.width)||n(it.height)))return '';
    return 'cm';
  }
  function cm(v,u){const x=n(v);if(!x||!u)return '';return u==='mm'?x/10:x}
  function neat(v){if(v==='')return '';return Number(v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}
  function install(){
    if(typeof window.rowsForExport!=='function'||typeof window.sourceHeaders!=='function'||typeof window.csvEscape!=='function'||typeof window.statusOf!=='function'||typeof window.exportText!=='function'){setTimeout(install,150);return}
    window.rowsForExport=function(list){
      const src=sourceHeaders();
      const bm=['BM_SourceLine','BM_InternalId','BM_SourceId','BM_SKU','BM_Barcode','BM_Description','BM_Location','BM_Zone','BM_PackType','BM_CartonOrUnit','BM_RecordKey','BM_DimensionInputUnit','BM_LengthEntered','BM_WidthEntered','BM_HeightEntered','BM_LengthCm','BM_WidthCm','BM_HeightCm','BM_GrossWeightKg','BM_WeightKg','BM_NetWeightText','BM_Quantity','BM_Status','BM_Method','BM_Confidence','BM_MeasuredAt','BM_UpdatedAt','BM_ProductPhoto','BM_UnitPhoto','BM_CartonPhoto','BM_BoxPhoto','BM_Notes'];
      const headers=[...src,...bm];
      const rows=list.map(it=>{
        const s=statusOf(it),vals=src.map(h=>(it.sourceRow||{})[h]??''),m=it.photoMeta&&typeof it.photoMeta==='object'?it.photoMeta:{},u=unitOf(it),pack=canonicalPack(it.packType),key=[String(it.sku||'').trim(),pack].filter(Boolean).join('|');
        vals.push(it.sourceIndex||'',it.id,it.sourceId||'',it.sku||'',it.barcode||'',it.description||'',it.location||'',it.zone||'',it.packType||'',pack,key,u?u.toUpperCase():'UNCONFIRMED',it.length||'',it.width||'',it.height||'',neat(cm(it.length,u)),neat(cm(it.width,u)),neat(cm(it.height,u)),it.weight||'',it.weight||'',it.netWeight||'',it.quantity||'',s,it.method||'',it.confidence||'',it.measuredAt||'',it.updatedAt||'',m.product?'YES':'NO',m.unit?'YES':'NO',m.box?'YES':'NO',m.box?'YES':'NO',it.notes||'');
        return vals;
      });
      return [headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n');
    };
    const oldExport=exportText;
    window.exportText=function(name,mime,content){if(String(name||'').startsWith('BoxMeasure-audit-'))content=String(content||'').replace(/App version:\s*[^\r\n]+/,'App version: '+VERSION);return oldExport(name,mime,content)};
    const header=document.querySelector('header .sub');if(header){let v=VERSION;try{if(window.AndroidBridge&&typeof AndroidBridge.getVersion==='function')v=AndroidBridge.getVersion()||VERSION}catch(e){}header.textContent='Warehouse Measurement & Visual Verification '+v}
    const exp=document.getElementById('export');if(exp&&!document.getElementById('bmVisualExportNote')){const note=document.createElement('div');note.id='bmVisualExportNote';note.className='status';note.innerHTML='<b>Warehouse-safe export:</b> CSV keeps original source columns first, then adds Location, Carton/Unit identity, raw dimension values + input unit, normalized centimetres, Gross Weight, text-capable Net Weight, and photo YES/NO flags. If the source dimension unit is unconfirmed, normalized CM values are deliberately left blank.';const cards=exp.querySelectorAll('.card');if(cards.length)cards[cards.length-1].appendChild(note)}
    try{if(window.BoxMeasureUltimate&&typeof BoxMeasureUltimate.renderOps==='function')BoxMeasureUltimate.renderOps()}catch(e){}
  }
  install();
})();
