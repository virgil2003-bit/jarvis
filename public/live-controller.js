import { isMailReview } from './mail-intent.js';

// One owner of the microphone; no browser SpeechRecognition or TTS restart loop.
export class LiveVoiceController {
 constructor({connect,api,onState=()=>{},onMessage=()=>{},onError=()=>{},onInterface=()=>{},onTick=()=>{},now=Date.now}){Object.assign(this,{connect,api,onState,onMessage,onError,onInterface,onTick,now});this.phase='idle';this.generation=0;this.session=null;this.timer=null;this.seen=new Set();this.mailRequestedAt=null;}
 get active(){return this.phase!=='idle'}
 async start(){
  if(this.active)return;const generation=++this.generation;this.phase='connecting';this.seen.clear();this.mailRequestedAt=null;this.onState('CONNECTING');let watchdog;
  const current=()=>this.generation===generation&&this.active;
  try{
   const token=await this.api('/api/live/session');if(!current())return;
   const pending=this.connect({conversationToken:token.conversationToken,connectionType:'webrtc',
    onConversationCreated:session=>{if(current())this.session=session;else void session.endSession().catch(()=>{})},
    onConnect:()=>{if(current()){this.phase='connected';this.onState('LISTENING')}},
    onDisconnect:()=>{if(current()){void this.stop();this.onError('Live voice disconnected. Check your connection, then enable voice again.')}},
    onError:()=>{if(current()){void this.stop();this.onError('Live voice could not continue. Check microphone permission, ElevenLabs credits, and your connection.')}},
    onModeChange:({mode})=>{if(current())this.onState(mode==='speaking'?'SPEAKING':'LISTENING')},
    onInterruption:()=>{if(current()){this.session?.setVolume({volume:1});this.onState('LISTENING')}},
    onMessage:message=>{if(!current())return;const id=message.event_id===undefined?null:String(message.event_id)+':'+message.source;if(id&&this.seen.has(id))return;if(id)this.seen.add(id);const role=message.source==='user'||message.role==='user'?'user':'assistant';if(role==='user'){this.session?.setVolume({volume:1});if(isMailReview(message.message))this.mailRequestedAt=this.now();if(/^(?:jarvis[, ]+)?(?:stop listening|disable voice)[.!?]*$/i.test(message.message.trim())){void this.stop();return;}}this.onMessage(role,message.message);},
    clientTools:{read_recent_emails:async()=>{if(!current())return JSON.stringify({error:'Session ended.'});if(this.mailRequestedAt===null||this.now()-this.mailRequestedAt>45000)return JSON.stringify({error:'Ask the user to explicitly request an email briefing before reading mail.'});this.mailRequestedAt=null;this.onState('THINKING');try{const data=await this.api('/api/mail/review');if(!current())return JSON.stringify({error:'Session ended.'});return JSON.stringify(data)}catch(error){return JSON.stringify({error:error.message})}},
     control_interface:({action})=>{if(!current())return 'Session ended.';const allowed=['settings','console','dashboard','conversations','protocols','pause_animation','resume_animation'];if(!allowed.includes(action))return 'Unsupported interface command.';this.onInterface(action);return 'Interface updated.'}}
   });
   // Late connections are ended even if a cancellation/timeout wins the race.
   pending.then(session=>{if(!current())void session.endSession().catch(()=>{})}).catch(()=>{});
   const session=await Promise.race([pending,new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('Live voice connection timed out. Check microphone permission and your connection.')),30000)})]);
   if(!current()){await session.endSession().catch(()=>{});return;}this.session=session;this.phase='connected';
   const duration=Math.min(Number(token.maxDurationSeconds)||300,300);const deadline=this.now()+duration*1000;
   this.onTick(duration);this.timer=setInterval(()=>{if(!current())return;const remaining=Math.max(0,Math.ceil((deadline-this.now())/1000));this.onTick(remaining);if(!remaining){void this.stop();this.onError('The five-minute live session ended to limit usage. You can start another session if your daily allowance permits.')}},1000);
  }catch(error){if(current()){await this.stop();this.onError(error.message||'Live voice could not connect.')}}finally{clearTimeout(watchdog)}
 }
 async stop(){this.generation++;this.phase='idle';clearInterval(this.timer);this.timer=null;this.mailRequestedAt=null;const session=this.session;this.session=null;this.onTick(null);this.onState('STANDBY');if(session)await session.endSession().catch(()=>{});}
 sendText(text){if(this.phase!=='connected'||!this.session)return false;if(isMailReview(text))this.mailRequestedAt=this.now();this.session.setVolume({volume:1});this.session.sendUserMessage(text);this.onMessage('user',text);return true;}
 interrupt(){if(this.session){this.session.setVolume({volume:0});this.session.sendUserActivity();this.onState('LISTENING')}}
 setMuted(muted){this.session?.setVolume({volume:muted?0:1});}
}
