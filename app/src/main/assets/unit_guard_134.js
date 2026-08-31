(function(){
  'use strict';
  let loaded=false;
  function install(){
    if(loaded)return;
    if(!window.BoxMeasure131){setTimeout(install,120);return;}
    loaded=true;
    if(document.getElementById('bm-completionguard134-script'))return;
    const s=document.createElement('script');
    s.id='bm-completionguard134-script';
    s.async=false;
    s.src='file:///android_asset/completion_guard_134.js';
    document.head.appendChild(s);
  }
  install();
})();
