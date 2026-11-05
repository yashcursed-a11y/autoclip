const { getPosts, getPost, updatePost, getAccounts, appendPostLog, getSettings } = require('./db');
const { dispatchDirectPost } = require('./publishers');

let schedulerInterval = null;
let isProcessingQueue = false;

// Initialize automatic posting scheduler daemon
function initScheduler() {
  if (schedulerInterval) return;

  console.log('[Scheduler] Social auto-post scheduler initialized (checking every 20s)...');

  schedulerInterval = setInterval(async () => {
    if (isProcessingQueue) return;
    try {
      isProcessingQueue = true;
      const now = new Date();
      const posts = await getPosts();
      const duePosts = posts.filter(p => p.status === 'scheduled' && new Date(p.scheduledAt) <= now);

      for (const post of duePosts) {
        console.log(`[Scheduler] Due post detected: "${post.title || post.clipName}" (ID: ${post.id}). Executing multi-account publish...`);
        await publishPost(post.id).catch(err => {
          console.error(`[Scheduler] Failed to auto-publish post ${post.id}:`, err);
        });
      }
    } catch (err) {
      console.error('[Scheduler] Queue check error:', err);
    } finally {
      isProcessingQueue = false;
    }
  }, 20000);
}

// Publish post across target accounts (supports 10+ accounts)
async function publishPost(postId) {
  const post = await getPost(postId);
  if (!post) throw new Error(`Post with id ${postId} not found.`);

  await updatePost(postId, { status: 'publishing' });

  const allAccounts = await getAccounts();
  const targetAccounts = allAccounts.filter(a => {
    if (!a.enabled) return false;
    if (!post.accountIds || post.accountIds.length === 0) return true; // all if unspecified
    return post.accountIds.includes(a.id);
  });

  const deliveryResults = [];
  const settings = await getSettings();

  for (const acc of targetAccounts) {
    let directResult;
    try {
      directResult = await dispatchDirectPost({
        videoPath: post.videoPath,
        videoUrl: post.videoUrl,
        title: post.title || post.clipName,
        caption: post.caption || '',
        hashtags: post.hashtags || [],
        firstComment: post.firstComment || '',
        privacy: acc.privacy || 'public',
        account: acc
      });
    } catch (directErr) {
      directResult = {
        success: false,
        platform: acc.platform,
        message: `AutoClip direct publishing notice: ${directErr.message}`
      };
    }

    const delivered = Boolean(directResult.success);
    const deliveryMessage = directResult.message || `Published to ${acc.handle}`;
    const liveUrl = directResult.url || '';

    deliveryResults.push({
      accountId: acc.id,
      accountName: acc.name,
      handle: acc.handle,
      platform: acc.platform,
      delivered,
      liveUrl,
      postId: directResult.postId,
      message: deliveryMessage,
      timestamp: new Date().toISOString()
    });

    await appendPostLog({
      postId: post.id,
      accountId: acc.id,
      handle: acc.handle,
      platform: acc.platform,
      title: post.title,
      liveUrl,
      status: delivered ? 'success' : 'failed',
      message: deliveryMessage
    });
  }

  const allSuccess = deliveryResults.every(r => r.delivered);
  const updated = await updatePost(postId, {
    status: allSuccess ? 'published' : 'failed',
    publishedAt: new Date().toISOString(),
    deliveryResults
  });

  console.log(`[Scheduler] Post ${postId} finished publishing across ${deliveryResults.length} accounts.`);
  return updated;
}

// Generate viral title, hook caption & hashtags with Gemini or smart heuristic
async function generatePostMetadata(title, transcriptText = '', platform = 'all', apiKey = null) {
  const cleanTitle = (title || 'Insane Moment').trim();

  // Try Gemini if apiKey provided
  if (apiKey) {
    try {
      const prompt = `You are a world-class viral short-form social media manager for TikTok, YouTube Shorts, and Instagram Reels.
Generate high-CTR, retention-optimized copywriting for this video clip:
Clip Title: "${cleanTitle}"
Transcript context (optional): "${(transcriptText || '').slice(0, 800)}"

Return STRICTLY a JSON object with this format (no markdown formatting, just pure JSON):
{
  "titles": [
    "Viral Click Hook Title 1",
    "Curiosity Gap Title 2",
    "High Emotion Title 3"
  ],
  "caption": "Short punchy caption with 2-3 sentences and emoji hooks to drive comments and retention.",
  "hashtags": ["#fyp", "#viral", "#shorts", "#trending", "#reels"],
  "firstComment": "Engaging question or call to action to boost the comment section algorithm."
}`;

      const models = ['gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-2.5-flash'];
      for (const model of models) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4500);

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
            })
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
              const parsed = JSON.parse(cleaned);
              return {
                title: parsed.titles?.[0] || cleanTitle,
                altTitles: parsed.titles || [cleanTitle],
                caption: parsed.caption || '',
                hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : ['#fyp', '#viral', '#shorts'],
                firstComment: parsed.firstComment || 'Which part surprised you the most? 👇'
              };
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Heuristic High-Performing Templates
  const genericHashtags = ['#fyp', '#viral', '#shorts', '#trending', '#reels', '#foryou', '#explore', '#contentcreator', '#viralvideo'];
  const platformTags = {
    tiktok: ['#tiktokviral', '#xyzbca', '#fypシ', '#storytime'],
    shorts: ['#youtubeshorts', '#shortsvideo', '#subscribe', '#viralshorts'],
    reels: ['#reelsinstagram', '#reelsviral', '#reelsvideo', '#instadaily'],
    twitter: ['#viral', '#trending', '#video', '#mustwatch']
  };

  const selectedTags = Array.from(new Set([
    ...genericHashtags,
    ...(platformTags[platform] || platformTags.tiktok)
  ]));

  return {
    title: cleanTitle,
    altTitles: [
      `Wait for the end... 🤯 ${cleanTitle}`,
      `Nobody expected THIS to happen: ${cleanTitle}`,
      `The moment everything changed | ${cleanTitle}`
    ],
    caption: `You will NOT believe what happened here! Watch until the end... 🔥\n\nWhat would you have done in this situation? Let me know below! 👇`,
    hashtags: selectedTags.slice(0, 10),
    firstComment: `Tag someone who needs to see this! Full video link in bio 👇🔥`
  };
}

module.exports = {
  initScheduler,
  publishPost,
  generatePostMetadata
};
