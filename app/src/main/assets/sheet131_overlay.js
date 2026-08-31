(function(){
  'use strict';
  const VERSION='1.3.1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=s=>esc(s).replace(/`/g,'&#96;');
  const num=v=>Number(String(v??'').trim().replace(',','.'))||0;
  const natural=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{numeric:true,sensitivity:'base'});
  let installed=false;

  function canonicalPack(v){
    const s=String(v||'').trim().toLowerCase();
    if(s==='box'||s==='carton'||s.includes('carton')||s.includes('case'))return 'Carton';
    if(s==='unit qty'||s==='unit'||s.includes('unit'))return 'Unit';
    return '';
  }
  function packInternal(v){return canonicalPack(v)==='Carton'?'Box':canonicalPack(v)==='Unit'?'Unit Qty':String(v||'')}
  function dimUnit(it){return String(it&&it.dimensionUnit||'cm').toLowerCase()==='mm'?'mm':'cm'}
  function normCm(v,u){const n=num(v);if(!n)return '';return u==='mm'?(n/10):n}
  function fmt(n,d=1){return n===''?'':Number(n).toFixed(d).replace(/\.0$/,'')}
  function recordKey(it){const sku=String(it&&it.sku||'').trim();const p=canonicalPack(it&&it.packType);return [sku,p].filter(Boolean).join('|')}
  function oppositePack(p){const c=canonicalPack(p);return c==='Carton'?'Unit':c==='Unit'?'Carton':''}
  function pairFor(it){
    if(!it||!String(it.sku||'').trim())return null;
    const want=oppositePack(it.packType);if(!want)return null;
    try{return items.find(x=>x.id!==it.id&&String(x.sku||'').trim().toLowerCase()===String(it.sku||'').trim().toLowerCase()&&canonicalPack(x.packType)===want)||null}catch(e){return null}
  }
  function missing(it){
    const out=[];
    if(!(num(it.length)>0&&num(it.width)>0&&num(it.height)>0))out.push('dimensions');
    if(!(num(it.weight)>0))out.push('gross weight');
    if(!it.zone)out.push('area');
    if(!it.packType)out.push('Carton/Unit');
    if(!String(it.location||'').trim())out.push('location');
    return out;
  }
  function mediaBadges(it){
    const m=it&&it.photoMeta&&typeof it.photoMeta==='object'?it.photoMeta:{};
    const a=[];
    if(m.product)a.push('<span class="bmMediaBadge on">PRODUCT PHOTO</span>');
    if(m.unit)a.push('<span class="bmMediaBadge on">UNIT PHOTO</span>');
    if(m.box)a.push('<span class="bmMediaBadge on">CARTON PHOTO</span>');
    if(!a.length)a.push('<span class="bmMediaBadge">NO PHOTO</span>');
    return a.join('');
  }

  function injectStyles(){
    if($('bm131Styles'))return;
    const st=document.createElement('style');st.id='bm131Styles';st.textContent=`
      .bm131Location{display:flex;gap:8px;align-items:end;margin-top:8px}.bm131Location>div{flex:1}.bm131Pair{margin-top:8px;border-left:3px solid #5f90b8;background:#0a1d2f;padding:9px 10px;border-radius:9px;color:#bdd0e0;font-size:11px;line-height:1.45}
      .bm131DimBar{display:grid;grid-template-columns:145px 1fr;gap:8px;align-items:end;margin:10px 0 4px}.bm131DimPreview{background:#071522;border:1px solid #294963;border-radius:10px;padding:9px;color:#bcd0df;font-size:11px;min-height:43px;display:flex;align-items:center}
      .bmLocationPill{border-color:#48779b;color:#b8ddf7}.bmPairPill{border-color:#5b7f5b;color:#bde8bd}.bm131Sort{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
      .bm131SheetNote{border-left:3px solid #ffca63;background:#ffca6310;color:#ffe3a6;border-radius:9px;padding:9px 10px;font-size:11px;line-height:1.45;margin:8px 0}
      @media(max-width:520px){.bm131DimBar,.bm131Sort{grid-template-columns:1fr}.bm131Location{display:block}}
    `;document.head.appendChild(st);
  }

  function updateHeader(){
    const sub=document.querySelector('header .sub');if(!sub)return;
    let v=VERSION;try{if(window.AndroidBridge&&typeof AndroidBridge.getVersion==='function')v=AndroidBridge.getVersion()||VERSION}catch(e){}
    sub.textContent='Warehouse Measurement & Visual Verification '+v;
  }

  function mappingOptions(selected){
    try{return '<option value="">— Not mapped —</option>'+importHeaders.map(h=>`<option value="${esc(h)}"${h===selected?' selected':''}>${esc(h)}</option>`).join('')}catch(e){return '<option value="">— Not mapped —</option>'}
  }
  function guess(words){
    try{return importHeaders.find(h=>{const x=String(h).toLowerCase().replace(/[_-]/g,' ');return words.some(w=>x.includes(w))})||''}catch(e){return ''}
  }
  function fillExtraMappings(){
    const guesses={
      mapLocation:guess(['location','bin','slot','rack','pick face','pickface']),
      mapGrossWeight:guess(['gross weight','gross kg','grossweight']),
      mapNetWeight:guess(['net weight','net kg','netweight']),
      mapLength:guess(['length','len']),mapWidth:guess(['width']),mapHeight:guess(['height']),
      mapNotes:guess(['notes','note','comment','remarks'])
    };
    Object.entries(guesses).forEach(([id,g])=>{const el=$(id);if(el)el.innerHTML=mappingOptions(g)});
  }
  function ensureImportUi(){
    const box=$('mappingBox');if(!box||$('mapLocation'))return;
    const mapping=box.querySelector('.mapping');if(!mapping)return;
    const fields=[
      ['Location / pick face','mapLocation'],['Gross Weight (KG)','mapGrossWeight'],['Net weight / pack breakdown','mapNetWeight'],
      ['Length','mapLength'],['Width','mapWidth'],['Height','mapHeight'],['Notes','mapNotes']
    ];
    fields.forEach(([label,id])=>{const d=document.createElement('div');d.innerHTML=`<label>${label}</label><select id="${id}" class="field"></select>`;mapping.appendChild(d)});
    const controls=document.createElement('div');controls.className='bm131DimBar';controls.id='bmImportDimUnitRow';
    controls.innerHTML='<div><label>Imported dimension unit</label><select id="defaultDimUnit" class="field"><option value="">Unspecified — review</option><option value="mm">Millimetres (MM)</option><option value="cm">Centimetres (CM)</option></select></div><div class="bm131SheetNote">The paper form is printed as CM, but values such as 230 × 210 × 183 look like millimetres. BoxMeasure will not silently assume the heading is correct.</div>';
    mapping.parentNode.insertBefore(controls,mapping.nextSibling);
    const packLabel=$('mapPack')&&$('mapPack').parentElement.querySelector('label');if(packLabel)packLabel.textContent='Carton or Unit';
    const def=$('defaultPack');if(def){[...def.options].forEach(o=>{if(o.value==='Box')o.textContent='Carton';if(o.value==='Unit Qty')o.textContent='Unit'});const dl=def.parentElement.querySelector('label');if(dl)dl.textContent='Default Carton/Unit if blank'}
    fillExtraMappings();
  }

  function patchSetupMapping(){
    if(typeof setupMapping!=='function'||setupMapping.__bm131)return;
    const old=setupMapping;
    const wrapped=function(){old();ensureImportUi();fillExtraMappings()};wrapped.__bm131=true;setupMapping=wrapped;
    ensureImportUi();try{if(importHeaders&&importHeaders.length)fillExtraMappings()}catch(e){}
  }

  function ensureItemUi(){
    const sec=$('item');if(!sec)return;
    const card=sec.querySelector('.card');if(!card)return;
    const pack=$('packType');if(pack){
      const lab=pack.parentElement.querySelector('label');if(lab)lab.textContent='Carton or Unit *';
      [...pack.options].forEach(o=>{if(o.value==='Box')o.textContent='Carton';if(o.value==='Unit Qty')o.textContent='Unit'});
    }
    if($('measureHint'))$('measureHint').textContent='Confirm whether you are measuring the Carton or the Unit.';
    if(!$('location')){
      const anchor=card.querySelector('.grid2');
      const row=document.createElement('div');row.className='bm131Location';row.innerHTML='<div><label>Location / pick face</label><input id="location" class="field" placeholder="e.g. A-063-B" autocomplete="off"></div><div id="bm131Pair" class="bm131Pair">Carton/Unit pairing will appear here when the same Item # has both records.</div>';
      if(anchor)anchor.insertAdjacentElement('afterend',row);else card.prepend(row);
      $('location').addEventListener('input',()=>{if(typeof draftChanged==='function')draftChanged()});
    }
    if(!$('dimensionUnit')){
      const len=$('length');const grid=len&&len.closest('.grid3');
      if(grid){
        const bar=document.createElement('div');bar.className='bm131DimBar';bar.id='bm131DimBar';bar.innerHTML='<div><label>Dimension entry unit *</label><select id="dimensionUnit" class="field"><option value="mm">Millimetres (MM)</option><option value="cm">Centimetres (CM)</option></select></div><div id="bm131DimPreview" class="bm131DimPreview">Enter dimensions to see the normalized centimetre values.</div>';
        grid.parentNode.insertBefore(bar,grid);
        $('dimensionUnit').addEventListener('change',()=>{localStorage.setItem('bm.defaultDimUnit',$('dimensionUnit').value);if(typeof draftChanged==='function')draftChanged();updateDimUi()});
      }
    }
    const weight=$('weight');if(weight){const lab=weight.parentElement.querySelector('label');if(lab)lab.textContent='Gross Weight (KG) *'}
    if(!$('netWeight')&&weight){
      const grid=weight.closest('.grid2');if(grid){const d=document.createElement('div');d.innerHTML='<label>Net weight / pack breakdown</label><input id="netWeight" class="field" placeholder="e.g. 15 × 0.16 kg or 4.5 kg">';grid.appendChild(d);$('netWeight').addEventListener('input',()=>{if(typeof draftChanged==='function')draftChanged()})}
    }
    const sku=$('sku');if(sku){const lab=sku.parentElement.querySelector('label');if(lab)lab.textContent='Item # / product code'}
    updateDimensionLabels();
  }

  function updateDimensionLabels(){
    const u=$('dimensionUnit')?$('dimensionUnit').value:'cm';
    [['length','Length'],['width','Width'],['height','Height']].forEach(([id,name])=>{const el=$(id);if(el){const lab=el.parentElement.querySelector('label');if(lab)lab.textContent=`${name} ${u.toUpperCase()} *`}});
  }
  function updateDimUi(){
    updateDimensionLabels();
    const out=$('bm131DimPreview');if(!out)return;
    const u=$('dimensionUnit')?$('dimensionUnit').value:'cm',l=num($('length')&&$('length').value),w=num($('width')&&$('width').value),h=num($('height')&&$('height').value);
    if(l&&w&&h){out.innerHTML=`Entered: <b>${fmt(l)} × ${fmt(w)} × ${fmt(h)} ${u.toUpperCase()}</b><br>Normalized: <b>${fmt(normCm(l,u),1)} × ${fmt(normCm(w,u),1)} × ${fmt(normCm(h,u),1)} CM</b>`}
    else out.textContent='Enter dimensions to see the normalized centimetre values.';
  }
  function updatePair(){
    const box=$('bm131Pair');if(!box||typeof draft==='undefined'||!draft)return;
    const p=pairFor(draft);
    if(p)box.innerHTML=`Matching <b>${esc(canonicalPack(p.packType))}</b> record found for Item # <b>${esc(draft.sku||'')}</b> · ${esc(p.location||'No location')} · ${esc(String(typeof statusOf==='function'?statusOf(p):'').toUpperCase())}`;
    else box.innerHTML=`No matching ${esc(oppositePack(draft.packType)||'Carton/Unit')} record currently linked to this Item #.`;
  }

  function wrapItemLifecycle(){
    if(typeof fillItem==='function'&&!fillItem.__bm131){
      const old=fillItem;const wrapped=function(){old();ensureItemUi();if(typeof draft!=='undefined'&&draft){if(!draft.dimensionUnit)draft.dimensionUnit='cm';$('location').value=draft.location||'';$('netWeight').value=draft.netWeight||'';$('dimensionUnit').value=dimUnit(draft)}updateDimUi();updatePair();renamePhotoText()};wrapped.__bm131=true;fillItem=wrapped;
    }
    if(typeof draftChanged==='function'&&!draftChanged.__bm131){
      const old=draftChanged;const wrapped=function(){if(typeof draft!=='undefined'&&draft){if($('location'))draft.location=$('location').value.trim();if($('netWeight'))draft.netWeight=$('netWeight').value.trim();if($('dimensionUnit'))draft.dimensionUnit=$('dimensionUnit').value||'cm'}old();if(typeof draft!=='undefined'&&draft){if($('location'))draft.location=$('location').value.trim();if($('netWeight'))draft.netWeight=$('netWeight').value.trim();if($('dimensionUnit'))draft.dimensionUnit=$('dimensionUnit').value||'cm';try{persist()}catch(e){}}updateDimUi();updatePair();renamePhotoText()};wrapped.__bm131=true;draftChanged=wrapped;
    }
    if(typeof newItem==='function'&&!newItem.__bm131){
      const old=newItem;const wrapped=function(){old();try{if(draft){draft.dimensionUnit=localStorage.getItem('bm.defaultDimUnit')||'mm';draft.location='';draft.netWeight='';persist();fillItem()}}catch(e){}};wrapped.__bm131=true;newItem=wrapped;
    }
  }

  function ensureQueueControls(){
    if($('bmQueueSort'))return;
    const search=$('search');if(search)search.placeholder='Search location, Item #, barcode, description';
    const status=$('statusFilter');if(!status)return;
    const row=document.createElement('div');row.className='bm131Sort';row.innerHTML='<div><label>Sort work by</label><select id="bmQueueSort" class="field"><option value="location">Location → Item # → Carton/Unit</option><option value="source">Original source order</option><option value="item">Item # → Carton/Unit</option></select></div><div class="bm131SheetNote">Location sorting mirrors the paper list so you can work down the racking instead of bouncing between pick faces.</div>';
    status.closest('.grid2').insertAdjacentElement('afterend',row);$('bmQueueSort').addEventListener('change',()=>renderQueue());
  }

  function replaceQueueFilter(){
    if(typeof queueFiltered!=='function'||queueFiltered.__bm131)return;
    const wrapped=function(){
      const q=$('search')?$('search').value.trim().toLowerCase():'',sf=$('statusFilter')?$('statusFilter').value:'outstanding';
      let a=items.filter(it=>{
        const z=zoneFilter==='All'||(zoneFilter==='Unassigned'?(!it.zone||!it.packType):it.zone===zoneFilter);
        const text=[it.location,it.sourceId,it.sku,it.barcode,it.description,canonicalPack(it.packType)].join(' ').toLowerCase();
        const s=statusOf(it),st=sf==='all'||(sf==='outstanding'?s!=='complete':s===sf);
        return z&&st&&(!q||text.includes(q));
      });
      const sort=$('bmQueueSort')?$('bmQueueSort').value:'location';
      a.sort((x,y)=>{
        if(sf==='outstanding'){const rank={unmeasured:0,partial:1,complete:2};const d=(rank[statusOf(x)]??9)-(rank[statusOf(y)]??9);if(d)return d}
        if(sort==='source')return (x.sourceIndex||999999)-(y.sourceIndex||999999);
        if(sort==='item'){const d=natural(x.sku,y.sku);if(d)return d;const p=natural(canonicalPack(x.packType),canonicalPack(y.packType));if(p)return p;return natural(x.location,y.location)}
        const d=natural(x.location,y.location);if(d)return d;const i=natural(x.sku,y.sku);if(i)return i;const p=canonicalPack(x.packType)==='Carton'?0:1,qv=canonicalPack(y.packType)==='Carton'?0:1;if(p!==qv)return p-qv;return (x.sourceIndex||999999)-(y.sourceIndex||999999);
      });
      return a;
    };wrapped.__bm131=true;queueFiltered=wrapped;
  }

  async function hydrateThumb(el,it){
    if(!el||!it||!window.BoxMeasureUltimate||!BoxMeasureUltimate.photoGet)return;
    const order=['product',canonicalPack(it.packType)==='Carton'?'box':'unit',canonicalPack(it.packType)==='Carton'?'unit':'box'];
    let data='';for(const r of order){try{data=await BoxMeasureUltimate.photoGet(it.id,r)}catch(e){}if(data)break}
    if(data){el.innerHTML=`<img alt="${esc(it.description||'Product')}" src="${data}">`;el.classList.add('has')}else el.innerHTML='PHOTO<br>NOT SET';
  }
  function replaceQueueRender(){
    if(typeof renderQueue!=='function'||renderQueue.__bm131)return;
    const wrapped=function(){
      const a=queueFiltered(),complete=items.filter(x=>statusOf(x)==='complete').length;
      $('queueSummary').textContent=`${a.length} shown · ${complete}/${items.length} measured`;
      const list=$('queueList');if(!list)return;
      list.innerHTML=a.length?a.map((it,idx)=>{
        const s=statusOf(it),miss=missing(it),u=dimUnit(it),pair=pairFor(it),pack=canonicalPack(it.packType)||'NO TYPE';
        const nL=normCm(it.length,u),nW=normCm(it.width,u),nH=normCm(it.height,u);
        const dims=it.length&&it.width&&it.height?`${esc(it.length)} × ${esc(it.width)} × ${esc(it.height)} ${u.toUpperCase()}${u==='mm'?` · ${fmt(nL,1)} × ${fmt(nW,1)} × ${fmt(nH,1)} CM`:''}`:'No dimensions';
        const z=it.zone==='Dry'?'dry':it.zone==='Chiller'?'chiller':it.zone==='Frozen'?'frozen':'unassigned';
        return `<div class="item bmQueueCard bm-zone-${z}" data-bm-id="${attr(it.id)}"><div class="bmThumb" id="bm131Thumb_${idx}">PHOTO<br>LOADING</div><div><div class="bmCardTop"><div class="grow"><div class="bmCardTitle">${esc(it.description||it.sku||it.barcode||`Line ${it.sourceIndex||''}`)}</div><div class="bmCardMeta"><b>${esc(it.location||'NO LOCATION')}</b> · Item # ${esc(it.sku||'—')}<br>${dims}<br>Gross ${esc(it.weight||'—')} kg${it.netWeight?` · Net ${esc(it.netWeight)}`:''}</div></div><span class="bmStatus ${s}">${s==='unmeasured'?'NOT STARTED':s.toUpperCase()}</span></div><div class="${miss.length?'bmMissing':'bmMissing bmReady'}">${miss.length?'Missing: '+esc(miss.join(' · ')):'Measurement record complete'}</div><div class="bmMediaBadges">${mediaBadges(it)}</div><div style="margin-top:5px"><span class="pill bmLocationPill">${esc(it.location||'NO LOCATION')}</span><span class="pill">${esc(it.zone||'NO AREA')}</span><span class="pill">${esc(pack)}</span>${pair?`<span class="pill bmPairPill">PAIR ✓</span>`:''}${it.sourceIndex?`<span class="pill">LINE ${it.sourceIndex}</span>`:''}</div></div></div>`;
      }).join(''):'<div class="empty">No products match this queue.</div>';
      [...list.querySelectorAll('[data-bm-id]')].forEach((el,idx)=>{const it=a[idx];el.onclick=()=>editItem(it.id);hydrateThumb($('bm131Thumb_'+idx),it)});
    };wrapped.__bm131=true;renderQueue=wrapped;
  }

  function renamePhotoText(){
    const sec=$('item');if(!sec)return;
    sec.querySelectorAll('.bmPhotoLabel,.bmMediaBadge,.bmPhotoNote').forEach(el=>{el.childNodes.forEach(n=>{if(n.nodeType===3)n.nodeValue=n.nodeValue.replace(/\bBox\b/g,'Carton').replace(/BOX/g,'CARTON')});if(!el.children.length)el.textContent=el.textContent.replace(/\bBox\b/g,'Carton').replace(/BOX/g,'CARTON')});
  }

  function settingsUi(){
    const sec=$('settings');if(!sec||$('bm131Settings'))return;
    const card=document.createElement('div');card.className='card';card.id='bm131Settings';card.innerHTML='<h2>Warehouse measurement conventions</h2><div class="sub">These defaults affect new manual items only. Every item still stores its own unit explicitly.</div><label>Default dimension entry unit</label><select id="bmDefaultDimUnit" class="field"><option value="mm">Millimetres (MM)</option><option value="cm">Centimetres (CM)</option></select><div class="bm131SheetNote">Use MM if you enter values like 230 × 210 × 183. Use CM if you enter 23 × 21 × 18.3. Both normalize to centimetres on export.</div>';
    sec.insertBefore(card,sec.firstChild);const sel=$('bmDefaultDimUnit');sel.value=localStorage.getItem('bm.defaultDimUnit')||'mm';sel.onchange=()=>localStorage.setItem('bm.defaultDimUnit',sel.value);
  }

  function migrateLegacy(){
    let changed=false;try{items.forEach(it=>{if(!it.dimensionUnit){it.dimensionUnit='cm';changed=true}if(it.netWeight===undefined){it.netWeight='';changed=true}if(it.location===undefined){it.location='';changed=true}});if(changed)persist()}catch(e){}
  }

  function install(){
    if(installed)return;
    if(!document.body||typeof queueFiltered!=='function'||typeof renderQueue!=='function'||!$('bmUltimateStyles')){setTimeout(install,140);return}
    installed=true;injectStyles();updateHeader();migrateLegacy();patchSetupMapping();ensureImportUi();ensureItemUi();ensureQueueControls();replaceQueueFilter();replaceQueueRender();wrapItemLifecycle();settingsUi();
    const item=$('item');if(item){new MutationObserver(()=>renamePhotoText()).observe(item,{childList:true,subtree:true,characterData:true})}
    if(typeof go==='function'&&!go.__bm131){const old=go;const wrapped=function(id){old(id);if(id==='item')setTimeout(()=>{ensureItemUi();fillItem();renamePhotoText()},0);if(id==='work')setTimeout(()=>{ensureQueueControls();renderQueue()},0);if(id==='settings')setTimeout(settingsUi,0);updateHeader()};wrapped.__bm131=true;go=wrapped}
    renderQueue();if(typeof draft!=='undefined'&&draft)fillItem();
    window.BoxMeasure131={version:VERSION,canonicalPack,normCm,recordKey};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
