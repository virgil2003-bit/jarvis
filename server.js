import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript'};
export const server = http.createServer(async (req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html','style.css','app.js'].includes(filename)) { res.writeHead(404); res.end('Not found'); return; }
  try { const body = await readFile(path.join(root, filename)); res.writeHead(200, {'Content-Type':types[path.extname(filename)]+'; charset=utf-8'}); res.end(body); }
  catch { res.writeHead(500); res.end('Unable to load interface'); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('JARVIS listening on port '+(process.env.PORT || 3000)));
