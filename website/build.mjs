import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {stageDownload} = createRequire(import.meta.url)('./stage-download.cjs');
await mkdir('dist',{recursive:true});
const bundleDownload=process.argv.includes('--with-download');
const filename='AUTOCLIPIN-Windows-v1.0.1.zip';
const href=bundleDownload ? `./downloads/${filename}` : `../../dist/${filename}`;
const html=(await readFile('index.html','utf8')).replaceAll(`../dist/${filename}`,href);
await writeFile('dist/index.html',html);
await cp('marketing','dist/marketing',{recursive:true});
// Local previews reuse the original ZIP; only explicitly requested release bundles copy it.
if(bundleDownload)stageDownload(fileURLToPath(new URL('./dist/downloads',import.meta.url)));
await writeFile('dist/.nojekyll','');
console.log(bundleDownload?'Built website with download ZIP.':'Built website preview using original ZIP; no large download copies created.');
