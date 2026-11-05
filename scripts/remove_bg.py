import sys
import json
import cv2
import numpy as np
from PIL import Image, ImageFilter

def hex_to_bgr(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join([c*2 for c in hex_str])
    if len(hex_str) != 6:
        return (255, 255, 255)
    r = int(hex_str[0:2], 16)
    g = int(hex_str[2:4], 16)
    b = int(hex_str[4:6], 16)
    return (b, g, r)

def remove_background(input_path, output_path, mode='auto', tolerance=35, key_color_hex='#ffffff', feather_radius=1):
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Could not load image at {input_path}")

    # Ensure 3-channel BGR base
    if len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        bgr = img[:, :, :3]
    else:
        bgr = img.copy()

    h, w = bgr.shape[:2]

    # Sample corners to determine background color if auto
    if mode == 'auto' or not key_color_hex:
        corners = [
            bgr[0, 0].astype(int),
            bgr[0, w-1].astype(int),
            bgr[h-1, 0].astype(int),
            bgr[h-1, w-1].astype(int)
        ]
        avg_corner = np.mean(corners, axis=0).astype(np.uint8)
        target_bgr = tuple(int(x) for x in avg_corner)
    else:
        target_bgr = hex_to_bgr(key_color_hex)

    tol = int(tolerance)

    if mode in ['auto', 'flood']:
        # FloodFill from the four corners
        # mask needs to be 2 pixels wider and taller than the image
        mask = np.zeros((h + 2, w + 2), np.uint8)
        seed_points = [
            (0, 0),
            (w - 1, 0),
            (0, h - 1),
            (w - 1, h - 1),
            (w // 2, 0),
            (w // 2, h - 1),
            (0, h // 2),
            (w - 1, h // 2)
        ]

        work_bgr = bgr.copy()
        flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
        for pt in seed_points:
            dist = np.max(np.abs(work_bgr[pt[1], pt[0]].astype(int) - np.array(target_bgr)))
            if dist <= tol + 20:
                cv2.floodFill(
                    work_bgr,
                    mask,
                    pt,
                    (0, 0, 0),
                    (tol, tol, tol),
                    (tol, tol, tol),
                    flags
                )

        bg_mask = (mask[1:-1, 1:-1] > 0).astype(np.uint8) * 255
    else:
        # Global color keying across the entire image
        diff = np.max(np.abs(bgr.astype(int) - np.array(target_bgr)), axis=2)
        bg_mask = (diff <= tol).astype(np.uint8) * 255

    # Invert to get foreground alpha (255 = keep, 0 = transparent)
    alpha = 255 - bg_mask

    # If original image had an alpha channel, respect existing transparency
    if len(img.shape) == 3 and img.shape[2] == 4:
        alpha = np.minimum(alpha, img[:, :, 3])

    # Convert to PIL Image for soft feathering
    pil_bgr = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    pil_alpha = Image.fromarray(alpha)

    if feather_radius > 0:
        pil_alpha = pil_alpha.filter(ImageFilter.GaussianBlur(radius=feather_radius))

    pil_bgr.putalpha(pil_alpha)
    pil_bgr.save(output_path, 'PNG')

    return {
        "success": True,
        "outputPath": output_path,
        "width": w,
        "height": h
    }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: remove_bg.py <input> <output> [mode] [tolerance] [key_hex] [feather]"}))
        sys.exit(1)

    in_file = sys.argv[1]
    out_file = sys.argv[2]
    mode_arg = sys.argv[3] if len(sys.argv) > 3 else 'auto'
    tol_arg = int(sys.argv[4]) if len(sys.argv) > 4 else 35
    hex_arg = sys.argv[5] if len(sys.argv) > 5 else '#ffffff'
    feather_arg = int(sys.argv[6]) if len(sys.argv) > 6 else 1

    try:
        res = remove_background(in_file, out_file, mode_arg, tol_arg, hex_arg, feather_arg)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
