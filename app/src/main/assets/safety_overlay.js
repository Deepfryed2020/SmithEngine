(function(){
  'use strict';
  const VERSION='1.3.1';
  const META_KEY='bm.importmeta.122';
  const VALIDATION_KEY='bm.validation.131';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
  const val=(row,id)=>{try{return $(id)?mapped(row,id):''}catch(e){return ''}};

  function list(){try{return Array.isArray(items)?items:[]}catch(e){return[]}}
  function loadBatches(){try{return JSON.parse(localStorage.getItem(META_KEY)||'[]')}catch(e){return[]}}
  function saveBatches(v){localStorage.setItem(META_KEY,JSON.stringify(v))}
  function sourceObject(it){return it&&it.sourceRow&&typeof it.sourceRow==='object'?it.sourceRow:{}}
  function hasSource(it){return Object.keys(sourceObject(it)).length>0}
  function canonicalPack(v){const s=String(v||'').trim().toLowerCase();if(s==='box'||s==='carton'||s.includes('carton')||s.includes('case'))return 'Carton';if(s==='unit qty'||s==='unit'||s.includes('unit'))return 'Unit';return ''}
  function fingerprint(obj){
    const keys=Object.keys(obj||{}).sort(),text=keys.map(k=>k+'='+String(obj[k]??'')).join('\u001f');let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function duplicateGroups(arr,keyFn){
    const map=new Map();arr.forEach(it=>{const key=String(keyFn(it)||'').trim().toLowerCase();if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(it)});
    return [...map.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows}));
  }
  function validation(){
    const arr=list();let complete=0,missingDims=0,missingWeight=0,missingClass=0,missingLocation=0,missingDimUnit=0,sourceMismatch=0,sourceNoFingerprint=0;
    arr.forEach(it=>{
      const dims=n(it.length)>0&&n(it.width)>0&&n(it.height)>0,wt=n(it.weight)>0,cls=!!it.zone&&!!it.packType;
      if(dims&&wt&&cls)complete++;if(!dims)missingDims++;if(!wt)missingWeight++;if(!cls)missingClass++;if(!String(it.location||'').trim())missingLocation++;if(dims&&!String(it.dimensionUnit||'').trim())missingDimUnit++;
      if(hasSource(it)){if(it.sourceFingerprint){if(it.sourceFingerprint!==fingerprint(sourceObject(it)))sourceMismatch++}else sourceNoFingerprint++}
    });
    const skuDupes=duplicateGroups(arr,it=>String(it.sku||'').trim()?String(it.sku).trim()+'|'+canonicalPack(it.packType):'');
    const barcodeDupes=duplicateGroups(arr,it=>it.barcode||'');
    const batches=loadBatches();const batchChecks=batches.map(b=>{const present=arr.filter(x=>x.importBatchId===b.id).length;return {...b,present,ok:present===Number(b.rowCount||0)}});
    const batchMismatch=batchChecks.filter(x=>!x.ok).length,sourceRows=arr.filter(hasSource).length,manualRows=arr.length-sourceRows,outstanding=arr.length-complete;
    const hardFail=sourceMismatch>0||batchMismatch>0;
    const warnings=outstanding>0||skuDupes.length>0||barcodeDupes.length>0||sourceNoFingerprint>0||missingLocation>0||missingDimUnit>0;
    return {total:arr.length,complete,outstanding,missingDims,missingWeight,missingClass,missingLocation,missingDimUnit,sourceRows,manualRows,sourceMismatch,sourceNoFingerprint,skuDupes,barcodeDupes,batches:batchChecks,batchMismatch,hardFail,warnings,generatedAt:new Date().toISOString()};
  }
  function statusWord(v){return v.hardFail?'FAIL':v.warnings?'CHECK':'PASS'}
  function statusClass(v){return v.hardFail?'warn':v.warnings?'warn':'ok'}
  function detailsHtml(v){
    const dupeCount=v.skuDupes.length+v.barcodeDupes.length;
    const batchRows=v.batches.length?v.batches.map(b=>`<div class="item"><b>${esc(b.fileName||b.id)}</b><div class="itemmeta">Expected ${b.rowCount} source rows · ${b.present} still present · ${b.ok?'MATCH':'MISMATCH'}</div></div>`).join(''):'<div class="status">No tracked import batches yet.</div>';
    return `<div class="grid3"><div class="metric"><b>${v.total}</b><small>output rows</small></div><div class="metric"><b>${v.complete}</b><small>measured</small></div><div class="metric"><b>${v.outstanding}</b><small>outstanding</small></div><div class="metric"><b>${v.sourceRows}</b><small>source-backed</small></div><div class="metric"><b>${v.manualRows}</b><small>manual-added</small></div><div class="metric"><b>${dupeCount}</b><small>duplicate groups</small></div></div>
      <div class="${statusClass(v)}" style="margin-top:9px"><b>${statusWord(v)}</b> · Missing dimensions ${v.missingDims} · gross weight ${v.missingWeight} · area/Carton-Unit ${v.missingClass} · location ${v.missingLocation} · dimension unit ${v.missingDimUnit} · source changes ${v.sourceMismatch} · batch mismatches ${v.batchMismatch}.</div>
      <div class="sub" style="margin-top:8px"><b>Item # + Carton/Unit is treated as the stock-record identity.</b> The same Item # appearing once as Carton and once as Unit is valid and is not flagged as a duplicate. Source inventory files remain read-only.</div><h3 style="margin-top:12px">Import row-count proof</h3>${batchRows}`;
  }
  function render(){const box=$('bmSafetyResults');if(!box)return;const v=validation();box.innerHTML=detailsHtml(v);localStorage.setItem(VALIDATION_KEY,JSON.stringify(v))}
  function auditText(v){
    const lines=['BoxMeasure Export Audit','App version: '+VERSION,'Generated: '+v.generatedAt,'','SOURCE SAFETY','Imported source files are read-only. BoxMeasure does not modify the original CSV/JSON/Excel file.','Record identity: Item # + Carton/Unit. A Carton and Unit sharing an Item # are a valid pair.','','ROW COUNTS','Total output rows: '+v.total,'Source-backed rows: '+v.sourceRows,'Manual-added rows: '+v.manualRows,'Complete measurement rows: '+v.complete,'Outstanding rows: '+v.outstanding,'','VALIDATION','Missing dimensions: '+v.missingDims,'Missing gross weight: '+v.missingWeight,'Missing Dry/Chiller/Frozen or Carton/Unit: '+v.missingClass,'Missing location: '+v.missingLocation,'Dimensions with unspecified unit: '+v.missingDimUnit,'Duplicate Item # + Carton/Unit groups: '+v.skuDupes.length,'Duplicate barcode groups: '+v.barcodeDupes.length,'Source fingerprint mismatches: '+v.sourceMismatch,'Legacy source rows without fingerprint: '+v.sourceNoFingerprint,'Import batch row-count mismatches: '+v.batchMismatch,'','IMPORT BATCHES'];
    if(v.batches.length)v.batches.forEach(b=>lines.push(`${b.fileName||b.id}: expected ${b.rowCount}, present ${b.present}, ${b.ok?'MATCH':'MISMATCH'}`));else lines.push('No tracked import batches recorded.');
    lines.push('','RESULT: '+statusWord(v));if(v.hardFail)lines.push('Export should be stopped until the integrity mismatch is resolved.');else if(v.warnings)lines.push('Review warnings before treating the dataset as final.');else lines.push(`PASS: ${v.total} app rows will produce ${v.total} CSV data rows; no tracked source rows changed or disappeared.`);return lines.join('\r\n');
  }
  function saveAudit(){const v=validation();if(typeof exportText==='function')exportText(`BoxMeasure-audit-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`,'text/plain',auditText(v))}
  function preflight(kind){
    const v=validation();render();if(v.hardFail){alert('Export blocked: BoxMeasure found a source-integrity or imported-row-count mismatch. Open Export → Validation & integrity for details.');return false}
    if(kind==='master'&&v.outstanding>0&&!confirm(`This dataset is not finished: ${v.outstanding} of ${v.total} lines are still incomplete. Export the master CSV anyway?`))return false;
    if(kind==='master'&&(v.skuDupes.length||v.barcodeDupes.length)&&!confirm(`Validation found ${v.skuDupes.length} repeated Item # + Carton/Unit groups and ${v.barcodeDupes.length} duplicate barcode groups. Carton/Unit pairs are already excluded. Rows will NOT be dropped. Export anyway?`))return false;
    return true;
  }

  function installImportGuard(){
    if(typeof commitImport!=='function')return;
    commitImport=function(){
      if(!importRows||!importRows.length)return;const incomingCount=importRows.length;
      if(list().length&&!confirm(`BoxMeasure already contains ${list().length} lines. Importing this file will ADD ${incomingCount} more rows and will not replace the existing queue. Continue?`))return;
      const dz=$('defaultZone')?$('defaultZone').value:'',dp=$('defaultPack')?$('defaultPack').value:'',du=$('defaultDimUnit')?$('defaultDimUnit').value:'';
      const batchId='batch_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),fileName=(($('importStatus')&&$('importStatus').innerText)||'Inventory import').split(/\n/)[0].trim()||'Inventory import';
      const existingSkuPack=new Set(list().map(x=>String(x.sku||'').trim()?String(x.sku).trim().toLowerCase()+'|'+canonicalPack(x.packType).toLowerCase():'').filter(Boolean));
      const existingBarcode=new Set(list().map(x=>String(x.barcode||'').trim().toLowerCase()).filter(Boolean));
      let duplicateRows=0;const ids=[];
      importRows.forEach((r,idx)=>{
        const sku=val(r,'mapSku'),barcode=val(r,'mapBarcode'),pack=normalizePack(val(r,'mapPack'))||dp,skuPack=sku?sku.trim().toLowerCase()+'|'+canonicalPack(pack).toLowerCase():'',bk=barcode.trim().toLowerCase();
        const duplicate=(!!skuPack&&existingSkuPack.has(skuPack))||(!!bk&&existingBarcode.has(bk));if(duplicate)duplicateRows++;if(skuPack)existingSkuPack.add(skuPack);if(bk)existingBarcode.add(bk);
        const sourceRow=Object.fromEntries(importHeaders.map(h=>[h,r[h]??'']));
        const length=val(r,'mapLength'),width=val(r,'mapWidth'),height=val(r,'mapHeight'),hasDims=!!(String(length).trim()||String(width).trim()||String(height).trim());
        const it={id:uid(),sourceIndex:r.__sourceIndex||idx+1,sourceRow,sourceId:val(r,'mapId'),sku,barcode,description:val(r,'mapDescription'),location:val(r,'mapLocation'),zone:normalizeZone(val(r,'mapZone'))||dz,packType:pack,length,width,height,dimensionUnit:hasDims?du:'',weight:val(r,'mapGrossWeight'),netWeight:val(r,'mapNetWeight'),quantity:'',method:'manual',confidence:'Verified',notes:val(r,'mapNotes'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),measuredAt:'',importBatchId:batchId,sourceFingerprint:fingerprint(sourceRow),duplicateAtImport:duplicate};
        items.push(it);ids.push(it.id);
      });
      const batches=loadBatches();batches.push({id:batchId,fileName,rowCount:incomingCount,importedCount:ids.length,duplicateRows,dimensionUnit:du||'unspecified',importedAt:new Date().toISOString(),headers:[...importHeaders],itemIds:ids});saveBatches(batches);persist();
      if($('importStatus'))$('importStatus').textContent=`Imported ${ids.length}/${incomingCount} rows. ${duplicateRows} true duplicate candidates were preserved for review. Carton/Unit pairs were not treated as duplicates.`;
      importRows=[];importHeaders=[];if($('mappingBox'))$('mappingBox').classList.add('hide');alert(`Import complete: ${ids.length} of ${incomingCount} source rows preserved. ${duplicateRows} true duplicate candidates were kept for review. Carton/Unit pairs are valid.`);go('dashboard');
    };
  }
  function installExportGuards(){if(typeof exportMaster==='function'){const old=exportMaster;exportMaster=function(){if(preflight('master'))old()}}if(typeof exportCompleteOnly==='function'){const old=exportCompleteOnly;exportCompleteOnly=function(){if(preflight('measured'))old()}}if(typeof exportCheckpoint==='function'){const old=exportCheckpoint;exportCheckpoint=function(){if(preflight('checkpoint'))old()}}}
  function installUi(){
    const exp=$('export');if(exp&&!$('bmSafetyCard')){const card=document.createElement('div');card.className='card';card.id='bmSafetyCard';card.innerHTML='<h2>Validation & integrity</h2><div class="sub">Prove that imported rows were preserved before sending the finished CSV.</div><div id="bmSafetyResults" style="margin-top:9px"></div><div class="grid2" style="margin-top:9px"><button class="btn primary" id="bmRunValidation">RUN VALIDATION</button><button class="btn" id="bmSaveAudit">SAVE AUDIT REPORT</button></div>';exp.insertBefore(card,exp.firstChild);$('bmRunValidation').onclick=render;$('bmSaveAudit').onclick=saveAudit}
    const dash=$('dashboard');if(dash&&!$('bmSourceSafety')){const card=document.createElement('div');card.className='ok';card.id='bmSourceSafety';card.style.margin='9px 0';card.innerHTML='<b>SOURCE FILE SAFE</b><br>Inventory files are read only. Measurements are stored inside BoxMeasure and exports are always new files.';const progress=dash.querySelector('.card');if(progress)dash.insertBefore(card,progress.nextSibling);else dash.insertBefore(card,dash.firstChild)}render();
  }
  function install(){installImportGuard();installExportGuards();installUi();if(typeof go==='function'){const oldGo=go;go=function(id){oldGo(id);if(id==='export')render()}}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
