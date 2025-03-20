import json
import argparse
import os
import random

def convert_data_to_questionnaire_format(input_file, output_file, video_dir="videos"):
    """
    Convert existing data to the questionnaire format.
    
    Args:
        input_file (str): Path to the input JSON file (e.g., ge.json)
        output_file (str): Path to the output questionnaire JSON file
        video_dir (str): Directory where videos are stored
    """
    try:
        # Load the input data
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded {len(data)} items from {input_file}")
        
        # Convert to questionnaire format
        questionnaire_data = []
        
        for i, item in enumerate(data):
            # Get the ground truth and negative comments
            ground_truth = item.get("GT", "")
            negative_comments = item.get("negative_comments", [])
            
            # Skip if we don't have both ground truth and at least one negative comment
            if not ground_truth or not negative_comments:
                print(f"Skipping item {i+1} due to missing ground truth or negative comments")
                continue
            
            # Create options by combining ground truth and negative comments
            options = [ground_truth] + negative_comments
            
            # Shuffle options so ground truth isn't always first
            shuffled_options = options.copy()
            random.shuffle(shuffled_options)
            
            # Video URL - assuming naming convention based on index
            video_filename = f"technique_{i+1}.mp4"
            video_url = f"{video_dir}/{video_filename}"
            
            # Create the questionnaire item
            questionnaire_item = {
                "id": f"technique_{i+1}",
                "videoUrl": video_url,
                "groundTruth": ground_truth,
                "options": shuffled_options
            }
            
            questionnaire_data.append(questionnaire_item)
        
        # Write the questionnaire data to the output file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(questionnaire_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully converted {len(questionnaire_data)} items to questionnaire format")
        print(f"Saved to {output_file}")
        
        # Print reminder about video files
        print("\nImportant: Ensure your video files match the expected paths:")
        for item in questionnaire_data:
            print(f"  - {item['videoUrl']}")
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    return True

def convert_ge_json_to_questionnaire(ge_json_path, output_path, max_items=None):
    """
    Convert the specific ge.json format to the questionnaire format.
    
    Args:
        ge_json_path (str): Path to the ge.json file
        output_path (str): Path to save the questionnaire JSON file
        max_items (int, optional): Maximum number of items to include
    """
    try:
        # Load the ge.json data
        with open(ge_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded {len(data)} items from {ge_json_path}")
        
        # Limit the number of items if specified
        if max_items and max_items < len(data):
            data = data[:max_items]
            print(f"Limited to {max_items} items")
        
        # Convert to questionnaire format
        questionnaire_data = []
        
        for i, item in enumerate(data):
            # Get the ground truth
            ground_truth = item.get("GT", "")
            # Get the negative comments
            negative_comments = item.get("negative_comments", [])
            
            # Create options by combining ground truth and negative comments
            # Put the ground truth at a random position
            options = negative_comments.copy()
            correct_option_index = random.randint(0, len(options))
            options.insert(correct_option_index, ground_truth)
            
            # Video URL - assuming naming convention based on index
            video_filename = f"technique_{i+1}.mp4"
            video_url = f"videos/{video_filename}"
            
            # Create the questionnaire item
            questionnaire_item = {
                "id": f"technique_{i+1}",
                "videoUrl": video_url,
                "groundTruth": ground_truth,
                "options": options,
                "correctOptionIndex": correct_option_index  # Store the correct option index
            }
            
            questionnaire_data.append(questionnaire_item)
        
        # Write the questionnaire data to the output file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(questionnaire_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully converted {len(questionnaire_data)} items to questionnaire format")
        print(f"Saved to {output_path}")
        
        # Print information about creating a GitHub Pages repository
        print("\nTo create a GitHub Pages site with this questionnaire:")
        print("1. Create a new GitHub repository")
        print("2. Upload the following files to the repository:")
        print("   - index.html")
        print("   - questionnaire.js")
        print("   - questionnaire_data.json")
        print("   - videos/ directory with your video files")
        print("3. Go to Settings > Pages and enable GitHub Pages")
        print("4. Your questionnaire will be available at https://yourusername.github.io/repositoryname/")
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description='Convert data to questionnaire format')
    parser.add_argument('--input', required=True,
                        help='Path to the input JSON file')
    parser.add_argument('--output', default='questionnaire_data.json',
                        help='Path to the output questionnaire JSON file')
    parser.add_argument('--video-dir', default='videos',
                        help='Directory where videos are stored')
    parser.add_argument('--max-items', type=int, default=None,
                        help='Maximum number of items to include')
    parser.add_argument('--from-ge-json', action='store_true',
                        help='Specify if input is in ge.json format')
    
    args = parser.parse_args()
    
    if args.from_ge_json:
        convert_ge_json_to_questionnaire(args.input, args.output, args.max_items)
    else:
        convert_data_to_questionnaire_format(args.input, args.output, args.video_dir)

if __name__ == "__main__":
    main() 