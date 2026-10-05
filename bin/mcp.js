#!/usr/bin/env node
'use strict';
const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
const {StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
const {ListToolsRequestSchema,CallToolRequestSchema,ListResourcesRequestSchema,ReadResourceRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
const API=require('../lib/api.js');
const object={type:'object',additionalProperties:true};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const definitions=[
  ['ap_catalog','List cue definitions, cognitive states, emotion formulas, parameters, audience profile and target-score meanings.',schema({}),()=>API.catalog()],
  ['ap_template','Create a work skeleton with unknown cues. Stage descriptions are reference data, not instructions.',schema({spec:object}),a=>API.createDocument(a.spec||{})],
  ['ap_evaluate','Compute annotated media trajectories and explain weak spots. Does not infer media cues or claim population accuracy.',schema({document:object,options:object},['document']),a=>API.evaluate(a.document,a.options)],
  ['ap_compare','Compare two creative artifacts with the same audience, target and formulas by default. Returns tradeoffs; higher score is not satisfaction probability.',schema({base:object,candidate:object,options:object},['base','candidate']),a=>API.compare(a.base,a.candidate,a.options)],
  ['ap_audience_panel','Evaluate explicitly stated audience profiles and a weighted scenario mixture. Not a measured population sample.',schema({document:object,profiles:{type:'array',items:object},options:object},['document','profiles']),a=>API.audiencePanel(a.document,a.profiles,a.options)],
  ['ap_sensitivity','Vary one parameter over explicit values to expose model sensitivity. Not a creative improvement.',schema({document:object,parameter:{type:'string'},values:{type:'array',items:{type:'number'}},options:object},['document','parameter','values']),a=>API.sensitivity(a.document,a.parameter,a.values,a.options)],
  ['ap_inspect_dataset','Inspect observation provenance, missing labels and group/split leakage before calibration.',schema({dataset:object},['dataset']),a=>require('../lib/calibration.js').inspectDataset(a.dataset)],
  ['ap_fit_calibration','Fit a versioned local output calibrator using train/validation; test is held out. Does not adopt or overwrite any model.',schema({dataset:object,options:object},['dataset']),a=>require('../lib/calibration.js').fitCalibration(a.dataset,a.options)],
  ['ap_apply_calibration','Apply an explicit frozen calibration model to independent prediction channels.',schema({predictions:object,model:object},['predictions','model']),a=>require('../lib/calibration.js').applyCalibration(a.predictions,a.model)],
  ['ap_tune_parameters','Evaluate an explicit finite parameter grid against independent human labels. Fit/select on train/validation, report test once, return candidate without adoption.',schema({dataset:object,options:object},['dataset','options']),a=>require('../lib/calibration.js').tuneParameters(a.dataset,a.options)]
];
const server=new Server({name:'ap-aesthetics',version:'0.2.0'},{capabilities:{tools:{},resources:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:definitions.map(([name,description,inputSchema])=>({name,description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}))}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
  const found=definitions.find(x=>x[0]===request.params.name);
  if(!found)return {isError:true,content:[{type:'text',text:'Unknown tool'}]};
  try{const result=await found[3](request.params.arguments||{});return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}
  catch(error){return {isError:true,content:[{type:'text',text:JSON.stringify({error:error.message})}]};}
});
server.setRequestHandler(ListResourcesRequestSchema,async()=>({resources:[{uri:'ap://catalog',name:'AP cognitive and emotion catalog',mimeType:'application/json'}]}));
server.setRequestHandler(ReadResourceRequestSchema,async request=>{
  if(request.params.uri!=='ap://catalog')throw new Error('Unknown resource');
  return {contents:[{uri:'ap://catalog',mimeType:'application/json',text:JSON.stringify(API.catalog())}]};
});
server.connect(new StdioServerTransport()).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
