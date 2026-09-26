/* One atomic localStorage value owns application state. Original keys remain a migration fallback until the first successful commit. */
(function(root){
  'use strict';
  const KEY='em_app_store_v2',KEYS=['tos_evidence_v1','tos_rosters_v1','tos_assessed_v1','tos_rubrics_v1','tos_termstart_v1','tos_duedates_v1','em_studio_v1'];
  function create(storage){
    let revision=null,problem='',pending=null;
    function read(){const raw=storage.getItem(KEY);if(raw===null)return null;const b=JSON.parse(raw);if(!b||b.schema!==2||!Number.isInteger(b.revision)||!b.values||Array.isArray(b.values)||Object.keys(b.values).some(k=>!KEYS.includes(k)||typeof b.values[k]!=='string'))throw Error('Application storage is damaged. Download recovery data before restoring a valid full backup.');return b;}
    try{const b=read();revision=b?.revision??0;for(const k of KEYS){const raw=b?b.values[k]:storage.getItem(k);if(raw!=null){const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Stored '+k+' is damaged. Download recovery data and restore a valid full backup.');}}}catch(e){problem=e.message;}
    function getItem(key){if(!KEYS.includes(key))return storage.getItem(key);if(problem)return null;const b=read();return b?(b.values[key]??null):storage.getItem(key);}
    function commit(updates,{replace=false,recover=false}={}){
      pending=updates;
      try{
        if(problem&&!recover)throw Error(problem);
        let current;try{current=read();}catch(e){if(!recover)throw e;current=null;}
        if(!recover&&(current?.revision??0)!==revision)throw Error('Another tab changed the records. Download the unsaved change, then reload before saving.');
        const values=replace?{}:current?{...current.values}:Object.fromEntries(KEYS.map(k=>[k,storage.getItem(k)]).filter(([,v])=>v!==null));
        for(const [key,value] of Object.entries(updates)){if(!KEYS.includes(key)||typeof value!=='string')throw Error('Unsupported application storage field.');values[key]=value;}
        const b={schema:2,revision:(current?.revision??0)+1,committedAt:new Date().toISOString(),values};
        storage.setItem(KEY,JSON.stringify(b)); // Atomic: memory advances only after this succeeds.
        revision=b.revision;problem='';pending=null;return {ok:true};
      }catch(e){return {ok:false,error:e.message,pending};}
    }
    function setItem(k,v){if(!KEYS.includes(k))return storage.setItem(k,v);const r=commit({[k]:v});if(!r.ok)throw Error(r.error);}
    return {KEY,KEYS,getItem,setItem,commit,block(message){problem=message;},get problem(){return problem;},recovery:()=>JSON.stringify({app:'evidence-map-storage-recovery',raw:storage.getItem(KEY),legacy:Object.fromEntries(KEYS.map(k=>[k,storage.getItem(k)])),unsaved:pending},null,2)};
  }
  if(typeof module==='object'&&module.exports)module.exports={create,KEY,KEYS};else root.AppStorage=create(root.localStorage);
})(typeof window==='undefined'?globalThis:window);
