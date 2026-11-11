(function(root){'use strict';
async function read(path,base,manifest){
 const compressed=manifest?.compression==='gzip'&&!(manifest.plainFiles||[]).includes(path),url=new URL(path+(compressed?'.gz':''),base);if(manifest)url.searchParams.set('v',manifest.version);
 const r=await fetch(url.href,{cache:path==='manifest.json'?'no-cache':'default'});if(!r.ok)throw Error('טעינת נתונים נכשלה: '+path+' ('+r.status+')');if(!compressed)return r.json();
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes[0]!==31||bytes[1]!==139){return JSON.parse(new TextDecoder().decode(bytes));}
 if(typeof DecompressionStream==='undefined')throw Error('נדרש דפדפן עדכני לפתיחת הנתונים הדחוסים.');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());
}
const api={read};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DataFiles=api;
})(typeof self!=='undefined'?self:globalThis);
