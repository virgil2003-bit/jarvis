import {build} from 'esbuild';
import {copyFile,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const result=await build({entryPoints:['public/live-voice.js'],outfile:'public/live-voice.bundle.js',bundle:true,format:'esm',minify:true,legalComments:'eof',metafile:true,target:['chrome110','edge110','safari16.4']});
const packages=new Set();
for(const input of Object.keys(result.metafile.inputs)){
 if(!input.includes('node_modules/'))continue;
 let dir=path.dirname(path.resolve(input));
 while(dir!==path.dirname(dir)){
  try{const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));if(pkg.name){packages.add(dir);break;}}catch{}
  dir=path.dirname(dir);
 }
}
let notices='Third-party notices for the bundled ElevenLabs conversation client.\n\n';
for(const dir of [...packages].sort()){
 const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));notices+=`${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license||'See package license')}\n`;
 for(const file of (await readdir(dir)).filter(f=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(f))){try{notices+=await readFile(path.join(dir,file),'utf8')+'\n'}catch{}}
 notices+='\n';
}
await writeFile('public/live-voice.NOTICES.txt',notices);
await copyFile('public/live-voice.bundle.js','docs/live-voice.bundle.js');
await copyFile('public/live-voice.NOTICES.txt','docs/live-voice.NOTICES.txt');
