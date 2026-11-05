import subprocess, os, shutil

test_dir = os.path.abspath('work/data/finished/test-path-with spaces')
os.makedirs(test_dir, exist_ok=True)
ass_file = os.path.join(test_dir, 'test sub with spaces.ass')
with open(ass_file, 'w', encoding='utf-8') as f:
    f.write('''[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,Arial,56,&H00FFFFFF,&H003EFFD8,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,240,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,Base,,0,0,0,,{\\c&H003EFFD8&}CAPTION TEST
''')

# In FFmpeg filter:
escaped = ass_file.replace('\\', '/').replace(':', '\\:').replace("'", "\\'")
vf = f"ass=filename='{escaped}'"
print('VF:', vf)
p = subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:d=1', '-vf', vf, '-frames:v', '1', '-f', 'null', '-'], capture_output=True, text=True)
print('Code:', p.returncode)
if p.returncode != 0:
    print('Error:', p.stderr[-400:])
else:
    print('SUCCESS')
shutil.rmtree(test_dir, ignore_errors=True)
