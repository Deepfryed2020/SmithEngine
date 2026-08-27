(function(){
  'use strict';
  const VERSION='1.2.2';
  const META_KEY='bm.importmeta.122';
  const VALIDATION_KEY='bm.validation.122';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;

  function list(){ try{return Array.isArray(items)?items:[]}catch(e){return[]} }
  function loadBatches(){try{return JSON.parse(localStorage.getItem(META_KEY)||'[]')}catch(e){return[]}}
  function saveBatches(v){localStorage.setItem(META_KEY,JSON.stringify(v))}
  function sourceObject(it){return it&&it.sourceRow&&typeof it.sourceRow==='object'?it.sourceRow:{}}
  function hasSource(it){return Object.keys(sourceObject(it)).length>0}
  function fingerprint(obj){
    const keys=Object.keys(obj||{}).sort();
    const text=keys.map(k=>k+'='+String(obj[k]??'')).join('\u001f');
    let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function duplicateGroups(arr,field){
    const map=new Map();
    arr.forEach(it=>{const value=String(it&&it[field]||'').trim();if(!value)return;const key=value.toLowerCase();if(!map.has(key))map.set(key,[]);map.get(key).push(it)});
    return [...map.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows}));
  }
  function validation(){
    const arr=list();
    let complete=0,missingDims=0,missingWeight=0,missingClass=0,sourceMismatch=0,sourceNoFingerprint=0;
    arr.forEach(it=>{
      const dims=n(it.length)>0&&n(it.width)>0&&n(it.height)>0;
      const wt=n(it.weight)>0;
      const cls=!!it.zone&&!!it.packType;
      if(dims&&wt&&cls)complete++;
      if(!dims)missingDims++;
      if(!wt)missingWeight++;
      if(!cls)missingClass++;
      if(hasSource(it)){
        if(it.sourceFingerprint){if(it.sourceFingerprint!==fingerprint(sourceObject(it)))sourceMismatch++}
        else sourceNoFingerprint++;
      }
    });
    const skuDupes=duplicateGroups(arr,'sku'),barcodeDupes=duplicateGroups(arr,'barcode');
    const batches=loadBatches();
    const batchChecks=batches.map(b=>{
      const present=arr.filter(x=>x.importBatchId===b.id).length;
      return {...b,present,ok:present===Number(b.rowCount||0)};
    });
    const batchMismatch=batchChecks.filter(x=>!x.ok).length;
    const sourceRows=arr.filter(hasSource).length;
    const manualRows=arr.length-sourceRows;
    const outstanding=arr.length-complete;
    const hardFail=sourceMismatch>0||batchMismatch>0;
    const warnings=outstanding>0||skuDupes.length>0||barcodeDupes.length>0||sourceNoFingerprint>0;
    return {total:arr.length,complete,outstanding,missingDims,missingWeight,missingClass,sourceRows,manualRows,sourceMismatch,sourceNoFingerprint,skuDupes,barcodeDupes,batches:batchChecks,batchMismatch,hardFail,warnings,generatedAt:new Date().toISOString()};
  }
  function statusWord(v){return v.hardFail?'FAIL':v.warnings?'CHECK':'PASS'}
  function statusClass(v){return v.hardFail?'warn':v.warnings?'warn':'ok'}
  function detailsHtml(v){
    const dupeCount=v.skuDupes.length+v.barcodeDupes.length;
    const batchRows=v.batches.length?v.batches.map(b=>`<div class="item"><b>${esc(b.fileName||b.id)}</b><div class="itemmeta">Expected ${b.rowCount} source rows · ${b.present} still present · ${b.ok?'MATCH':'MISMATCH'}</div></div>`).join(''):'<div class="status">No v1.2.2 import batch metadata yet. Existing 1.2.1 data is still usable.</div>';
    return `<div class="grid3">
      <div class="metric"><b>${v.total}</b><small>output rows</small></div>
      <div class="metric"><b>${v.complete}</b><small>complete</small></div>
      <div class="metric"><b>${v.outstanding}</b><small>outstanding</small></div>
      <div class="metric"><b>${v.sourceRows}</b><small>source-backed</small></div>
      <div class="metric"><b>${v.manualRows}</b><small>manual-added</small></div>
      <div class="metric"><b>${dupeCount}</b><small>duplicate groups</small></div>
    </div>
    <div class="${statusClass(v)}" style="margin-top:9px"><b>${statusWord(v)}</b> · Missing dimensions ${v.missingDims} · missing weight ${v.missingWeight} · missing area/type ${v.missingClass} · source changes ${v.sourceMismatch} · batch mismatches ${v.batchMismatch}.</div>
    <div class="sub" style="margin-top:8px">Source inventory files are opened read-only. BoxMeasure stores its own copy of each source row and exports to a new file; it never writes back to the imported CSV/JSON/Excel file.</div>
    <h3 style="margin-top:12px">Import row-count proof</h3>${batchRows}`;
  }
  function render(){
    const box=$('bmSafetyResults');if(!box)return;
    const v=validation();box.innerHTML=detailsHtml(v);
    localStorage.setItem(VALIDATION_KEY,JSON.stringify(v));
  }
  function auditText(v){
    const lines=[];
    lines.push('BoxMeasure Export Audit');
    lines.push('App version: '+VERSION);
    lines.push('Generated: '+v.generatedAt);
    lines.push('');
    lines.push('SOURCE SAFETY');
    lines.push('Imported source files are read-only. BoxMeasure does not modify the original CSV/JSON/Excel file.');
    lines.push('');
    lines.push('ROW COUNTS');
    lines.push('Total output rows: '+v.total);
    lines.push('Source-backed rows: '+v.sourceRows);
    lines.push('Manual-added rows: '+v.manualRows);
    lines.push('Complete rows: '+v.complete);
    lines.push('Outstanding rows: '+v.outstanding);
    lines.push('');
    lines.push('VALIDATION');
    lines.push('Missing dimensions: '+v.missingDims);
    lines.push('Missing weight: '+v.missingWeight);
    lines.push('Missing Dry/Chiller/Frozen or Box/Unit Qty: '+v.missingClass);
    lines.push('Duplicate SKU groups: '+v.skuDupes.length);
    lines.push('Duplicate barcode groups: '+v.barcodeDupes.length);
    lines.push('Source fingerprint mismatches: '+v.sourceMismatch);
    lines.push('Legacy source rows without fingerprint: '+v.sourceNoFingerprint);
    lines.push('Import batch row-count mismatches: '+v.batchMismatch);
    lines.push('');
    lines.push('IMPORT BATCHES');
    if(v.batches.length)v.batches.forEach(b=>lines.push(`${b.fileName||b.id}: expected ${b.rowCount}, present ${b.present}, ${b.ok?'MATCH':'MISMATCH'}`));
    else lines.push('No v1.2.2 import batches recorded.');
    lines.push('');
    lines.push('RESULT: '+statusWord(v));
    if(v.hardFail)lines.push('Export should be stopped until source integrity/batch mismatch is resolved.');
    else if(v.warnings)lines.push('Review warnings before treating the dataset as final.');
    else lines.push(`PASS: ${v.total} app rows will produce ${v.total} CSV data rows; no tracked source rows changed or disappeared.`);
    return lines.join('\r\n');
  }
  function saveAudit(){
    const v=validation();
    if(typeof exportText==='function')exportText(`BoxMeasure-audit-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`,'text/plain',auditText(v));
  }
  function preflight(kind){
    const v=validation();render();
    if(v.hardFail){alert('Export blocked: BoxMeasure found a source-integrity or imported-row-count mismatch. Open Export → Validation & integrity for details.');return false}
    if(kind==='master'&&v.outstanding>0){return confirm(`This dataset is not finished: ${v.outstanding} of ${v.total} lines are still incomplete. Export the master CSV anyway?`)}
    if(kind==='master'&&(v.skuDupes.length||v.barcodeDupes.length)){return confirm(`Validation found ${v.skuDupes.length+v.barcodeDupes.length} duplicate SKU/barcode groups. The rows will NOT be dropped. Export anyway?`)}
    return true;
  }

  function installImportGuard(){
    if(typeof commitImport!=='function')return;
    commitImport=function(){
      if(!importRows||!importRows.length)return;
      const incomingCount=importRows.length;
      if(list().length&&!confirm(`BoxMeasure already contains ${list().length} lines. Importing this file will ADD ${incomingCount} more rows and will not replace the existing queue. Continue?`))return;
      const dz=$('defaultZone').value,dp=$('defaultPack').value;
      const batchId='batch_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      const fileName=(($('importStatus')&&$('importStatus').innerText)||'Inventory import').split(/\n/)[0].trim()||'Inventory import';
      const existingSku=new Set(list().map(x=>String(x.sku||'').trim().toLowerCase()).filter(Boolean));
      const existingBarcode=new Set(list().map(x=>String(x.barcode||'').trim().toLowerCase()).filter(Boolean));
      let duplicateRows=0;const ids=[];
      importRows.forEach((r,idx)=>{
        const sku=mapped(r,'mapSku'),barcode=mapped(r,'mapBarcode');
        const sk=sku.toLowerCase(),bk=barcode.toLowerCase();
        const duplicate=(!!sk&&existingSku.has(sk))||(!!bk&&existingBarcode.has(bk));
        if(duplicate)duplicateRows++;
        if(sk)existingSku.add(sk);if(bk)existingBarcode.add(bk);
        const sourceRow=Object.fromEntries(importHeaders.map(h=>[h,r[h]??'']));
        const it={id:uid(),sourceIndex:r.__sourceIndex||idx+1,sourceRow,sourceId:mapped(r,'mapId'),sku,barcode,description:mapped(r,'mapDescription'),zone:normalizeZone(mapped(r,'mapZone'))||dz,packType:normalizePack(mapped(r,'mapPack'))||dp,length:'',width:'',height:'',weight:'',quantity:'',method:'manual',confidence:'Verified',notes:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),measuredAt:'',importBatchId:batchId,sourceFingerprint:fingerprint(sourceRow),duplicateAtImport:duplicate};
        items.push(it);ids.push(it.id);
      });
      const batches=loadBatches();
      batches.push({id:batchId,fileName,rowCount:incomingCount,importedCount:ids.length,duplicateRows,importedAt:new Date().toISOString(),headers:[...importHeaders],itemIds:ids});
      saveBatches(batches);
      persist();
      if($('importStatus'))$('importStatus').textContent=`Imported ${ids.length}/${incomingCount} rows. ${duplicateRows} possible duplicate rows were preserved and flagged — none were dropped.`;
      importRows=[];importHeaders=[];if($('mappingBox'))$('mappingBox').classList.add('hide');
      alert(`Import complete: ${ids.length} of ${incomingCount} source rows preserved. ${duplicateRows} possible duplicates were kept for review.`);
      go('dashboard');
    };
  }
  function installExportGuards(){
    if(typeof exportMaster==='function'){
      const old=exportMaster;exportMaster=function(){if(preflight('master'))old()};
    }
    if(typeof exportCompleteOnly==='function'){
      const old=exportCompleteOnly;exportCompleteOnly=function(){if(preflight('measured'))old()};
    }
    if(typeof exportCheckpoint==='function'){
      const old=exportCheckpoint;exportCheckpoint=function(){if(preflight('checkpoint'))old()};
    }
  }
  function installUi(){
    const headerSub=document.querySelector('header .sub');if(headerSub)headerSub.textContent='Warehouse Measurement Queue '+VERSION;
    const exp=$('export');
    if(exp&&!$('bmSafetyCard')){
      const card=document.createElement('div');card.className='card';card.id='bmSafetyCard';
      card.innerHTML='<h2>Validation & integrity</h2><div class="sub">Prove that imported rows were preserved before sending the finished CSV.</div><div id="bmSafetyResults" style="margin-top:9px"></div><div class="grid2" style="margin-top:9px"><button class="btn primary" id="bmRunValidation">RUN VALIDATION</button><button class="btn" id="bmSaveAudit">SAVE AUDIT REPORT</button></div>';
      exp.insertBefore(card,exp.firstChild);
      $('bmRunValidation').onclick=render;$('bmSaveAudit').onclick=saveAudit;
    }
    const dash=$('dashboard');
    if(dash&&!$('bmSourceSafety')){
      const card=document.createElement('div');card.className='ok';card.id='bmSourceSafety';card.style.margin='9px 0';
      card.innerHTML='<b>SOURCE FILE SAFE</b><br>Inventory files are read only. Measurements are stored inside BoxMeasure and exports are always new files.';
      const progress=dash.querySelector('.card');if(progress)dash.insertBefore(card,progress.nextSibling);else dash.insertBefore(card,dash.firstChild);
    }
    render();
  }
  function install(){
    installImportGuard();installExportGuards();installUi();
    if(typeof go==='function'){
      const oldGo=go;go=function(id){oldGo(id);if(id==='export')render()};
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
