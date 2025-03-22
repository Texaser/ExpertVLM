#!/usr/bin/env python3

import json
import os
import random

# Path to matched_results directory
matched_results_dir = '/mnt/bum/hanyi/repo/Qwen/matched_results'

# New questionnaire data
new_data = []
sample_id = 1

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


# Get all *_enriched.json files
json_files = [f for f in os.listdir(matched_results_dir) if f.endswith('_enriched.json')]

# Process each file
for file_name in json_files:
    file_path = os.path.join(matched_results_dir, file_name)
    
    # Skip very large files that might cause memory issues
    file_size = os.path.getsize(file_path) / (1024 * 1024)  # Size in MB
    
    # Extract domain from filename
    domain = file_name.split('_')[0]
    
    # Check if it's a "ge" or "tips" file
    is_ge = "_ge_" in file_name
    
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
        
        # Limit to maximum 3 samples
        selected_samples = random.sample(samples, min(2, len(samples)))
        
        for sample in selected_samples:
            # Check if the required fields exist
            if 'GT' not in sample or 'negative_comments' not in sample:
                continue
                
            # Create the new sample in the format required for questionnaire_data.json
            new_sample = {
                'id': f'{domain}_{sample_id}',
                'groundTruth': sample['GT'],
                'negative_comments': sample['negative_comments'],
                'scenario_text': scenario_text,
                'is_ge': is_ge
            }
            
            # Add video URL if it exists
            if 'take_name' in sample and 'recording' in sample:
                video_name = f"{sample['take_name']}_{sample['recording']}"
                # Just reference a placeholder URL for now
                new_sample['videoUrl'] = f"videos/placeholder_{domain}_{sample_id}.mp4"
            else:
                # Use a placeholder for videos
                new_sample['videoUrl'] = f"videos/placeholder_{domain}_{sample_id}.mp4"
            
            new_data.append(new_sample)
            sample_id += 1
    
    except Exception as e:
        print(f'Error processing {file_name}: {str(e)}')

# Save the new questionnaire_data.json
with open('questionnaire_data.json', 'w') as f:
    json.dump(new_data, f, indent=2)

print(f'Created questionnaire_data.json with {len(new_data)} samples') 