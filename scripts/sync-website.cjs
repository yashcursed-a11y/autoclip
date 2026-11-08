const {cpSync,readFileSync,writeFileSync,existsSync} = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const source = path.join(root,'website');
if (!existsSync(path.join(source,'index.html'))) throw new Error('Website source not found');
const html=readFileSync(path.join(source,'index.html'),'utf8');
writeFileSync(path.join(root,'public','landing.html'),html);
cpSync(path.join(source,'marketing'),path.join(root,'public','marketing'),{recursive:true});
console.log('Updated the app landing page from website source (Zero download overhead).');
