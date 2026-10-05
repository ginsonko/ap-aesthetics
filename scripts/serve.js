#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.AP_AESTHETICS_PORT||process.argv[2]||18933);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid local preview port');
const allowed=new Set(['index.html','web/index.html','web/style.css','web/app.js','web/catalog.js','web/engine.js','web/examples.js',
 'dist/ap-aesthetics.html','dist/manifest.json','demo/index.html','demo/experience.css','demo/experience.js','demo/experience-data.js',
 'demo/experience.mp4','demo/cover.png','demo/predictions.json','docs/MODEL.md','docs/CALIBRATION.md','docs/EXPERIENCE.md','examples/magi.json']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.mp4':'video/mp4'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');}catch{res.writeHead(400);res.end();return;}
 if(!name||name.endsWith('/'))name+='index.html';
 if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}
 const file=path.join(root,name);let stat;
 try{const resolved=fs.realpathSync(file);if(!resolved.startsWith(fs.realpathSync(root)+path.sep))throw new Error('Outside root');stat=fs.statSync(resolved);if(!stat.isFile())throw new Error('Not a file');}catch{res.writeHead(404);res.end(name==='demo/experience.mp4'?'Render the demo first. See docs/EXPERIENCE.md.':'Not found');return;}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
 let start=0,end=stat.size-1,code=200;
 if(req.headers.range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
  if(!m[1])start=Math.max(0,stat.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
  if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
  code=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
 }
 headers['Content-Length']=end-start+1;res.writeHead(code,headers);
 if(req.method==='HEAD'){res.end();return;}
 const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`AP Aesthetics: http://127.0.0.1:${port}/ (local only)`)).on('error',e=>{console.error(e.message);process.exitCode=1;});
