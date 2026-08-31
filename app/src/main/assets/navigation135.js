(function(){
'use strict';
const VERSION='1.3.5';
function show(id){
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('on',x.id===id));
  document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('on',x.dataset.page===id));
  try{window.scrollTo(0,0)}catch(e){}
}
function bind(){
  const nav=document.querySelector('.navin');
  if(!nav)return setTimeout(bind,100);
  [...nav.querySelectorAll('.nav')].forEach(btn=>{
    const id=btn.dataset.page;
    const clone=btn.cloneNode(true);
    clone.removeAttribute('onclick');
    btn.replaceWith(clone);
    clone.addEventListener('click',ev=>{
      ev.preventDefault();ev.stopPropagation();
      if(id==='item'){
        try{if(typeof draft==='undefined'||!draft){if(typeof newItem==='function')newItem();return;}}catch(e){}
      }
      show(id);
      if(id==='item')setTimeout(()=>{try{if(typeof fillItem==='function')fillItem()}catch(e){}},0);
    },{passive:false});
  });
  const sub=document.querySelector('header .sub');
  if(sub)sub.textContent='Warehouse Measurement & Visual Verification '+VERSION;
  let badge=document.getElementById('bmRuntime135');
  if(!badge){badge=document.createElement('div');badge.id='bmRuntime135';badge.textContent='RUNTIME 1.3.5';badge.style='position:absolute;right:18px;top:72px;font-size:10px;font-weight:900;color:#9ff4d8;border:1px solid #2a8069;border-radius:999px;padding:3px 7px;background:#06251f;z-index:40';document.body.appendChild(badge);}
  window.BoxMeasureNav135={show};window.__bm135NavReady=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
