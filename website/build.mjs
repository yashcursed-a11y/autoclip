import {cp,mkdir,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for (const name of ['index.html','marketing']) await cp(name,`dist/${name}`,{recursive:true});
await writeFile('dist/.nojekyll','');
console.log('Built static AutoClip website.');
