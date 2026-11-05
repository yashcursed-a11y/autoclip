
const { findBestMoments } = require('./lib/analyzer');
(async () => {
  const dummyTranscript = {
    duration: 120,
    audio_energy: [0.1, 0.2, 0.8, 0.9, 0.95, 0.5, 0.2],
    segments: [
      { id: 0, start: 2.0, end: 12.0, text: 'Wait until you see how crazy this play was!', words: [] },
      { id: 1, start: 12.5, end: 25.0, text: 'We were down by ten points and nobody believed we could win.', words: [] },
      { id: 2, start: 25.5, end: 38.0, text: 'Then I made the final shot and the entire arena went wild!', words: [] }
    ]
  };

  const moments = await findBestMoments(dummyTranscript, 120, { clipCount: 2, templateId: 'viral' });
  console.log('Result count:', moments.length);
  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    console.log('Clip ' + (i+1) + ': ' + m.title + ' | Score: ' + m.score + ' | ' + m.start + 's - ' + m.end + 's');
    console.log('  Reason: ' + m.reason);
  }
})();
