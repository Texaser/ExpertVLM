// Main variables to manage the questionnaire state
let currentQuestionIndex = 0;
let questions = [];
let userResponses = [];
let userSessionId = getOrCreateUserSessionId();
let preloadedVideos = {}; // Store preloaded videos
let lastSaveTime = null;
let saveTimeout = null;
const AUTO_SAVE_INTERVAL = 30000; // Auto-save interval: 30 seconds

// DOM elements
const videoContainer = document.getElementById('video-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const progressCount = document.getElementById('progress-count');
const saveStatus = document.getElementById('save-status');
const saveStatusMessage = document.getElementById('save-status-message');
const resumeBanner = document.getElementById('resume-banner');
const submissionForm = document.getElementById('submission-form');
const submitAllBtn = document.getElementById('submit-all-btn');
const submissionSuccess = document.getElementById('submission-success');

// Function to shuffle array elements (Fisher-Yates algorithm)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Load questions and initialize the questionnaire
document.addEventListener('DOMContentLoaded', function() {
    // Optimize video playback performance
    optimizeVideoPlayback();
    
    loadQuestions()
        .then(data => {
            questions = data;
            if (questions.length > 0) {
                loadUserResponses();
                renderQuestion(currentQuestionIndex);
                updateProgressBar();
                
                // Preload next video
                preloadNextVideo(currentQuestionIndex + 1);
                
                // Start auto-save interval
                scheduleAutoSave();
            } else {
                videoContainer.innerHTML = '<div class="alert alert-danger">No questions found.</div>';
            }
        })
        .catch(error => {
            videoContainer.innerHTML = `<div class="alert alert-danger">Error loading questions: ${error.message}</div>`;
        });

    // Add event listeners
    prevBtn.addEventListener('click', goToPreviousQuestion);
    nextBtn.addEventListener('click', goToNextQuestion);
    submitAllBtn.addEventListener('click', submitAllResponses);
    
    // Add global click handler for buttons in dynamic content
    document.addEventListener('click', function(event) {
        // Handle reveal button clicks
        if (event.target && event.target.id === 'reveal-btn') {
            handleRevealBtnClick(event.target);
        }
        
        // Handle confirm filter button clicks
        if (event.target && event.target.id === 'confirm-filter-btn') {
            handleConfirmFilterBtnClick(event.target);
        }
    });
});

// Get or create a user session ID
function getOrCreateUserSessionId() {
    let sessionId = localStorage.getItem('userSessionId');
    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem('userSessionId', sessionId);
    }
    return sessionId;
}

