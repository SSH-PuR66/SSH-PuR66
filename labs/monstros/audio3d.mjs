// Synthesized arcade sound, created only after an explicit audio-button gesture.
export function createAudio(){
  let context=null,master=null,motor=null,motorGain=null,enabled=false,lastTick=-1;
  const voices=new Set();
  function initialize(){
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
    context=new Audio();master=context.createGain();master.gain.value=.22;master.connect(context.destination);
    motor=context.createOscillator();motor.type='sawtooth';motor.frequency.value=48;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;
    motorGain=context.createGain();motorGain.gain.value=0;motor.connect(filter);filter.connect(motorGain);motorGain.connect(master);motor.start();return true;
  }
  async function setEnabled(value){
    if(value&&!context&&!initialize())return false;
    enabled=Boolean(value);if(enabled)await context.resume();else if(context)await context.suspend();return enabled;
  }
  function hit(strong){
    if(voices.size>=10)return;
    const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();voices.add(osc);
    osc.type=strong?'triangle':'square';osc.frequency.setValueAtTime(strong?105:180,now);osc.frequency.exponentialRampToValueAtTime(strong?30:65,now+.13);
    gain.gain.setValueAtTime(strong?.5:.12,now);gain.gain.exponentialRampToValueAtTime(.001,now+.19);
    osc.connect(gain);gain.connect(master);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start();osc.stop(now+.21);
  }
  function update(state,running){
    if(!enabled||!context)return;const now=context.currentTime;
    motorGain.gain.setTargetAtTime(running?.12:0,now,.08);motor.frequency.setTargetAtTime(45+Math.sin(state.tick*.025)*7,now,.08);
    if(state.tick<lastTick)lastTick=-1;
    if(running&&state.tick!==lastTick){const recent=state.events.filter(e=>e.tick>lastTick&&e.tick<=state.tick);if(recent.some(e=>e.type==='hit'))hit(true);else if(recent.some(e=>e.type==='pulse'))hit(false);}
    lastTick=state.tick;
  }
  function quiet(){if(context&&motorGain)motorGain.gain.setTargetAtTime(0,context.currentTime,.02);}
  function dispose(){enabled=false;for(const voice of voices)try{voice.stop();}catch{}motor?.stop();context?.close();}
  return {setEnabled,update,quiet,dispose};
}
