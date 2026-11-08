/**
 * Downloads disabled - AUTOCLIPIN runs as Cloud Web Studio
 */
function stageDownload() {
  return null;
}
module.exports = { stageDownload };
  try { fs.linkSync(source, target); }
  catch { fs.copyFileSync(source, target); }
  return target;
}

module.exports = {stageDownload, filename};
