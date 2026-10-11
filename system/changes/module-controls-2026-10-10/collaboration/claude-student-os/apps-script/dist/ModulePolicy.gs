/* Shared availability rules. This module never writes work, evidence, reviews or marks. */
(function(root){
  'use strict';
  var states=['inherit','open','hidden','closed'];
  function resolve(config,ref,learnerId){
    var groups=(config.groups||[]).filter(function(g){return g.members.indexOf(learnerId)>=0;}).map(function(g){return g.id;});
    var rules=(config.rules||[]).filter(function(r){return (r.target_type==='sprint'?r.target_id===ref.sprint_id:r.target_id===ref.project_id)&&
      (r.audience_type==='class'||r.audience_type==='student'&&r.audience_id===learnerId||r.audience_type==='group'&&groups.indexOf(r.audience_id)>=0);});
    function rank(r){return ({class:0,group:10,student:20}[r.audience_type])+(r.target_type==='project'?1:0);}
    rules.sort(function(a,b){return rank(b)-rank(a)||a.id.localeCompare(b.id);});
    if(!rules.length)return {state:'inherit',required:null,source:'existing',rule_ids:[]};
    var winners=rules.filter(function(r){return rank(r)===rank(rules[0]);});
    // Overlapping groups use the more restrictive availability; the teacher sees the conflict.
    var order={hidden:3,closed:2,open:1};winners.sort(function(a,b){return order[b.state]-order[a.state]||a.id.localeCompare(b.id);});
    var first=winners[0],conflict=winners.some(function(r){return r.state!==first.state||r.required!==first.required;});
    return {state:first.state,required:first.state==='open'?winners.some(function(r){return r.required;}):false,source:first.audience_type,
      rule_ids:winners.map(function(r){return r.id;}),overlap:conflict};
  }
  function apply(item,policy){
    var a=JSON.parse(JSON.stringify(item));a.availability=policy;
    if(policy.state==='hidden')return null;
    if(policy.state==='closed') {a.deadline=null;if(a.submission){a.submission.url=null;a.submission.state='Closed by your teacher; saved work and feedback remain available.';}}
    if(policy.required===false)a.deadline=null;
    return a;
  }
  var api={states:states,resolve:resolve,apply:apply};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ModulePolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
