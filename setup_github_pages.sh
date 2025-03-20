#!/bin/bash

# Stop on error
set -e

echo "=== Video Technique Evaluation GitHub Pages Setup ==="
echo

# Check if required packages are installed
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "Python 3 not found. Please install Python 3 and try again."
    exit 1
fi



# Create videos directory
echo "Creating videos directory..."
mkdir -p videos

# Process videos if source video is provided
if [ -n "$1" ]; then
    echo "Processing videos from source: $1"
    python download_videos_for_web.py --source-video "$1" --time-ranges time_ranges.json
else
    echo "No source video provided. You will need to add videos manually to the videos/ directory."
    echo "To process videos, run: ./setup_github_pages.sh /path/to/your/source/video.mp4"
fi

# Create or verify GitHub repository
if [ -d ".git" ]; then
    echo "Git repository already exists."
else
    echo "Initializing new Git repository..."
    git init
    git add .
    git commit -m "Initial commit for GitHub Pages video questionnaire"
    
    echo "To push to GitHub:"
    echo "1. Create a new repository on GitHub"
    echo "2. Run the following commands:"
    echo "   git remote add origin https://github.com/yourusername/your-repo-name.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
fi

echo
echo "Setup complete! To test the site locally, run:"
echo "python -m http.server 8000"
echo
echo "Then open your browser to: http://localhost:8000"
echo
echo "To enable GitHub Pages:"
echo "1. Push this repository to GitHub"
echo "2. Go to repository settings > Pages"
echo "3. Select the 'main' branch as the source"
echo "4. Click Save"
echo
echo "Your questionnaire will be available at https://yourusername.github.io/your-repo-name/" 