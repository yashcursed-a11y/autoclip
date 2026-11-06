const {cpSync,copyFileSync,existsSync} = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const source = path.join(root,'website');
if (!existsSync(path.join(source,'index.html'))) throw new Error('Website source not found');
copyFileSync(path.join(source,'index.html'),path.join(root,'public','landing.html'));
cpSync(path.join(source,'marketing'),path.join(root,'public','marketing'),{recursive:true});
console.log('Updated the app landing page from website source.');