// Generate a UUID for user session
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Load questions from JSON file
async function loadQuestions() {
    try {
        const response = await fetch('filtered_all_questionnaire_data_enriched.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const allData = await response.json();
        
        // 返回所有数据，不再限制为前10个
        return allData;
    } catch (error) {
        throw error;
    }
}

// Load user responses from localStorage if available
function loadUserResponses() {
    const savedResponses = localStorage.getItem(`videoResponses_${userSessionId}`);
    if (savedResponses) {
        userResponses = JSON.parse(savedResponses);
        
        // If we have a saved position, restore it
        const savedPosition = localStorage.getItem(`videoPosition_${userSessionId}`);
        if (savedPosition) {
            currentQuestionIndex = parseInt(savedPosition, 10);
        }
        
        // Show resume banner
        resumeBanner.style.display = 'block';
        showSaveStatus("Progress restored", "saved");
    } else {
        // Initialize empty responses for each question
        userResponses = questions.map(() => ({
            selectedOption: null,
            filterFlags: {
                groundTruthNotClear: false,
                otherOptionsSupported: false,
                languageIssues: false,
                otherIssues: false
            },
            flagReasons: '',
            comments: '',
            feedbackShown: false,
            isCorrect: false,
            timestamp: new Date().toISOString()
        }));
        saveUserResponses();
    }
}

// Optimize video playback performance
function optimizeVideoPlayback() {
    // Basic optimization for video playback
    const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                           isMobileDevice() || 
                           /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Limit concurrent video loading
    window.MAX_CONCURRENT_VIDEOS = isLowEndDevice ? 1 : 2;
    
    // Set video quality
    window.VIDEO_QUALITY = isLowEndDevice ? 'low' : 'high';
}

// Preload next video
function preloadNextVideo(nextIndex) {
    if (nextIndex < questions.length) {
        const nextQuestion = questions[nextIndex];
        const nextQuestionId = nextQuestion.id;
        const nextVideoTime = nextQuestion.video_time || 'unknown';
        const videoPath = `additional_video_clips/${nextQuestionId}_${nextVideoTime}.mp4`;
        
        // Check if already preloaded
        if (!preloadedVideos[nextQuestionId]) {
            // Create a temporary video element for preloading
            const preloadVideo = document.createElement('video');
            preloadVideo.style.display = 'none';
            preloadVideo.src = videoPath;
            preloadVideo.preload = 'metadata'; // Only preload metadata
            preloadVideo.muted = true; // Mute to reduce resource usage
            
            // Listen for the preload completion event
            preloadVideo.addEventListener('loadedmetadata', function() {
                preloadedVideos[nextQuestionId] = {
                    path: videoPath,
                    duration: preloadVideo.duration,
                    width: preloadVideo.videoWidth,
                    height: preloadVideo.videoHeight,
                    ready: true
                };
                
                // If mobile device, remove preload element immediately to save resources
                if (isMobileDevice()) {
                    if (document.body.contains(preloadVideo)) {
                        document.body.removeChild(preloadVideo);
                    }
                }
            });
            
            preloadVideo.addEventListener('error', function(e) {
                // Mark as preload failed
                preloadedVideos[nextQuestionId] = {
                    path: videoPath,
                    ready: false,
                    error: true
                };
                
                // Remove DOM element
                if (document.body.contains(preloadVideo)) {
                    document.body.removeChild(preloadVideo);
                }
            });
            
            // Start preloading
            preloadVideo.load();
            
            // Add to DOM (needed to trigger loading)
            document.body.appendChild(preloadVideo);
            
            // Set shorter timeout to remove element and save resources
            setTimeout(() => {
                if (document.body.contains(preloadVideo)) {
                    document.body.removeChild(preloadVideo);
                }
            }, 15000); // Remove after 15 seconds regardless of loading completion
        }
    }
}

// Detect mobile device
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
        saveUserResponses(true); // true = is auto-save
    }, AUTO_SAVE_INTERVAL);
}

// Save user responses to localStorage
function saveUserResponses(isAutoSave = false) {
    localStorage.setItem(`videoResponses_${userSessionId}`, JSON.stringify(userResponses));
    localStorage.setItem(`videoPosition_${userSessionId}`, currentQuestionIndex.toString());
    
    // Record last save time
    lastSaveTime = new Date();
    
    // Show save indicator (unless it's an auto-save and we don't want to distract)
    if (!isAutoSave) {
        showSaveStatus("Progress saved", "saved");
    }
    
    // Reschedule auto-save
    scheduleAutoSave();
}

