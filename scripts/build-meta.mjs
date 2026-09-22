import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
let sha=process.env.APP_BUILD_SHA||'local';
try{sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
writeFileSync('dist/version.json',JSON.stringify({app:'openwater',sha,builtAt:new Date().toISOString()})+'\n');
