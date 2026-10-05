#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const API=require('../lib/api.js');
const args=process.argv.slice(2),command=args.shift();
const read=p=>JSON.parse(fs.readFileSync(p==='-'?0:p,'utf8').replace(/^\uFEFF/,''));
function main(){
  let result;
  switch(command){
    case 'catalog':result=API.catalog();break;
    case 'template':result=API.createDocument(args[0]?read(args[0]):{});break;
    case 'evaluate':result=API.evaluate(read(args[0]),args[1]?read(args[1]):{});break;
    case 'compare':result=API.compare(read(args[0]),read(args[1]),args[2]?read(args[2]):{});break;
    case 'panel':result=API.audiencePanel(read(args[0]),read(args[1]));break;
    case 'sensitivity':result=API.sensitivity(read(args[0]),args[1],JSON.parse(args[2]));break;
    case 'inspect':result=require('../lib/calibration.js').inspectDataset(read(args[0]));break;
    case 'fit':result=require('../lib/calibration.js').fitCalibration(read(args[0]),args[1]?read(args[1]):{});break;
    case 'apply':result=require('../lib/calibration.js').applyCalibration(read(args[0]),read(args[1]));break;
    case 'tune':result=require('../lib/calibration.js').tuneParameters(read(args[0]),read(args[1]));break;
    default: process.stdout.write('AP Aesthetics 0.2\nCommands: catalog | template [spec.json] | evaluate work.json [options.json] | compare base.json candidate.json | panel work.json profiles.json | sensitivity work.json parameter "[values]" | inspect dataset.json | fit dataset.json [options.json] | apply predictions.json model.json | tune dataset.json options.json\nUse - to read JSON from stdin. Output is JSON; redirect to save.\n');return;
  }
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
try{main();}catch(error){process.stderr.write(JSON.stringify({error:error.message})+'\n');process.exitCode=1;}
