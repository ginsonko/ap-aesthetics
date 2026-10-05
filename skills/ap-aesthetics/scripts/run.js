#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const skill=path.resolve(__dirname,'..');
let root;
const runtime=path.join(skill,'.runtime.json');
if(fs.existsSync(runtime))root=JSON.parse(fs.readFileSync(runtime,'utf8')).packageRoot;
else root=path.resolve(skill,'../..');
const cli=path.join(root,'bin','cli.js');
if(!fs.existsSync(cli)){process.stderr.write('AP Aesthetics package not found. Run npm run install:skill from the repository to register its local path.\n');process.exit(1);}
const result=spawnSync(process.execPath,[cli,...process.argv.slice(2)],{stdio:'inherit'});
if(result.error){process.stderr.write(result.error.message+'\n');process.exitCode=1;}else process.exitCode=result.status??1;
