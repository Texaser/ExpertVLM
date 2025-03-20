#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import argparse
import json
import shutil

def check_ffmpeg():
    """检查是否安装了FFmpeg"""
    try:
        # 尝试运行ffmpeg命令，如果成功则返回True
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False

def convert_video(input_video, output_dir=None):
    """转换视频为浏览器兼容格式"""
    # 如果未指定输出目录，则使用默认目录
    if output_dir is None:
        output_dir = os.path.join("videos", "converted")
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 获取文件名（不含扩展名）
    filename = os.path.basename(input_video)
    filename_noext = os.path.splitext(filename)[0]
    
    # 构建输出文件路径
    output_file = os.path.join(output_dir, f"{filename_noext}_converted.mp4")
    
    print(f"开始转换视频: {input_video}")
    print(f"输出文件: {output_file}")
    
    # 构建FFmpeg命令
    ffmpeg_cmd = [
        'ffmpeg', '-i', input_video,
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.0',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        output_file
    ]
    
    try:
        # 执行转换命令
        subprocess.run(ffmpeg_cmd, check=True)
        print("转换成功！")
        print(f"转换后的文件: {output_file}")
        print("\n您可以在HTML中这样引用新视频:")
        print('<video controls>')
        print(f'    <source src="{output_file}" type="video/mp4">')
        print('    您的浏览器不支持HTML5视频。')
        print('</video>')
        
        # 检查是否存在questionnaire_data.json，如果存在则提示更新
        if os.path.exists("questionnaire_data.json"):
            print("\n您可能需要更新questionnaire_data.json文件中的视频路径。")
            print(f'将原路径 "{input_video}" 替换为 "{output_file}"')
            
            # 提供一个自动更新的选项
            choice = input("\n是否自动更新questionnaire_data.json? (y/n): ")
            if choice.lower() == 'y':
                update_json(input_video, output_file)
        
        return output_file
    except subprocess.CalledProcessError as e:
        print(f"转换失败: {e}")
        return None

def update_json(old_path, new_path):
    """更新JSON文件中的视频路径"""
    try:
        # 备份原始文件
        shutil.copy2("questionnaire_data.json", "questionnaire_data.json.bak")
        print("已创建备份文件: questionnaire_data.json.bak")
        
        # 读取JSON文件
        with open("questionnaire_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 更新视频路径
        updated = False
        if isinstance(data, list):
            for item in data:
                if "videoUrl" in item and item["videoUrl"] == old_path:
                    item["videoUrl"] = new_path
                    updated = True
        
        # 写回JSON文件
        if updated:
            with open("questionnaire_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print("已更新questionnaire_data.json中的视频路径")
        else:
            print("未在questionnaire_data.json中找到匹配的视频路径")
    except Exception as e:
        print(f"更新JSON文件失败: {e}")

def main():
    parser = argparse.ArgumentParser(description="将视频转换为浏览器兼容格式")
    parser.add_argument("input_video", help="输入视频文件路径")
    parser.add_argument("--output-dir", help="输出目录（默认为videos/converted）")
    
    args = parser.parse_args()
    
    # 检查是否安装了FFmpeg
    if not check_ffmpeg():
        print("错误: 未安装FFmpeg。请先安装FFmpeg。")
        print("Ubuntu/Debian: sudo apt-get install ffmpeg")
        print("MacOS: brew install ffmpeg")
        sys.exit(1)
    
    # 检查输入文件是否存在
    if not os.path.exists(args.input_video):
        print(f"错误: 输入文件 '{args.input_video}' 不存在")
        sys.exit(1)
    
    # 转换视频
    convert_video(args.input_video, args.output_dir)

if __name__ == "__main__":
    main() 