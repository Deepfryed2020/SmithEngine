(function(){
  'use strict';
  const VERSION='1.3.0';
  const DB_NAME='boxmeasure.media.v1';
  const STORE='photos';
  const ROLES=['product','unit','box'];
  let installed=false;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=s=>esc(s).replace(/`/g,'&#96;');
  const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
  const roleLabel=r=>r==='product'?'Product':r==='unit'?'Unit':'Box';

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Photo database unavailable'));
    });
  }
  async function photoPut(itemId,role,dataUrl){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(dataUrl,itemId+':'+role);
      tx.oncomplete=()=>{db.close();resolve(true)};
      tx.onerror=()=>{db.close();reject(tx.error||new Error('Photo save failed'))};
    });
  }
  async function photoGet(itemId,role){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(itemId+':'+role);
      req.onsuccess=()=>{const v=req.result||'';db.close();resolve(v)};
      req.onerror=()=>{db.close();reject(req.error||new Error('Photo read failed'))};
    });
  }
  async function photoDelete(itemId,role){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(itemId+':'+role);
      tx.oncomplete=()=>{db.close();resolve(true)};
      tx.onerror=()=>{db.close();reject(tx.error||new Error('Photo delete failed'))};
    });
  }

  function compressImage(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Could not read image'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('Could not decode image'));
        img.onload=()=>{
          const max=720,scale=Math.min(1,max/Math.max(img.width,img.height));
          const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg',0.7));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function ensureMeta(it){
    if(!it)return {product:false,unit:false,box:false};
    if(!it.photoMeta||typeof it.photoMeta!=='object')it.photoMeta={product:false,unit:false,box:false};
    ROLES.forEach(r=>{if(typeof it.photoMeta[r]!=='boolean')it.photoMeta[r]=false});
    return it.photoMeta;
  }
  function syncPhotoMeta(role,present){
    if(!window.draft)return;
    const meta=ensureMeta(draft);meta[role]=!!present;
    draft.photoMeta=meta;draft.updatedAt=new Date().toISOString();
    if(Array.isArray(window.items)){
      const ix=items.findIndex(x=>x.id===draft.id);
      if(ix>=0){items[ix].photoMeta=JSON.parse(JSON.stringify(meta));items[ix].updatedAt=draft.updatedAt;}
    }
    if(typeof persist==='function')persist();
  }
  function mediaCount(it){const m=ensureMeta(it);return ROLES.filter(r=>m[r]).length}
  function requiredMissing(it){
    const miss=[];
    if(!(n(it.length)>0&&n(it.width)>0&&n(it.height)>0))miss.push('dimensions');
    if(!(n(it.weight)>0))miss.push('weight');
    if(!it.zone)miss.push('area');
    if(!it.packType)miss.push('type');
    return miss;
  }
  function measurementStatus(it){
    const dims=n(it.length)>0&&n(it.width)>0&&n(it.height)>0;
    const wt=n(it.weight)>0;
    if(dims&&wt&&it.zone&&it.packType)return 'complete';
    if(dims||wt)return 'partial';
    return 'unmeasured';
  }
  function zoneClass(z){return z==='Dry'?'dry':z==='Chiller'?'chiller':z==='Frozen'?'frozen':'unassigned'}
  function photoBadges(it){
    const m=ensureMeta(it),out=[];
    if(m.product)out.push('<span class="bmMediaBadge on">PRODUCT PHOTO</span>');
    if(m.unit)out.push('<span class="bmMediaBadge on">UNIT PHOTO</span>');
    if(m.box)out.push('<span class="bmMediaBadge on">BOX PHOTO</span>');
    if(!out.length)out.push('<span class="bmMediaBadge">NO PHOTO</span>');
    return out.join('');
  }

  function injectStyles(){
    if($('bmUltimateStyles'))return;
    const style=document.createElement('style');style.id='bmUltimateStyles';style.textContent=`
      :root{--bm-shadow:0 12px 34px rgba(0,0,0,.22);--bm-soft:#0b1929;--bm-soft2:#0f2237}
      body{background:radial-gradient(circle at 50% -20%,#16314e 0,#07111f 36%,#050c16 100%);letter-spacing:.01em}
      .app{padding-top:4px}.card{box-shadow:var(--bm-shadow);border-color:#31516e;background:linear-gradient(180deg,#122b45 0,#0c1b2c 100%)}
      header{padding:10px 4px 14px;background:linear-gradient(180deg,#07111ff8,#07111fee);border-bottom:1px solid #18324a}header h1{font-size:27px;letter-spacing:-.03em}
      .tag{background:#0d2a2a;border-color:#43c9a277;box-shadow:0 0 24px #43c9a219 inset}
      .btn{border:1px solid #ffffff10;box-shadow:0 6px 18px #00000020}.btn:active{transform:translateY(1px)}
      .field{background:#06111d;border-color:#335570;box-shadow:inset 0 1px 0 #ffffff06}.field:focus{outline:2px solid #2f8cff55;border-color:#4b9cff}
      .zone{box-shadow:inset 0 1px 0 #ffffff08,0 8px 22px #0002}.zone:nth-child(1){border-color:#94733e}.zone:nth-child(2){border-color:#3e7594}.zone:nth-child(3){border-color:#5d65a5}
      .bmQueueCard{position:relative;display:grid;grid-template-columns:82px minmax(0,1fr);gap:12px;padding:11px;border-radius:15px;overflow:hidden;transition:.12s ease;background:linear-gradient(180deg,#0c1d2f,#081725);box-shadow:0 8px 24px #0002}
      .bmQueueCard:active{transform:scale(.992)}.bmQueueCard.bm-zone-dry{border-left:4px solid #b58a45}.bmQueueCard.bm-zone-chiller{border-left:4px solid #4ba3cf}.bmQueueCard.bm-zone-frozen{border-left:4px solid #7a83da}.bmQueueCard.bm-zone-unassigned{border-left:4px solid #ffca63}
      .bmThumb{width:82px;height:82px;border-radius:12px;border:1px solid #31516e;background:linear-gradient(145deg,#112b42,#081522);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#68839b;font-size:10px;text-align:center;padding:5px}.bmThumb img{width:100%;height:100%;object-fit:cover}.bmThumb.has{border-color:#4e7797}
      .bmCardTop{display:flex;gap:8px;align-items:flex-start}.bmCardTitle{font-weight:900;font-size:16px;line-height:1.18;letter-spacing:-.01em}.bmCardMeta{font-size:11px;color:#a8bdd0;margin-top:5px;line-height:1.4}.bmMissing{font-size:10px;color:#ffdda0;margin-top:6px}.bmReady{color:#8df0cd}
      .bmStatus{font-size:9px;font-weight:900;border-radius:99px;padding:4px 7px;border:1px solid #526b81;white-space:nowrap}.bmStatus.complete{color:#8df0cd;border-color:#347a65;background:#13352d}.bmStatus.partial{color:#ffe09c;border-color:#8d7337;background:#352d18}.bmStatus.unmeasured{color:#bed0e0;border-color:#3e5e79;background:#102235}
      .bmMediaBadges{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}.bmMediaBadge{font-size:8px;border:1px dashed #526b81;border-radius:99px;padding:3px 6px;color:#7f98ad}.bmMediaBadge.on{border-style:solid;border-color:#347a65;color:#8df0cd}
      .bmPhotoSection{margin-top:13px;padding:13px;border-radius:15px;border:1px solid #31516e;background:linear-gradient(180deg,#10253a,#091825)}.bmPhotoTitle{display:flex;align-items:flex-start;gap:8px}.bmPhotoTitle h3{font-size:17px}.bmPhotoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.bmPhotoTile{background:#071522;border:1px solid #294963;border-radius:12px;padding:7px}.bmPhotoTile.emphasis{border-color:#549ad0;box-shadow:0 0 0 1px #549ad033 inset}.bmPhotoLabel{font-size:10px;font-weight:900;letter-spacing:.04em;color:#c9d9e7;margin-bottom:5px}.bmPhotoPreview{aspect-ratio:1/1;border-radius:9px;background:#0c2133;border:1px dashed #385972;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#7891a7;font-size:9px;text-align:center;padding:4px}.bmPhotoPreview img{width:100%;height:100%;object-fit:cover}.bmPhotoActions{display:grid;gap:5px;margin-top:6px}.bmPhotoActions .btn{min-height:35px;padding:6px 5px;font-size:9px}.bmPhotoActions .two{display:grid;grid-template-columns:1fr 1fr;gap:4px}
      .bmOpsCard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.bmOpsMetric{background:#071522;border:1px solid #294963;border-radius:11px;padding:10px;text-align:center}.bmOpsMetric b{display:block;font-size:21px}.bmOpsMetric small{font-size:9px;color:#8fa7ba}
      .bmNoticeBackdrop{position:fixed;inset:0;z-index:200;background:#0009;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(5px)}.bmNotice{width:min(480px,100%);background:linear-gradient(180deg,#142b42,#0a1725);border:1px solid #3c6482;border-radius:18px;box-shadow:0 24px 80px #0009;padding:18px}.bmNotice h3{font-size:19px;margin:0 0 8px}.bmNotice p{white-space:pre-wrap;color:#c2d2e0;line-height:1.5;font-size:13px}.bmNotice .btn{width:100%;margin-top:10px}
      .bmPhotoNote{font-size:10px;color:#8fa7ba;line-height:1.4;margin-top:6px}
      @media(max-width:520px){.bmQueueCard{grid-template-columns:68px minmax(0,1fr);gap:9px}.bmThumb{width:68px;height:68px}.bmPhotoGrid{grid-template-columns:1fr}.bmPhotoTile{display:grid;grid-template-columns:86px 1fr;gap:8px}.bmPhotoLabel{grid-column:1/-1}.bmPhotoPreview{width:86px;height:86px;aspect-ratio:auto}.bmPhotoActions{margin-top:0}.bmOpsCard{grid-template-columns:repeat(3,1fr)}}
    `;document.head.appendChild(style);
  }

  function showNotice(message,title='BoxMeasure'){
    const old=$('bmNoticeBackdrop');if(old)old.remove();
    const d=document.createElement('div');d.className='bmNoticeBackdrop';d.id='bmNoticeBackdrop';
    d.innerHTML=`<div class="bmNotice"><h3>${esc(title)}</h3><p>${esc(message)}</p><button class="btn primary" id="bmNoticeOk">OK</button></div>`;
    document.body.appendChild(d);$('bmNoticeOk').onclick=()=>d.remove();
  }

  function updateHeader(){
    const sub=document.querySelector('header .sub');if(!sub)return;
    let version=VERSION;
    try{if(window.AndroidBridge&&typeof AndroidBridge.getVersion==='function')version=AndroidBridge.getVersion()||VERSION}catch(e){}
    sub.textContent='Warehouse Measurement & Visual Verification '+version;
  }

  async function hydrateThumb(el,item){
    if(!el||!item)return;
    const order=['product',item.packType==='Box'?'box':'unit',item.packType==='Box'?'unit':'box'];
    let data='';
    for(const r of order){try{data=await photoGet(item.id,r)}catch(e){data=''}if(data)break}
    if(data){el.innerHTML=`<img alt="${esc(item.description||'Product')}" src="${data}">`;el.classList.add('has')}
    else el.innerHTML='PHOTO<br>NOT SET';
  }

  function replaceStatusLogic(){
    window.statusOf=measurementStatus;
  }

  function replaceQueue(){
    window.renderQueue=function(){
      const a=queueFiltered();
      const complete=items.filter(x=>measurementStatus(x)==='complete').length;
      $('queueSummary').textContent=`${a.length} shown · ${complete}/${items.length} measured`;
      const list=$('queueList');
      list.innerHTML=a.length?a.map((it,idx)=>{
        const s=measurementStatus(it),miss=requiredMissing(it),z=zoneClass(it.zone),meta=ensureMeta(it);
        const hint=miss.length?`Missing: ${miss.join(' · ')}`:'Measurement record complete';
        return `<div class="item bmQueueCard bm-zone-${z}" data-bm-id="${attr(it.id)}"><div class="bmThumb" id="bmThumb_${idx}">PHOTO<br>LOADING</div><div><div class="bmCardTop"><div class="grow"><div class="bmCardTitle">${esc(it.description||it.sku||it.barcode||`Line ${it.sourceIndex||''}`)}</div><div class="bmCardMeta">${esc(it.sku||'No SKU')} · ${esc(it.barcode||'No barcode')}<br>${it.length||'—'} × ${it.width||'—'} × ${it.height||'—'} cm · ${it.weight||'—'} kg</div></div><span class="bmStatus ${s}">${s==='unmeasured'?'NOT STARTED':s.toUpperCase()}</span></div><div class="${miss.length?'bmMissing':'bmMissing bmReady'}">${esc(hint)}</div><div class="bmMediaBadges">${photoBadges(it)}</div><div style="margin-top:5px"><span class="pill">${esc(it.zone||'NO AREA')}</span><span class="pill">${esc(it.packType||'NO TYPE')}</span>${it.sourceIndex?`<span class="pill">LINE ${it.sourceIndex}</span>`:''}</div></div></div>`;
      }).join(''):'<div class="empty">No products match this queue.</div>';
      list.querySelectorAll('.bmQueueCard').forEach(el=>el.addEventListener('click',()=>editItem(el.dataset.bmId)));
      a.forEach((it,idx)=>hydrateThumb($('bmThumb_'+idx),it));
    };
  }

  function ensurePhotoUi(){
    if($('bmPhotoSection'))return;
    const itemPage=$('item');if(!itemPage)return;
    const card=itemPage.querySelector('.card');if(!card)return;
    const dims=[...card.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Dimensions');
    const sec=document.createElement('div');sec.id='bmPhotoSection';sec.className='bmPhotoSection';
    sec.innerHTML=`<div class="bmPhotoTitle"><div class="grow"><h3>Visual pick verification</h3><div class="sub">Keep a product photo, plus separate unit/box references when packaging can be confused.</div></div><span class="pill">LOCAL PHOTOS</span></div><div class="bmPhotoGrid">${ROLES.map(r=>`<div class="bmPhotoTile" id="bmTile_${r}"><div class="bmPhotoLabel">${roleLabel(r).toUpperCase()}</div><div class="bmPhotoPreview" id="bmPreview_${r}">NO PHOTO</div><div class="bmPhotoActions"><label class="btn primary" for="bmFile_${r}" style="margin:0;text-align:center;display:flex;align-items:center;justify-content:center">TAKE / CHOOSE</label><input id="bmFile_${r}" type="file" accept="image/*" capture="environment"><div class="two">${r!=='product'?`<button class="btn ghost" type="button" data-copy-role="${r}">USE PRODUCT</button>`:'<span></span>'}<button class="btn ghost" type="button" data-remove-role="${r}">REMOVE</button></div></div></div>`).join('')}</div><div class="bmPhotoNote">Photos are compressed for speed and stored locally inside BoxMeasure. They do not alter the source inventory file and are not embedded into the CSV.</div>`;
    if(dims)card.insertBefore(sec,dims);else card.appendChild(sec);
    ROLES.forEach(r=>{
      const input=$('bmFile_'+r);input.addEventListener('change',async e=>{
        const file=e.target.files&&e.target.files[0];input.value='';if(!file||!window.draft)return;
        try{const data=await compressImage(file);await photoPut(draft.id,r,data);syncPhotoMeta(r,true);await renderPhotoPanel();renderQueue();renderOps();showNotice(`${roleLabel(r)} photo saved for this product.`,'Photo saved')}catch(err){showNotice(err&&err.message?err.message:String(err),'Photo error')}
      });
    });
    sec.querySelectorAll('[data-copy-role]').forEach(b=>b.addEventListener('click',async e=>{
      if(!window.draft)return;const role=e.currentTarget.dataset.copyRole;
      try{const data=await photoGet(draft.id,'product');if(!data){showNotice('Add a product photo first.','No product photo');return}await photoPut(draft.id,role,data);syncPhotoMeta(role,true);await renderPhotoPanel();renderQueue();renderOps()}catch(err){showNotice('Could not copy the product photo.','Photo error')}
    }));
    sec.querySelectorAll('[data-remove-role]').forEach(b=>b.addEventListener('click',async e=>{
      if(!window.draft)return;const role=e.currentTarget.dataset.removeRole;
      try{await photoDelete(draft.id,role);syncPhotoMeta(role,false);await renderPhotoPanel();renderQueue();renderOps()}catch(err){showNotice('Could not remove the photo.','Photo error')}
    }));
  }

  async function renderPhotoPanel(){
    ensurePhotoUi();if(!window.draft)return;
    const meta=ensureMeta(draft);
    ROLES.forEach(r=>{
      const tile=$('bmTile_'+r);if(tile)tile.classList.toggle('emphasis',(draft.packType==='Box'&&r==='box')||(draft.packType==='Unit Qty'&&r==='unit'));
    });
    for(const r of ROLES){
      const p=$('bmPreview_'+r);if(!p)continue;
      let data='';try{data=await photoGet(draft.id,r)}catch(e){}
      if(data){p.innerHTML=`<img alt="${roleLabel(r)} photo" src="${data}">`;meta[r]=true}
      else{p.textContent='NO PHOTO';meta[r]=false}
    }
    draft.photoMeta=meta;
  }

  function installOpsCard(){
    const dash=$('dashboard');if(!dash||$('bmOpsWrap'))return;
    const wrap=document.createElement('div');wrap.className='card';wrap.id='bmOpsWrap';
    wrap.innerHTML='<div class="row"><div class="grow"><h2>Visual verification coverage</h2><div class="sub">Quick indication of how much pick-reference imagery has been captured.</div></div><span class="pill">OPTIONAL</span></div><div class="bmOpsCard" style="margin-top:9px"><div class="bmOpsMetric"><b id="bmProductCount">0</b><small>PRODUCT PHOTOS</small></div><div class="bmOpsMetric"><b id="bmUnitCount">0</b><small>UNIT REFERENCES</small></div><div class="bmOpsMetric"><b id="bmBoxCount">0</b><small>BOX REFERENCES</small></div></div>';
    const cards=dash.querySelectorAll('.card');if(cards.length>1)dash.insertBefore(wrap,cards[1]);else dash.appendChild(wrap);
  }
  function renderOps(){
    installOpsCard();if(!Array.isArray(window.items))return;
    const counts={product:0,unit:0,box:0};items.forEach(it=>{const m=ensureMeta(it);ROLES.forEach(r=>{if(m[r])counts[r]++})});
    if($('bmProductCount'))$('bmProductCount').textContent=counts.product;
    if($('bmUnitCount'))$('bmUnitCount').textContent=counts.unit;
    if($('bmBoxCount'))$('bmBoxCount').textContent=counts.box;
  }

  function wrapLifecycle(){
    if(typeof window.fillItem==='function'){
      const oldFill=fillItem;window.fillItem=function(){oldFill();ensurePhotoUi();renderPhotoPanel()};
    }
    if(typeof window.draftChanged==='function'){
      const oldDraft=draftChanged;window.draftChanged=function(){oldDraft();renderPhotoPanel()};
    }
    if(typeof window.renderDashboard==='function'){
      const oldDash=renderDashboard;window.renderDashboard=function(){oldDash();renderOps()};
    }
    if(typeof window.saveCurrent==='function'){
      const oldSave=saveCurrent;window.saveCurrent=function(next){oldSave(next);renderOps()};
    }
    if(typeof window.go==='function'){
      const oldGo=go;window.go=function(id){oldGo(id);if(id==='item')setTimeout(()=>renderPhotoPanel(),0);if(id==='work')setTimeout(()=>renderQueue(),0);if(id==='dashboard')setTimeout(()=>renderOps(),0)};
    }
  }

  function upgradeText(){
    const startBtn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Import inventory CSV');if(startBtn)startBtn.textContent='Import inventory';
    const status=$('statusFilter');if(status){const o=[...status.options].find(x=>x.value==='unmeasured');if(o)o.textContent='Not started'}
  }

  function install(){
    if(installed)return;
    if(typeof window.renderQueue!=='function'||typeof window.queueFiltered!=='function'||!document.body){setTimeout(install,120);return}
    installed=true;
    injectStyles();replaceStatusLogic();replaceQueue();ensurePhotoUi();installOpsCard();wrapLifecycle();upgradeText();updateHeader();
    window.alert=(msg)=>showNotice(String(msg||''));
    renderQueue();renderOps();if(window.draft)renderPhotoPanel();
    window.BoxMeasureUltimate={version:VERSION,photoGet,photoPut,photoDelete,renderPhotoPanel,renderOps};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
