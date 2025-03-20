# Video Technique Evaluation Questionnaire

This is a GitHub Pages website for conducting video technique evaluations in a questionnaire format. Users can watch videos, compare different technique descriptions, and provide feedback.

## Demo

You can see a live demo of this questionnaire at: [https://yourusername.github.io/video-evaluation](https://yourusername.github.io/video-evaluation)

## Features

- Multiple videos with options to select from
- Progress tracking for respondents
- Mobile-friendly responsive design
- User-friendly interface with clear instructions
- Data collection through FormSpree (or your preferred backend)
- Automatic data persistence using localStorage

## Setup Instructions

### Basic GitHub Pages Setup

1. **Fork or clone this repository**

2. **Enable GitHub Pages**
   - Go to your repository settings
   - Scroll down to the GitHub Pages section
   - Select the main branch as the source
   - Click Save

3. **Customize the questionnaire data**
   - Edit `questionnaire_data.json` to include your own videos and options
   - Upload your videos to the `videos/` directory

4. **Update form submission settings (optional)**
   - In `questionnaire.js`, replace the FormSpree endpoint with your own
   - Or implement your preferred method of data collection

### Preparing Your Own Data

If you have existing data in a different format (like the `ge.json` file), you can use the included Python tools to convert it:

```bash
# Convert ge.json to questionnaire format
python convert_to_questionnaire.py --input path/to/ge.json --output questionnaire_data.json --from-ge-json

# Process videos for the questionnaire
python download_videos_for_web.py --source-video path/to/source.mp4 --questionnaire-data questionnaire_data.json
```

## Project Structure

- `index.html`: The main HTML file for the questionnaire
- `questionnaire.js`: JavaScript code for handling user interactions and data collection
- `questionnaire_data.json`: JSON file containing the questionnaire data
- `videos/`: Directory containing video clips for the questionnaire
- `convert_to_questionnaire.py`: Python script to convert existing data to questionnaire format
- `download_videos_for_web.py`: Python script to process videos for web use

## Customization

### Appearance

You can customize the appearance of the questionnaire by editing the CSS in the `<style>` section of `index.html`.

### Behavior

The behavior of the questionnaire can be customized by editing `questionnaire.js`.

### Data Collection

By default, the questionnaire uses a simulated submission process. To collect real data, you can:

1. Set up a [FormSpree](https://formspree.io/) endpoint and update the endpoint in `questionnaire.js`
2. Implement your own backend solution
3. Use Google Forms or another survey tool by modifying the submission function

## License

This project is available under the MIT License. See the LICENSE file for more details. 