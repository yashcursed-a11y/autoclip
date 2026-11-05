"""Bounded, local visual framing analysis. Mouth motion is a speech heuristic."""
import json
import math
import sys
from pathlib import Path
import cv2
import numpy as np

VERSION = 'visual-framing-v1'

def crop_for_face(face, width, height, ratio):
    x, y, w, h = face
    ch = min(height, max(h * 3.4, height * .64))
    cw = ch * ratio
    if cw > width:
        cw = width
        ch = cw / ratio
    cw, ch = max(2, int(cw) // 2 * 2), max(2, int(ch) // 2 * 2)
    # Eyes sit above center, leaving room for shoulders and captions.
    cx, cy = x + w / 2, y + h * 1.35
    return {'x': int(max(0, min(width-cw, cx-cw/2))) // 2 * 2,
            'y': int(max(0, min(height-ch, cy-ch/2))) // 2 * 2,
            'width': cw, 'height': ch}

def choose_layout(faces, policy='adaptive'):
    """Fail safely to fit; never invent a second person when none was detected."""
    if not faces or len(faces) >= 3 or policy == 'group_fit':
        return 'fit', []
    ordered = sorted(faces, key=lambda f: f['box'][0])
    if len(ordered) == 1:
        return 'single', ordered[:1]
    if policy == 'duo_auto':
        return 'duo', ordered[:2]
    ranked = sorted(ordered, key=lambda f: f.get('activity', 0), reverse=True)
    # Require a clear visual lead. Uncertain/overlapping activity keeps both faces.
    first, second = ranked[0].get('activity', 0), ranked[1].get('activity', 0)
    if first > 7 and first > second * 2.5:
        return 'single', ranked[:1]
    return 'duo', ordered[:2]

def analyze(source, start, end, aspect='9:16', policy='adaptive'):
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise ValueError('The source video could not be opened.')
    try:
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30)
        total = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        end = min(end, total) if total > 0 else end
        duration = end - start
        if width < 2 or height < 2 or duration <= 0:
            raise ValueError('The requested clip has no readable frames.')
        aw, ah = map(float, aspect.split(':'))
        ratio = aw / ah
        cv2.setNumThreads(2)
        if policy == 'group_fit':
            return {'version':VERSION,'source':{'width':width,'height':height,'fps':fps},'duration':round(duration,3),
                    'aspect':aspect,'policy':policy,'sampleCount':0,'segments':[{'start':0,'end':round(duration,3),'layout':'fit','crops':[],'faceCount':0}],
                    'speechDetection':'not-needed','warning':'Full-picture layout selected; no speaker detection is required.'}
        model = Path(__file__).resolve().parent.parent / 'models' / 'yunet' / 'face_detection_yunet_2026may.onnx'
        if not model.exists():
            raise ValueError('The bundled YuNet face detector is missing. Restore models/yunet.')
        detector = cv2.FaceDetectorYN.create(str(model), '', (640, 360), .85, .3, 1000)
        step = max(.5, duration / 100)
        samples, previous, previous_gray = [], [], None
        next_id = 1
        for relative in np.arange(0, duration, step):
            cap.set(cv2.CAP_PROP_POS_MSEC, (start + relative) * 1000)
            ok, frame = cap.read()
            if not ok:
                continue
            scale = min(1., 640. / width)
            small = cv2.resize(frame, (max(2, int(width*scale)), max(2, int(height*scale))))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            scene_change = previous_gray is not None and float(np.mean(cv2.absdiff(gray, previous_gray))) > 38
            if scene_change:
                previous = []
            previous_gray = gray
            detector.setInputSize((small.shape[1],small.shape[0]))
            _, detections = detector.detect(small)
            boxes = []
            for detection in ([] if detections is None else detections):
                x,y,w,h = [int(v) for v in detection[:4]]
                x,y = max(0,x),max(0,y)
                w,h = min(w,small.shape[1]-x),min(h,small.shape[0]-y)
                if w>=24 and h>=24:
                    boxes.append((x,y,w,h))
            # Largest six faces suffice for group detection; suppress tiny background faces.
            boxes = sorted(boxes, key=lambda b: b[2]*b[3], reverse=True)[:6]
            if boxes:
                largest = boxes[0][2] * boxes[0][3]
                boxes = [b for b in boxes if b[2]*b[3] >= largest*.18]
            current, used = [], set()
            for x,y,w,h in boxes:
                center = ((x+w/2)/gray.shape[1], (y+h/2)/gray.shape[0])
                mouth = cv2.resize(gray[y+int(h*.60):y+int(h*.94), x+int(w*.20):x+int(w*.80)], (32,16))
                candidates = [(math.dist(center,p['center']),i,p) for i,p in enumerate(previous) if i not in used]
                match = min(candidates, default=None, key=lambda item:item[0])
                activity = 0.
                if match and match[0] < .18:
                    used.add(match[1]); old = match[2]; track_id = old['id']
                    # Normalized mouth texture change; not identity or audio diarization.
                    activity = float(np.mean(cv2.absdiff(mouth, old['mouth'])))
                else:
                    track_id = next_id; next_id += 1
                box = [float(v)/scale for v in (x,y,w,h)]
                current.append({'id':track_id,'center':center,'mouth':mouth,'activity':activity,'box':box})
            layout, selected = choose_layout(current, policy)
            crops = [crop_for_face(f['box'],width,height,ratio*(2 if layout=='duo' else 1)) for f in selected]
            samples.append({'start':round(float(relative),3),'layout':layout,'crops':crops,
                            'faceCount':len(current),'tracks':[f['id'] for f in selected]})
            previous = current
        if not samples:
            raise ValueError('No frames could be decoded for framing analysis.')
        segments = []
        pending_key, pending_count = None, 0
        for sample in samples:
            key = (sample['layout'], tuple(sample['tracks']))
            if not segments:
                segments.append(dict(sample)); continue
            last = segments[-1]
            last_key = (last['layout'], tuple(last['tracks']))
            if key == last_key:
                pending_count = 0
                # Keep stable crops inside a shot; refresh only after substantial movement.
                moved = bool(sample['crops'] and last['crops'] and abs(sample['crops'][0]['x']-last['crops'][0]['x']) > width*.10)
                if moved and sample['start']-last['start'] >= 2 and len(segments)<32:
                    segments.append(dict(sample))
                continue
            pending_count = pending_count+1 if key == pending_key else 1
            pending_key = key
            if pending_count >= 2 and sample['start']-last['start'] >= 1.2 and len(segments)<32:
                segments.append(dict(sample)); pending_count = 0
        for i,seg in enumerate(segments):
            seg['end'] = segments[i+1]['start'] if i+1<len(segments) else round(duration,3)
            seg.pop('tracks',None)
        return {'version':VERSION,'source':{'width':width,'height':height,'fps':fps},
                'duration':round(duration,3),'aspect':aspect,'policy':policy,'sampleCount':len(samples),
                'segments':segments,'speechDetection':'visual-mouth-motion-estimate',
                'warning':'Visual estimates can miss profiles, small faces and overlapping speech. Review before export.'}
    finally:
        cap.release()

if __name__ == '__main__':
    try:
        print(json.dumps(analyze(sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),sys.argv[4],sys.argv[5] if len(sys.argv)>5 else 'adaptive')))
    except Exception as error:
        print(json.dumps({'error':str(error)}));sys.exit(1)
