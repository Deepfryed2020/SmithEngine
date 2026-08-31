const fs=require('fs');
const vm=require('vm');
const pages=['dashboard','work','item','measure','import','export','settings'].map(id=>({id,classList:{toggle(){}}}));
const navs=['dashboard','work','measure','import','export','settings'].map(page=>({dataset:{page},classList:{toggle(){}},onclick:null}));
const calls={dashboard:0,work:0,exportStats:0,exportUi:0,settings:0,item:0,measure:0,scroll:0};
const context={
  console,
  setTimeout(fn){fn();return 1;},
  document:{
    body:{},
    getElementById(){return null;},
    querySelectorAll(sel){if(sel==='.page')return pages;if(sel==='.nav')return navs;return[];}
  },
  renderDashboard(){calls.dashboard++;},
  renderQueue(){calls.work++;},
  renderExportStats(){calls.exportStats++;},
  renderSettings(){calls.settings++;},
  fillItem(){calls.item++;},
  renderMeasureChips(){calls.measure++;}
};
context.window=context;
context.scrollTo=()=>{calls.scroll++;};
context.BoxMeasure132Core={};
context.BoxMeasure132UI={};
context.BoxMeasure132Export={installUi(){calls.exportUi++;}};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app/src/main/assets/nav132_hotfix.js','utf8'),context,{filename:'nav132_hotfix.js'});
if(typeof context.go!=='function')throw new Error('stable go was not installed');
for(const id of ['dashboard','work','measure','import','export','settings','item'])context.go(id);
if(calls.dashboard!==1)throw new Error('dashboard dispatch failed');
if(calls.work!==1)throw new Error('work dispatch failed');
if(calls.measure!==1)throw new Error('measure dispatch failed');
if(calls.exportStats!==1||calls.exportUi!==1)throw new Error('export dispatch failed');
if(calls.settings!==1)throw new Error('settings dispatch failed');
if(calls.item!==1)throw new Error('item dispatch failed');
if(calls.scroll!==7)throw new Error('scroll dispatch count failed');
for(const nav of navs){if(typeof nav.onclick!=='function')throw new Error('nav click handler missing for '+nav.dataset.page);nav.onclick();}
console.log('BoxMeasure 1.3.2 navigation smoke: PASS');
