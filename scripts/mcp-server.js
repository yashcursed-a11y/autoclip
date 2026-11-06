#!/usr/bin/env node

/**
 * AutoClip Model Context Protocol (MCP) Server
 * Connects Claude Desktop & ChatGPT to AutoClip Pro Studio via JSON-RPC 2.0.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getJobs, getJob, updateJob, getSettings } = require('../lib/db');
const { getLicenseStatus } = require('../lib/licensing');

const TOOLS = [
  {
    name: 'list_projects',
    description: 'List all video projects currently imported or processed in AutoClip Studio.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_video_transcript',
    description: 'Retrieve the full word-by-word spoken transcript with timestamps and audio contrast for a video project.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The unique ID of the video project.' }
      },
      required: ['jobId']
    }
  },
  {
    name: 'create_clip_candidate',
    description: 'Add a new discovered highlight clip or cut to the AutoClip CapCut timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The ID of the video project.' },
        start: { type: 'number', description: 'Start timestamp in seconds.' },
        end: { type: 'number', description: 'End timestamp in seconds.' },
        title: { type: 'string', description: 'Viral hook title for the clip.' },
        hook: { type: 'string', description: 'Opening dialogue sentence.' },
        score: { type: 'number', description: 'Viral rating between 1 and 100.' }
      },
      required: ['jobId', 'start', 'end', 'title']
    }
  },
  {
    name: 'get_license_and_quota',
    description: 'Check active AutoClip creator pass, weekly clip usage, and remaining quota.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'analyze_video_gemini_intelligence',
    description: 'PRO-TIER ONLY: Deep Gemini multimodal reasoning over video projects. Discovers story arcs, high-retention hooks, emotional climaxes, and distributes candidate clips across the full timeline. Free users cannot access this tool.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The unique ID of the video project.' },
        focus: { 
          type: 'string', 
          description: 'Focus objective for clipping: "viral_hooks", "story_arcs", "controversial_debates", "comedy_punchlines", or "educational_insights".',
          enum: ['viral_hooks', 'story_arcs', 'controversial_debates', 'comedy_punchlines', 'educational_insights']
        },
        clipCount: { type: 'number', description: 'Number of clips to discover across the timeline (default 5).' },
        autoAddToTimeline: { type: 'boolean', description: 'Automatically insert discovered clips into the project timeline (default true).' }
      },
      required: ['jobId']
    }
  }
];

async function handleToolCall(name, args) {
  if (name === 'list_projects') {
    const jobs = await getJobs();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jobs.map(j => ({
            id: j.id,
            name: j.sourceName || j.sourceUrl,
            duration: j.duration ? `${Math.round(j.duration)}s` : 'Unknown',
            status: j.status,
            clipsCount: (j.clips || []).length,
            renderedOutputs: (j.outputs || []).length
          })), null, 2)
        }
      ]
    };
  }

  if (name === 'get_video_transcript') {
    const job = await getJob(args.jobId);
    if (!job) {
      return { isError: true, content: [{ type: 'text', text: `Project ${args.jobId} not found.` }] };
    }
    const transcript = job.transcript || 'No transcript generated yet for this project.';
    return {
      content: [
        {
          type: 'text',
          text: typeof transcript === 'string' ? transcript : JSON.stringify(transcript.segments || transcript, null, 2)
        }
      ]
    };
  }

  if (name === 'create_clip_candidate') {
    const job = await getJob(args.jobId);
    if (!job) {
      return { isError: true, content: [{ type: 'text', text: `Project ${args.jobId} not found.` }] };
    }

    const newClip = {
      id: crypto.randomUUID ? crypto.randomUUID() : `clip_${Date.now()}`,
      start: Number(args.start),
      end: Number(args.end),
      title: args.title,
      hook: args.hook || args.title,
      score: Number(args.score) || 88,
      source: 'mcp-claude'
    };

    job.clips = job.clips || [];
    job.clips.push(newClip);
    job.clips.sort((a, b) => a.start - b.start);

    await updateJob(job.id, { clips: job.clips });

    return {
      content: [
        {
          type: 'text',
          text: `✓ Clip successfully added to AutoClip Timeline!\nID: ${newClip.id}\nRange: ${newClip.start}s - ${newClip.end}s\nTitle: "${newClip.title}"`
        }
      ]
    };
  }

  if (name === 'get_license_and_quota') {
    const status = getLicenseStatus();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }
      ]
    };
  }

  if (name === 'analyze_video_gemini_intelligence') {
    const status = getLicenseStatus();
    const isPro = status.isValid && ['starter', 'max', 'ultra', 'yearly'].includes(status.tier);

    if (!isPro) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: '🔒 ACCESS DENIED: Gemini Deep Video Intelligence is an AUTOCLIPIN Pro exclusive feature.\n\nFree tier accounts cannot use autonomous AI multi-modal clipping.\nUpgrade to Starter ($9/mo), Max ($20/mo), or Ultra ($50/mo) at https://autoclipin.com to unlock unlimited AI clipping in MCP.'
          }
        ]
      };
    }

    const job = await getJob(args.jobId);
    if (!job) {
      return { isError: true, content: [{ type: 'text', text: `Project ${args.jobId} not found.` }] };
    }

    if (!job.transcript || !job.transcript.segments || !job.transcript.segments.length) {
      return { isError: true, content: [{ type: 'text', text: `Project ${args.jobId} has no transcript. Transcribe or import the video first.` }] };
    }

    // Call AI intelligence engine with Gemini mode enabled
    const { findBestMoments } = require('../lib/analyzer');
    const settings = await getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings?.geminiApiKey;

    const clipCount = Math.max(1, Math.min(30, Number(args.clipCount || 5)));
    const clips = await findBestMoments(job.transcript, job.duration || 600, {
      analysisMode: apiKey ? 'gemini' : 'local',
      clipCount,
      templateId: args.focus || 'viral_hooks',
      minDuration: 20,
      maxDuration: 65
    });

    if (args.autoAddToTimeline !== false && clips && clips.length) {
      job.clips = job.clips || [];
      // Append non-overlapping clips
      for (const c of clips) {
        if (!job.clips.some(existing => Math.abs(existing.start - c.start) < 15)) {
          job.clips.push(c);
        }
      }
      job.clips.sort((a, b) => a.start - b.start);
      await updateJob(job.id, { clips: job.clips });
    }

    return {
      content: [
        {
          type: 'text',
          text: `✨ Gemini Multimodal Intelligence Analysis Complete!\n\nDiscovered ${clips.length} high-impact clips distributed across the timeline.\n${args.autoAddToTimeline !== false ? '✓ Clips automatically added to the Studio timeline.' : ''}\n\n` +
            JSON.stringify(clips.map((c, i) => ({
              rank: i + 1,
              start: `${Math.round(c.start)}s`,
              end: `${Math.round(c.end)}s`,
              duration: `${Math.round(c.end - c.start)}s`,
              title: c.title,
              score: c.score,
              viralBadge: c.viralBadge,
              category: c.category
            })), null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// JSON-RPC 2.0 stdio loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const msg = JSON.parse(line);
    const { id, method, params } = msg;

    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'autoclip-mcp', version: '1.0.1' }
      });
    } else if (method === 'notifications/initialized') {
      // client initialized notification
    } else if (method === 'tools/list') {
      sendResponse(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      const toolName = params.name;
      const toolArgs = params.arguments || {};
      const result = await handleToolCall(toolName, toolArgs);
      sendResponse(id, result);
    } else {
      sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    console.error('[MCP Error]', err);
  }
});

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}
