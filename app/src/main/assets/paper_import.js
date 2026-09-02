/* BoxMeasure v1.3.8 Paper Sheet Import */
const PAPER_ROLLBACK_KEY='bm.paper.lastRollback.138';
let paperPages=[];
let paperRows=[];
let paperCurrentImage='';

function paperNormLocation(v){
  const parts=String(v||'').toLowerCase().match(/[a-z]+|\d+/g)||[];
  return parts.map(x=>/^\d+$/.test(x)?String(Number(x)):x).join('');
}
function paperKey(r){return `${String(r.sku||'').replace(/^0+/,'')}|${paperNormLocation(r.location)}|${paperLevel(r)}`}
function paperLevel(r){return /unit/i.test(r.packageLevel||r.packType||'')?'unit':'carton'}
function paperEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function paperNum(v){const x=String(v??'').trim().replace(',','.');return /^\d+(?:\.\d+)?$/.test(x)?x:''}
function paperRowReady(r){return !!(r.location&&r.sku&&paperNum(r.grossWeightKg)&&paperNum(r.lengthCm)&&paperNum(r.widthCm)&&paperNum(r.heightCm))}
function paperConfidence(r){return Number(r.confidence||0)}

document.getElementById('paperPhoto')?.addEventListener('change',event=>{
  const file=event.target.files&&event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>paperStartRecognition(String(reader.result||''),file.name||`page-${paperPages.length+1}.jpg`);
  reader.readAsDataURL(file);
});

function paperStartRecognition(dataUrl,name){
  paperCurrentImage=dataUrl;
  $('paperImage').src=dataUrl;$('paperPreview').classList.remove('hide');
  $('paperRows').innerHTML='';$('paperActions').classList.add('hide');$('paperSummary').classList.add('hide');
  $('paperProgress').classList.remove('hide');$('paperProgress').querySelector('span').style.width='18%';
  $('paperStatus').textContent='Straightening sheet and reading printed and handwritten cells…';
  try{
    if(window.AndroidOcr&&AndroidOcr.recognizePaper){AndroidOcr.recognizePaper(dataUrl,name);return}
  }catch(error){paperOcrFailed(String(error))}
  paperOcrFailed('On-device OCR bridge is unavailable in this build.');
}

function paperOcrProgress(percent,message){
  $('paperProgress').classList.remove('hide');
  $('paperProgress').querySelector('span').style.width=`${Math.max(0,Math.min(100,Number(percent)||0))}%`;
  if(message)$('paperStatus').textContent=message;
}
function paperOcrFailed(message){
  $('paperProgress').classList.add('hide');
  $('paperStatus').innerHTML=`<span style="color:var(--red)">Could not read this sheet:</span> ${paperEsc(message)} Try brighter, flatter framing or choose the photo again.`;
}
function paperOcrComplete(payload){
  let result;try{result=typeof payload==='string'?JSON.parse(payload):payload}catch(e){return paperOcrFailed('OCR returned invalid data')}
  paperRows=(result.rows||[]).map((r,index)=>({
    rowNumber:r.rowNumber||index+1,location:String(r.location||'').trim(),sku:String(r.sku||'').trim(),
    description:String(r.description||'').trim(),packageLevel:/unit/i.test(r.packageLevel||'')?'Unit':'Carton',
    grossWeightKg:paperNum(r.grossWeightKg),lengthCm:paperNum(r.lengthCm),widthCm:paperNum(r.widthCm),heightCm:paperNum(r.heightCm),
    netWeight:String(r.netWeight||'').trim(),notes:String(r.notes||'').trim(),confidence:Number(r.confidence||0),
    cellConfidence:r.cellConfidence||{},sourcePhoto:result.sourceName||''
  }));
  paperPages.push({sourceName:result.sourceName||'',capturedAt:new Date().toISOString(),rowCount:paperRows.length});
  paperOcrProgress(100,`Read ${paperRows.length} table rows. Review highlighted cells, then approve the page.`);
  setTimeout(()=>$('paperProgress').classList.add('hide'),500);
  paperRenderRows();
}

