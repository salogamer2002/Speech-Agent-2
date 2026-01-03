from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs('public', exist_ok=True)

def create_logo(filename, bg_color, text_color, text):
    width, height = 250, 60
    img = Image.new('RGB', (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)
    
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    draw.text((x, y), text, fill=text_color, font=font)
    img.save(filename)
    print(f'✅ Created: {filename}')

# Create dark theme logo
create_logo('public/logo_dark.png', '#212121', '#E91E63', 'Infomary')

# Create light theme logo
create_logo('public/logo_light.png', '#FFFFFF', '#E91E63', 'Infomary')

print('\n🎉 Logos created successfully!')