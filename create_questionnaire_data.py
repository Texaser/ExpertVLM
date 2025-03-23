#!/usr/bin/env python3

import json
import os
import random
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description='Generate a large pool of questionnaire data')
    parser.add_argument('--output_file', type=str, default='all_questionnaire_data.json',
                        help='Output file for all samples (default: all_questionnaire_data.json)')
    parser.add_argument('--min_options', type=int, default=3,
                        help='Minimum number of negative options required for a valid sample (default: 3)')
    return parser.parse_args()

# Path to matched_results directory
matched_results_dir = '/mnt/bum/hanyi/repo/Qwen/matched_results'

# Define scenario text for each domain and type (tips/ge)
def get_scenario_text(domain, is_ge):
    # Default texts
    tips_text = "A player is struggling with their technique."
    ge_text = "A player is executing a good performance."
    
    # Domain-specific texts
    domain_scenarios = {
        "violin": {
            "tips": "A violin student is struggling with their technique.",
            "ge": "A violin student is executing a good performance."
        },
        "piano": {
            "tips": "A piano student is struggling with their technique.",
            "ge": "A piano student is executing a good performance."
        },
        "guitar": {
            "tips": "A guitar student is struggling with their technique.",
            "ge": "A guitar student is executing a good performance."
        },
        "bike": {
            "tips": "A cycling student is having trouble with their bike technique.",
            "ge": "A cycling student is executing a good bike performance."
        },
        "dance": {
            "tips": "A dance student is struggling with their movement technique.",
            "ge": "A dance student is executing a good movement performance."
        },
        "basketball": {
            "tips": "A basketball player is struggling with their technique.",
            "ge": "A basketball player is executing a good performance."
        },
        "soccer": {
            "tips": "A soccer player is struggling with their technique.",
            "ge": "A soccer player is executing a good performance."
        },
        "salad": {
            "tips": "A cooking student is struggling with their salad preparation technique.",
            "ge": "A cooking student is executing a good salad preparation."
        },
        "omelet": {
            "tips": "A cooking student is struggling with their omelet preparation technique.",
            "ge": "A cooking student is executing a good omelet preparation."
        },
        "cooking": {
            "tips": "A cooking student is struggling with their cooking technique.",
            "ge": "A cooking student is executing a good cooking performance."
        },
        "cpr": {
            "tips": "A CPR student is struggling with their emergency technique.",
            "ge": "A CPR student is executing a good emergency procedure."
        },
        "covid": {
            "tips": "A healthcare worker is struggling with their COVID-19 procedures.",
            "ge": "A healthcare worker is executing good COVID-19 procedures."
        },
        "bouldering": {
            "tips": "A climbing student is struggling with their bouldering technique.",
            "ge": "A climbing student is executing good bouldering movements."
        }
    }
    
    if domain in domain_scenarios:
        if is_ge:
            return domain_scenarios[domain]["ge"]
        else:
            return domain_scenarios[domain]["tips"]
    else:
        # Default if domain not found
        return ge_text if is_ge else tips_text

def collect_all_samples(min_options=3):
    """Collect all valid samples from all enriched JSON files"""
    all_samples = []
    sample_id = 1
    domain_counts = {}
    
    # Get all *_enriched.json files
    json_files = [f for f in os.listdir(matched_results_dir) if f.endswith('_enriched.json')]
    
    for file_name in json_files:
        file_path = os.path.join(matched_results_dir, file_name)
        
        # Extract domain from filename
        domain = file_name.split('_')[0]
        is_ge = "_ge_" in file_name
        
        # Track domain counts
        domain_key = f"{domain}_{'ge' if is_ge else 'tips'}"
        if domain_key not in domain_counts:
            domain_counts[domain_key] = 0
        
        # Get appropriate scenario text
        scenario_text = get_scenario_text(domain, is_ge)
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Get samples
            samples = data.get('enriched_samples', [])
            
            if not samples:
                print(f'No samples found in {file_name}')
                continue
            
            # Process each sample
            for sample in samples:
                # Check if the required fields exist
                if 'GT' not in sample or 'negative_comments' not in sample:
                    continue
                
                # Ensure negative_comments is a list with enough options
                if not isinstance(sample['negative_comments'], list) or len(sample['negative_comments']) < min_options:
                    continue
                
                # Create the new sample in the format required for questionnaire_data.json
                new_sample = {
                    'id': f'{domain}_{sample_id}',
                    'groundTruth': sample['GT'],
                    'negative_comments': sample['negative_comments'],
                    'scenario_text': scenario_text,
                    'is_ge': is_ge,
                    'domain': domain,
                    'domain_type': domain_key
                }
                
                # Add video URL if it exists
                if 'take_name' in sample and 'recording' in sample:
                    video_name = f"{sample['take_name']}_{sample['recording']}"
                    # Just reference a placeholder URL for now
                    new_sample['videoUrl'] = f"videos/{video_name}.mp4"
                else:
                    # Use a placeholder for videos
                    new_sample['videoUrl'] = f"videos/placeholder_{domain}_{sample_id}.mp4"
                
                all_samples.append(new_sample)
                domain_counts[domain_key] += 1
                sample_id += 1
        
        except Exception as e:
            print(f'Error processing {file_name}: {str(e)}')
    
    return all_samples, domain_counts

def main():
    args = parse_args()
    
    print(f"Collecting samples from {matched_results_dir}...")
    all_samples, domain_counts = collect_all_samples(min_options=args.min_options)
    
    # Print statistics about collected samples
    print("\nSample statistics:")
    print(f"Total valid samples: {len(all_samples)}")
    print("Samples per domain:")
    for domain_key, count in sorted(domain_counts.items()):
        print(f"  {domain_key}: {count} samples")
    
    # Save all samples
    with open(args.output_file, 'w') as f:
        json.dump(all_samples, f, indent=2)
    
    print(f"\nSaved {len(all_samples)} samples to {args.output_file}")
    
    # Also create a copy as questionnaire_data.json for the frontend
    with open('questionnaire_data.json', 'w') as f:
        json.dump(all_samples, f, indent=2)
    
    print(f"Also copied to questionnaire_data.json")
    
    print("\nNext steps:")
    print("1. Update text_questionnaire.js to randomly select N questions from the pool for each user")
    print("2. Add a mechanism to ensure different users see different questions")

if __name__ == '__main__':
    main() 