const test = require('node:test');
const assert = require('node:assert/strict');
const {
  KNOWLEDGE_TOPICS,
  matchKnowledgeTopic,
  answerAssistantQuery
} = require('../lib/assistant-knowledge');

test('Assistant: matches YouTube API setup intent correctly', () => {
  const topic = matchKnowledgeTopic('how to create youtube api');
  assert.ok(topic);
  assert.equal(topic.id, 'youtube_api');
  assert.match(topic.response, /console\.cloud\.google\.com/i);
  assert.match(topic.response, /OAuth consent screen/i);
});

test('Assistant: matches Google Drive API setup intent correctly', () => {
  const topic = matchKnowledgeTopic('how to connect google drive api');
  assert.ok(topic);
  assert.equal(topic.id, 'google_drive');
  assert.match(topic.response, /google-oauth\.json/i);
});

test('Assistant: matches MCP server intent and provides script path', () => {
  const topic = matchKnowledgeTopic('how to connect claude desktop via mcp');
  assert.ok(topic);
  assert.equal(topic.id, 'mcp_protocol');
  assert.match(topic.response, /mcp-server\.js/i);
  assert.match(topic.response, /claude_desktop_config\.json/i);
});

test('Assistant: matches Beast Engine v2.0 and Brock Johnson 1,300 hook data', () => {
  const topic = matchKnowledgeTopic('tell me about beast engine and brock hooks');
  assert.ok(topic);
  assert.equal(topic.id, 'beast_engine');
  assert.match(topic.response, /1,300/i);
  assert.match(topic.response, /2\.3x/i);
});

test('Assistant: matches Daniel Bitton 31-second loop intent', () => {
  const topic = matchKnowledgeTopic('how does daniel bitton 31 second rewatch loop work');
  assert.ok(topic);
  assert.equal(topic.id, 'daniel_bitton_loop');
  assert.match(topic.response, /200%/i);
});

test('Assistant: answers queries and returns formatted response with suggestions', async () => {
  const res = await answerAssistantQuery('how do i create yt api credentials?');
  assert.ok(res.text);
  assert.match(res.text, /YouTube Data API v3/i);
  assert.ok(Array.isArray(res.suggestedTopics));
});

test('Assistant: returns live system hardware diagnostics when asked', async () => {
  const res = await answerAssistantQuery('what is the system status and ram?');
  assert.ok(res.text);
  assert.match(res.text, /FFmpeg/i);
  assert.match(res.text, /Faster-Whisper/i);
  assert.equal(res.actionButton.action, 'open_processes');
});
