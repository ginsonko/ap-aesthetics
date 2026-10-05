'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'skills','ap-aesthetics');
const target=path.resolve(process.argv[2]||path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills','ap-aesthetics'));
let backup=null;
if(fs.existsSync(target)){
  const marker=path.join(target,'.runtime.json');
  if(!fs.existsSync(marker))throw new Error('An unrelated existing skill occupies this name; inspect it before replacing.');
  const previous=JSON.parse(fs.readFileSync(marker,'utf8'));
  if(previous.packageName!=='ap-aesthetics')throw new Error('Existing skill is not managed by this package.');
  backup=path.join(os.homedir(),'.codex','skill-backups','ap-aesthetics-'+Date.now());
  fs.mkdirSync(path.dirname(backup),{recursive:true});fs.cpSync(target,backup,{recursive:true});
}
fs.mkdirSync(target,{recursive:true});
fs.cpSync(source,target,{recursive:true});
fs.writeFileSync(path.join(target,'.runtime.json'),JSON.stringify({packageName:'ap-aesthetics',packageRoot:root,version:'0.2.0'},null,2)+'\n');
console.log(JSON.stringify({installed:target,packageRoot:root,backup,discovery:'New sessions can discover the skill; current clients may need a refresh.'}));
