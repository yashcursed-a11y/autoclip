import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
const html = await readFile('index.html','utf8');
await writeFile('dist/index.html',html);
await cp('marketing','dist/marketing',{recursive:true});
await writeFile('dist/.nojekyll','');
console.log('Built website successfully (Zero download overhead).');
