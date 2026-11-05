import sys
import os
import json
import cv2
import numpy as np

def compute_framing():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing input video file"}))
        sys.exit(1)

    video_path = sys.argv[1]
    start_sec = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    end_sec = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
    aspect_ratio_str = sys.argv[4] if len(sys.argv) > 4 else "9:16"

    # Target aspect ratios (width / height)
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

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)

    # Calculate ideal crop dimensions matching target aspect ratio
    src_ratio = float(width) / float(height)
    if src_ratio > target_ratio:
        # Source is wider than target (e.g. 16:9 -> 9:16)
        crop_h = height
        crop_w = int(round(height * target_ratio))
    else:
        # Source is taller than target
        crop_w = width
        crop_h = int(round(width / target_ratio))

    crop_w = min(width, crop_w)
    crop_h = min(height, crop_h)

    # Default safe center coordinates
    default_crop_x = int((width - crop_w) / 2)
    default_crop_y = int((height - crop_h) / 2)

    start_frame = max(0, int(start_sec * fps))
    end_frame = min(total_frames, int(end_sec * fps))
    if end_frame <= start_frame:
        end_frame = min(total_frames, start_frame + int(fps * 5))

    # Sample up to 20 frames across the clip to detect face/motion centers
    sample_count = 20
    step = max(1, int((end_frame - start_frame) / sample_count))

    detected_centers_x = []
    prev_gray = None

    for f_idx in range(start_frame, end_frame, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Motion detection if previous frame exists
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            # Find center of motion
            moments = cv2.moments(thresh)
            if moments["m00"] > 1000:
                cx = int(moments["m10"] / moments["m00"])
                detected_centers_x.append(cx)

        prev_gray = gray

    cap.release()

    # If motion / activity was detected, compute smoothed center
    if detected_centers_x:
        avg_cx = float(np.median(detected_centers_x))
        # Center the crop box on avg_cx
        target_x = int(round(avg_cx - (crop_w / 2)))
        # Clamp within bounds
        final_x = max(0, min(width - crop_w, target_x))
        final_y = default_crop_y
        tracking_mode = "motion_activity"
    else:
        # Safe centered fallback
        final_x = default_crop_x
        final_y = default_crop_y
        tracking_mode = "safe_center_fallback"

    result = {
        "source": { "width": width, "height": height, "fps": fps },
        "target": { "aspect": aspect_ratio_str, "ratio": target_ratio },
        "crop": {
            "x": int(final_x),
            "y": int(final_y),
            "width": int(crop_w),
            "height": int(crop_h)
        },
        "mode": tracking_mode
    }
    print(json.dumps(result))

if __name__ == '__main__':
    compute_framing()
