(function(){
'use strict';
if(window.__bm136FreezeGuardReady)return;
const NativeMutationObserver=window.MutationObserver;
if(typeof NativeMutationObserver==='function'){
  function SafeMutationObserver(callback){
    const inner=new NativeMutationObserver(callback);
    const nativeObserve=inner.observe.bind(inner);
    inner.observe=function(target,options){
      if(target&&target.id==='item'&&options&&options.subtree){
        console.warn('BoxMeasure 1.3.6 blocked recursive item MutationObserver');
        return;
      }
      return nativeObserve(target,options);
    };
    return inner;
  }
  SafeMutationObserver.prototype=NativeMutationObserver.prototype;
  window.MutationObserver=SafeMutationObserver;
}
window.__bm136FreezeGuardReady=true;
})();
