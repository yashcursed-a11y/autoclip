---
name: find-best-clips
description: Finds and ranks self-contained short-form clip candidates from timestamped long-form video transcripts for AUTOCLIP. Use for viral, funny, gaming, story, reaction, podcast, or educational moments.
---

# Find Best Clips (AUTOCLIP Moment Selection Engine)

This skill directs an agent or model to analyze timestamped transcripts from hours-long videos and extract top-ranking, self-contained short-form clips (for TikTok, YouTube Shorts, Instagram Reels, and X).

---

## 1. Core Principles

1. **Grounding in Reality**:
   - Never invent or hallucinate dialogue.
   - Every candidate's `start` and `end` timestamps MUST correspond to real words or silence boundaries in the transcript.
   - Never produce candidates shorter than `minDuration` (default 15s) or longer than `maxDuration` (default 90s).

2. **The 3-Second Hook Rule**:
   - The opening sentence must immediately provoke curiosity, conflict, shock, empathy, or laughter.
   - Avoid long preambles, "So, anyway...", throat-clearing, or silence at the start.

3. **Complete Payoff**:
   - A clip must never cut off mid-thought or mid-sentence.
   - The ending must deliver the punchline, conclusion, lesson, or climactic moment.

4. **Standalone Comprehensibility**:
   - A viewer with zero prior context must understand what is happening and why it matters within 5 seconds.

---

## 2. 100-Point Scoring Rubric

Every candidate is evaluated on a strict 0–100 scale:

| Component | Points | Criteria |
|---|---|---|
| **Hook Strength** | 0–25 | Intriguing question, bold thesis, shocking visual/auditory event, high-energy opening in the first 3 seconds. |
| **Emotional Arc & Pacing** | 0–25 | Continuous momentum, rising tension, authentic laughter, surprise, or banter without sluggish dead air. |
| **Payoff / Punchline** | 0–25 | Complete resolution, satisfying climax, funny punchline, or crisp conclusion. No abrupt truncation. |
| **Standalone Clarity** | 0–15 | Viewer requires no background knowledge to appreciate the premise and stakes. |
| **Template Alignment** | 0–10 | Adherence to the specific requested style (e.g., comedy for Funny, insight for Educational). |

**Total Score**: Sum of the 5 categories (0–100). Clips scoring below 65 are rejected unless the source has limited speech.

---

## 3. Template-Specific Guidance

- **Viral Energy (`viral`)**:
  High-intensity speech, controversial takes, extreme hype, fast banter, or intense plot twists. Prioritize moments where speech rate or audio energy rises sharply.

- **Funny Moments (`funny`)**:
  Bloopers, unexpected errors, contagious laughter, witty comebacks, awkward silences with comedic timing, self-deprecating humor.

- **Gaming Highlights (`gaming`)**:
  Clutch plays, sudden deaths, boss battle completions, high-volume gamer screams, bugs/physics glitches, victory celebrations.

- **Educational Insights (`insight`)**:
  Actionable life/tech advice, mind-expanding mental models, counter-intuitive facts, step-by-step explanations that make the viewer feel smarter.

- **Storytelling (`story`)**:
  Clear narrative arc: Exposition ("One time I..."), Escalation ("And then things went wrong..."), and Climax/Resolution ("That was the day I realized...").

- **Reactions (`reactions`)**:
  Visceral, authentic responses to external media, chat messages, or unexpected game events.

- **Podcast Highlights (`podcast`)**:
  Deep conversation snippets, spicy debates, vulnerable personal admissions, or philosophical disagreements.

---

## 4. Multi-Hour Transcript Chunking

When analyzing transcripts longer than 15 minutes:
1. Divide the transcript into overlapping chunks:
   - Chunk Duration: 10–12 minutes.
   - Overlap: 2 minutes.
2. Analyze each chunk independently to maintain full attention to granular word timings.
3. Merge candidate lists and deduplicate overlapping candidate windows.

---

## 5. Candidate Validation & Duplicate Detection

- **Overlap Suppression**: If Candidate A and Candidate B overlap by more than 10% of their duration, discard the one with the lower score.
- **Dead Air Penalty**: Deduct 20 points if any continuous silence exceeding 3.5 seconds occurs in the first half of the clip.
- **Repetition Suppression**: Deduct 15 points if the speaker repeats the same sentence or stutters excessively without comedic intent.

---

## 6. Creator Feedback Learning Loop

When reviewing previously accepted and rejected clips from this creator:
- **Accepted Patterns**: Notice topics, speakers, or pacing that the creator previously accepted; boost matching candidate scores by +5 to +10 points.
- **Rejected Patterns**: Identify rejected themes (e.g., sponsored reads, technical setup delays); automatically disqualify similar segments.
- **Timestamp Adjustments**: If the creator frequently trims the beginning or end of suggestions, tighten start/end margins closer to the first spoken word.

---

## 7. Input & Output Specification

### Input Schema
```json
{
  "duration": 3600.0,
  "template": "viral",
  "clipCount": 3,
  "minDuration": 20,
  "maxDuration": 60,
  "customBrief": "Focus on moments discussing future technology",
  "segments": [
    { "id": 0, "start": 12.0, "end": 16.5, "text": "Wait until you see what happens next.", "words": [...] }
  ],
  "creatorFeedback": {
    "accepted": [...],
    "rejected": [...]
  }
}
```

### Output Schema
```json
{
  "clips": [
    {
      "start": 12.0,
      "end": 44.5,
      "score": 93,
      "title": "The Quantum Shift Explained",
      "hook": "Wait until you see what happens next.",
      "reason": "Captivating 3-second hook followed by a high-energy explanation of next-gen technology with a clear payoff.",
      "caption_keywords": ["quantum", "future", "impossible"],
      "context_warning": ""
    }
  ]
}
```
