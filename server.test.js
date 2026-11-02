import { test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from './server.js';
test('serves the dashboard and assets; rejects unknown paths',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try { const base=`http://127.0.0.1:${server.address().port}`;
 for(const [route,type,content] of [['/','text/html','NEURAL INTERFACE'],['/style.css','text/css','@media'],['/app.js','text/javascript','SpeechRecognition']]){
 const res=await fetch(base+route); assert.equal(res.status,200);assert.ok(res.headers.get('content-type').includes(type));assert.ok((await res.text()).includes(content));}
 assert.equal((await fetch(base+'/package.json')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
