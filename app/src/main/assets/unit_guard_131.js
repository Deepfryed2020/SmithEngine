(function(){
  'use strict';
  const files=['core132.js','ui132.js','export132.js'];
  files.forEach((file,i)=>{
    const id='bm132-'+i;
    if(document.getElementById(id))return;
    const s=document.createElement('script');
    s.id=id;
    s.async=false;
    s.src='file:///android_asset/'+file;
    document.head.appendChild(s);
  });
})();
