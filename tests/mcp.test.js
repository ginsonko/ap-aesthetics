'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const API=require('../lib/api.js'),X=require('../web/examples.js');
test('real stdio MCP initialize, catalog, evaluate, comparison and tool error',async()=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(__dirname,'../bin/mcp.js')],stderr:'pipe'});
 const client=new Client({name:'ap-integration-test',version:'1'});
 try{
  await client.connect(transport);const listed=await client.listTools();assert.equal(listed.tools.length,10);
  const c=await client.callTool({name:'ap_catalog',arguments:{}});assert.equal(c.structuredContent.states.length,47);
  const d=X.make();const r=await client.callTool({name:'ap_evaluate',arguments:{document:d}});assert.equal(r.structuredContent.document_sha256,API.hash(d));
  const b=await client.callTool({name:'ap_compare',arguments:{base:d,candidate:X.make('long_wait')}});assert.ok(b.structuredContent.score_delta<0);
  const bad=await client.callTool({name:'ap_evaluate',arguments:{document:{schema:'wrong'}}});assert.equal(bad.isError,true);
  const resources=await client.listResources();assert.equal(resources.resources[0].uri,'ap://catalog');
  const template=await client.callTool({name:'ap_template',arguments:{spec:{stages:[{title:'Unannotated',duration:3}]}}});assert.equal(template.structuredContent.scenes[0].cues.care,null);
  const panel=await client.callTool({name:'ap_audience_panel',arguments:{document:d,profiles:[{id:'a',weight:1,profile:{relationship:.7}}]}});assert.equal(panel.structuredContent.groups.length,1);
  const sensitivity=await client.callTool({name:'ap_sensitivity',arguments:{document:d,parameter:'fatigueHalf',values:[40,80]}});assert.equal(sensitivity.structuredContent.runs.length,2);
  const dataset=require('../examples/calibration-synthetic.json');
  const inspected=await client.callTool({name:'ap_inspect_dataset',arguments:{dataset}});assert.equal(inspected.structuredContent.valid,true);
  const fitted=await client.callTool({name:'ap_fit_calibration',arguments:{dataset}});assert.equal(fitted.structuredContent.schema,'ap-aesthetics-calibration/1');
  const applied=await client.callTool({name:'ap_apply_calibration',arguments:{predictions:{warmth:.5,unresolved:null},model:fitted.structuredContent}});assert.ok(Math.abs(applied.structuredContent.warmth-.475)<1e-10);assert.equal(applied.structuredContent.unresolved,null);
  const tuned=await client.callTool({name:'ap_tune_parameters',arguments:{dataset:require('../examples/calibration-tuning-synthetic.json'),options:require('../examples/calibration-tuning-options.json')}});assert.equal(tuned.structuredContent.parameters.emotionGain,.7);assert.ok(tuned.structuredContent.test.mse<1e-20);
  const leaky=JSON.parse(JSON.stringify(dataset));leaky.observations[12].group_id=leaky.observations[0].group_id;
  const rejected=await client.callTool({name:'ap_fit_calibration',arguments:{dataset:leaky}});assert.equal(rejected.isError,true);
 }finally{await client.close();}
});
