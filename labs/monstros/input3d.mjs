const KEYS=Object.freeze({KeyW:'forward',ArrowUp:'forward',KeyS:'reverse',ArrowDown:'reverse',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyQ:'aimLeft',KeyE:'aimRight',Space:'fire',ShiftLeft:'boost',ShiftRight:'boost',KeyX:'brake'});

/** Keyboard and captured touch buttons share one input snapshot per physics tick. */
export function createControls({canvas,root,isActive,onPause,onRestart,onFocusLoss}){
  const keys=new Set(),touches=new Map(),abort=new AbortController(),options={signal:abort.signal};
  const isTyping=target=>target?.matches?.('input,select,textarea,[contenteditable="true"]');
  function release(){keys.clear();touches.clear();for(const b of root.querySelectorAll('[data-drive]'))b.classList.remove('held');}
  function down(event){
    if(!isActive()||isTyping(event.target)||document.activeElement!==canvas)return;
    if(KEYS[event.code]){event.preventDefault();keys.add(event.code);}
    if(!event.repeat&&event.code==='KeyP'){event.preventDefault();onPause();}
    if(!event.repeat&&event.code==='KeyR'){event.preventDefault();onRestart();}
  }
  function up(event){keys.delete(event.code);}
  window.addEventListener('keydown',down,options);window.addEventListener('keyup',up,options);
  window.addEventListener('blur',()=>{release();onFocusLoss();},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();},options);
  for(const button of root.querySelectorAll('[data-drive]')){
    button.addEventListener('pointerdown',event=>{if(!isActive())return;event.preventDefault();button.setPointerCapture(event.pointerId);touches.set(event.pointerId,button.dataset.drive);button.classList.add('held');},options);
    const end=event=>{touches.delete(event.pointerId);if(![...touches.values()].includes(button.dataset.drive))button.classList.remove('held');};
    button.addEventListener('pointerup',end,options);button.addEventListener('pointercancel',end,options);button.addEventListener('lostpointercapture',end,options);
    button.addEventListener('contextmenu',event=>event.preventDefault(),options);
  }
  function snapshot(assist=true){
    const held=new Set([...keys].map(code=>KEYS[code]).concat([...touches.values()]));
    return {throttle:Number(held.has('forward'))-Number(held.has('reverse')),steer:Number(held.has('right'))-Number(held.has('left')),aim:Number(held.has('aimRight'))-Number(held.has('aimLeft')),fire:held.has('fire'),boost:held.has('boost'),brake:held.has('brake'),assist:Boolean(assist)};
  }
  return {snapshot,release,dispose(){release();abort.abort();}};
}