// Render the current question
function renderQuestion(index) {
    if (index < 0 || index >= questions.length) {
        return;
    }

    const question = questions[index];
    const response = userResponses[index];
    
    // Clear previous content
    videoContainer.innerHTML = '';

    // Get the template and create a new instance
    const template = document.getElementById('video-question-template');
    const questionElement = template.content.cloneNode(true);
    
    // Set up the video
    const videoPlayer = questionElement.querySelector('#video-player');
    const videoSource = questionElement.querySelector('source');
    
    // 构建视频文件路径，使用id和video_time
    const videoTime = question.video_time || 'unknown';
    const videoPath = `additional_video_clips/${question.id}_${videoTime}.mp4`;
    
    // Try multiple possible video paths
    const videoPaths = [
        videoPath,  // 主路径
        `additional_video_clips/${question.id.toLowerCase()}_${videoTime}.mp4`  // 备用路径（小写ID）
    ];
    
    // Function to try loading from each path
    let pathIndex = 0;
    function tryNextVideoPath() {
        if (pathIndex >= videoPaths.length) {
            // All paths failed, show error message
            const videoWrapper = questionElement.querySelector('.video-wrapper');
            const errorMessage = document.createElement('div');
            errorMessage.className = 'alert alert-warning mt-2';
            errorMessage.innerHTML = `
                <strong>Video could not be loaded</strong><br>
                <p>You can continue the evaluation without the video.</p>
            `;
            videoWrapper.appendChild(errorMessage);
            return;
        }
        
        // Try current path
        videoSource.src = videoPaths[pathIndex];
        videoPlayer.load();
        
        // Make sure video controls work
        videoPlayer.controls = true;
        videoPlayer.controlsList = "nodownload";
        videoPlayer.style.width = "100%";
        videoPlayer.style.zIndex = "10";
        
        // Ensure it's playable
        videoPlayer.addEventListener('canplay', function() {
            console.log("Video can play now");
            // Sometimes needed to kickstart the video
            videoPlayer.play().then(() => {
                videoPlayer.pause();
            }).catch(e => console.log("Auto-play prevented by browser"));
        });
        
        // Increment for next attempt
        pathIndex++;
    }
    
    // Start trying paths
    tryNextVideoPath();
    
    // Add event listeners for video
    videoPlayer.addEventListener('error', function(e) {
        console.error("Video error:", e);
        // Try next path
        tryNextVideoPath();
    });
    
    // Make sure video controls are visible and functional
    videoPlayer.addEventListener('loadedmetadata', function() {
        // Force controls to be visible
        videoPlayer.controls = true;
        console.log("Video metadata loaded, duration:", videoPlayer.duration);
    });

    // Set up the options
    const optionsList = questionElement.querySelector('.options-list');
    const allOptions = [question.groundTruth, ...question.negative_comments];
    
    // Shuffle options for random order
    const shuffledOptions = shuffleArray([...allOptions]);
    
    // Store the mapping of shuffled indices to determine ground truth later
    const groundTruthIndex = shuffledOptions.indexOf(question.groundTruth);
    questionElement.querySelector('#options-container').dataset.groundTruthIndex = groundTruthIndex;
    
    // Create option elements
    shuffledOptions.forEach((option, i) => {
        const optionCard = document.createElement('div');
        optionCard.className = `option-card ${response.selectedOption === i ? 'selected' : ''}`;
        optionCard.dataset.index = i;
        
        optionCard.innerHTML = `
            <div class="option-content">
                <i class="bi bi-check-circle-fill check-icon"></i>
            <div class="option-text">${option}</div>
            </div>
        `;
        
        // 直接给选项卡添加点击事件
        optionCard.addEventListener('click', function() {
            // 移除所有选项的selected类
            optionsList.querySelectorAll('.option-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // 为当前选中的选项添加selected类
            this.classList.add('selected');
            
            // 更新用户响应数据
            userResponses[currentQuestionIndex].selectedOption = i;
            
            // 启用提交按钮
            const submitBtn = questionElement.querySelector('#reveal-btn');
            submitBtn.disabled = false;
            
            // 保存响应
            saveUserResponses();
        });
        
        optionsList.appendChild(optionCard);
    });
    
    // Add click handlers for options
    questionElement.querySelectorAll('.option-clickable').forEach(clickable => {
        clickable.addEventListener('click', function() {
            const card = this.closest('.option-card');
            if (!card) return;
            
            const optionIndex = parseInt(card.dataset.index, 10);
            selectOption(optionIndex, questionElement);
        });
    });
    
    // Set up the submit button
    const submitBtn = questionElement.querySelector('#reveal-btn');
    submitBtn.disabled = response.feedbackShown;
    submitBtn.textContent = response.feedbackShown ? 'Submitted' : 'Confirm Selection';
    
    // Set up the comments textarea
    const commentsTextarea = questionElement.querySelector('#comments');
    if (commentsTextarea) {
        commentsTextarea.value = response.comments || '';
        commentsTextarea.addEventListener('input', function() {
            response.comments = this.value;
            saveUserResponses();
        });
    }
    
    // Clear previous content and append new question
    videoContainer.innerHTML = '';
    videoContainer.appendChild(questionElement);
    
    // If this question was already answered, show Phase 2
    if (response.feedbackShown) {
        showFeedback(questionElement);
    }
}

// Save filter flags from the form
function saveFilterFlags(index, questionElement) {
    userResponses[index].filterFlags = {
        groundTruthNotClear: questionElement.querySelector('#filter-groundtruth').checked,
        otherOptionsSupported: questionElement.querySelector('#filter-others').checked,
        languageIssues: questionElement.querySelector('#filter-language').checked,
        otherIssues: questionElement.querySelector('#filter-other-issues').checked
    };
    
    if (questionElement.querySelector('#filter-other-issues').checked) {
        userResponses[index].flagReasons = questionElement.querySelector('#flag-reasons').value;
    } else {
        userResponses[index].flagReasons = '';
    }
    
    userResponses[index].timestamp = new Date().toISOString();
    saveUserResponses();
}

// Update the progress bar
function updateProgressBar() {
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
    
    // Update progress count text
    progressCount.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
}

// Go to the previous question
function goToPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex);
        updateNavigationButtons();
        updateProgressBar();
    }
}

