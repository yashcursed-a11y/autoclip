"""
Bounded, local visual framing analysis (Engine 2.0 Upgrade).
Features:
- 5-point facial landmark tracking (eyes, nose, mouth corners)
- Mouth Aspect Ratio (MAR) dynamic lip-motion active speaker scoring
- Rule of Thirds vertical eye-line placement & Gaze-direction Lead Room
- Cinematic Deadband smoothing (eliminates camera jitter)
- Multi-face layout policy (single speaker, duo face-stack, group-fit)
"""
import json
import math
import sys
from pathlib import Path
import cv2
import numpy as np

VERSION = 'visual-framing-v1'

def crop_for_face_advanced(face_meta, width, height, ratio):
    """
    Computes an optimal crop for a face utilizing 5-point facial landmarks.
    Ensures eye line sits at ~32% from the top (Rule of Thirds) and applies
    gaze-based lead room.
    """
    box = face_meta['box']  # [x, y, w, h] in full-res coordinates
    landmarks = face_meta.get('landmarks')  # 5 points in full-res coordinates
    x, y, w, h = box

    # Calculate optimal crop height and width for aspect ratio
    ch = min(height, max(h * 3.2, height * 0.65))
    cw = ch * ratio
    if cw > width:
        cw = width
        ch = cw / ratio

    cw, ch = max(2, int(round(cw)) // 2 * 2), max(2, int(round(ch)) // 2 * 2)

    # 1. Vertical placement (Rule of Thirds)
    if landmarks and len(landmarks) >= 5:
        # Landmark 0: Right eye, Landmark 1: Left eye
        eye_y = (landmarks[0][1] + landmarks[1][1]) / 2.0
        # Place eyes around 30-33% down the crop frame for flattering composition
        target_y = eye_y - 0.32 * ch
    else:
        # Fallback eye estimate: ~30% into the face box
        eye_y = y + h * 0.30
        target_y = eye_y - 0.32 * ch

    crop_y = int(max(0, min(height - ch, target_y))) // 2 * 2

    # 2. Horizontal placement & Lead Room
    face_cx = x + w / 2.0
    lead_room_offset = 0.0

    if landmarks and len(landmarks) >= 5:
        re_x = landmarks[0][0]
        le_x = landmarks[1][0]
        nt_x = landmarks[2][0]

        dist_right = abs(nt_x - re_x)
        dist_left = abs(le_x - nt_x)

        # Detect head yaw / gaze direction
        if dist_right < dist_left * 0.60:
            # Person is turned towards their right (screen left) -> shift frame left
            lead_room_offset = -0.06 * cw
        elif dist_left < dist_right * 0.60:
            # Person is turned towards their left (screen right) -> shift frame right
            lead_room_offset = 0.06 * cw

    target_x = (face_cx + lead_room_offset) - (cw / 2.0)
    crop_x = int(max(0, min(width - cw, target_x))) // 2 * 2

    return {
        'x': crop_x,
        'y': crop_y,
        'width': cw,
        'height': ch
    }

def choose_layout(faces, policy='adaptive'):
    """
    Selects the optimal vertical framing layout based on active speaker telemetry.
    Fails safely to 'fit' (letterboxed) if 3+ faces are present to avoid excluding people.
    """
    if not faces or len(faces) >= 3 or policy == 'group_fit':
        return 'fit', []

    ordered = sorted(faces, key=lambda f: f['box'][0])
    if len(ordered) == 1:
        return 'single', ordered[:1]
    if policy == 'duo_auto':
        return 'duo', ordered[:2]

    # Rank by active speaker score
    ranked = sorted(ordered, key=lambda f: f.get('activity', 0), reverse=True)
    first, second = ranked[0].get('activity', 0), ranked[1].get('activity', 0)

    # Require a definitive active speaker lead to single-crop; otherwise keep both in duo stack
    if first > 8.0 and first > second * 2.2:
        return 'single', ranked[:1]

    return 'duo', ordered[:2]

def analyze(source, start, end, aspect='9:16', policy='adaptive'):
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise ValueError('The source video could not be opened.')

    try:
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        total_sec = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        end = min(end, total_sec) if total_sec > 0 else end
        duration = end - start

        if width < 2 or height < 2 or duration <= 0:
            raise ValueError('The requested clip has no readable frames.')

        aw, ah = map(float, aspect.split(':'))
        ratio = aw / ah

        cv2.setNumThreads(2)

        if policy == 'group_fit':
            return {
                'version': VERSION,
                'source': {'width': width, 'height': height, 'fps': fps},
                'duration': round(duration, 3),
                'aspect': aspect,
                'policy': policy,
                'sampleCount': 0,
                'segments': [{
                    'start': 0,
                    'end': round(duration, 3),
                    'layout': 'fit',
                    'crops': [],
                    'faceCount': 0
                }],
                'speechDetection': 'not-needed',
                'warning': 'Full-picture layout selected; speaker tracking bypassed.'
            }

        # Initialize YuNet Neural Face Detector
        model = Path(__file__).resolve().parent.parent / 'models' / 'yunet' / 'face_detection_yunet_2026may.onnx'
        if not model.exists():
            raise ValueError(f'The bundled YuNet face detector model is missing at {model}')

        detector = cv2.FaceDetectorYN.create(str(model), '', (640, 360), 0.75, 0.3, 1000)

        # Sampling step: ~2-3 samples per second for high tracking precision
        step = max(0.35, duration / 120.0)
        samples = []
        previous = []
        previous_gray = None
        next_id = 1

        for relative in np.arange(0, duration, step):
            cap.set(cv2.CAP_PROP_POS_MSEC, (start + relative) * 1000)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue

            scale = min(1.0, 640.0 / width)
            small_w = max(2, int(width * scale))
            small_h = max(2, int(height * scale))
            small = cv2.resize(frame, (small_w, small_h))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            # Detect scene cut / camera switch
            scene_change = previous_gray is not None and float(np.mean(cv2.absdiff(gray, previous_gray))) > 36.0
            if scene_change:
                previous = []
            previous_gray = gray

            detector.setInputSize((small_w, small_h))
            _, detections = detector.detect(small)

            detections_list = []
            if detections is not None:
                for det in detections:
                    bx, by, bw, bh = [int(v) for v in det[:4]]
                    bx, by = max(0, bx), max(0, by)
                    bw = min(bw, small_w - bx)
                    bh = min(bh, small_h - by)
                    if bw >= 22 and bh >= 22:
                        detections_list.append((bx, by, bw, bh, det))

            # Focus on primary candidate faces; ignore micro background faces
            detections_list = sorted(detections_list, key=lambda d: d[2] * d[3], reverse=True)[:6]
            if detections_list:
                largest_area = detections_list[0][2] * detections_list[0][3]
                detections_list = [d for d in detections_list if (d[2] * d[3]) >= largest_area * 0.16]

            current = []
            used_prev_indices = set()

            for bx, by, bw, bh, raw_det in detections_list:
                # 5-point landmarks in scaled coordinates:
                # 0: Right eye, 1: Left eye, 2: Nose, 3: Right mouth, 4: Left mouth
                re_pt = (float(raw_det[4]), float(raw_det[5]))
                le_pt = (float(raw_det[6]), float(raw_det[7]))
                nt_pt = (float(raw_det[8]), float(raw_det[9]))
                rm_pt = (float(raw_det[10]), float(raw_det[11]))
                lm_pt = (float(raw_det[12]), float(raw_det[13]))

                # Normalized face center in small image
                center = ((bx + bw / 2.0) / small_w, (by + bh / 2.0) / small_h)

                # Mouth Aspect Ratio (MAR) Calculation:
                mouth_width = math.hypot(lm_pt[0] - rm_pt[0], lm_pt[1] - rm_pt[1])
                mouth_cx = (lm_pt[0] + rm_pt[0]) / 2.0
                mouth_cy = (lm_pt[1] + rm_pt[1]) / 2.0
                nose_mouth_dist = math.hypot(mouth_cx - nt_pt[0], mouth_cy - nt_pt[1])
                eye_dist = math.hypot(le_pt[0] - re_pt[0], le_pt[1] - re_pt[1]) + 1e-4
                mar = float(nose_mouth_dist / eye_dist)

                # Extract normalized mouth texture ROI
                mouth_y1 = max(0, int(by + bh * 0.58))
                mouth_y2 = min(small_h, int(by + bh * 0.94))
                mouth_x1 = max(0, int(bx + bw * 0.20))
                mouth_x2 = min(small_w, int(bx + bw * 0.80))
                if mouth_y2 > mouth_y1 and mouth_x2 > mouth_x1:
                    mouth_roi = cv2.resize(gray[mouth_y1:mouth_y2, mouth_x1:mouth_x2], (32, 16))
                else:
                    mouth_roi = np.zeros((16, 32), dtype=np.uint8)

                # Match with previous tracked faces
                candidates = [
                    (math.dist(center, p['center']), idx, p)
                    for idx, p in enumerate(previous)
                    if idx not in used_prev_indices
                ]
                match = min(candidates, default=None, key=lambda item: item[0])

                activity = 0.0
                recent_mars = [mar]

                if match and match[0] < 0.20:
                    used_prev_indices.add(match[1])
                    old_face = match[2]
                    track_id = old_face['id']
                    recent_mars = (old_face.get('recent_mars', []) + [mar])[-5:]

                    # MAR temporal variance (tracks natural speech opening/closing cycle)
                    mar_variance = float(np.std(recent_mars)) * 120.0 if len(recent_mars) >= 2 else 0.0

                    # Optical pixel flux across mouth
                    tex_diff = float(np.mean(cv2.absdiff(mouth_roi, old_face['mouth'])))

                    # Fused active speaker metric
                    activity = float(0.60 * mar_variance + 0.40 * tex_diff)
                else:
                    track_id = next_id
                    next_id += 1

                # Unscale box and landmarks to full resolution coordinates
                box_full = [float(v) / scale for v in (bx, by, bw, bh)]
                landmarks_full = [
                    [re_pt[0] / scale, re_pt[1] / scale],
                    [le_pt[0] / scale, le_pt[1] / scale],
                    [nt_pt[0] / scale, nt_pt[1] / scale],
                    [rm_pt[0] / scale, rm_pt[1] / scale],
                    [lm_pt[0] / scale, lm_pt[1] / scale]
                ]

                face_meta = {
                    'id': track_id,
                    'center': center,
                    'mouth': mouth_roi,
                    'activity': activity,
                    'recent_mars': recent_mars,
                    'box': box_full,
                    'landmarks': landmarks_full
                }
                current.append(face_meta)

            # Choose layout and compute crops
            layout, selected = choose_layout(current, policy)
            target_aspect_multiplier = 2.0 if layout == 'duo' else 1.0
            crops = [
                crop_for_face_advanced(f, width, height, ratio * target_aspect_multiplier)
                for f in selected
            ]

            samples.append({
                'start': round(float(relative), 3),
                'layout': layout,
                'crops': crops,
                'faceCount': len(current),
                'tracks': [f['id'] for f in selected]
            })
            previous = current

        if not samples:
            raise ValueError('No frames could be decoded for framing analysis.')

        # Build contiguous, temporally stable segments with Cinematic Deadband Smoothing
        segments = []
        pending_key = None
        pending_count = 0
        deadband_px = int(width * 0.08)  # 8% deadband zone to eliminate camera jitter

        for sample in samples:
            key = (sample['layout'], tuple(sample['tracks']))

            if not segments:
                segments.append(dict(sample))
                continue

            last = segments[-1]
            last_key = (last['layout'], tuple(last['tracks']))

            if key == last_key:
                pending_count = 0
                if sample['crops'] and last['crops']:
                    # Check horizontal shift against deadband
                    diff_x = abs(sample['crops'][0]['x'] - last['crops'][0]['x'])

                    # Only create a refreshed segment if movement exceeded deadband AND duration >= 1.8s
                    if diff_x > deadband_px and (sample['start'] - last['start']) >= 1.8 and len(segments) < 32:
                        # Apply Exponential Moving Average (EMA) easing to smooth camera motion
                        smoothed_crop = dict(sample['crops'][0])
                        smoothed_crop['x'] = int(round(last['crops'][0]['x'] * 0.35 + sample['crops'][0]['x'] * 0.65)) // 2 * 2
                        smoothed_sample = dict(sample)
                        smoothed_sample['crops'] = [smoothed_crop] + sample['crops'][1:]
                        segments.append(smoothed_sample)
                continue

            # Layout or speaker switch candidate
            pending_count = pending_count + 1 if key == pending_key else 1
            pending_key = key

            # Require at least 2 consecutive samples confirming the switch to avoid flash-cuts
            if pending_count >= 2 and (sample['start'] - last['start']) >= 1.2 and len(segments) < 32:
                segments.append(dict(sample))
                pending_count = 0

        # Close and ground segment boundaries to cover [0, duration]
        for i, seg in enumerate(segments):
            seg['end'] = segments[i + 1]['start'] if i + 1 < len(segments) else round(duration, 3)
            seg.pop('tracks', None)

        return {
            'version': VERSION,
            'source': {'width': width, 'height': height, 'fps': fps},
            'duration': round(duration, 3),
            'aspect': aspect,
            'policy': policy,
            'sampleCount': len(samples),
            'segments': segments,
            'speechDetection': '5pt-yunet-mar-lip-tracking',
            'framingFeatures': [
                'rule-of-thirds-eye-line',
                'gaze-direction-lead-room',
                'cinematic-deadband-smoothing'
            ]
        }

    finally:
        cap.release()

if __name__ == '__main__':
    try:
        policy_arg = sys.argv[5] if len(sys.argv) > 5 else 'adaptive'
        result = analyze(
            sys.argv[1],
            float(sys.argv[2]),
            float(sys.argv[3]),
            sys.argv[4],
            policy_arg
        )
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'error': str(error)}))
        sys.exit(1)
