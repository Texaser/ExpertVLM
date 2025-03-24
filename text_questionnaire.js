document.addEventListener('DOMContentLoaded', function() {
    // Data structure for the questionnaire
    let questionnaireData = [];
    let currentIndex = 0;
    let responses = [];
    let correctAnswers = {};
    let lastSaveTime = null;
    let saveTimeout = null;
    
    // Settings for balanced question selection
    const samplesPerType = 2;  // Number of samples per domain and type (GE/tips)
    const userSessionId = getOrCreateUserSessionId();  // Get existing session ID or create a new one
    const AUTO_SAVE_INTERVAL = 30000; // Auto-save interval: 30 seconds
    
    console.log("Script loaded, starting data loading...");
    console.log("User session ID:", userSessionId);

    // Initialize save status indicator
    const saveStatus = document.getElementById('save-status');
    const saveStatusMessage = document.getElementById('save-status-message');
    const resumeBanner = document.getElementById('resume-banner');

    // Generate a unique session ID for this user or use existing one
    function getOrCreateUserSessionId() {
        const savedId = localStorage.getItem('textQuestionnaireSessionId');
        if (savedId) {
            console.log("Found existing session ID:", savedId);
            return savedId;
        }
        
        // Create a new session ID
        const timestamp = new Date().getTime();
        const randomPart = Math.floor(Math.random() * 1000000);
        const newId = `${timestamp}-${randomPart}`;
        
        // Save the new ID
        localStorage.setItem('textQuestionnaireSessionId', newId);
        return newId;
    }
    
    // Show save status with specified message and class
    function showSaveStatus(message, className) {
        saveStatusMessage.textContent = message;
        saveStatus.className = ''; // Clear existing classes
        saveStatus.classList.add('visible', className);
        
        // Hide after 3 seconds
        setTimeout(() => {
            saveStatus.classList.remove('visible');
        }, 3000);
    }
    
    // Schedule auto-save
    function scheduleAutoSave() {
        // Clear any existing timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Set new timeout
        saveTimeout = setTimeout(() => {
            saveResponses(true); // true = is auto-save
        }, AUTO_SAVE_INTERVAL);
    }
    
    // Select balanced questions from the full dataset
    function selectBalancedQuestions(allQuestions, samplesPerType) {
        // Use the session ID as part of the random seed
        const seed = parseInt(userSessionId.split('-')[0]) % 10000;
        const seededRandom = new Math.seedrandom(seed.toString());
        
        // Group questions by domain and type (GE/tips)
        const groupedQuestions = {};
        
        allQuestions.forEach(question => {
            const domain = question.domain || question.id.split('_')[0];
            const type = question.is_ge ? 'ge' : 'tips';
            const key = `${domain}_${type}`;
            
            if (!groupedQuestions[key]) {
                groupedQuestions[key] = [];
            }
            
            groupedQuestions[key].push(question);
        });
        
        console.log("Grouped questions by domain and type:", Object.keys(groupedQuestions));
        
        // Find unique domains
        const domains = [...new Set(Object.keys(groupedQuestions).map(key => key.split('_')[0]))];
        console.log("Available domains:", domains);
        
        // Select questions for each domain and type
        const selectedQuestions = [];
        
        domains.forEach(domain => {
            const geKey = `${domain}_ge`;
            const tipsKey = `${domain}_tips`;
            
            // Select good execution samples if available
            if (groupedQuestions[geKey] && groupedQuestions[geKey].length >= samplesPerType) {
                // Shuffle the array
                shuffleArrayWithSeed(groupedQuestions[geKey], seededRandom);
                // Take first N samples
                selectedQuestions.push(...groupedQuestions[geKey].slice(0, samplesPerType));
                console.log(`Selected ${samplesPerType} GE samples from ${domain}`);
            } else if (groupedQuestions[geKey]) {
                console.log(`Not enough GE samples for ${domain}, using all ${groupedQuestions[geKey].length} available`);
                selectedQuestions.push(...groupedQuestions[geKey]);
            } else {
                console.log(`No GE samples available for ${domain}`);
            }
            
            // Select tips for improvement samples if available
            if (groupedQuestions[tipsKey] && groupedQuestions[tipsKey].length >= samplesPerType) {
                // Shuffle the array
                shuffleArrayWithSeed(groupedQuestions[tipsKey], seededRandom);
                // Take first N samples
                selectedQuestions.push(...groupedQuestions[tipsKey].slice(0, samplesPerType));
                console.log(`Selected ${samplesPerType} tips samples from ${domain}`);
            } else if (groupedQuestions[tipsKey]) {
                console.log(`Not enough tips samples for ${domain}, using all ${groupedQuestions[tipsKey].length} available`);
                selectedQuestions.push(...groupedQuestions[tipsKey]);
            } else {
                console.log(`No tips samples available for ${domain}`);
            }
        });
        
        // Final shuffle to mix up the questions
        shuffleArrayWithSeed(selectedQuestions, seededRandom);
        
        return selectedQuestions;
    }
    
    // Fisher-Yates shuffle with seeded random
    function shuffleArrayWithSeed(array, seededRandom) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(seededRandom() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Directly check if the JSON file exists
    fetch('questionnaire_data.json')
        .then(response => {
            console.log("Fetch response code:", response.status);
            return response.text(); // First get the raw text
        })
        .then(text => {
            console.log("Raw JSON data length:", text.length, "bytes");
            
            try {
                // Manually parse JSON
                const allData = JSON.parse(text);
                
                // Log the complete data with separators between samples
                console.log("Complete JSON data:");
                allData.forEach((item, index) => {
                    console.log(`\n------ SAMPLE ${index + 1}: ${item.id} ------`);
                    // Log the entire item object without any truncation
                    console.log(JSON.stringify(item, null, 2));
                });
                
                return allData;
            } catch (e) {
                console.error("JSON parsing error:", e);
                throw new Error("JSON parsing failed: " + e.message);
            }
        })
        .then(allData => {
            console.log("Successfully parsed JSON data");
            console.log("Total available questions:", allData.length);
            
            // Select balanced questions for this user session
            const selectedData = selectBalancedQuestions(allData, samplesPerType);
            console.log(`Selected ${selectedData.length} questions for this session`);
            
            // Log the distribution of selected questions
            const distribution = {};
            selectedData.forEach(item => {
                const domain = item.domain || item.id.split('_')[0];
                const type = item.is_ge ? 'ge' : 'tips';
                const key = `${domain}_${type}`;
                
                if (!distribution[key]) {
                    distribution[key] = 0;
                }
                
                distribution[key]++;
            });
            console.log("Distribution of selected questions:", distribution);
            
            if (selectedData.length > 0) {
                console.log("First selected item:", selectedData[0]);
            }
            
            questionnaireData = selectedData;
            console.log("Data loading complete, processing options...");
            prepareOptions();
            console.log("Options processing complete, initializing responses...");
            initializeResponses();
            console.log("Response initialization complete, rendering current question...");
            renderCurrentQuestion();
            console.log("Updating progress bar...");
            updateProgressBar();
            
            // Start auto-save interval
            scheduleAutoSave();
            
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
            console.log(`Merged ${allOptions.length} options for item ${processedItem.id}`);
            
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
        
        // Create new response objects for each question
        const newResponses = questionnaireData.map((item, index) => ({
            questionId: item.id,
            selectedOption: null,
            isCorrect: false,
            feedbackShown: false,  // New field to mark if feedback has been shown
            comments: '',
            validations: item.options ? new Array(item.options.length).fill(null) : [],  // Track validation for each option
            cannotTell: false  // Track if user selected "Cannot tell"
        }));
        
        console.log("Created", newResponses.length, "new response objects");

        // Try to load any previously saved responses from localStorage
        const savedResponses = localStorage.getItem('textQuestionnaireResponses');
        const savedCurrentIndex = localStorage.getItem('textQuestionnaireCurrentIndex');
        let hasRestoredProgress = false;
        
        if (savedResponses) {
            try {
                const parsedResponses = JSON.parse(savedResponses);
                console.log("Found saved responses:", parsedResponses.length);
                
                // Only restore responses for questions that match our current data
                questionnaireData.forEach((item, index) => {
                    const savedResponse = parsedResponses.find(r => r.questionId === item.id);
                    if (savedResponse) {
                        // Make sure validations array exists and has the right length
                        if (!savedResponse.validations || savedResponse.validations.length !== item.options.length) {
                            savedResponse.validations = new Array(item.options.length).fill(null);
                        }
                        // Make sure cannotTell property exists
                        if (savedResponse.cannotTell === undefined) {
                            savedResponse.cannotTell = false;
                        }
                        newResponses[index] = savedResponse;
                        hasRestoredProgress = true;
                    }
                });
                
                // Restore current question index if valid
                if (savedCurrentIndex && !isNaN(parseInt(savedCurrentIndex))) {
                    const parsedIndex = parseInt(savedCurrentIndex);
                    if (parsedIndex >= 0 && parsedIndex < questionnaireData.length) {
                        currentIndex = parsedIndex;
                        console.log("Restored current index to:", currentIndex);
                    }
                }
                
                // Show resume banner if we restored progress
                if (hasRestoredProgress) {
                    resumeBanner.style.display = 'block';
                    showSaveStatus("Progress restored", "saved");
                }
            } catch (e) {
                console.error('Error parsing saved responses:', e);
            }
        }
        
        responses = newResponses;
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
        
        // Create the instruction text with LLM validation explanation
        let instructionText = `Here are some expert feedback options (${feedbackType}). Some options are generated by AI and may not be appropriate. Please:
        1. Select the option that <strong>best describes this performance</strong> OR check "<strong>Cannot tell which option is correct</strong>" below.
        2. For <strong>EACH option</strong>, mark it as either <strong>Valid</strong> or <strong>Invalid</strong> based on whether it makes sense in this context.
        
        You must complete <strong>both steps</strong> before submitting.`;
        
        const questionContainer = document.getElementById('question-container');
        
        // Create scenario description
        const scenarioHtml = `
            <div class="scenario-description">
                <h5>Scenario ${currentIndex + 1}</h5>
                <p>${scenarioText} ${instructionText}</p>
            </div>
        `;
        
        // Create HTML for options with validation controls
        const optionsHtml = item.options.map((option, idx) => {
            const validClass = responses[currentIndex].validations[idx] === true ? 'valid-option' : 
                             (responses[currentIndex].validations[idx] === false ? 'invalid-option' : '');
            
            return `
                <div class="option-card ${responses[currentIndex].selectedOption === idx ? 'selected' : ''} ${validClass}" data-option="${idx}">
                    <div class="option-content option-clickable">
                        <i class="bi bi-check-circle-fill check-icon"></i>
                        <div class="option-text">${option}</div>
                    </div>
                    <div class="validation-controls">
                        <label class="validation-label">
                            <input type="radio" name="validation-${currentIndex}-${idx}" value="valid" 
                                ${responses[currentIndex].validations[idx] === true ? 'checked' : ''}>
                            Valid
                        </label>
                        <label class="validation-label">
                            <input type="radio" name="validation-${currentIndex}-${idx}" value="invalid"
                                ${responses[currentIndex].validations[idx] === false ? 'checked' : ''}>
                            Invalid
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        // Add "Cannot tell" option
        const cannotTellHtml = `
            <div class="cannot-tell-option ${responses[currentIndex].cannotTell ? 'selected' : ''}">
                <label>
                    <input type="checkbox" id="cannot-tell-${currentIndex}" 
                        ${responses[currentIndex].cannotTell ? 'checked' : ''}>
                    <span>Cannot tell which option is correct</span>
                </label>
            </div>
        `;

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
                    
                    ${cannotTellHtml}
                    
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
        
        // Add event listeners to option cards and their content
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', function(e) {
                // Don't trigger option selection if clicking on validation controls
                if (e.target.closest('.validation-controls')) {
                    return;
                }
                
                const optionIndex = parseInt(this.getAttribute('data-option'));
                selectOption(optionIndex);
            });
        });
        
        // Make option-content also clickable
        document.querySelectorAll('.option-clickable').forEach(content => {
            content.addEventListener('click', function(e) {
                const card = this.closest('.option-card');
                if (card) {
                    const optionIndex = parseInt(card.getAttribute('data-option'));
                    selectOption(optionIndex);
                }
            });
        });
        
        // Add event listeners for validation radios
        document.querySelectorAll('.validation-controls input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const [_, questionIdx, optionIdx] = this.name.split('-');
                const value = this.value === 'valid';
                updateValidation(parseInt(optionIdx), value);
            });
        });
        
        // Add event listener for "Cannot tell" checkbox
        const cannotTellCheckbox = document.getElementById(`cannot-tell-${currentIndex}`);
        if (cannotTellCheckbox) {
            cannotTellCheckbox.addEventListener('change', function() {
                responses[currentIndex].cannotTell = this.checked;
                
                // If "Cannot tell" is selected, deselect any chosen option
                if (this.checked && responses[currentIndex].selectedOption !== null) {
                    responses[currentIndex].selectedOption = null;
                    document.querySelectorAll('.option-card').forEach(card => {
                        card.classList.remove('selected');
                    });
                }
                
                // Update UI
                document.querySelector('.cannot-tell-option').classList.toggle('selected', this.checked);
                saveResponses();
            });
        }
        
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
        // Check if all options have been validated
        const allOptionsValidated = responses[currentIndex].validations.every(validation => validation === true || validation === false);
        
        if (!allOptionsValidated) {
            alert('Please mark every option as either Valid or Invalid before submitting.');
            return;
        }
        
        // Check if user either selected an option or marked "Cannot tell"
        if (responses[currentIndex].selectedOption === null && !responses[currentIndex].cannotTell) {
            alert('Please select an option or check "Cannot tell which option is correct"');
            return;
        }

        // If "Cannot tell" is checked, we don't evaluate correctness
        if (responses[currentIndex].cannotTell) {
            responses[currentIndex].isCorrect = null; // Not applicable
            responses[currentIndex].feedbackShown = true;
            
            // Disable submit button
            document.getElementById('submit-answer-btn').disabled = true;
            document.getElementById('submit-answer-btn').textContent = 'Submitted';
            
            // Save responses and return without showing feedback
            saveResponses();
            return;
        }

        // Determine if correct for normal selections
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

    // Update validation for an option
    function updateValidation(optionIndex, isValid) {
        responses[currentIndex].validations[optionIndex] = isValid;
        
        // Update UI
        const optionCard = document.querySelector(`.option-card[data-option="${optionIndex}"]`);
        optionCard.classList.remove('valid-option', 'invalid-option');
        optionCard.classList.add(isValid ? 'valid-option' : 'invalid-option');
        
        // Save responses
        saveResponses();
    }

    // Save responses to localStorage
    function saveResponses(isAutoSave = false) {
        try {
            localStorage.setItem('textQuestionnaireResponses', JSON.stringify(responses));
            localStorage.setItem('textQuestionnaireCurrentIndex', currentIndex.toString());
            
            // Record last save time
            lastSaveTime = new Date();
            
            // Show save indicator (unless it's an auto-save and we don't want to distract)
            if (!isAutoSave) {
                showSaveStatus("Progress saved", "saved");
            }
            
            // Reschedule auto-save
            scheduleAutoSave();
            
            return true;
        } catch (e) {
            console.error("Error saving progress:", e);
            showSaveStatus("Save failed", "error");
            return false;
        }
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
            saveResponses();
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
            
            // Final save before submission
            saveResponses();
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
        
        // Check if any responses are missing - consider a question answered if either an option is selected OR "Cannot tell" is checked
        const unansweredCount = responses.filter(r => r.selectedOption === null && !r.cannotTell).length;
        if (unansweredCount > 0) {
            const confirmSubmit = confirm(`You have not answered ${unansweredCount} question(s). Do you want to submit anyway?`);
            if (!confirmSubmit) return;
        }
        
        // Calculate score - only consider questions where an option was selected (not "Cannot tell")
        const answeredQuestions = responses.filter(r => r.selectedOption !== null);
        const correctCount = answeredQuestions.filter(r => r.isCorrect).length;
        const totalAnswered = answeredQuestions.length;
        const totalScore = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
        
        // Create enhanced responses with clear validation labels and spacing between questions
        const enhancedResponses = responses.map((response, idx) => {
            // Get the original options for this question
            const questionOptions = questionnaireData[idx].options;
            const domain = questionnaireData[idx].domain || questionnaireData[idx].id.split('_')[0];
            const feedbackType = questionnaireData[idx].is_ge ? 'good execution' : 'tips for improvement';
            
            // Create labeled validations that include the complete option text
            const labeledValidations = response.validations.map((isValid, optionIdx) => {
                return {
                    optionNumber: optionIdx + 1,
                    // Display complete text without truncation
                    optionText: questionOptions[optionIdx],
                    isValid: isValid,
                    validationLabel: isValid === true ? 'Valid' : 
                                   isValid === false ? 'Invalid' : 'Not Validated'
                };
            });
            
            // Add a formatted response with clear structure and spacing
            return {
                // Start with question ID as the first field for easy identification
                questionId: response.questionId,
                spacer: "----------------------------------------",
                domain: domain,
                feedbackType: feedbackType,
                selectionInfo: {
                    selectedOption: response.selectedOption !== null ? 
                          `Option #${response.selectedOption + 1}` : null,
                    // Display complete selected option text without truncation
                    selectedOptionText: response.selectedOption !== null ? 
                              questionOptions[response.selectedOption] : null,
                    cannotTell: response.cannotTell,
                    isCorrect: response.isCorrect
                },
                validationResults: labeledValidations,
                userComments: response.comments || "No comments provided"
            };
        });
        
        // Prepare the final submission data
        const submissionData = {
            evaluator: {
                name: name,
                email: email,
                additionalComments: additionalComments
            },
            sessionInfo: {
                sessionId: userSessionId,
                submittedAt: new Date().toISOString(),
                questionsTotal: questionnaireData.length,
                questionsAnswered: totalAnswered,
                cannotTellCount: responses.filter(r => r.cannotTell).length,
                correctCount: correctCount,
                score: totalScore
            },
            responses: enhancedResponses
        };
        
        // In a real application, you would send this data to your server
        console.log('Submission data:', submissionData);
        
        // Show loading state for submission
        document.getElementById('submit-all-btn').disabled = true;
        document.getElementById('submit-all-btn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
        
        // For GitHub Pages demo, we'll save to localStorage
        localStorage.setItem('textQuestionnaireSubmission', JSON.stringify(submissionData));
        
        // Submit to FormSpree
        submitToFormSpree(submissionData);
    });

    // Function to submit to FormSpree
    function submitToFormSpree(data) {
        // Use the same FormSpree endpoint as in your video questionnaire
        const formSpreeEndpoint = 'https://formspree.io/f/xdkeaypg';
        
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
                // Clear saved progress data after successful submission
                localStorage.removeItem('textQuestionnaireResponses');
                localStorage.removeItem('textQuestionnaireCurrentIndex');
                
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
    
    // Handle page leaving/refresh to save state
    window.addEventListener('beforeunload', function(e) {
        // Save progress one last time before leaving
        saveResponses(true);
    });
}); 