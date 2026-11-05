import os
import sys
import json
import subprocess
import traceback
import numpy as np

# Ensure UTF-8 output on Windows consoles/pipes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def run_transcription():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing input file path"}), flush=True)
        sys.exit(1)

    input_file = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] and not sys.argv[2].startswith('-') else "tiny"
    language = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] and sys.argv[3] != "auto" and not sys.argv[3].startswith('-') else None

    if not os.path.exists(input_file):
        print(json.dumps({"error": f"File does not exist: {input_file}"}), flush=True)
        sys.exit(1)

    # 1. Extract audio via ffmpeg to a temporary 16kHz 32-bit float PCM file
    # Using disk-backed memmap prevents memory exhaustion on multi-hour streams on 8GB laptops.
    pcm_file = input_file + ".pcm"
    if not os.path.exists(pcm_file) or os.path.getsize(pcm_file) < 1024:
        print(json.dumps({"type": "progress", "percent": 5, "message": "Extracting audio stream to optimized scratch buffer..."}), flush=True)
        cmd = [
            'ffmpeg', '-y', '-nostdin', '-threads', '2', '-v', 'error',
            '-i', input_file,
            '-f', 'f32le', '-ac', '1', '-ar', '16000', pcm_file
        ]
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            if os.path.exists(pcm_file):
                try: os.unlink(pcm_file)
                except: pass
            print(json.dumps({"error": f"FFmpeg audio extraction failed: {str(e)}"}), flush=True)
            sys.exit(1)
    else:
        print(json.dumps({"type": "progress", "percent": 10, "message": "Using existing scratch buffer on disk..."}), flush=True)

    pcm_size = os.path.getsize(pcm_file) if os.path.exists(pcm_file) else 0
    total_samples = pcm_size // 4
    duration = float(total_samples) / 16000.0

    if total_samples == 0:
        if os.path.exists(pcm_file):
            try: os.unlink(pcm_file)
            except: pass
        print(json.dumps({
            "language": "en",
            "language_probability": 1.0,
            "duration": 0,
            "segments": [],
            "audio_energy": []
        }), flush=True)
        sys.exit(0)

    # Memory map the PCM audio (zero RAM overhead)
    audio = np.memmap(pcm_file, dtype=np.float32, mode='r')

    # 2. Compute audio energy in 1-second buckets
    samples_per_sec = 16000
    num_buckets = int(np.ceil(duration))
    audio_energy = []
    for b in range(num_buckets):
        start_idx = b * samples_per_sec
        end_idx = min(len(audio), (b + 1) * samples_per_sec)
        chunk = audio[start_idx:end_idx]
        if len(chunk) > 0:
            rms = float(np.sqrt(np.mean(chunk**2)))
            audio_energy.append(round(rms, 4))
        else:
            audio_energy.append(0.0)

    # 3. Load faster-whisper model
    print(json.dumps({"type": "progress", "percent": 15, "message": f"Loading Whisper model ({model_size})..."}), flush=True)
    from faster_whisper import WhisperModel

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception as e:
        del audio
        if os.path.exists(pcm_file):
            try: os.unlink(pcm_file)
            except: pass
        print(json.dumps({"error": f"Failed to load Whisper model: {str(e)}"}), flush=True)
        sys.exit(1)

    # 4. Transcribe with word timestamps (chunked in 10-minute windows to avoid memory allocation errors on 5-6h streams)
    print(json.dumps({"type": "progress", "percent": 25, "message": "Transcribing speech in memory-optimized chunks..."}), flush=True)
    kwargs = {
        "word_timestamps": True,
        "vad_filter": True,
        "vad_parameters": dict(min_silence_duration_ms=500)
    }
    if language:
        kwargs["language"] = language

    try:
        CHUNK_SECONDS = 600  # 10 minutes per chunk
        chunk_samples = CHUNK_SECONDS * samples_per_sec
        total_samples = len(audio)

        checkpoint_file = input_file + ".checkpoint.json"
        completed_chunks = set()
        detected_lang = language or "en"
        detected_lang_prob = 1.0
        segments_list = []
        seg_idx = 0

        # Load existing partial progress checkpoint if available
        if os.path.exists(checkpoint_file):
            try:
                with open(checkpoint_file, 'r', encoding='utf-8') as cf:
                    cdata = json.load(cf)
                    segments_list = cdata.get("segments", [])
                    completed_chunks = set(cdata.get("completed_chunks", []))
                    seg_idx = len(segments_list)
                    detected_lang = cdata.get("language", detected_lang)
                    detected_lang_prob = cdata.get("language_probability", detected_lang_prob)
                    print(json.dumps({
                        "type": "progress",
                        "percent": 25,
                        "message": f"Resuming from checkpoint ({len(completed_chunks)} chunks already processed)..."
                    }), flush=True)
            except Exception as read_cp_err:
                print(f"[Warning] Could not load checkpoint: {read_cp_err}", file=sys.stderr)
                completed_chunks = set()

        num_chunks = int(np.ceil(total_samples / chunk_samples))
        for c_idx in range(num_chunks):
            if c_idx in completed_chunks:
                continue

            c_start = c_idx * chunk_samples
            c_end = min(total_samples, (c_idx + 1) * chunk_samples)
            offset_seconds = float(c_start) / samples_per_sec

            chunk_audio = np.array(audio[c_start:c_end], dtype=np.float32)

            # Skip pure silence chunks (< 0.003 RMS)
            if np.max(np.abs(chunk_audio)) < 0.003:
                completed_chunks.add(c_idx)
                continue

            try:
                chunk_gen, chunk_info = model.transcribe(chunk_audio, **kwargs)
                if c_idx == 0 and chunk_info:
                    detected_lang = chunk_info.language
                    detected_lang_prob = chunk_info.language_probability

                for seg in chunk_gen:
                    words = []
                    if seg.words:
                        for w in seg.words:
                            words.append({
                                "word": w.word.strip(),
                                "start": round(float(w.start) + offset_seconds, 2),
                                "end": round(float(w.end) + offset_seconds, 2),
                                "probability": round(float(w.probability), 3)
                            })

                    segments_list.append({
                        "id": seg_idx,
                        "start": round(float(seg.start) + offset_seconds, 2),
                        "end": round(float(seg.end) + offset_seconds, 2),
                        "text": seg.text.strip(),
                        "words": words
                    })
                    seg_idx += 1

                completed_chunks.add(c_idx)
                # Persist checkpoint to disk atomically
                try:
                    tmp_cp = checkpoint_file + ".tmp"
                    with open(tmp_cp, 'w', encoding='utf-8') as cf:
                        json.dump({
                            "completed_chunks": list(completed_chunks),
                            "segments": segments_list,
                            "language": detected_lang,
                            "language_probability": detected_lang_prob
                        }, cf)
                    os.replace(tmp_cp, checkpoint_file)
                except: pass

                if duration > 0:
                    cur_time = min(duration, float(c_end) / samples_per_sec)
                    cur_pct = 25 + int(min(65, (cur_time / duration) * 65))
                    print(json.dumps({
                        "type": "progress",
                        "percent": cur_pct,
                        "message": f"Transcribing stream: {int(cur_time)}s / {int(duration)}s ({int(cur_pct)}%)"
                    }), flush=True)

            except Exception as chunk_err:
                print(f"[Warning] Chunk {c_idx+1}/{num_chunks} transcription warning: {chunk_err}", file=sys.stderr)
                continue

        # Clean up checkpoint on complete success
        if os.path.exists(checkpoint_file):
            try: os.unlink(checkpoint_file)
            except: pass

        print(json.dumps({"type": "progress", "percent": 95, "message": "Finalizing transcript..."}), flush=True)

        result = {
            "language": detected_lang,
            "language_probability": round(float(detected_lang_prob), 3),
            "duration": round(duration, 2),
            "segments": segments_list,
            "audio_energy": audio_energy
        }
        print(json.dumps(result), flush=True)

    except Exception as e:
        err_msg = f"Transcription error: {str(e)}\n{traceback.format_exc()}"
        print(json.dumps({"error": err_msg}), flush=True)
        sys.exit(1)
    finally:
        del audio
        if os.path.exists(pcm_file):
            try: os.unlink(pcm_file)
            except: pass

if __name__ == '__main__':
    run_transcription()
