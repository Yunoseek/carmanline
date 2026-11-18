import { mkdir, copyFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('web/vendor', { recursive:true });
for(const file of ['katex.min.css','katex.min.js']) await copyFile('node_modules/katex/dist/'+file,'web/vendor/'+file);
await cp('node_modules/katex/dist/fonts','web/vendor/fonts',{recursive:true});
await copyFile('node_modules/katex/LICENSE','web/vendor/KATEX-LICENSE.txt');
await build({entryPoints:['web/app.mjs'],bundle:true,outfile:'web/app.bundle.js',format:'iife',target:['chrome52'],charset:'utf8',banner:{js:"if(!Object.values){Object.values=function(o){return Object.keys(o).map(function(k){return o[k]})}}if(!String.prototype.padStart){String.prototype.padStart=function(n,p){p=p===undefined?' ':String(p);var s=String(this),need=Math.max(0,n-s.length),prefix='';if(!p)return s;while(prefix.length<need)prefix+=p;return prefix.slice(0,need)+s;};}"}});
console.log('Offline formula assets ready.');
