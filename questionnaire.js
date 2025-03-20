document.addEventListener('DOMContentLoaded', function() {
    // Data structure for the questionnaire
    let questionnaireData = [];
    let currentIndex = 0;
    let responses = [];

    // Load the questionnaire data
    fetch('questionnaire_data.json')
        .then(response => response.json())
        .then(data => {
            questionnaireData = data;
            console.log("Loaded questionnaire data:", data); // Debug log
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

    // Initialize responses array
    function initializeResponses() {
        responses = questionnaireData.map(item => ({
            videoId: item.id,
            selectedOption: null,
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
        console.log("Rendering video for item:", item); // Debug log
        
        const videoContainer = document.getElementById('video-container');
        
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
                    <h4>Ground Truth</h4>
                    <div class="comment-card mb-4">${item.groundTruth}</div>
                    
                    <h4>Select the most accurate option:</h4>
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
        responses[currentIndex].selectedOption = optionIndex;
        
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
        
        // Prepare the final submission data
        const submissionData = {
            evaluator: {
                name: name,
                email: email,
                additionalComments: additionalComments
            },
            responses: responses,
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
        const formSpreeEndpoint = 'https://formspree.io/f/yourformid';
        
        // Show loading state
        document.getElementById('submit-all-btn').disabled = true;
        document.getElementById('submit-all-btn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
        
        // For demonstration, we'll just simulate a successful submission
        setTimeout(() => {
            // Show success message
            document.getElementById('submission-form').style.display = 'none';
            document.getElementById('submission-success').style.display = 'block';
            
            // In a real implementation, you would send data to FormSpree like this:
            /*
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
                } else {
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
            */
        }, 1500);
    }
}); 