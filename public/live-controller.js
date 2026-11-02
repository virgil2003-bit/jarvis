import { isMailReview } from './mail-intent.js';

// Return actionable categories without exposing raw provider payloads or session tokens.
export function describeVoiceFailure(message='',context={}){
 const text=String(message)+' '+String(context?.errorType||context?.type||'');
 if(/client tool|tool execution|unhandled.*tool|ignored.*approval/i.test(text))return {fatal:false,message:'A voice tool failed, but the conversation is still connected. Try stating the request again.'};
 if(/permission|notallowed|not allowed|denied.*mic|microphone.*denied/i.test(text))return {fatal:true,message:'Microphone access was blocked. Allow the microphone for this site in Chrome, then enable voice.'};
 if(/quota|credit|balance|daily.limit|concurrency|rate.limit|limit.exceeded/i.test(text))return {fatal:true,message:'ElevenLabs reported a credit or session limit. Check ElevenLabs Agents usage before starting another session.'};
 if(/voice.*(unavailable|not found|invalid)|invalid.*voice/i.test(text))return {fatal:true,message:'ElevenLabs could not use the selected voice. Check that it is in My Voices and available to your plan.'};
 if(/max.duration|duration.exceeded/i.test(text))return {fatal:true,message:'The live session reached its time limit. You can start another if your daily allowance permits.'};
 if(/autoplay|audiocontext|audio context|audio.*suspend/i.test(text))return {fatal:true,message:'The browser blocked audio playback. Click the page, allow sound for this site, then enable voice.'};
 if(/network|connection|webrtc|ice.*fail|transport|socket/i.test(text))return {fatal:true,message:'The live audio connection failed. Check your connection and use one JARVIS tab before reconnecting.'};
 if(/unauthori|forbidden|auth|api.key|permission.*agent/i.test(text))return {fatal:true,message:'ElevenLabs rejected agent access. Check the API key permissions and saved agent ID in Render.'};
 return {fatal:true,message:'Live voice stopped unexpectedly. Check the voice diagnostics in Settings before reconnecting.'};
}