function paperCellClass(row,field){
  const score=Number((row.cellConfidence||{})[field]??row.confidence??0);
  return score<0.65?'paper-low':'';
}
function paperRenderRows(){
  const existing=new Set(items.map(paperKey));let ready=0,review=0,blank=0;
  const html=paperRows.map((r,index)=>{
    const duplicate=existing.has(paperKey(r));const complete=paperRowReady(r);
    if(!r.grossWeightKg&&!r.lengthCm&&!r.widthCm&&!r.heightCm)blank++;else if(complete&&paperConfidence(r)>=.65&&!duplicate)ready++;else review++;
    return `<div class="item ${complete&&!duplicate?'':'selected'}" data-paper-row="${index}">
      <div class="itemtop"><div class="grow"><div class="itemtitle">Row ${paperEsc(r.rowNumber)} · ${paperEsc(r.description||'Unrecognised description')}</div>
      <div class="itemmeta">${duplicate?'Already present — skipped on approval':complete?'Ready to import':'Check highlighted or missing cells'}</div></div>
      <span class="pill ${duplicate?'partial':complete?'done':'bad'}">${duplicate?'DUPLICATE':complete?'READY':'REVIEW'}</span></div>
      <div class="grid3">
       <div><label>Location</label><input class="field ${paperCellClass(r,'location')}" value="${paperEsc(r.location)}" oninput="paperEdit(${index},'location',this.value)"></div>
       <div><label>SKU</label><input class="field ${paperCellClass(r,'sku')}" value="${paperEsc(r.sku)}" oninput="paperEdit(${index},'sku',this.value)"></div>
       <div><label>Level</label><select class="field" onchange="paperEdit(${index},'packageLevel',this.value)"><option ${r.packageLevel==='Carton'?'selected':''}>Carton</option><option ${r.packageLevel==='Unit'?'selected':''}>Unit</option></select></div>
      </div>
      <div class="grid3">
       <div><label>Gross kg</label><input inputmode="decimal" class="field ${paperCellClass(r,'grossWeightKg')}" value="${paperEsc(r.grossWeightKg)}" oninput="paperEdit(${index},'grossWeightKg',this.value)"></div>
       <div><label>Length cm</label><input inputmode="decimal" class="field ${paperCellClass(r,'lengthCm')}" value="${paperEsc(r.lengthCm)}" oninput="paperEdit(${index},'lengthCm',this.value)"></div>
       <div><label>Width cm</label><input inputmode="decimal" class="field ${paperCellClass(r,'widthCm')}" value="${paperEsc(r.widthCm)}" oninput="paperEdit(${index},'widthCm',this.value)"></div>
      </div>
      <div class="grid3"><div><label>Height cm</label><input inputmode="decimal" class="field ${paperCellClass(r,'heightCm')}" value="${paperEsc(r.heightCm)}" oninput="paperEdit(${index},'heightCm',this.value)"></div>
      <div style="grid-column:span 2"><label>Net / pack notation</label><input class="field" value="${paperEsc(r.netWeight)}" oninput="paperEdit(${index},'netWeight',this.value)"></div></div>
    </div>`;
  }).join('');
  $('paperRows').innerHTML=html||'<div class="empty">No table rows were detected.</div>';
  $('paperReady').textContent=ready;$('paperReview').textContent=review;$('paperBlank').textContent=blank;
  $('paperSummary').classList.remove('hide');$('paperActions').classList.toggle('hide',!paperRows.length);
}
function paperEdit(index,field,value){paperRows[index][field]=value;paperRows[index].confidence=1;(paperRows[index].cellConfidence||{})[field]=1;paperRenderRows()}
function paperAddAnother(){$('paperPhoto').value='';$('paperPhoto').click()}

function paperApprovePage(){
  const before=JSON.stringify({createdAt:new Date().toISOString(),items});
  const existing=new Set(items.map(paperKey));let added=0,duplicates=0,incomplete=0;
  paperRows.forEach((r,index)=>{
    if(!paperRowReady(r)){incomplete++;return}const k=paperKey(r);if(existing.has(k)){duplicates++;return}existing.add(k);
    const now=new Date().toISOString(),isUnit=paperLevel(r)==='unit';
    items.push({id:uid(),sourceIndex:r.rowNumber||index+1,sourceRow:{sourcePhoto:r.sourcePhoto},sourceId:r.sourcePhoto||'',sku:r.sku,barcode:'',description:r.description,zone:'Frozen',packType:isUnit?'Unit':'Carton',length:r.lengthCm,width:r.widthCm,height:r.heightCm,weight:r.grossWeightKg,quantity:'1',method:'paper-sheet-ocr',confidence:r.confidence>=.65?'Verified':'Review',notes:r.notes||'',createdAt:now,updatedAt:now,measuredAt:now,photoMeta:{product:false,unit:isUnit,box:!isUnit},dimensionUnit:'cm',location:r.location,netWeight:r.netWeight,packageLevel:isUnit?'Unit':'Carton',unitWeightKg:isUnit?r.grossWeightKg:'',unitNetWeightKg:isUnit?r.netWeight:'',grossWeightSource:'paper-ocr',unitWeightSource:isUnit?'paper-ocr':'',weightVerification:r.confidence>=.65?'Verified':'Review',unitWeightSamples:'1',containsLevel:isUnit?'':'Unit',parentBarcode:'',childBarcode:'',packBreakdown:r.netWeight||''});added++;
  });
  localStorage.setItem(PAPER_ROLLBACK_KEY,before);persist();renderDashboard();renderQueue();renderExportStats();
  $('paperStatus').textContent=`Imported ${added} rows; skipped ${duplicates} duplicates and ${incomplete} incomplete rows. A one-step rollback is available in Settings.`;
  paperRows=[];$('paperRows').innerHTML='';$('paperActions').classList.add('hide');$('paperSummary').classList.add('hide');
}
function paperRollbackLastImport(){
  const raw=localStorage.getItem(PAPER_ROLLBACK_KEY);if(!raw)return alert('No paper import is available to roll back.');
  if(!confirm('Restore the data snapshot from immediately before the last approved paper page?'))return;
  try{const snapshot=JSON.parse(raw);items=snapshot.items||[];persist();localStorage.removeItem(PAPER_ROLLBACK_KEY);renderDashboard();renderQueue();renderExportStats();alert('Last paper import rolled back.')}catch(e){alert('Rollback snapshot is damaged.')}
}
function paperExportReview(){exportText(`BoxMeasure-paper-review-${stamp()}.json`,'application/json',JSON.stringify({schema:'boxmeasure.paper-review.v1',createdAt:new Date().toISOString(),pages:paperPages,rows:paperRows},null,2))}

const paperStyle=document.createElement('style');paperStyle.textContent='.paper-low{border-color:var(--warn)!important;background:#3a2a0d!important}.paper-low:focus{outline:2px solid var(--warn)}';document.head.appendChild(paperStyle);
window.paperOcrProgress=paperOcrProgress;window.paperOcrComplete=paperOcrComplete;window.paperOcrFailed=paperOcrFailed;
