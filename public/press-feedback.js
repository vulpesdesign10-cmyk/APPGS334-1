(()=>{
  'use strict';
  const selector='button,.button,[role="button"],.nav-item,.mobile-bottom-nav button,.mobile-drawer-item,[data-view],[data-print]';
  const started=new WeakMap();
  const MIN_PRESS=75;
  function targetOf(e){return e.target?.closest?.(selector)}
  function press(t){
    if(!t||t.disabled||t.getAttribute('aria-disabled')==='true')return;
    started.set(t,performance.now());
    t.classList.add('is-pressing');
    try{navigator.vibrate?.(8)}catch{}
  }
  function release(t){
    if(!t)return;
    const elapsed=performance.now()-(started.get(t)||0);
    setTimeout(()=>t.classList.remove('is-pressing'),Math.max(0,MIN_PRESS-elapsed));
  }
  addEventListener('pointerdown',e=>press(targetOf(e)),{passive:true,capture:true});
  addEventListener('pointerup',e=>release(targetOf(e)),{passive:true,capture:true});
  addEventListener('pointercancel',e=>release(targetOf(e)),{passive:true,capture:true});
  addEventListener('touchstart',e=>press(targetOf(e)),{passive:true,capture:true});
  addEventListener('touchend',e=>release(targetOf(e)),{passive:true,capture:true});
  addEventListener('click',e=>{
    const t=targetOf(e);if(!t)return;
    t.classList.add('press-confirm');
    setTimeout(()=>t.classList.remove('press-confirm'),95);
  },true);
})();
