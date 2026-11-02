import http from 'node:http';
import {fileURLToPath} from 'node:url';
export const server=http.createServer((req,res)=>{
 const health=new URL(req.url,'http://localhost').pathname==='/health';
 res.writeHead(health?200:410,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
 res.end(health?'Shutdown deployment is running.':'JARVIS has been removed.');
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3000),'0.0.0.0');
