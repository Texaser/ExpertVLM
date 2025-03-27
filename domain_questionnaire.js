// JavaScript for handling domain-specific questionnaires

// Global variables
let currentQuestionIndex = 0;
let questions = [];
let userResponses = [];
let userSessionId = getOrCreateUserSessionId();
let preloadedVideos = {}; // Store preloaded videos
let lastSaveTime = null;
let saveTimeout = null;
const AUTO_SAVE_INTERVAL = 30000; // Auto-save interval: 30 seconds

// Define Drive folder ID at the beginning of the file
const DRIVE_FOLDER_ID = '1Qgzid-OsjrDpb6j5N8v4A78VDviUWSHY';

// CORS proxy configuration - use this to bypass CORS restrictions
const USE_CORS_PROXY = true;
const CORS_PROXY_URL = 'https://corsproxy.io/?';

// Video loading attempt counter
let videoLoadAttempts = {};
const MAX_LOAD_ATTEMPTS = 3;

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

// Get current domain
const currentDomain = window.currentDomain || "";

// Function to shuffle array elements (Fisher-Yates algorithm)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 在DOMContentLoaded时检查视频映射是否已加载
document.addEventListener('DOMContentLoaded', function() {
    // 验证视频映射文件已加载
    if (typeof window.videoFileMapping === 'undefined') {
        console.warn('Video mapping data not loaded. Please ensure video_mapping.js is correctly loaded.');
    } else {
        console.log(`Loaded ${Object.keys(window.videoFileMapping).length} video mappings`);
    }
    
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

// Load domain-specific questions
async function loadQuestions() {
    try {
        const response = await fetch('filtered_all_questionnaire_data_enriched.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const allData = await response.json();
        
        // If current domain is set, filter relevant questions
        if (currentDomain) {
            const filteredData = allData.filter(q => q.domain === currentDomain);
            console.log(`Loaded ${filteredData.length} questions for domain: ${currentDomain}`);
            return filteredData;
        } else {
            console.log(`Loaded all ${allData.length} questions (no domain filter)`);
            return allData;
        }
    } catch (error) {
        console.error('Error loading questions:', error);
        throw error;
    }
}

// Load user responses from localStorage if available
function loadUserResponses() {
    const storedKey = currentDomain ? `videoResponses_${currentDomain}_${userSessionId}` : `videoResponses_${userSessionId}`;
    const savedResponses = localStorage.getItem(storedKey);
    
    if (savedResponses) {
        try {
            userResponses = JSON.parse(savedResponses);
            
            // If we have a saved position, restore it
            const savedPosition = localStorage.getItem(`videoPosition_${currentDomain}_${userSessionId}`);
            if (savedPosition) {
                currentQuestionIndex = parseInt(savedPosition, 10);
                // 确保currentQuestionIndex在有效范围内
                if (currentQuestionIndex >= questions.length) {
                    currentQuestionIndex = questions.length - 1;
                    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
                }
            }
            
            // 确保userResponses数组长度与questions匹配
            ensureUserResponsesMatch();
            
            // Show resume banner
            if (resumeBanner) {
                resumeBanner.style.display = 'block';
            }
            showSaveStatus("Progress restored", "saved");
        } catch (error) {
            console.error("Error parsing saved responses:", error);
            initializeUserResponses();
        }
    } else {
        // Initialize empty responses for each question
        initializeUserResponses();
        saveUserResponses();
    }
}

// Initialize all user responses
function initializeUserResponses() {
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
}

// Ensure userResponses array length matches questions
function ensureUserResponsesMatch() {
    // Initialize an empty response object
    const emptyResponse = {
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
    };
    
    // If userResponses length is insufficient, supplement to match questions length
    while (userResponses.length < questions.length) {
        userResponses.push({...emptyResponse});
    }
    
    // If userResponses is too long, truncate to match questions length
    if (userResponses.length > questions.length) {
        userResponses = userResponses.slice(0, questions.length);
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
        const nextQuestionId = questions[nextIndex].id;
        const videoPath = `video_clips/${nextQuestionId}.mp4`;
        
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
    const storedKey = currentDomain ? `videoResponses_${currentDomain}_${userSessionId}` : `videoResponses_${userSessionId}`;
    const positionKey = currentDomain ? `videoPosition_${currentDomain}_${userSessionId}` : `videoPosition_${userSessionId}`;
    
    localStorage.setItem(storedKey, JSON.stringify(userResponses));
    localStorage.setItem(positionKey, currentQuestionIndex.toString());
    
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
    
    // Get the filename for the current question's video
    const fileName = getStandardizedFileName(question.id);
    
    // Try to get the video ID and load the video
    tryLoadVideoWithRetries(videoPlayer, videoSource, fileName);
    
    // Add variables to track user dragging
    let userSeeking = false;
    let targetTime = 0;
    // Flag to always allow video dragging
    window.videoSeekEnabled = true;
    
    // Add listeners for drag events
    videoPlayer.addEventListener('seeking', function() {
        // Mark that user is dragging
        userSeeking = true;
        targetTime = videoPlayer.currentTime;
        console.log("User seeking to time:", targetTime);
    });
    
    videoPlayer.addEventListener('seeked', function() {
        // Video has jumped to new position
        console.log("Seeked to:", videoPlayer.currentTime);
        
        // Keep userSeeking true for a while to ensure time updates are correctly applied
        setTimeout(() => {
            userSeeking = false;
        }, 200);
    });
    
    // Prevent progress bar from resetting
    videoPlayer.addEventListener('timeupdate', function() {
        // If user just dragged and position is incorrect, fix it
        if (userSeeking && Math.abs(videoPlayer.currentTime - targetTime) > 0.5) {
            console.log("Correcting time from", videoPlayer.currentTime, "to", targetTime);
            videoPlayer.currentTime = targetTime;
        }
    });
    
    // Add video wrapper click event but prevent it from capturing control interactions
    const videoWrapper = questionElement.querySelector('.video-wrapper');
    if (videoWrapper) {
        videoWrapper.addEventListener('click', function(e) {
            // Check if click is on the video element itself or controls
            if (e.target === videoPlayer || e.target.closest('video')) {
                // Let the event bubble for video and controls
                return true;
            }
            
            // For clicks on the wrapper (but not the video), toggle play/pause
            if (videoPlayer.paused) {
                videoPlayer.play();
            } else {
                videoPlayer.pause();
            }
        });
    }

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
        
        // Add click event directly to option card
        optionCard.addEventListener('click', function() {
            // If already submitted, don't allow selection
            if (response.feedbackShown) return;
            
            // Remove selected class from all options
            optionsList.querySelectorAll('.option-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // Add selected class to the current selected option
            this.classList.add('selected');
            
            // Update user response data
            userResponses[currentQuestionIndex].selectedOption = i;
            
            // Enable submit button
            const submitBtn = questionElement.querySelector('#reveal-btn');
            submitBtn.disabled = false;
            
            // Save response
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
    if (submitBtn) {
        submitBtn.disabled = response.feedbackShown || response.selectedOption === null;
        submitBtn.textContent = response.feedbackShown ? 'Submitted' : 'Confirm Selection';
    }
    
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
    const filterGroundtruth = questionElement.querySelector('#filter-groundtruth');
    const filterOthers = questionElement.querySelector('#filter-others');
    const filterLanguage = questionElement.querySelector('#filter-language');
    const filterOtherIssues = questionElement.querySelector('#filter-other-issues');
    const flagReasons = questionElement.querySelector('#flag-reasons');
    
    userResponses[index].filterFlags = {
        groundTruthNotClear: filterGroundtruth ? filterGroundtruth.checked : false,
        otherOptionsSupported: filterOthers ? filterOthers.checked : false,
        languageIssues: filterLanguage ? filterLanguage.checked : false,
        otherIssues: filterOtherIssues ? filterOtherIssues.checked : false
    };
    
    if (filterOtherIssues && filterOtherIssues.checked && flagReasons) {
        userResponses[index].flagReasons = flagReasons.value;
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
            domain: currentDomain,
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
    const submissionKey = currentDomain ? `submission_${currentDomain}_${userSessionId}` : `submission_${userSessionId}`;
    localStorage.setItem(submissionKey, JSON.stringify(submissionData));
    
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
            const storedKey = currentDomain ? `videoResponses_${currentDomain}_${userSessionId}` : `videoResponses_${userSessionId}`;
            const positionKey = currentDomain ? `videoPosition_${currentDomain}_${userSessionId}` : `videoPosition_${userSessionId}`;
            
            localStorage.removeItem(storedKey);
            localStorage.removeItem(positionKey);
            
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
    if (!optionsList) {
        console.error("Options list not found");
        return;
    }
    
    const selectedOption = optionsList.querySelector('.option-card.selected');
    
    if (!selectedOption) {
        alert('Please select an option first');
        return;
    }
    
    const selectedIndex = parseInt(selectedOption.dataset.index, 10);
    const optionsContainer = questionElement.querySelector('#options-container');
    if (!optionsContainer) {
        console.error("Options container not found");
        return;
    }
    
    const groundTruthIndex = parseInt(optionsContainer.dataset.groundTruthIndex, 10);
    
    // Move to Phase 2
    const phaseIndicator = questionElement.querySelector('#phase-indicator');
    if (phaseIndicator) {
        phaseIndicator.textContent = 'Phase 2: Review and Filter';
        phaseIndicator.style.backgroundColor = '#cff4fc';
    }
    
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
    if (groundTruthContainer) {
        groundTruthContainer.style.display = 'block';
    }
    
    // Set ground truth text
    const groundTruthText = questionElement.querySelector('#ground-truth-text');
    if (groundTruthText) {
        const question = questions[currentQuestionIndex];
        groundTruthText.textContent = question.groundTruth;
    }
    
    // Show feedback message
    const feedbackMessage = questionElement.querySelector('#feedback-message');
    if (feedbackMessage) {
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
    }
    
    // Set up filter checkboxes based on stored values
    const response = userResponses[currentQuestionIndex];
    if (response.filterFlags) {
        const filterGroundtruth = questionElement.querySelector('#filter-groundtruth');
        const filterOthers = questionElement.querySelector('#filter-others');
        const filterLanguage = questionElement.querySelector('#filter-language');
        const filterOtherIssues = questionElement.querySelector('#filter-other-issues');
        
        if (filterGroundtruth) filterGroundtruth.checked = response.filterFlags.groundTruthNotClear;
        if (filterOthers) filterOthers.checked = response.filterFlags.otherOptionsSupported;
        if (filterLanguage) filterLanguage.checked = response.filterFlags.languageIssues;
        if (filterOtherIssues) filterOtherIssues.checked = response.filterFlags.otherIssues;
        
        if (response.filterFlags.otherIssues) {
            const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
            if (flagReasonsContainer) flagReasonsContainer.style.display = 'block';
            
            const flagReasons = questionElement.querySelector('#flag-reasons');
            if (flagReasons) flagReasons.value = response.flagReasons || '';
        }
    }
    
    // Set up other issue checkbox to show/hide text area
    const otherIssuesCheckbox = questionElement.querySelector('#filter-other-issues');
    const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
    
    if (otherIssuesCheckbox && flagReasonsContainer) {
        otherIssuesCheckbox.addEventListener('change', function() {
            flagReasonsContainer.style.display = this.checked ? 'block' : 'none';
        });
    }
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
    if (!response) {
        console.error("No response data found for question index", currentQuestionIndex);
        return;
    }
    
    // Debug output
    console.log("Showing feedback for question", currentQuestionIndex, "Response:", response);
    
    const groundTruthIndex = parseInt(questionElement.querySelector('#options-container').dataset.groundTruthIndex, 10);
    if (isNaN(groundTruthIndex)) {
        console.error("Invalid groundTruthIndex");
        return;
    }
    
    // Show Phase 2
    const phaseIndicator = questionElement.querySelector('#phase-indicator');
    if (phaseIndicator) {
        phaseIndicator.textContent = 'Phase 2: Review and Filter';
        phaseIndicator.style.backgroundColor = '#cff4fc';
    }
    
    // Mark selected option as incorrect/correct
    questionElement.querySelectorAll('.option-card').forEach(card => {
        if (!card) return;
        
        const cardIndex = parseInt(card.dataset.index, 10);
        if (isNaN(cardIndex)) return;
        
        // Make sure to clear all classes first
        card.classList.remove('correct', 'incorrect');
        
        if (cardIndex === groundTruthIndex) {
            card.classList.add('correct');
        } else if (cardIndex === response.selectedOption && response.selectedOption !== groundTruthIndex) {
            card.classList.add('incorrect');
        }
    });
    
    // Disable options
    questionElement.querySelectorAll('.option-card').forEach(card => {
        if (card) card.style.pointerEvents = 'none';
    });
    
    // Hide submit button
    const submitBtn = questionElement.querySelector('#reveal-btn');
    if (submitBtn) submitBtn.style.display = 'none';
    
    // Show ground truth container
    const groundTruthContainer = questionElement.querySelector('#ground-truth-container');
    if (groundTruthContainer) groundTruthContainer.style.display = 'block';
    
    // Set ground truth text
    const groundTruthText = questionElement.querySelector('#ground-truth-text');
    if (groundTruthText) {
        const question = questions[currentQuestionIndex];
        groundTruthText.textContent = question?.groundTruth || "Ground truth not available";
    }
    
    // Show feedback message
    const feedbackMessage = questionElement.querySelector('#feedback-message');
    if (feedbackMessage) {
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
    }
    
    // Set up filter checkboxes based on stored values
    if (response.filterFlags) {
        const filterGroundtruth = questionElement.querySelector('#filter-groundtruth');
        const filterOthers = questionElement.querySelector('#filter-others');
        const filterLanguage = questionElement.querySelector('#filter-language');
        const filterOtherIssues = questionElement.querySelector('#filter-other-issues');
        
        if (filterGroundtruth) filterGroundtruth.checked = response.filterFlags.groundTruthNotClear;
        if (filterOthers) filterOthers.checked = response.filterFlags.otherOptionsSupported;
        if (filterLanguage) filterLanguage.checked = response.filterFlags.languageIssues;
        if (filterOtherIssues) filterOtherIssues.checked = response.filterFlags.otherIssues;
        
        if (response.filterFlags.otherIssues) {
            const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
            if (flagReasonsContainer) flagReasonsContainer.style.display = 'block';
            
            const flagReasons = questionElement.querySelector('#flag-reasons');
            if (flagReasons) flagReasons.value = response.flagReasons || '';
        }
    }
    
    // Set up other issue checkbox to show/hide text area
    const otherIssuesCheckbox = questionElement.querySelector('#filter-other-issues');
    const flagReasonsContainer = questionElement.querySelector('#flag-reasons-container');
    
    if (otherIssuesCheckbox && flagReasonsContainer) {
        otherIssuesCheckbox.addEventListener('change', function() {
            flagReasonsContainer.style.display = this.checked ? 'block' : 'none';
        });
    }
}

// New function: Try to load video with multiple methods and automatic retries
function tryLoadVideoWithRetries(videoPlayer, videoSource, fileName) {
    // Reset attempt counter for this file
    if (!videoLoadAttempts[fileName]) {
        videoLoadAttempts[fileName] = 0;
    }
    
    // Increment attempt counter
    videoLoadAttempts[fileName]++;
    
    // 尝试顺序改为：1.本地视频 2.Google Drive
    const videoWrapper = videoPlayer.closest('.video-wrapper');
    
    console.log(`尝试加载视频: ${fileName}, 尝试次数: ${videoLoadAttempts[fileName]}`);
    
    // 首先尝试从本地加载
    if (videoLoadAttempts[fileName] === 1) {
        // 尝试多个可能的本地路径
        const questionId = fileName.replace('.mp4', '');
        const videoPaths = [
            `video_clips/${fileName}`,
            `videos/${fileName}`,
            `video_clips/${questionId}.mp4`,
            `videos/${questionId}.mp4`
        ];
        
        console.log(`尝试从本地路径加载: ${videoPaths[0]}`);
        
        // 清除视频容器的现有内容
        if (videoWrapper) {
            while (videoWrapper.firstChild) {
                videoWrapper.removeChild(videoWrapper.firstChild);
            }
            
            // 创建视频容器
            const container = document.createElement('div');
            container.className = 'video-player-container';
            
            // 创建视频元素
            const videoElement = document.createElement('video');
            videoElement.id = 'direct-video-player';
            videoElement.width = "100%";
            videoElement.height = "350px";
            videoElement.controls = true;
            videoElement.controlsList = "nodownload";
            videoElement.preload = "auto";
            videoElement.style.backgroundColor = "#000";
            
            // 创建source元素
            const source = document.createElement('source');
            source.type = "video/mp4";
            source.src = videoPaths[0];
            videoElement.appendChild(source);
            
            // 添加错误处理
            videoElement.addEventListener('error', function(e) {
                console.error("视频加载错误:", e);
                
                // 如果本地加载失败，尝试Google Drive
                const fileId = getFileIdFromName(fileName);
                if (fileId) {
                    console.log(`本地加载失败，尝试从Google Drive加载: ${fileName}, ID: ${fileId}`);
                    tryLoadFromGoogleDrive(container, fileId, fileName);
                } else {
                    // 显示错误消息
                    showVideoErrorMessage(videoWrapper, fileName);
                }
            });
            
            // 添加成功处理
            videoElement.addEventListener('canplay', function() {
                console.log(`视频 ${fileName} 成功从本地加载!`);
            });
            
            // 将视频元素添加到容器
            container.appendChild(videoElement);
            videoWrapper.appendChild(container);
            
            // 加载视频
            videoElement.load();
            return;
        }
    } else {
        // 后续尝试使用Google Drive
        const fileId = getFileIdFromName(fileName);
        if (fileId && videoWrapper) {
            // 清除容器
            while (videoWrapper.firstChild) {
                videoWrapper.removeChild(videoWrapper.firstChild);
            }
            
            const container = document.createElement('div');
            container.className = 'video-player-container';
            videoWrapper.appendChild(container);
            
            // 尝试从Google Drive加载
            tryLoadFromGoogleDrive(container, fileId, fileName);
            return;
        } else {
            // 如果都失败了，显示错误消息
            showVideoErrorMessage(videoWrapper, fileName);
        }
    }
}

// 从Google Drive加载视频
function tryLoadFromGoogleDrive(container, fileId, fileName) {
    if (!container) return;
    
    // 创建直接访问链接
    const directLinkElement = document.createElement('div');
    directLinkElement.className = 'text-center mt-3 mb-3';
    directLinkElement.innerHTML = `
        <a href="https://drive.google.com/file/d/${fileId}/view" 
           target="_blank" class="btn btn-primary btn-lg">
           <i class="bi bi-play-circle"></i> 在Google Drive中播放视频
        </a>
        <p class="small mt-2">点击上方按钮在新窗口中打开视频</p>
    `;
    
    // 创建视频ID信息(方便调试)
    const debugInfo = document.createElement('div');
    debugInfo.className = 'small text-muted mt-2';
    debugInfo.innerHTML = `视频名称: ${fileName} | ID: ${fileId}`;
    
    // 添加到容器
    container.appendChild(directLinkElement);
    container.appendChild(debugInfo);
    
    console.log(`已创建Google Drive直接访问链接: ${fileName}`);
}

// 显示视频错误消息
function showVideoErrorMessage(videoWrapper, fileName) {
    if (!videoWrapper) return;
    
    // 检查错误消息是否已显示
    if (videoWrapper.querySelector('.alert-warning')) return;
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'alert alert-warning mt-2';
    errorMessage.innerHTML = `
        <strong>无法加载视频</strong><br>
        <p>请尝试以下方法访问视频 "${fileName}":</p>
        <ol>
            <li>刷新页面再试一次</li>
            <li>
                <a href="https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}" 
                   target="_blank" class="btn btn-sm btn-outline-primary my-2">
                   打开Google Drive文件夹
                </a>
                <span class="ml-2">在文件夹中找到并播放视频</span>
            </li>
            <li>检查视频文件是否已正确放置在本地服务器的video_clips或videos文件夹中</li>
        </ol>
        <p class="mt-2">您可以继续评估其他问题，稍后再回来处理这个视频。</p>
    `;
    videoWrapper.appendChild(errorMessage);
}

// Generate a direct link from Google Drive file ID
function getGoogleDriveDirectLink(fileId) {
    // 使用多种不同的URL格式，增加视频加载成功的机会
    // 方法1: 使用exportDownload参数 (可能更可靠)
    const exportDownloadUrl = `https://drive.google.com/uc?export=download&confirm=yep&id=${fileId}`;
    
    // 方法2: 使用简单链接，但添加特殊参数
    const simpleUrl = `https://docs.google.com/uc?id=${fileId}&export=download&confirm=t&uuid=${Date.now()}`;
    
    // 使用哪种链接格式取决于尝试次数
    let directUrl;
    
    // 根据尝试次数在不同链接类型之间轮换
    const attempt = Math.floor(Math.random() * 2); // 0 或 1
    
    if (attempt === 0) {
        directUrl = exportDownloadUrl;
        console.log("Using export download URL format");
    } else {
        directUrl = simpleUrl;
        console.log("Using simple URL format with UUID");
    }
    
    // 如果需要代理，路由通过代理
    if (USE_CORS_PROXY) {
        return CORS_PROXY_URL + encodeURIComponent(directUrl);
    } else {
        return directUrl;
    }
}

// Convert question ID to standardized filename
function getStandardizedFileName(questionId) {
    return `${questionId}.mp4`;
}

// Get file ID from name using local cache or mapping
function getFileIdFromName(fileName) {
    // First try direct match
    if (window.videoFileMapping && window.videoFileMapping[fileName]) {
        console.log(`Found exact match for ${fileName} in mapping`);
        return window.videoFileMapping[fileName];
    }
    
    // Try different formats (if filename contains .mp4)
    if (fileName.endsWith('.mp4') && window.videoFileMapping) {
        // Try without extension
        const nameWithoutExt = fileName.replace('.mp4', '');
        if (window.videoFileMapping[nameWithoutExt]) {
            console.log(`Found match for ${fileName} without extension`);
            return window.videoFileMapping[nameWithoutExt];
        }
        
        // Try adding extension
        const nameWithExt = fileName.includes('.mp4') ? fileName : fileName + '.mp4';
        if (window.videoFileMapping[nameWithExt]) {
            console.log(`Found match for ${fileName} with extension`);
            return window.videoFileMapping[nameWithExt];
        }
    }
    
    // Try current domain combination
    if (currentDomain && window.videoFileMapping) {
        const domainFile = `${currentDomain}_${fileName}`;
        if (window.videoFileMapping[domainFile]) {
            console.log(`Found match using domain prefix: ${domainFile}`);
            return window.videoFileMapping[domainFile];
        }
        
        // Try without .mp4
        const domainFileNoExt = `${currentDomain}_${fileName.replace('.mp4', '')}`;
        if (window.videoFileMapping[domainFileNoExt]) {
            console.log(`Found match using domain prefix without extension: ${domainFileNoExt}`);
            return window.videoFileMapping[domainFileNoExt];
        }
    }
    
    // Debug: list all available mappings
    if (window.videoFileMapping) {
        console.log("Available video mappings:", Object.keys(window.videoFileMapping).slice(0, 5), "...");
    } else {
        console.error("No video mapping available! Make sure video_mapping.js is loaded properly.");
    }
    
    // Warning log
    console.warn(`Video ID not found in mapping for file: ${fileName}`);
    return null;
}

// Generate video mapping from Drive folder
function generateVideoMapping() {
  // Replace with your folder ID
  var folderId = '1Qgzid-OsjrDpb6j5N8v4A78VDviUWSHY';
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  
  var mapping = {};
  while (files.hasNext()) {
    var file = files.next();
    mapping[file.getName()] = file.getId();
  }
  
  return JSON.stringify(mapping, null, 2);
}

function doGet() {
  var output = "const videoFileMapping = " + generateVideoMapping() + ";";
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
} 