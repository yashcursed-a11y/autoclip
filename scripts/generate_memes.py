import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'memes')
os.makedirs(OUT_DIR, exist_ok=True)

font_path_bold = 'C:/Windows/Fonts/arialbd.ttf'
font_path_impact = 'C:/Windows/Fonts/impact.ttf'
font_path_emoji = 'C:/Windows/Fonts/seguiemj.ttf'

memes = [
    {
        "id": "mind_blown",
        "title": "MIND BLOWN!",
        "subtitle": "⚡ INSANE DISCOVERY ⚡",
        "icon": "🤯",
        "bg_color": (32, 16, 64, 235),
        "border_color": (168, 85, 247, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (216, 180, 254, 255)
    },
    {
        "id": "skull_bruh",
        "title": "BRUH MOMENT...",
        "subtitle": "💀 HE CANNOT BE SERIOUS 💀",
        "icon": "💀",
        "bg_color": (24, 24, 27, 240),
        "border_color": (239, 68, 68, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (252, 165, 165, 255)
    },
    {
        "id": "money_rain",
        "title": "STONKS / MONEY!",
        "subtitle": "💸 BAG SECURED 💸",
        "icon": "💰",
        "bg_color": (6, 44, 20, 240),
        "border_color": (34, 197, 94, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (134, 239, 172, 255)
    },
    {
        "id": "wait_what",
        "title": "WAIT... WHAT?!",
        "subtitle": "❓ HOLD UP A SECOND ❓",
        "icon": "❓",
        "bg_color": (45, 30, 0, 240),
        "border_color": (234, 179, 8, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (253, 224, 71, 255)
    },
    {
        "id": "emotional_damage",
        "title": "EMOTIONAL DAMAGE!",
        "subtitle": "💔 CRITICAL HIT -999 💔",
        "icon": "💔",
        "bg_color": (50, 10, 20, 245),
        "border_color": (244, 63, 94, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (253, 164, 175, 255)
    },
    {
        "id": "gigachad",
        "title": "GIGACHAD / SIGMA",
        "subtitle": "🗿 ABSOLUTE LEGEND 🗿",
        "icon": "🗿",
        "bg_color": (28, 25, 23, 240),
        "border_color": (217, 119, 6, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (253, 230, 138, 255)
    },
    {
        "id": "fbi_warning",
        "title": "FBI OPEN UP!",
        "subtitle": "🚨 CODE RED ALERT 🚨",
        "icon": "🚨",
        "bg_color": (15, 23, 42, 245),
        "border_color": (59, 130, 246, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (147, 197, 253, 255)
    },
    {
        "id": "genius_brain",
        "title": "200 IQ MOVE!",
        "subtitle": "💡 GALAXY BRAIN MOMENT 💡",
        "icon": "💡",
        "bg_color": (10, 30, 50, 240),
        "border_color": (6, 182, 212, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (165, 243, 252, 255)
    },
    {
        "id": "clutch_win",
        "title": "MASSIVE W / CLUTCH!",
        "subtitle": "🏆 UNREAL PLAY 🏆",
        "icon": "🏆",
        "bg_color": (40, 25, 5, 240),
        "border_color": (245, 158, 11, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (254, 240, 138, 255)
    },
    {
        "id": "rage_quit",
        "title": "RAGE QUIT!",
        "subtitle": "🤬 HE LOST HIS MIND 🤬",
        "icon": "🔥",
        "bg_color": (55, 10, 10, 245),
        "border_color": (220, 38, 38, 255),
        "text_color": (255, 255, 255, 255),
        "highlight_color": (254, 202, 202, 255)
    }
]

def make_meme_badge(item):
    W, H = 560, 180
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded pill container
    rect = [12, 12, W - 12, H - 12]
    radius = 32

    # Outer glow / shadow
    shadow_box = [8, 8, W - 8, H - 8]
    draw.rounded_rectangle(shadow_box, radius=radius + 4, fill=(0, 0, 0, 120))

    # Background
    draw.rounded_rectangle(rect, radius=radius, fill=item["bg_color"], outline=item["border_color"], width=5)

    # Fonts
    title_font = ImageFont.truetype(font_path_impact, 48)
    sub_font = ImageFont.truetype(font_path_bold, 22)
    emoji_font = ImageFont.truetype(font_path_emoji, 64)

    # Draw icon/emoji
    draw.text((36, 42), item["icon"], font=emoji_font, fill=(255, 255, 255, 255))

    # Draw Title with slight drop shadow
    title_x, title_y = 135, 34
    draw.text((title_x + 2, title_y + 2), item["title"], font=title_font, fill=(0, 0, 0, 220))
    draw.text((title_x, title_y), item["title"], font=title_font, fill=item["text_color"])

    # Draw Subtitle / punchline
    sub_x, sub_y = 138, 98
    draw.text((sub_x, sub_y), item["subtitle"], font=sub_font, fill=item["highlight_color"])

    out_file = os.path.join(OUT_DIR, f"{item['id']}.png")
    img.save(out_file, 'PNG')
    print(f"Generated: {out_file}")

if __name__ == '__main__':
    for m in memes:
        make_meme_badge(m)
    print("All meme badges created successfully!")
