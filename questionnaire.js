document.addEventListener('DOMContentLoaded', function() {
    // Data structure for the questionnaire
    let questionnaireData = [];
    let currentIndex = 0;
    let responses = [];

    // Load the questionnaire data
    fetch('filtered_questionnaire_data.json')
        .then(response => response.json())
        .then(data => {
            questionnaireData = data;
            console.log("Loaded questionnaire data:", data); // Debug log
            
            // Process the data to create combined and shuffled options
            questionnaireData.forEach((item, index) => {
                console.log(`Processing item ${index} (id: ${item.id}):`, item); // Debug log
                
                // Verify groundTruth exists
                if (!item.groundTruth) {
                    console.error(`Item ${item.id || index}: missing groundTruth`);
                    item.groundTruth = "Missing ground truth";
                }
                
                // Verify negative_comments exists and is an array
                if (!item.negative_comments) {
                    console.error(`Item ${item.id || index}: missing negative_comments`);
                    item.negative_comments = [
                        "Missing option 1", 
                        "Missing option 2", 
                        "Missing option 3", 
                        "Missing option 4"
                    ]; // Set default to prevent errors
                } else if (!Array.isArray(item.negative_comments)) {
                    console.error(`Item ${item.id || index}: negative_comments is not an array:`, item.negative_comments);
                    // Try to convert to array if it's something else
                    try {
                        if (typeof item.negative_comments === 'string') {
                            // If it's a string, try to parse it as JSON
                            item.negative_comments = JSON.parse(item.negative_comments);
                        } else {
                            // If it's some other type, convert to empty array
                            item.negative_comments = [
                                "Missing option 1", 
                                "Missing option 2", 
                                "Missing option 3", 
                                "Missing option 4"
                            ];
                        }
                    } catch (e) {
                        console.error(`Failed to convert negative_comments: ${e}`);
                        item.negative_comments = [
                            "Missing option 1", 
                            "Missing option 2", 
                            "Missing option 3", 
                            "Missing option 4"
                        ]; // Set default to prevent errors
                    }
                }
                
                console.log(`Item ${item.id || index} has groundTruth: "${item.groundTruth}" and ${item.negative_comments.length} negative comments`);
                
                // Create an array combining groundTruth and negative_comments
                const allOptions = [item.groundTruth, ...item.negative_comments];
                console.log(`Combined ${allOptions.length} options for item ${item.id || index}`);
                
                // Shuffle the options so groundTruth isn't always first
                shuffleArray(allOptions);
                
                // Add options array to the item
                item.options = allOptions;
                
                // Find the index of groundTruth in the shuffled array
                item.correctOptionIndex = allOptions.indexOf(item.groundTruth);
                console.log(`Item ${item.id}: correct answer is index ${item.correctOptionIndex} out of ${allOptions.length} options`);
            });
            
            initializeResponses();
            renderCurrentVideo();
            updateProgressBar();
        })
        .catch(error => {
            console.error('Error loading questionnaire data:', error);
            document.getElementById('app').innerHTML = `
                <div class="alert alert-danger">
                    <h4>Error Loading Data</h4>
                    <p>Sorry, there was a problem loading the questionnaire data. Please refresh the page or contact the administrator.</p>
                    <p>Error details: ${error.message}</p>
                </div>
            `;
        });

    // Fisher-Yates shuffle algorithm
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Initialize responses array
    function initializeResponses() {
        responses = questionnaireData.map(item => ({
            videoId: item.id,
            selectedOption: null,
            isCorrect: false,
            comments: ''
        }));

        // Try to load any previously saved responses from localStorage
        const savedResponses = localStorage.getItem('videoQuestionnaireResponses');
        if (savedResponses) {
            try {
                const parsedResponses = JSON.parse(savedResponses);
                // Only restore responses for videos that still exist in our data
                questionnaireData.forEach((item, index) => {
                    const savedResponse = parsedResponses.find(r => r.videoId === item.id);
                    if (savedResponse) {
                        responses[index] = savedResponse;
                    }
                });
            } catch (e) {
                console.error('Error parsing saved responses:', e);
            }
        }
    }

    // Render the current video and its options
    function renderCurrentVideo() {
        if (!questionnaireData || !questionnaireData.length) {
            console.error("No questionnaire data available");
            return;
        }

        const item = questionnaireData[currentIndex];
        console.log(`Rendering video ${currentIndex + 1}/${questionnaireData.length} (ID: ${item.id})`);
        console.log("Item data:", item);
        console.log("Item has", item.options ? item.options.length : 0, "options");
        
        const videoContainer = document.getElementById('video-container');
        
        // Ensure options exist
        if (!item.options || !Array.isArray(item.options) || item.options.length === 0) {
            console.error(`Item ${item.id} has no valid options array, attempting to recreate it`);
            if (item.groundTruth && item.negative_comments && Array.isArray(item.negative_comments)) {
                item.options = [item.groundTruth, ...item.negative_comments];
                shuffleArray(item.options);
                item.correctOptionIndex = item.options.indexOf(item.groundTruth);
            } else {
                console.error("Cannot recreate options - missing required data");
                item.options = ["Option 1 (error)", "Option 2 (error)", "Option 3 (error)", "Option 4 (error)", "Option 5 (error)"];
                item.correctOptionIndex = 0;
            }
        }
        
        // Create HTML for the current video with explicit controls
        const optionsHtml = item.options.map((option, idx) => `
            <div class="option-card ${responses[currentIndex].selectedOption === idx ? 'selected' : ''}" data-option="${idx}">
                <i class="bi bi-check-circle-fill check-icon"></i>
                ${option}
            </div>
        `).join('');

        // Modified video HTML with preload attribute and explicit height/width
        const videoHtml = `
            <div class="video-item" id="video-item-${currentIndex}">
                <h3>Video ${currentIndex + 1} of ${questionnaireData.length}</h3>
                <div class="video-container mb-4">
                    <video controls preload="auto" width="100%" height="auto" id="video-${currentIndex}">
                        <source src="${item.videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
                
                <div class="questionnaire-section">
                    <h4>Select the most accurate feedback option:</h4>
                    <div class="options-container mb-3">
                        ${optionsHtml}
                    </div>
                    
                    <div class="mb-3">
                        <label for="comments-${currentIndex}" class="form-label">Additional Comments (Optional)</label>
                        <textarea class="form-control" id="comments-${currentIndex}" 
                            placeholder="Any comments about this video or your selection">${responses[currentIndex].comments || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        videoContainer.innerHTML = videoHtml;
        
        // After the video element is created, let's check if it loaded correctly
        const videoElement = document.getElementById(`video-${currentIndex}`);
        if (videoElement) {
            console.log("Video element created:", videoElement);
            
            // Add event listeners to detect video load issues
            videoElement.addEventListener('error', function(e) {
                console.error("Video error:", e);
                alert("Error loading video. Please check the console for details.");
            });
            
            videoElement.addEventListener('loadeddata', function() {
                console.log("Video loaded successfully");
            });
        }
        
        // Add event listeners to option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', function() {
                const optionIndex = parseInt(this.getAttribute('data-option'));
                selectOption(optionIndex);
            });
        });
        
        // Add event listener for comments
        document.getElementById(`comments-${currentIndex}`).addEventListener('input', function() {
            responses[currentIndex].comments = this.value;
            saveResponses();
        });
        
        // Update navigation buttons
        document.getElementById('prev-btn').disabled = (currentIndex === 0);
        document.getElementById('next-btn').textContent = (currentIndex === questionnaireData.length - 1) ? 'Finish' : 'Next';
    }

    // Select an option for the current video
    function selectOption(optionIndex) {
        // Update response data with selection and whether it's correct
        const correctIndex = questionnaireData[currentIndex].correctOptionIndex;
        const isCorrect = (optionIndex === correctIndex);
        
        responses[currentIndex].selectedOption = optionIndex;
        responses[currentIndex].isCorrect = isCorrect;
        
        // Update UI
        document.querySelectorAll('.option-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`.option-card[data-option="${optionIndex}"]`).classList.add('selected');
        
        // Save responses
        saveResponses();
    }

    // Save responses to localStorage
    function saveResponses() {
        localStorage.setItem('videoQuestionnaireResponses', JSON.stringify(responses));
    }

    // Update the progress bar
    function updateProgressBar() {
        const progress = ((currentIndex + 1) / questionnaireData.length) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;
    }

    // Navigation button event listeners
    document.getElementById('prev-btn').addEventListener('click', function() {
        if (currentIndex > 0) {
            currentIndex--;
            renderCurrentVideo();
            updateProgressBar();
        }
    });

    document.getElementById('next-btn').addEventListener('click', function() {
        // Save any comments
        const commentsTextarea = document.getElementById(`comments-${currentIndex}`);
        if (commentsTextarea) {
            responses[currentIndex].comments = commentsTextarea.value;
            saveResponses();
        }

        if (currentIndex < questionnaireData.length - 1) {
            currentIndex++;
            renderCurrentVideo();
            updateProgressBar();
        } else {
            // Show submission form if we're at the last video
            document.getElementById('video-container').style.display = 'none';
            document.getElementById('submission-form').style.display = 'block';
            document.getElementById('prev-btn').style.display = 'none';
            document.getElementById('next-btn').style.display = 'none';
        }
    });

    // Submit button event listener
    document.getElementById('submit-all-btn').addEventListener('click', function() {
        const name = document.getElementById('evaluator-name').value.trim();
        const email = document.getElementById('evaluator-email').value.trim();
        const additionalComments = document.getElementById('additional-comments').value.trim();
        
        if (!name) {
            alert('Please enter your name before submitting.');
            return;
        }
        
        if (!email) {
            alert('Please enter your email before submitting.');
            return;
        }
        
        // Check if any responses are missing
        const unansweredCount = responses.filter(r => r.selectedOption === null).length;
        if (unansweredCount > 0) {
            const confirmSubmit = confirm(`You have not selected options for ${unansweredCount} video(s). Do you want to submit anyway?`);
            if (!confirmSubmit) return;
        }
        
        // Calculate score for correct answers
        const correctCount = responses.filter(r => r.isCorrect).length;
        const totalScore = Math.round((correctCount / questionnaireData.length) * 100);
        
        // Prepare the final submission data
        const submissionData = {
            evaluator: {
                name: name,
                email: email,
                additionalComments: additionalComments
            },
            responses: responses,
            score: {
                correct: correctCount,
                total: questionnaireData.length,
                percentage: totalScore
            },
            submittedAt: new Date().toISOString()
        };
        
        // In a real application, you would send this data to your server
        console.log('Submission data:', submissionData);
        
        // For GitHub Pages demo, we'll just save to localStorage and show success
        localStorage.setItem('videoQuestionnaireSubmission', JSON.stringify(submissionData));
        
        // For demonstration, you could submit to a service like FormSpree
        // that allows you to collect form submissions on static sites
        submitToFormSpree(submissionData);
    });

    // Function to submit to FormSpree (or similar service)
    function submitToFormSpree(data) {
        // Replace with your actual FormSpree endpoint or other service
        const formSpreeEndpoint = 'https://formspree.io/f/xdkeaypg'; // Replace with your FormSpree form ID
        
        // Show loading state
        document.getElementById('submit-all-btn').disabled = true;
        document.getElementById('submit-all-btn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
        
        // Send data to FormSpree
        fetch(formSpreeEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (response.ok) {
                document.getElementById('submission-form').style.display = 'none';
                document.getElementById('submission-success').style.display = 'block';
                
                // Save to localStorage as backup
                localStorage.setItem('videoQuestionnaireSubmission', JSON.stringify(data));
            } else {
                console.error('Form submission failed:', response.status, response.statusText);
                alert('There was a problem submitting your responses. Please try again.');
                document.getElementById('submit-all-btn').disabled = false;
                document.getElementById('submit-all-btn').textContent = 'Submit Evaluation';
            }
        })
        .catch(error => {
            console.error('Submission error:', error);
            alert('There was a problem submitting your responses. Please try again.');
            document.getElementById('submit-all-btn').disabled = false;
            document.getElementById('submit-all-btn').textContent = 'Submit Evaluation';
        });
    }
}); 