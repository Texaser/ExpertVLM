import os
import json
import argparse
import cv2
import decord
from decord import VideoReader, cpu
import numpy as np
import random

def download_video_segment(video_path, start_time, end_time, output_path, width=640):
    """
    Download a segment from a video file and save it to the specified output location,
    optimized for web use with appropriate resizing.
    
    Args:
        video_path (str): Path to the source video file
        start_time (int/float): Start time in seconds
        end_time (int/float): End time in seconds
        output_path (str): Path to save the output video
        width (int): Target width of the video (height will be calculated to maintain aspect ratio)
    """
    try:
        # Load video using decord
        vr = VideoReader(video_path, ctx=cpu(0))
        
        # Get video properties
        fps = vr.get_avg_fps()
        total_frames = len(vr)
        
        print(f"Video loaded: {video_path}")
        print(f"Total frames: {total_frames}")
        print(f"FPS: {fps}")
        
        # Calculate frame indices for the time range
        start_frame = int(start_time * fps)
        end_frame = int(end_time * fps)
        
        # Make sure frame indices are within bounds
        start_frame = max(0, start_frame)
        end_frame = min(total_frames - 1, end_frame)
        
        print(f"Extracting frames {start_frame} to {end_frame} (time: {start_time}s to {end_time}s)")
        
        # Extract frames in the specified range
        frames = vr.get_batch(list(range(start_frame, end_frame + 1))).asnumpy()
        
        # Calculate new dimensions while maintaining aspect ratio
        original_height, original_width = frames[0].shape[:2]
        height = int(width * original_height / original_width)
        
        # Set up video writer with web-optimized settings
        fourcc = cv2.VideoWriter_fourcc(*'avc1')  # H.264 codec for better web compatibility
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # Resize and write frames to the output video
        print(f"Processing and writing {len(frames)} frames to {output_path}...")
        for frame in frames:
            # Resize frame
            resized_frame = cv2.resize(frame, (width, height))
            
            # Convert from RGB to BGR (cv2 expects BGR)
            frame_bgr = cv2.cvtColor(resized_frame, cv2.COLOR_RGB2BGR)
            
            # Write to video
            out.write(frame_bgr)
        
        # Release resources
        out.release()
        
        # Get file size
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"Video segment saved: {output_path} ({file_size_mb:.2f} MB)")
        
        return True
        
    except Exception as e:
        print(f"Error processing video: {e}")
        return False

def process_videos_for_questionnaire(questionnaire_data_file, source_video_path, output_dir="videos", time_ranges_file=None):
    """
    Process videos for the questionnaire based on the questionnaire data.
    
    Args:
        questionnaire_data_file (str): Path to the questionnaire data JSON file
        source_video_path (str): Path to the source video file
        output_dir (str): Directory to save processed videos
        time_ranges_file (str, optional): Path to a JSON file with time ranges for each item
    """
    try:
        # Load the questionnaire data
        with open(questionnaire_data_file, 'r', encoding='utf-8') as f:
            questionnaire_data = json.load(f)
        
        # Load time ranges if provided
        time_ranges = {}
        if time_ranges_file:
            with open(time_ranges_file, 'r', encoding='utf-8') as f:
                time_ranges = json.load(f)
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Process each item in the questionnaire data
        for i, item in enumerate(questionnaire_data):
            item_id = item["id"]
            video_url = item["videoUrl"]
            
            # Extract filename from video_url
            video_filename = os.path.basename(video_url)
            output_path = os.path.join(output_dir, video_filename)
            
            # Get time range for this item
            if item_id in time_ranges:
                time_range = time_ranges[item_id]
                start_time, end_time = map(float, time_range.split('-'))
            else:
                # Default 5-second segments at different points in the video
                # We'll use a deterministic but seemingly random distribution
                random.seed(i)  # Use item index as seed for reproducibility
                video_duration = 600  # Assume 10-minute video if not specified
                start_time = random.uniform(0, video_duration - 5)
                end_time = start_time + 5
            
            print(f"\nProcessing video for {item_id}...")
            print(f"Time range: {start_time:.2f}s - {end_time:.2f}s")
            
            # Download and process the video segment
            success = download_video_segment(
                source_video_path,
                start_time,
                end_time,
                output_path
            )
            
            if success:
                print(f"Successfully processed video for {item_id}")
            else:
                print(f"Failed to process video for {item_id}")
        
        print("\nVideo processing complete!")
        print(f"Generated {len(questionnaire_data)} video files in {output_dir}/")
        
    except Exception as e:
        print(f"Error in video processing: {e}")
        return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description='Download and process videos for web questionnaire')
    parser.add_argument('--source-video', required=True,
                        help='Path to the source video file')
    parser.add_argument('--questionnaire-data', default='questionnaire_data.json',
                        help='Path to the questionnaire data JSON file')
    parser.add_argument('--output-dir', default='videos',
                        help='Directory to save processed videos')
    parser.add_argument('--time-ranges', default=None,
                        help='Path to a JSON file with time ranges for each item')
    
    args = parser.parse_args()
    
    process_videos_for_questionnaire(
        args.questionnaire_data,
        args.source_video,
        args.output_dir,
        args.time_ranges
    )

if __name__ == "__main__":
    main() 