(function(){
  'use strict';
  const VERSION='1.3.0';
  function bridgeGlobal(name){
    if(Object.prototype.hasOwnProperty.call(window,name))return;
    try{
      Object.defineProperty(window,name,{configurable:true,get:function(){try{return eval(name)}catch(e){return undefined}},set:function(value){try{eval(name+' = value')}catch(e){}}});
    }catch(e){}
  }
  bridgeGlobal('draft');
  bridgeGlobal('items');
  function install(){
    if(typeof window.rowsForExport!=='function'||typeof window.sourceHeaders!=='function'||typeof window.csvEscape!=='function'||typeof window.statusOf!=='function'||typeof window.exportText!=='function'){setTimeout(install,150);return}
    window.rowsForExport=function(list){
      const src=sourceHeaders();
      const bm=['BM_SourceLine','BM_InternalId','BM_SourceId','BM_SKU','BM_Barcode','BM_Description','BM_Zone','BM_PackType','BM_LengthCm','BM_WidthCm','BM_HeightCm','BM_WeightKg','BM_Quantity','BM_Status','BM_Method','BM_Confidence','BM_MeasuredAt','BM_UpdatedAt','BM_ProductPhoto','BM_UnitPhoto','BM_BoxPhoto','BM_Notes'];
      const headers=[...src,...bm];
      const rows=list.map(it=>{
        const s=statusOf(it),vals=src.map(h=>(it.sourceRow||{})[h]??''),m=it.photoMeta&&typeof it.photoMeta==='object'?it.photoMeta:{};
        vals.push(it.sourceIndex||'',it.id,it.sourceId||'',it.sku||'',it.barcode||'',it.description||'',it.zone||'',it.packType||'',it.length||'',it.width||'',it.height||'',it.weight||'',it.quantity||'',s,it.method||'',it.confidence||'',it.measuredAt||'',it.updatedAt||'',m.product?'YES':'NO',m.unit?'YES':'NO',m.box?'YES':'NO',it.notes||'');
        return vals;
      });
      return [headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n');
    };
    const oldExport=exportText;
    window.exportText=function(name,mime,content){
      if(String(name||'').startsWith('BoxMeasure-audit-'))content=String(content||'').replace(/App version:\s*[^\r\n]+/,'App version: '+VERSION);
      return oldExport(name,mime,content);
    };
    const header=document.querySelector('header .sub');
    if(header){let v=VERSION;try{if(window.AndroidBridge&&typeof AndroidBridge.getVersion==='function')v=AndroidBridge.getVersion()||VERSION}catch(e){}header.textContent='Warehouse Measurement & Visual Verification '+v;}
    const exp=document.getElementById('export');
    if(exp&&!document.getElementById('bmVisualExportNote')){
      const note=document.createElement('div');note.id='bmVisualExportNote';note.className='status';
      note.innerHTML='<b>Visual verification:</b> CSV exports include BM_ProductPhoto, BM_UnitPhoto and BM_BoxPhoto as YES/NO flags. The image files themselves stay local inside BoxMeasure.';
      const cards=exp.querySelectorAll('.card');if(cards.length)cards[cards.length-1].appendChild(note);
    }
    try{if(window.BoxMeasureUltimate&&typeof BoxMeasureUltimate.renderOps==='function')BoxMeasureUltimate.renderOps()}catch(e){}
  }
  install();
})();
