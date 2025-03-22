document.addEventListener('DOMContentLoaded', function() {
    // Data structure for the questionnaire
    let questionnaireData = [];
    let currentIndex = 0;
    let responses = [];
    let correctAnswers = {};
    
    console.log("Script loaded, starting data loading...");

    // Directly check if the JSON file exists
    fetch('questionnaire_data.json')
        .then(response => {
            console.log("Fetch response code:", response.status);
            return response.text(); // First get the raw text
        })
        .then(text => {
            console.log("Raw JSON data length:", text.length, "bytes");
            console.log("First 100 characters of JSON data:", text.substring(0, 100));
            
            try {
                // Manually parse JSON
                const data = JSON.parse(text);
                return data;
            } catch (e) {
                console.error("JSON parsing error:", e);
                throw new Error("JSON parsing failed: " + e.message);
            }
        })
        .then(data => {
            console.log("Successfully parsed JSON data");
            console.log("Number of data items:", data.length);
            console.log("Data type:", Object.prototype.toString.call(data));
            
            if (data.length > 0) {
                console.log("First item data:", data[0]);
                
                if (data[0].negative_comments) {
                    console.log("First item negative_comments type:", 
                                Object.prototype.toString.call(data[0].negative_comments));
                    console.log("First item negative_comments length:", 
                                Array.isArray(data[0].negative_comments) ? data[0].negative_comments.length : "not an array");
                    
                    if (Array.isArray(data[0].negative_comments) && data[0].negative_comments.length > 0) {
                        console.log("First item's first negative comment:", data[0].negative_comments[0]);
                    }
                } else {
                    console.error("First item is missing negative_comments field");
                }
            }
            
            questionnaireData = data;
            console.log("Data loading complete, processing options...");
            prepareOptions();
            console.log("Options processing complete, initializing responses...");
            initializeResponses();
            console.log("Response initialization complete, rendering current question...");
            renderCurrentQuestion();
            console.log("Question rendering complete, updating progress bar...");
            updateProgressBar();
            console.log("All initialization complete!");
        })
        .catch(error => {
            console.error('Error loading questionnaire data:', error);
            document.querySelector('.container').innerHTML = `
                <div class="alert alert-danger">
                    <h4>Data Loading Error</h4>
                    <p>Sorry, there was a problem loading the questionnaire data. Please refresh the page or contact the administrator.</p>
                    <p>Error details: ${error.message}</p>
                </div>
            `;
        });

    // Prepare options by merging groundTruth with negative_comments and shuffling
    function prepareOptions() {
        console.log(`Processing ${questionnaireData.length} data items`);
        
        if (questionnaireData.length === 0) {
            console.error("questionnaireData array is empty, cannot process options!");
            return;
        }
        
        // Clone data to avoid modifying the original data
        const processedData = [];
        
        // Process each question
        questionnaireData.forEach((item, index) => {
            console.log(`Processing item ${index} (id: ${item.id})`);
            
            // Create a deep copy rather than a shallow copy
            const processedItem = JSON.parse(JSON.stringify(item));
            
            // Validate if groundTruth exists
            if (!processedItem.groundTruth) {
                console.error(`Item ${processedItem.id || index}: missing groundTruth`);
                processedItem.groundTruth = "Missing ground truth";
            }
            
            // Validate if negative_comments exists and is an array
            if (!processedItem.negative_comments) {
                console.error(`Item ${processedItem.id || index}: missing negative_comments`);
                processedItem.negative_comments = [
                    "Missing option 1", 
                    "Missing option 2", 
                    "Missing option 3", 
                    "Missing option 4"
                ];
            } else if (!Array.isArray(processedItem.negative_comments)) {
                console.error(`Item ${processedItem.id || index}: negative_comments is not an array:`, 
                             processedItem.negative_comments);
                console.error(`negative_comments type: ${typeof processedItem.negative_comments}`);
                
                // Try to convert to array (if it's another type)
                try {
                    if (typeof processedItem.negative_comments === 'string') {
                        // If it's a string, try to parse as JSON
                        processedItem.negative_comments = JSON.parse(processedItem.negative_comments);
                        console.log(`Successfully parsed ${processedItem.id}'s negative_comments string to array`);
                    } else {
                        // If it's another type, convert to default array
                        processedItem.negative_comments = [
                            "Missing option 1", 
                            "Missing option 2", 
                            "Missing option 3", 
                            "Missing option 4"
                        ];
                    }
                } catch (e) {
                    console.error(`Cannot convert negative_comments: ${e}`);
                    processedItem.negative_comments = [
                        "Missing option 1", 
                        "Missing option 2", 
                        "Missing option 3", 
                        "Missing option 4"
                    ];
                }
            } else if (processedItem.negative_comments.length === 0) {
                console.error(`Item ${processedItem.id || index}: negative_comments is an empty array`);
                processedItem.negative_comments = [
                    "Missing option 1", 
                    "Missing option 2", 
                    "Missing option 3", 
                    "Missing option 4"
                ];
            }
            
            console.log(`Item ${processedItem.id || index} has groundTruth: "${processedItem.groundTruth}" and ${processedItem.negative_comments.length} negative comments`);
            
            // Create an array with all options
            const allOptions = [processedItem.groundTruth, ...processedItem.negative_comments];
            console.log(`Merged ${allOptions.length} options, first option is: "${allOptions[0].substring(0, 50)}..."`);
            
            // Shuffle options
            shuffleArray(allOptions);
            
            // Replace the options array in the data
            processedItem.options = allOptions;
            
            // Find the index of the correct answer in the shuffled array
            const groundTruthIndex = allOptions.findIndex(option => option === processedItem.groundTruth);
            correctAnswers[processedItem.id] = groundTruthIndex;
            
            console.log(`Question ${processedItem.id}: correct answer index ${groundTruthIndex}, total ${allOptions.length} options`);
            
            // Add to the processed data array
            processedData.push(processedItem);
        });
        
        // Replace original data with processed data
        questionnaireData = processedData;
        console.log(`Prepared options for ${questionnaireData.length} questions`);
    }

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
        console.log("Initializing responses for", questionnaireData.length, "questions");
        
        // Ensure questionnaireData is a valid array
        if(!Array.isArray(questionnaireData) || questionnaireData.length === 0) {
            console.error("Cannot initialize responses: questionnaireData is invalid");
            return;
        }
        
        responses = questionnaireData.map((item, index) => ({
            questionId: item.id,
            selectedOption: null,
            isCorrect: false,
            feedbackShown: false,  // New field to mark if feedback has been shown
            comments: ''
        }));
        
        console.log("Created", responses.length, "response objects");

        // Try to load any previously saved responses from localStorage
        const savedResponses = localStorage.getItem('textQuestionnaireResponses');
        if (savedResponses) {
            try {
                const parsedResponses = JSON.parse(savedResponses);
                // Only restore responses for questions that still exist in our data
                questionnaireData.forEach((item, index) => {
                    const savedResponse = parsedResponses.find(r => r.questionId === item.id);
                    if (savedResponse) {
                        responses[index] = savedResponse;
                    }
                });
            } catch (e) {
                console.error('Error parsing saved responses:', e);
            }
        }
    }

    // Render the current question and its options
    function renderCurrentQuestion() {
        if (!questionnaireData || !questionnaireData.length) {
            console.error("No questionnaire data available");
            return;
        }

        console.log("Current index:", currentIndex);
        console.log("Total questions:", questionnaireData.length);
        
        if (currentIndex >= questionnaireData.length) {
            console.error(`Current index (${currentIndex}) is out of bounds for array of length ${questionnaireData.length}`);
            currentIndex = 0; // Reset to first question if out of bounds
        }

        const item = questionnaireData[currentIndex];
        console.log(`Rendering question ${currentIndex + 1}/${questionnaireData.length} (ID: ${item.id})`);
        console.log("Item data:", item);
        
        // Ensure the item has options property
        if (!item.options || !Array.isArray(item.options)) {
            console.error(`Item ${item.id} has no valid options array, attempting to recreate it`);
            
            // Check if groundTruth and negative_comments exist
            if (!item.groundTruth) {
                console.error(`Item ${item.id} is missing groundTruth`);
                item.groundTruth = "Missing ground truth";
            }
            
            if (!item.negative_comments || !Array.isArray(item.negative_comments)) {
                console.error(`Item ${item.id} is missing negative_comments or it's not an array`);
                console.log("negative_comments:", item.negative_comments);
                
                // If negative_comments exists but is not an array, try to parse
                if (item.negative_comments && typeof item.negative_comments === 'string') {
                    try {
                        item.negative_comments = JSON.parse(item.negative_comments);
                        console.log("Successfully parsed negative_comments string to array");
                    } catch (e) {
                        console.error("Failed to parse negative_comments:", e);
                        item.negative_comments = [
                            "Missing option 1", 
                            "Missing option 2", 
                            "Missing option 3", 
                            "Missing option 4"
                        ];
                    }
                } else {
                    // Set default options
                    item.negative_comments = [
                        "Missing option 1", 
                        "Missing option 2", 
                        "Missing option 3", 
                        "Missing option 4"
                    ];
                }
            }
            
            // Create options array and shuffle
            item.options = [item.groundTruth, ...item.negative_comments];
            shuffleArray(item.options);
            correctAnswers[item.id] = item.options.findIndex(option => option === item.groundTruth);
            
            console.log("Recreated options array:", item.options);
        }
        
        console.log("Item options:", item.options.length);
        
        // Generate a domain-specific scenario description based on the item's ID
        let domain = "guitar";
        if (item.id && item.id.includes('_')) {
            domain = item.id.split('_')[0]; // Extract domain from ID (e.g., "guitar_1" -> "guitar")
        }
        
        // Use the scenario_text from the JSON data or create a default if not available
        let scenarioText = item.scenario_text || "A student is performing a skill.";
        
        // Get the feedback type based on is_ge flag
        let feedbackType = item.is_ge ? "good execution" : "tips for improvement";
        
        // Create the instruction text
        let instructionText = `Here are some expert feedback options (${feedbackType}). Which one best describes this performance?`;
        
        const questionContainer = document.getElementById('question-container');
        
        // Create scenario description
        const scenarioHtml = `
            <div class="scenario-description">
                <h5>Scenario ${currentIndex + 1}</h5>
                <p>${scenarioText} ${instructionText}</p>
            </div>
        `;
        
        // Create HTML for options
        const optionsHtml = item.options.map((option, idx) => `
            <div class="option-card ${responses[currentIndex].selectedOption === idx ? 'selected' : ''}" data-option="${idx}">
                <i class="bi bi-check-circle-fill check-icon"></i>
                ${option}
            </div>
        `).join('');

        // Feedback message element - hidden initially
        const feedbackHtml = `
            <div class="feedback-message" id="feedback-${currentIndex}" style="display: none;">
                <!-- Feedback will be populated by JavaScript after user submits -->
            </div>
        `;

        // Add submit button
        const submitButtonHtml = `
            <div class="text-center mb-4">
                <button class="btn btn-primary" id="submit-answer-btn" ${responses[currentIndex].feedbackShown ? 'disabled' : ''}>
                    ${responses[currentIndex].feedbackShown ? 'Submitted' : 'Submit Answer'}
                </button>
            </div>
        `;

        // Full question HTML
        const questionHtml = `
            <div class="question-item" id="question-item-${currentIndex}">
                <h3>Question ${currentIndex + 1} of ${questionnaireData.length}</h3>
                ${scenarioHtml}
                
                <div class="questionnaire-section">
                    <h4>Select the most accurate feedback option:</h4>
                    <div class="options-container mb-3">
                        ${optionsHtml}
                    </div>
                    
                    ${submitButtonHtml}
                    ${feedbackHtml}
                    
                    <div class="mb-3 mt-4">
                        <label for="comments-${currentIndex}" class="form-label">Additional Comments (Optional)</label>
                        <textarea class="form-control" id="comments-${currentIndex}" 
                            placeholder="Any comments about your selection">${responses[currentIndex].comments || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        questionContainer.innerHTML = questionHtml;
        
        // Add event listeners to option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', function() {
                const optionIndex = parseInt(this.getAttribute('data-option'));
                selectOption(optionIndex);
            });
        });
        
        // Add event listener for the submit button
        document.getElementById('submit-answer-btn').addEventListener('click', function() {
            submitAnswer();
        });
        
        // Add event listener for comments
        document.getElementById(`comments-${currentIndex}`).addEventListener('input', function() {
            responses[currentIndex].comments = this.value;
            saveResponses();
        });
        
        // If feedback has been shown before, need to show it again
        if (responses[currentIndex].feedbackShown) {
            showFeedback();
        }
        
        // Update navigation buttons
        document.getElementById('prev-btn').disabled = (currentIndex === 0);
        document.getElementById('next-btn').textContent = (currentIndex === questionnaireData.length - 1) ? 'Finish' : 'Next';
    }

    // Select an option for the current question
    function selectOption(optionIndex) {
        // Remove previous selection
        document.querySelectorAll('.option-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Mark new selection
        const selectedCard = document.querySelector(`.option-card[data-option="${optionIndex}"]`);
        selectedCard.classList.add('selected');
        
        // Update response data
        responses[currentIndex].selectedOption = optionIndex;
        
        // Save responses
        saveResponses();
    }

    // Submit answer and show feedback
    function submitAnswer() {
        if (responses[currentIndex].selectedOption === null) {
            alert('Please select an option first');
            return;
        }

        // Determine if correct
        const correctIndex = correctAnswers[questionnaireData[currentIndex].id];
        const isCorrect = (responses[currentIndex].selectedOption === correctIndex);
        
        // Update response data
        responses[currentIndex].isCorrect = isCorrect;
        responses[currentIndex].feedbackShown = true;
        
        // Show feedback
        showFeedback();
        
        // Disable submit button
        document.getElementById('submit-answer-btn').disabled = true;
        document.getElementById('submit-answer-btn').textContent = 'Submitted';
        
        // Save responses
        saveResponses();
    }

    // Show feedback message
    function showFeedback() {
        const isCorrect = responses[currentIndex].isCorrect;
        const selectedIndex = responses[currentIndex].selectedOption;
        const correctIndex = correctAnswers[questionnaireData[currentIndex].id];
        
        // Update all option cards' styles
        document.querySelectorAll('.option-card').forEach((card, idx) => {
            card.classList.remove('correct', 'incorrect');
            
            if (idx === correctIndex) {
                card.classList.add('correct');
            } else if (idx === selectedIndex && !isCorrect) {
                card.classList.add('incorrect');
            }
        });
        
        // Show feedback message
        const feedbackEl = document.getElementById(`feedback-${currentIndex}`);
        feedbackEl.style.display = 'block';
        feedbackEl.className = `feedback-message ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
        feedbackEl.innerHTML = isCorrect ? 
            '<strong>Correct!</strong> You selected the most appropriate feedback option.' : 
            `<strong>Incorrect.</strong> The more appropriate option is #${correctIndex + 1}.`;
    }

    // Save responses to localStorage
    function saveResponses() {
        localStorage.setItem('textQuestionnaireResponses', JSON.stringify(responses));
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
            renderCurrentQuestion();
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
            renderCurrentQuestion();
            updateProgressBar();
        } else {
            // Show submission form if we're at the last question
            document.getElementById('question-container').style.display = 'none';
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
            const confirmSubmit = confirm(`You have not answered ${unansweredCount} question(s). Do you want to submit anyway?`);
            if (!confirmSubmit) return;
        }
        
        // Calculate score
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
        
        // For GitHub Pages demo, we'll just save to localStorage
        localStorage.setItem('textQuestionnaireSubmission', JSON.stringify(submissionData));
        
        // Submit to FormSpree
        submitToFormSpree(submissionData);
    });

    // Function to submit to FormSpree
    function submitToFormSpree(data) {
        // Use the same FormSpree endpoint as in your video questionnaire
        const formSpreeEndpoint = 'https://formspree.io/f/xdkeaypg';
        
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