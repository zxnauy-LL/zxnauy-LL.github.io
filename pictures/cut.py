import numpy as np
from PIL import Image
import os
import zipfile

# 定义输入文件路径
input_image_path = "pictures/lulu.jpg"
output_dir = "pictures/lulu_piggy_slices/"

# 确保输出目录存在
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 打开图片
img = Image.open(input_image_path)
width, height = img.size

# 图片是 4行 x 3列 的网格
rows = 4
cols = 3

# 计算每个单元格的宽度和高度
# 注意：这里假设网格是均匀分布的。如果原图有边框误差，可能需要微调，
# 但通常这种拼接图是均匀生成的。
cell_width = width // cols
cell_height = height // rows

file_paths = []

count = 1
for r in range(rows):
    for c in range(cols):
        # 计算裁切区域 (left, upper, right, lower)
        left = c * cell_width
        upper = r * cell_height
        right = (c + 1) * cell_width
        lower = (r + 1) * cell_height
        
        # 裁切图片
        crop = img.crop((left, upper, right, lower))
        
        # 保存为 PNG 格式以保留最佳质量
        filename = f"lulu_{count:02d}.png"
        filepath = os.path.join(output_dir, filename)
        crop.save(filepath)
        file_paths.append(filepath)
        
        count += 1

# 创建 ZIP 文件
zip_filename = "lulu_piggy_icons.zip"
with zipfile.ZipFile(zip_filename, 'w') as zipf:
    for file in file_paths:
        zipf.write(file, os.path.basename(file))

# 返回 ZIP 文件路径
zip_filename