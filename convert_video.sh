#!/bin/bash

# 检查是否安装了FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "错误: 未安装FFmpeg。请先安装FFmpeg。"
    echo "Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "MacOS: brew install ffmpeg"
    exit 1
fi

# 检查参数
if [ "$#" -lt 1 ]; then
    echo "用法: $0 <input_video> [output_directory]"
    echo "例如: $0 videos/gp01_153_157.mp4"
    echo "或: $0 videos/gp01_153_157.mp4 converted_videos"
    exit 1
fi

INPUT_VIDEO="$1"
FILENAME=$(basename "$INPUT_VIDEO")
FILENAME_NOEXT="${FILENAME%.*}"

# 确定输出目录
if [ "$#" -ge 2 ]; then
    OUTPUT_DIR="$2"
else
    OUTPUT_DIR="videos/converted"
fi

# 创建输出目录（如果不存在）
mkdir -p "$OUTPUT_DIR"

# 输出文件路径
OUTPUT_FILE="$OUTPUT_DIR/${FILENAME_NOEXT}_converted.mp4"

echo "开始转换视频: $INPUT_VIDEO"
echo "输出文件: $OUTPUT_FILE"

# 使用FFmpeg转换为H.264编码的MP4，这是目前最广泛支持的网页视频格式
ffmpeg -i "$INPUT_VIDEO" \
       -c:v libx264 \
       -profile:v baseline \
       -level 3.0 \
       -pix_fmt yuv420p \
       -preset medium \
       -crf 23 \
       -c:a aac \
       -movflags +faststart \
       "$OUTPUT_FILE"

# 检查转换是否成功
if [ $? -eq 0 ]; then
    echo "转换成功！"
    echo "转换后的文件: $OUTPUT_FILE"
    echo ""
    echo "您可以在HTML中这样引用新视频:"
    echo "<video controls>"
    echo "    <source src=\"$OUTPUT_FILE\" type=\"video/mp4\">"
    echo "    您的浏览器不支持HTML5视频。"
    echo "</video>"
    
    # 更新questionnaire_data.json中的视频路径
    if [ -f "questionnaire_data.json" ]; then
        echo ""
        echo "您可能需要更新questionnaire_data.json文件中的视频路径。"
        echo "将原路径 \"$INPUT_VIDEO\" 替换为 \"$OUTPUT_FILE\""
    fi
else
    echo "转换失败，请检查错误信息。"
fi 