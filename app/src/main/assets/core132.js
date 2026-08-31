(function(){
'use strict';
const VERSION='1.3.2', META_KEY='bm.importmeta.122';
const n=v=>Number(String(v??'').trim().replace(',','.'))||0;
const natural=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{numeric:true,sensitivity:'base'});
function canonicalPack(v){const s=String(v||'').trim().toLowerCase();if(s==='box'||s==='carton'||s.includes('carton')||s.includes('case'))return 'Carton';if(s==='unit qty'||s==='unit'||s.includes('unit'))return 'Unit';return ''}
function naMap(it){return it&&it.naFields&&typeof it.naFields==='object'?it.naFields:{}}
function isNA(it,key){return !!naMap(it)[key]}
function resolved(it,key){return isNA(it,key)||n(it&&it[key])>0}
function unitOf(it){return String(it&&it.dimensionUnit||'').toLowerCase()==='mm'?'mm':'cm'}
function cm(v,u){const x=n(v);if(!x)return '';return u==='mm'?x/10:x}
function neat(v){if(v===''||v===null||v===undefined)return '';return Number(v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}
function valueOrNA(it,key){return isNA(it,key)?'N/A':(it?(it[key]??''):'')}
function pairFor(it){if(!it||!String(it.sku||'').trim())return null;const want=canonicalPack(it.packType)==='Carton'?'Unit':canonicalPack(it.packType)==='Unit'?'Carton':'';if(!want)return null;try{return items.find(x=>x.id!==it.id&&String(x.sku||'').trim().toLowerCase()===String(it.sku||'').trim().toLowerCase()&&canonicalPack(x.packType)===want)||null}catch(e){return null}}
function missing(it){const out=[],p=canonicalPack(it&&it.packType);if(!String(it&&it.location||'').trim())out.push('location');if(!it||!it.zone)out.push('area');if(!p)out.push('Carton/Unit');if(p==='Carton'){if(!resolved(it,'weight'))out.push('gross weight');if(!resolved(it,'length'))out.push('length');if(!resolved(it,'width'))out.push('width');if(!resolved(it,'height'))out.push('height')}else if(p==='Unit'&&!resolved(it,'weight'))out.push('unit weight');return out}
function status(it){const m=missing(it);if(!m.length)return 'complete';const worked=!!(n(it&&it.weight)||n(it&&it.length)||n(it&&it.width)||n(it&&it.height)||String(it&&it.netWeight||'').trim()||Object.keys(naMap(it)).some(k=>naMap(it)[k])||it&&it.measuredAt);return worked?'partial':'unmeasured'}
function parseNet(text){const s=String(text||'').trim().toLowerCase().replace(/,/g,'.');let m=s.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g)\s*$/i);if(m){const count=Number(m[1]),each=Number(m[2]),eachKg=m[3].toLowerCase()==='g'?each/1000:each;return {kg:count*eachKg,label:`${count} × ${neat(eachKg)} kg = ${neat(count*eachKg)} kg`}}m=s.match(/^(\d+(?:\.\d+)?)\s*(kg|g)\s*$/i);if(m){const kg=m[2].toLowerCase()==='g'?Number(m[1])/1000:Number(m[1]);return {kg,label:`${neat(kg)} kg`}}return null}
function warnings(it){const out=[],u=unitOf(it),dims=['length','width','height'].map(k=>cm(it&&it[k],u)).filter(x=>x!=='');if(dims.some(x=>x>200))out.push('Very large dimension — verify CM/MM');const net=parseNet(it&&it.netWeight),gross=n(it&&it.weight);if(net&&gross&&net.kg>gross+0.05)out.push(`Net ${neat(net.kg)} kg exceeds gross ${neat(gross)} kg`);return out}
function sortWork(a,b){return natural(a.location,b.location)||natural(a.sku,b.sku)||((canonicalPack(a.packType)==='Carton'?0:1)-(canonicalPack(b.packType)==='Carton'?0:1))||((a.sourceIndex||999999)-(b.sourceIndex||999999))}
function fingerprint(obj){const keys=Object.keys(obj||{}).sort(),text=keys.map(k=>k+'='+String(obj[k]??'')).join('\u001f');let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return ('00000000'+(h>>>0).toString(16)).slice(-8)}
function batches(){try{return JSON.parse(localStorage.getItem(META_KEY)||'[]')}catch(e){return[]}}
function dupes(arr,keyFn){const map=new Map();arr.forEach(it=>{const k=String(keyFn(it)||'').trim().toLowerCase();if(!k)return;if(!map.has(k))map.set(k,[]);map.get(k).push(it)});return [...map.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows}))}
window.BoxMeasure132Core={VERSION,n,natural,canonicalPack,naMap,isNA,resolved,unitOf,cm,neat,valueOrNA,pairFor,missing,status,parseNet,warnings,sortWork,fingerprint,batches,dupes};
})();