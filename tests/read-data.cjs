const fs=require('fs'),path=require('path'),zlib=require('zlib');
module.exports=function read(name){const p=path.join(__dirname,'..','data',name);return JSON.parse(fs.existsSync(p)?fs.readFileSync(p):zlib.gunzipSync(fs.readFileSync(p+'.gz')));};
