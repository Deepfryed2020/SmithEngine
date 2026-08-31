(function(){
'use strict';
let installed=false;
function loadCompletion(){if(document.getElementById('bm-completionguard135-script'))return;const s=document.createElement('script');s.id='bm-completionguard135-script';s.async=false;s.src='file:///android_asset/completion_guard_135.js';document.head.appendChild(s)}
function install(){if(installed)return;if(!window.BoxMeasure131){setTimeout(install,100);return}installed=true;loadCompletion();window.BoxMeasureUnitGuard135={version:'1.3.5'}}
install();
})();