// Go to the next question
function goToNextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
        updateNavigationButtons();
        updateProgressBar();
    } else {
        // Show submission form when all questions are answered
        videoContainer.style.display = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        submissionForm.style.display = 'block';
    }
}

// Update navigation buttons' state
function updateNavigationButtons() {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === questions.length - 1;
    
    // 更新下一步按钮的文本
    nextBtn.textContent = (currentQuestionIndex === questions.length - 1) ? 'Finish' : 'Next';
}

// Submit all responses
function submitAllResponses() {
    const evaluatorName = document.getElementById('evaluator-name').value;
    const evaluatorEmail = document.getElementById('evaluator-email').value;
    const additionalComments = document.getElementById('additional-comments').value;
    
    if (!evaluatorName || !evaluatorEmail) {
        alert('Please enter your name and email before submitting.');
        return;
    }
    
    // Check if there are unanswered questions
    const unansweredCount = userResponses.filter(r => r.selectedOption === null).length;
    if (unansweredCount > 0) {
        const confirmSubmit = confirm(`You have not answered ${unansweredCount} question(s). Do you want to submit anyway?`);
        if (!confirmSubmit) return;
    }
    
    // Create enhanced responses with clear structure
    const enhancedResponses = userResponses.map((response, index) => {
        const question = questions[index];
        const originalOptions = [question.groundTruth, ...question.negative_comments];
        const selectedOptionText = response.selectedOption !== null ? 
                                   originalOptions[response.selectedOption] : "No option selected";
        
        // Return formatted response with clear structure
        return {
            questionId: question.id,
            domain: question.domain,
            feedbackType: question.is_ge ? 'good execution' : 'tips for improvement',
            selectionInfo: {
                selectedOption: response.selectedOption !== null ? 
                      `Option #${response.selectedOption + 1}` : null,
                selectedOptionText: response.selectedOption !== null ? 
                          selectedOptionText : null,
                isCorrect: response.isCorrect
            },
            filterFlags: response.filterFlags,
            flagReasons: response.flagReasons || "No flag reasons provided",
            comments: response.comments || ""
        };
    });
    
    // Prepare the final submission data
    const submissionData = {
        evaluator: {
            name: evaluatorName,
            email: evaluatorEmail,
            additionalComments: additionalComments
        },
        sessionInfo: {
            sessionId: userSessionId,
            submittedAt: new Date().toISOString(),
            questionsTotal: questions.length,
            questionsAnswered: questions.length - unansweredCount
        },
        responses: enhancedResponses
    };
    
    // Show loading state
    submitAllBtn.disabled = true;
    submitAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
    
    // Save to localStorage as backup
    localStorage.setItem('videoQuestionnaireSubmission', JSON.stringify(submissionData));
    
    // Submit to FormSpree
    submitToFormSpree(submissionData);
}

