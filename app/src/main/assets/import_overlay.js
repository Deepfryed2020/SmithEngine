(function(){
  'use strict';
  const qs=id=>document.getElementById(id);
  function escHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
  function extOf(name){const n=String(name||'').toLowerCase();const i=n.lastIndexOf('.');return i>=0?n.slice(i):'';}
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(window.XLSX) return resolve();
      const old=document.querySelector('script[data-bm-xlsx]');
      if(old){old.addEventListener('load',()=>resolve(),{once:true});old.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');s.src=src;s.dataset.bmXlsx='1';s.onload=resolve;s.onerror=()=>reject(new Error('Excel reader could not be loaded'));document.head.appendChild(s);
    });
  }
  function flatten(obj,prefix='',out={}){
    if(obj===null||obj===undefined){if(prefix)out[prefix]='';return out;}
    if(Array.isArray(obj)){out[prefix||'value']=obj.map(x=>typeof x==='object'?JSON.stringify(x):x).join(' | ');return out;}
    if(typeof obj!=='object'){out[prefix||'value']=obj;return out;}
    Object.keys(obj).forEach(k=>{
      const key=prefix?prefix+'.'+k:k,v=obj[k];
      if(v&&typeof v==='object'&&!Array.isArray(v)) flatten(v,key,out);
      else out[key]=Array.isArray(v)?v.map(x=>typeof x==='object'?JSON.stringify(x):x).join(' | '):(v??'');
    });
    return out;
  }
  function rowsFromObjects(arr){
    const objects=arr.filter(x=>x!==null&&x!==undefined).map(x=>typeof x==='object'&&!Array.isArray(x)?flatten(x):{value:x});
    const headers=[],seen=new Set();
    objects.forEach(o=>Object.keys(o).forEach(k=>{if(!seen.has(k)){seen.add(k);headers.push(k);}}));
    const rows=objects.map((o,i)=>{const r={};headers.forEach(h=>r[h]=o[h]??'');r.__sourceIndex=i+1;return r;});
    return {headers,rows};
  }
  function parseJsonInventory(text){
    const data=JSON.parse(String(text||'').replace(/^\uFEFF/,''));
    let arr=null;
    if(Array.isArray(data)) arr=data;
    else if(data&&typeof data==='object'){
      for(const k of ['inventory','items','rows','data','products','stock','records']){if(Array.isArray(data[k])){arr=data[k];break;}}
    }
    if(!arr) throw new Error('JSON must contain an array, or an inventory/items/rows/data/products array.');
    return rowsFromObjects(arr);
  }
  async function parseExcel(file){
    await loadScript('file:///android_asset/xlsx.full.min.js');
    if(!window.XLSX) throw new Error('Excel reader is unavailable.');
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array',cellDates:false});
    if(!wb.SheetNames||!wb.SheetNames.length) throw new Error('Workbook contains no worksheets.');
    const ws=wb.Sheets[wb.SheetNames[0]];
    const arr=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false,blankrows:false});
    if(!arr.length) throw new Error('First worksheet has no data rows.');
    const parsed=rowsFromObjects(arr);parsed.sheetName=wb.SheetNames[0];return parsed;
  }
  async function parseAny(file){
    const ext=extOf(file.name),type=String(file.type||'').toLowerCase();
    if(ext==='.xlsx'||ext==='.xls'||type.includes('spreadsheet')||type.includes('excel')) return await parseExcel(file);
    if(ext==='.json'||type.includes('json')) return parseJsonInventory(await file.text());
    if(ext==='.csv'||ext==='.tsv'||ext==='.txt'||type.includes('csv')||type.startsWith('text/')){
      if(typeof parseCSV!=='function') throw new Error('CSV parser unavailable.');
      return parseCSV(await file.text());
    }
    throw new Error('Unsupported file type. Use CSV, JSON, XLSX or XLS.');
  }
  async function handleFile(file){
    if(!file)return;
    try{
      go('import');
      const st=qs('importStatus');if(st)st.textContent='Reading '+file.name+'…';
      const parsed=await parseAny(file);
      if(!parsed.headers||!parsed.headers.length||!parsed.rows||!parsed.rows.length) throw new Error('No inventory rows found.');
      importHeaders=parsed.headers;importRows=parsed.rows;
      setupMapping();
      const mb=qs('mappingBox');if(mb)mb.classList.remove('hide');
      if(st)st.innerHTML=`<b>${escHtml(file.name)}</b><br>Loaded ${parsed.rows.length} rows${parsed.sheetName?` from worksheet <b>${escHtml(parsed.sheetName)}</b>`:''}. Map the columns below, then tap <b>IMPORT INTO WORK QUEUE</b>.`;
    }catch(err){
      const st=qs('importStatus');if(st)st.textContent='Import failed: '+(err&&err.message?err.message:String(err));
      const mb=qs('mappingBox');if(mb)mb.classList.add('hide');
    }finally{
      const inp=qs('bmUniversalImport');if(inp)inp.value='';
    }
  }
  function loadSafety(){
    if(document.getElementById('bm-safety-overlay-script'))return;
    const s=document.createElement('script');s.id='bm-safety-overlay-script';s.src='file:///android_asset/safety_overlay.js';document.head.appendChild(s);
  }
  function install(){
    if(qs('bmUniversalImport')){loadSafety();return;}
    const inp=document.createElement('input');
    inp.id='bmUniversalImport';inp.type='file';
    inp.accept='.csv,.tsv,.txt,.json,.xlsx,.xls,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    inp.style.display='none';inp.addEventListener('change',e=>handleFile(e.target.files&&e.target.files[0]));document.body.appendChild(inp);

    const dashboard=qs('dashboard');
    if(dashboard){
      const card=document.createElement('div');card.className='card';card.id='bmImportHero';
      card.innerHTML='<h2>Load your inventory first</h2><div class="sub">CSV · JSON · Excel (.xlsx/.xls). Import the stock list, map its columns once, then work through Dry / Chiller / Frozen.</div><button class="btn primary" id="bmHeroImport" style="width:100%;min-height:58px;margin-top:10px;font-size:17px">IMPORT INVENTORY FILE</button>';
      dashboard.insertBefore(card,dashboard.firstChild);
      qs('bmHeroImport').addEventListener('click',()=>inp.click());
    }

    const imp=qs('import');
    if(imp){
      const firstCard=imp.querySelector('.card');
      if(firstCard){
        const title=firstCard.querySelector('h2');if(title)title.textContent='Import inventory file';
        const sub=firstCard.querySelector('.sub');if(sub)sub.textContent='Load CSV, JSON, XLSX or XLS. Nothing is committed until you map the columns and confirm the import.';
        const oldLabel=firstCard.querySelector('label[for="inventoryFile"]');
        if(oldLabel){oldLabel.removeAttribute('for');oldLabel.textContent='CHOOSE CSV / JSON / EXCEL FILE';oldLabel.style.cursor='pointer';oldLabel.onclick=()=>inp.click();}
        const oldInput=qs('inventoryFile');if(oldInput)oldInput.disabled=true;
      }
    }

    const navin=document.querySelector('.navin');
    if(navin&&!navin.querySelector('[data-page="import"]')){
      navin.style.gridTemplateColumns='repeat(6,1fr)';
      const b=document.createElement('button');b.className='nav';b.dataset.page='import';b.textContent='IMPORT';b.onclick=()=>go('import');
      const exportBtn=navin.querySelector('[data-page="export"]');navin.insertBefore(b,exportBtn||null);
    }
    loadSafety();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
