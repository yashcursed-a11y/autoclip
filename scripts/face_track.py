"""
Single-clip face tracking & cinematic framing using YuNet 5-point neural landmarks.
"""
import sys
import os
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"
os.environ["OPENCV_VIDEOIO_PRIORITY_MSMF"] = "0"
import json
import gc
from pathlib import Path
import cv2
import numpy as np

cv2.setNumThreads(2)

def compute_framing():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing input video file"}))
        sys.exit(1)

    video_path = sys.argv[1]
    start_sec = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    end_sec = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
    aspect_ratio_str = sys.argv[4] if len(sys.argv) > 4 else "9:16"

    aspect_map = {
        "9:16": 9.0 / 16.0,
        "4:5": 4.0 / 5.0,
        "1:1": 1.0,
        "16:9": 16.0 / 9.0
    }
    target_ratio = aspect_map.get(aspect_ratio_str, 9.0 / 16.0)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(json.dumps({"error": f"Cannot open video: {video_path}"}))
        sys.exit(1)

    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)

        # Calculate crop dimensions matching target aspect ratio
        src_ratio = float(width) / float(height)
        if src_ratio > target_ratio:
            crop_h = height
            crop_w = int(round(height * target_ratio))
        else:
            crop_w = width
            crop_h = int(round(width / target_ratio))

        crop_w = min(width, max(2, crop_w // 2 * 2))
        crop_h = min(height, max(2, crop_h // 2 * 2))

        default_crop_x = int((width - crop_w) / 2) // 2 * 2
        default_crop_y = int((height - crop_h) / 2) // 2 * 2

        start_frame = max(0, int(start_sec * fps))
        end_frame = min(total_frames, int(end_sec * fps))
        if end_frame <= start_frame:
            end_frame = min(total_frames, start_frame + int(fps * 5))

        # Initialize YuNet Neural Detector if available
        model_path = Path(__file__).resolve().parent.parent / 'models' / 'yunet' / 'face_detection_yunet_2026may.onnx'
        detector = None
        if model_path.exists():
            try:
                detector = cv2.FaceDetectorYN.create(str(model_path), '', (640, 360), 0.70, 0.3, 100)
            except Exception:
                detector = None

        sample_count = 24
        step = max(1, int((end_frame - start_frame) / sample_count))

        detected_centers_x = []
        detected_eyes_y = []
        gaze_offsets_x = []

        scale = min(1.0, 640.0 / width)
        small_w = max(2, int(width * scale))
        small_h = max(2, int(height * scale))

        for f_idx in range(start_frame, end_frame, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            if detector is not None:
                small = cv2.resize(frame, (small_w, small_h))
                del frame  # Free full-res uncompressed frame immediately
                detector.setInputSize((small_w, small_h))
                _, detections = detector.detect(small)

                if detections is not None and len(detections) > 0:
                    # Pick highest confidence or largest face
                    best_face = max(detections, key=lambda d: float(d[2]) * float(d[3]))
                    fx = float(best_face[0]) / scale
                    fy = float(best_face[1]) / scale
                    fw = float(best_face[2]) / scale
                    fh = float(best_face[3]) / scale

                    fcx = fx + fw / 2.0
                    detected_centers_x.append(fcx)

                    # Check eyes for vertical composition
                    re_y = float(best_face[5]) / scale
                    le_y = float(best_face[7]) / scale
                    detected_eyes_y.append((re_y + le_y) / 2.0)

                    # Gaze lead room
                    re_x = float(best_face[4]) / scale
                    le_x = float(best_face[6]) / scale
                    nt_x = float(best_face[8]) / scale
                    dr = abs(nt_x - re_x)
                    dl = abs(le_x - nt_x)
                    if dr < dl * 0.60:
                        gaze_offsets_x.append(-0.06 * crop_w)
                    elif dl < dr * 0.60:
                        gaze_offsets_x.append(0.06 * crop_w)
                    else:
                        gaze_offsets_x.append(0.0)

        if detected_centers_x:
            avg_cx = float(np.median(detected_centers_x))
            avg_lead = float(np.mean(gaze_offsets_x)) if gaze_offsets_x else 0.0
            target_x = int(round(avg_cx + avg_lead - (crop_w / 2.0)))
            final_x = max(0, min(width - crop_w, target_x)) // 2 * 2

            if detected_eyes_y:
                avg_eye_y = float(np.median(detected_eyes_y))
                target_y = int(round(avg_eye_y - 0.32 * crop_h))
                final_y = max(0, min(height - crop_h, target_y)) // 2 * 2
            else:
                final_y = default_crop_y

            tracking_mode = "yunet_5pt_landmark_tracking"
        else:
            final_x = default_crop_x
            final_y = default_crop_y
            tracking_mode = "safe_center_fallback"

        result = {
            "source": {"width": width, "height": height, "fps": fps},
            "target": {"aspect": aspect_ratio_str, "ratio": target_ratio},
            "crop": {
                "x": int(final_x),
                "y": int(final_y),
                "width": int(crop_w),
                "height": int(crop_h)
            },
            "mode": tracking_mode,
            "framing": "cinematic_lead_room_and_rule_of_thirds"
        }
        print(json.dumps(result))

    finally:
        try:
            cap.release()
        except: pass
        if 'detector' in locals():
            try: del detector
            except: pass
        gc.collect()

if __name__ == '__main__':
    compute_framing()
