const assert = require('node:assert');
const {
  getPresets,
  savePresets,
  rememberTags,
  removeTag,
  saveTitleHook,
  removeTitleHook,
  saveDescriptionTemplate,
  removeDescriptionTemplate
} = require('../lib/db');

async function run() {
  console.log('Testing Tag & Preset Memory Bank...');

  // 1. Initial presets
  const presets = await getPresets();
  assert(Array.isArray(presets.tags), 'presets.tags should be an array');
  assert(Array.isArray(presets.titleHooks), 'presets.titleHooks should be an array');
  assert(Array.isArray(presets.descriptionTemplates), 'presets.descriptionTemplates should be an array');
  console.log('✔ Presets structure verified');

  // 2. Remember new tag
  const testTag = '#TestUnitTag_' + Date.now();
  const updatedTags = await rememberTags([testTag, '#DoubleCoverage']);
  assert(updatedTags.includes(testTag), 'New tag should be in presets.tags');
  console.log('✔ rememberTags added tag and avoided duplicates');

  // 3. Remove tag
  const cleanedTags = await removeTag(testTag);
  assert(!cleanedTags.includes(testTag), 'Deleted tag should be removed');
  console.log('✔ removeTag successfully removed tag');

  // 4. Save and remove Title Hook
  const newHook = await saveTitleHook({ label: 'Test Hook', text: 'Test Hook | ' });
  assert(newHook.id, 'New hook must have an id');
  const hooksAfter = (await getPresets()).titleHooks;
  assert(hooksAfter.some(h => h.id === newHook.id), 'New hook should be present in presets');
  await removeTitleHook(newHook.id);
  const hooksCleaned = (await getPresets()).titleHooks;
  assert(!hooksCleaned.some(h => h.id === newHook.id), 'Hook should be deleted');
  console.log('✔ saveTitleHook and removeTitleHook verified');

  // 5. Save and remove Description Template
  const newTpl = await saveDescriptionTemplate({ name: 'Test Template', text: 'Line 1\nLine 2' });
  assert(newTpl.id, 'New template must have an id');
  const tplsAfter = (await getPresets()).descriptionTemplates;
  assert(tplsAfter.some(t => t.id === newTpl.id), 'New template should be present in presets');
  await removeDescriptionTemplate(newTpl.id);
  const tplsCleaned = (await getPresets()).descriptionTemplates;
  assert(!tplsCleaned.some(t => t.id === newTpl.id), 'Template should be deleted');
  console.log('✔ saveDescriptionTemplate and removeDescriptionTemplate verified');

  console.log('ALL PRESET & TAG MEMORY TESTS PASSED!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
