import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './server.js';
test('remembered device authenticates text, voice, email and live endpoints without resending its password',async()=>{
 const env={JARVIS_ACCESS_TOKEN:'private-device-password-for-tests',OPENAI_API_KEY:'not-real-openai',ELEVENLABS_API_KEY:'not-real-eleven',ELEVENLABS_AGENT_ID:'agent_private_test',ICLOUD_EMAIL:'owner@icloud.com',ICLOUD_APP_PASSWORD:'not-real-apple'};
 const request=async url=>url.includes('/audio/speech')?new Response(Buffer.from([73,68,51])):url.includes('/responses')?Response.json({output:[{type:'message',content:[{type:'output_text',text:'Hello.'}]}]}):url.includes('/conversation/token')?Response.json({token:'temporary-conversation-token'}):Response.json({platform_settings:{auth:{enable_auth:true}},conversation_config:{turn:{turn_eagerness:'normal'},agent:{prompt:{prompt:'Custom',max_tokens:220}}}});
 const server=createServer({env,request,readMail:async()=>[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:env.JARVIS_ACCESS_TOKEN,remember:true})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];const bodies={'/api/chat':{messages:[{role:'user',content:'Hello'}]},'/api/speech':{text:'Hello'},'/api/mail/check':{},'/api/mail/review':{},'/api/live/readiness':{},'/api/live/session':{}};
 for(const [route,body]of Object.entries(bodies)){const options={method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)};assert.equal((await fetch(base+route,options)).status,200,route);assert.equal((await fetch(base+route,{...options,headers:{'Content-Type':'application/json'}})).status,401,route+' without device session');}
 env.JARVIS_ACCESS_TOKEN+='-rotated';assert.deepEqual(await(await fetch(base+'/api/auth/status',{headers:{Cookie:cookie}})).json(),{authenticated:false});
 }finally{await new Promise(r=>server.close(r))}
});
