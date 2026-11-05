const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { getPosts } = require('./db');

let cache = {
  timestamp: 0,
  data: null
};

async function fetchVideoStatsWithYtDlp(videoId) {
  const url = `https://youtube.com/shorts/${videoId}`;
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      url
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    return {
      videoId,
      title: info.title || 'YouTube Short',
      viewCount: Number(info.view_count) || 0,
      likeCount: Number(info.like_count) || 0,
      commentCount: Number(info.comment_count) || 0,
      duration: Math.round(info.duration || 0),
      thumbnailUrl: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      uploadDate: info.upload_date || '',
      liveUrl: url,
      channel: info.uploader || info.channel || 'Connected Channel',
      status: 'active'
    };
  } catch (err) {
    return {
      videoId,
      title: 'YouTube Short',
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      duration: 0,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      liveUrl: url,
      channel: 'YouTube Shorts',
      status: 'unavailable'
    };
  }
}

async function getShortsAnalytics(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache.data && (now - cache.timestamp < 3 * 60 * 1000)) {
    return cache.data;
  }

  const posts = await getPosts();
  const videoIds = [];
  const postMetaMap = new Map();

  for (const post of posts) {
    if (Array.isArray(post.deliveryResults)) {
      for (const res of post.deliveryResults) {
        if (res.platform === 'shorts' && (res.postId || res.liveUrl)) {
          let vid = res.postId;
          if (!vid && res.liveUrl) {
            const m = res.liveUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/);
            if (m) vid = m[1];
          }
          // Only query real YouTube 11-character video IDs
          if (vid && /^[a-zA-Z0-9_-]{11}$/.test(vid) && !videoIds.includes(vid)) {
            videoIds.push(vid);
            postMetaMap.set(vid, {
              postTitle: post.title,
              accountName: res.accountName || res.handle || 'Connected Channel',
              publishedAt: post.publishedAt || res.timestamp,
              hashtags: post.hashtags || []
            });
          }
        }
      }
    }
  }

  // Fetch stats concurrently with Promise.all
  const shorts = await Promise.all(videoIds.map(async (vid) => {
    const stats = await fetchVideoStatsWithYtDlp(vid);
    const meta = postMetaMap.get(vid);
    if (meta) {
      stats.postTitle = meta.postTitle;
      stats.accountName = meta.accountName;
      stats.publishedAt = meta.publishedAt;
      stats.hashtags = meta.hashtags;
    }
    return stats;
  }));

  // Sort by viewCount descending (top performing first)
  shorts.sort((a, b) => b.viewCount - a.viewCount);

  const totalViews = shorts.reduce((sum, s) => sum + s.viewCount, 0);
  const totalLikes = shorts.reduce((sum, s) => sum + s.likeCount, 0);
  const totalComments = shorts.reduce((sum, s) => sum + s.commentCount, 0);

  const result = {
    summary: {
      totalShorts: shorts.length,
      totalViews,
      totalLikes,
      totalComments,
      topShort: shorts[0] || null,
      lastUpdated: new Date().toISOString()
    },
    shorts
  };

  cache = {
    timestamp: now,
    data: result
  };

  return result;
}

module.exports = {
  getShortsAnalytics
};