// Function to submit to FormSpree
function submitToFormSpree(data) {
    // FormSpree endpoint - use the same as in text_questionnaire.js
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
            localStorage.removeItem(`videoResponses_${userSessionId}`);
            localStorage.removeItem(`videoPosition_${userSessionId}`);
            
            submissionForm.style.display = 'none';
            submissionSuccess.style.display = 'block';
        } else {
            console.error('Form submission failed:', response.status, response.statusText);
            alert('There was a problem submitting your responses. Please try again.');
            submitAllBtn.disabled = false;
            submitAllBtn.textContent = 'Submit Evaluation';
        }
    })
    .catch(error => {
        console.error('Submission error:', error);
        alert('There was a problem submitting your responses. Please try again.');
        submitAllBtn.disabled = false;
        submitAllBtn.textContent = 'Submit Evaluation';
    });
}

// Handle page leaving/refresh to save state
window.addEventListener('beforeunload', function(e) {
    // Save progress one last time before leaving
    saveUserResponses(true);
    
    // For some browsers, we need to return a string to show a confirmation dialog
    // Only add this if there's unsaved progress
    if (userResponses.some(r => r.selectedOption !== null)) {
        e.preventDefault();
        e.returnValue = 'You have unsaved progress. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// Make handlers available globally for direct HTML onclick attributes
window.handleRevealBtnClick = function(button) {
    // Get the current context
    const questionElement = button.closest('.video-container');
    if (!questionElement) return;
    
    const optionsList = questionElement.querySelector('.options-list');
    const selectedOption = optionsList.querySelector('.option-card.selected');
    
    if (!selectedOption) {
        alert('Please select an option first');
        return;
    }
    
    const selectedIndex = parseInt(selectedOption.dataset.index, 10);
    const groundTruthIndex = parseInt(questionElement.querySelector('#options-container').dataset.groundTruthIndex, 10);
    
    // Move to Phase 2
    const phaseIndicator = questionElement.querySelector('#phase-indicator');
    phaseIndicator.textContent = 'Phase 2: Review and Filter';
    phaseIndicator.style.backgroundColor = '#cff4fc';
    
    // Save the user's selection
    userResponses[currentQuestionIndex].selectedOption = selectedIndex;
    userResponses[currentQuestionIndex].feedbackShown = true;
    if (selectedIndex === groundTruthIndex) {
        userResponses[currentQuestionIndex].isCorrect = true;
    } else {
        userResponses[currentQuestionIndex].isCorrect = false;
    }
    saveUserResponses();
    
    // Mark correct and incorrect answers
    optionsList.querySelectorAll('.option-card').forEach(card => {
        const cardIndex = parseInt(card.dataset.index, 10);
        if (cardIndex === groundTruthIndex) {
            card.classList.add('correct');
        } else if (cardIndex === selectedIndex && selectedIndex !== groundTruthIndex) {
            card.classList.add('incorrect');
        }
    });
    
    // Disable options
    optionsList.querySelectorAll('.option-card').forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.cursor = 'default';
    });
    
    // Hide reveal button
    button.style.display = 'none';
    
    // Show ground truth container
    const groundTruthContainer = questionElement.querySelector('#ground-truth-container');
    groundTruthContainer.style.display = 'block';
    
    // Set ground truth text
    const groundTruthText = questionElement.querySelector('#ground-truth-text');
    const question = questions[currentQuestionIndex];
    groundTruthText.textContent = question.groundTruth;
    
    // Show feedback message
    const feedbackMessage = questionElement.querySelector('#feedback-message');
    feedbackMessage.style.display = 'block';
    
    if (selectedIndex === groundTruthIndex) {
        // Correct answer
        feedbackMessage.className = 'feedback-message feedback-correct';
        feedbackMessage.innerHTML = '<strong>Correct!</strong> You selected the most appropriate feedback option.';
    } else {
        // Incorrect answer
        feedbackMessage.className = 'feedback-message feedback-incorrect';
        feedbackMessage.innerHTML = `<strong>Incorrect.</strong> The more appropriate option is #${groundTruthIndex + 1}.`;
    }
    
    // Set up filter checkboxes based on stored values
    const response = userResponses[currentQuestionIndex];
    if (response.filterFlags) {
        questionElement.querySelector('#filter-groundtruth').checked = response.filterFlags.groundTruthNotClear;
        questionElement.querySelector('#filter-others').checked = response.filterFlags.otherOptionsSupported;
        questionElement.querySelector('#filter-language').checked = response.filterFlags.languageIssues;
        questionElement.querySelector('#filter-other-issues').checked = response.filterFlags.otherIssues;
        
        if (response.filterFlags.otherIssues) {
            const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
            flagReasonsContainer.style.display = 'block';
            questionElement.querySelector('#flag-reasons').value = response.flagReasons || '';
        }
    }
    
    // Set up other issue checkbox to show/hide text area
    const otherIssuesCheckbox = questionElement.querySelector('#filter-other-issues');
    const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
    
    otherIssuesCheckbox.addEventListener('change', function() {
        flagReasonsContainer.style.display = this.checked ? 'block' : 'none';
    });
};

// Handle confirm filter button clicks - make global
window.handleConfirmFilterBtnClick = function(button) {
    const questionElement = button.closest('.video-container');
    if (!questionElement) return;
    
    saveFilterFlags(currentQuestionIndex, questionElement);
    goToNextQuestion();
};

// Show feedback after submission
function showFeedback(questionElement) {
    // Get the current response
    const response = userResponses[currentQuestionIndex];
    const groundTruthIndex = parseInt(questionElement.querySelector('#options-container').dataset.groundTruthIndex, 10);
    
    // Show Phase 2
    const phaseIndicator = questionElement.querySelector('#phase-indicator');
    phaseIndicator.textContent = 'Phase 2: Review and Filter';
    phaseIndicator.style.backgroundColor = '#cff4fc';
    
    // Mark selected option as incorrect/correct
    questionElement.querySelectorAll('.option-card').forEach(card => {
        const cardIndex = parseInt(card.dataset.index, 10);
        card.classList.remove('correct', 'incorrect');
        
        if (cardIndex === groundTruthIndex) {
            card.classList.add('correct');
        } else if (cardIndex === response.selectedOption && response.selectedOption !== groundTruthIndex) {
            card.classList.add('incorrect');
        }
    });
    
    // Disable options
    questionElement.querySelectorAll('.option-card').forEach(card => {
        card.style.pointerEvents = 'none';
    });
    
    // Hide submit button
    const submitBtn = questionElement.querySelector('#reveal-btn');
    submitBtn.style.display = 'none';
    
    // Show ground truth container
    const groundTruthContainer = questionElement.querySelector('#ground-truth-container');
    groundTruthContainer.style.display = 'block';
    
    // Set ground truth text
    const groundTruthText = questionElement.querySelector('#ground-truth-text');
    const question = questions[currentQuestionIndex];
    groundTruthText.textContent = question.groundTruth;
    
    // Show feedback message
    const feedbackMessage = questionElement.querySelector('#feedback-message');
    feedbackMessage.style.display = 'block';
    
    if (response.selectedOption === groundTruthIndex) {
        // Correct answer
        feedbackMessage.className = 'feedback-message feedback-correct';
        feedbackMessage.innerHTML = '<strong>Correct!</strong> You selected the most appropriate feedback option.';
        response.isCorrect = true;
    } else {
        // Incorrect answer
        feedbackMessage.className = 'feedback-message feedback-incorrect';
        feedbackMessage.innerHTML = `<strong>Incorrect.</strong> The more appropriate option is #${groundTruthIndex + 1}.`;
        response.isCorrect = false;
    }
    
    // Set up filter checkboxes based on stored values
    if (response.filterFlags) {
        questionElement.querySelector('#filter-groundtruth').checked = response.filterFlags.groundTruthNotClear;
        questionElement.querySelector('#filter-others').checked = response.filterFlags.otherOptionsSupported;
        questionElement.querySelector('#filter-language').checked = response.filterFlags.languageIssues;
        questionElement.querySelector('#filter-other-issues').checked = response.filterFlags.otherIssues;
        
        if (response.filterFlags.otherIssues) {
            const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
            flagReasonsContainer.style.display = 'block';
            questionElement.querySelector('#flag-reasons').value = response.flagReasons || '';
        }
    }
    
    // Set up other issue checkbox to show/hide text area
    const otherIssuesCheckbox = questionElement.querySelector('#filter-other-issues');
    const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
    
    otherIssuesCheckbox.addEventListener('change', function() {
        flagReasonsContainer.style.display = this.checked ? 'block' : 'none';
    });
} 