// One owner of the microphone; no browser SpeechRecognition or TTS restart loop.
export class LiveVoiceController {
 constructor({connect,api,onState=()=>{},onMessage=()=>{},onError=()=>{},onInterface=()=>{},onTick=()=>{},onDiagnostic=()=>{},getMicrophone=()=>undefined,now=Date.now}){Object.assign(this,{connect,api,onState,onMessage,onError,onInterface,onTick,onDiagnostic,getMicrophone,now});this.phase='idle';this.generation=0;this.session=null;this.timer=null;this.seen=new Set();this.mailRequestedAt=null;this.lastTurnAt=null;}
 get active(){return this.phase!=='idle'}
 async start(){
  if(this.active)return;const generation=++this.generation;this.phase='connecting';this.seen.clear();this.mailRequestedAt=null;this.lastTurnAt=null;this.onState('CONNECTING');this.onDiagnostic('connecting');let watchdog,stage='server';
  const current=()=>this.generation===generation&&this.active;
  try{
   const token=await this.api('/api/live/session');if(!current())return;this.onDiagnostic('session token received');if(token.responseMode)this.onDiagnostic(token.responseMode==='quick'?'quick response settings applied':'quick settings unavailable; existing agent settings retained');stage='audio';
   const pending=this.connect({conversationToken:token.conversationToken,connectionType:'webrtc',inputDeviceId:this.getMicrophone(),
    onConversationCreated:session=>{if(current())this.session=session;else void session.endSession().catch(()=>{})},
    onConnect:()=>{if(current()){this.phase='connected';this.onDiagnostic('audio transport connected');this.onState('LISTENING')}},
    onDisconnect:details=>{if(current()){const code=Number.isInteger(details?.closeCode)?' code '+details.closeCode:'';this.onDiagnostic('disconnected: '+(details?.reason==='agent'?'agent ended session':'connection ended')+code);const failure=describeVoiceFailure(details?.message||details?.closeReason||'',details?.context);void this.stop();this.onError(details?.reason==='agent'?'ElevenLabs ended the session. Check Agents conversation history for its end reason.':failure.message)}},
    onError:(message,context)=>{if(current()){const failure=describeVoiceFailure(message,context);this.onDiagnostic(failure.fatal?'voice error: connection stopped':'tool warning: staying connected');if(failure.fatal)void this.stop();this.onError(failure.message)}},
    onModeChange:({mode})=>{if(current()){if(mode==='speaking'&&this.lastTurnAt!==null){this.onDiagnostic('reply audio started '+Math.max(0,this.now()-this.lastTurnAt)+' ms after recognized request');this.lastTurnAt=null;}this.onDiagnostic(mode==='speaking'?'assistant speaking':'listening');this.onState(mode==='speaking'?'SPEAKING':'LISTENING')}},
    onInterruption:()=>{if(current()){this.onDiagnostic('speech interrupted');this.session?.setVolume({volume:1});this.onState('LISTENING')}},
    onMessage:message=>{if(!current())return;const id=message.event_id===undefined?null:String(message.event_id)+':'+message.source;if(id&&this.seen.has(id))return;if(id)this.seen.add(id);this.onDiagnostic(message.source==='user'||message.role==='user'?'user speech recognized':'assistant reply received');const role=message.source==='user'||message.role==='user'?'user':'assistant';if(role==='user'){this.lastTurnAt=this.now();this.session?.setVolume({volume:1});if(isMailReview(message.message))this.mailRequestedAt=this.now();if(/^(?:jarvis[, ]+)?(?:stop listening|disable voice)[.!?]*$/i.test(message.message.trim())){void this.stop();return;}}this.onMessage(role,message.message);},
    clientTools:{read_recent_emails:async()=>{if(!current())return JSON.stringify({error:'Session ended.'});if(this.mailRequestedAt===null||this.now()-this.mailRequestedAt>45000)return JSON.stringify({error:'Ask the user to explicitly request an email briefing before reading mail.'});this.mailRequestedAt=null;const readStarted=this.now();this.onDiagnostic('email read started');this.onState('THINKING');try{const data=await this.api('/api/mail/review');this.onDiagnostic('email read completed in '+Math.max(0,this.now()-readStarted)+' ms');if(!current())return JSON.stringify({error:'Session ended.'});return JSON.stringify(data)}catch(error){return JSON.stringify({error:error.message})}},
     control_interface:({action})=>{if(!current())return 'Session ended.';const allowed=['settings','console','dashboard','conversations','protocols','pause_animation','resume_animation'];if(!allowed.includes(action))return 'Unsupported interface command.';this.onInterface(action);return 'Interface updated.'}}
   });
   // Late connections are ended even if a cancellation/timeout wins the race.
   pending.then(session=>{if(!current())void session.endSession().catch(()=>{})}).catch(()=>{});
   const session=await Promise.race([pending,new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('Live voice connection timed out. Check microphone permission and your connection.')),30000)})]);
   if(!current()){await session.endSession().catch(()=>{});return;}this.session=session;this.phase='connected';
   const duration=Math.min(Number(token.maxDurationSeconds)||300,300);const deadline=this.now()+duration*1000;
   this.onDiagnostic('session ready');this.onTick(duration);this.timer=setInterval(()=>{if(!current())return;const remaining=Math.max(0,Math.ceil((deadline-this.now())/1000));this.onTick(remaining);if(!remaining){void this.stop();this.onError('The five-minute live session ended to limit usage. You can start another session if your daily allowance permits.')}},1000);
  }catch(error){if(current()){await this.stop();this.onError(stage==='audio'?describeVoiceFailure(error.message).message:(error.message||'Live voice could not connect.'))}}finally{clearTimeout(watchdog)}
 }
 async stop(){this.generation++;this.phase='idle';clearInterval(this.timer);this.timer=null;this.mailRequestedAt=null;this.lastTurnAt=null;const session=this.session;this.session=null;this.onTick(null);this.onDiagnostic('session stopped');this.onState('STANDBY');if(session)await session.endSession().catch(()=>{});}
 sendText(text){if(this.phase!=='connected'||!this.session)return false;this.lastTurnAt=this.now();if(isMailReview(text))this.mailRequestedAt=this.now();this.session.setVolume({volume:1});this.session.sendUserMessage(text);this.onMessage('user',text);return true;}
 interrupt(){if(this.session){this.session.setVolume({volume:0});this.session.sendUserActivity();this.onState('LISTENING')}}
 setMuted(muted){this.session?.setVolume({volume:muted?0:1});}
}
