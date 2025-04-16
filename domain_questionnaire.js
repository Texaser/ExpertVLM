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
// const prevBtn = document.getElementById('prev-btn'); // 不再需要Previous按钮
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const progressCount = document.getElementById('progress-count');
const saveStatus = document.getElementById('save-status');
const saveStatusMessage = document.getElementById('save-status-message');
const resumeBanner = document.getElementById('resume-banner');
const submissionForm = document.getElementById('submission-form');
const submitAllBtn = document.getElementById('submit-all-btn');
const submissionSuccess = document.getElementById('submission-success');

// Get current domain and part
const currentDomain = window.currentDomain || "";
const currentPart = window.partitionNumber || ""; // 修改：使用partitionNumber代替currentPart

// Function to shuffle array elements (Fisher-Yates algorithm)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Check if video mapping is loaded when DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Verify that video mapping file is loaded
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
    // 移除 prevBtn.addEventListener('click', goToPreviousQuestion); 
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
        const response = await fetch('additional_samples/filtered_unique_additional_questionnaire_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const allData = await response.json();
        
        // If current domain is set, filter relevant questions
        if (currentDomain) {
            let filteredData = allData.filter(q => q.domain === currentDomain);
            
            // Define number of partitions for each domain
            const domainPartitions = {
                "basketball": 3,
                "bouldering": 2,
                "cooking": 2,
                "dance": 2,
                // Add other domains as needed
            };
            
            // Get number of partitions for current domain
            const numPartitions = domainPartitions[currentDomain] || 1;
            
            // Check if partition number is set and valid for this domain
            if (window.partitionNumber && window.partitionNumber <= numPartitions) {
                console.log(`Partition mode: Loading partition ${window.partitionNumber} of ${numPartitions} for ${currentDomain}`);
                const totalCount = filteredData.length;
                const partitionSize = Math.ceil(totalCount / numPartitions);
                
                // Calculate start and end indices for the partition
                const startIndex = (window.partitionNumber - 1) * partitionSize;
                const endIndex = Math.min(window.partitionNumber * partitionSize, totalCount);
                
                // Filter data for the current partition
                filteredData = filteredData.slice(startIndex, endIndex);
                
                console.log(`Loaded ${filteredData.length} questions for domain: ${currentDomain} (Partition ${window.partitionNumber}/${numPartitions}, questions ${startIndex+1}-${endIndex} of ${totalCount})`);
            } else {
                console.log(`Loaded ${filteredData.length} questions for domain: ${currentDomain} (all partitions)`);
            }
            
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
    const storedKey = currentPart ? 
        `videoResponses_${currentDomain}_part${currentPart}_${userSessionId}` : 
        `videoResponses_${currentDomain}_${userSessionId}`;
    
    const positionKey = currentPart ?
        `videoPosition_${currentDomain}_part${currentPart}_${userSessionId}` :
        `videoPosition_${currentDomain}_${userSessionId}`;
    
    // Always initialize userResponses to empty array before loading
    userResponses = [];
    currentQuestionIndex = 0;
    
    const savedResponses = localStorage.getItem(storedKey);
    
    if (savedResponses) {
        try {
            userResponses = JSON.parse(savedResponses);
            
            // Get the saved position
            const savedPosition = localStorage.getItem(positionKey);
            if (savedPosition) {
                currentQuestionIndex = parseInt(savedPosition, 10);
                // Ensure currentQuestionIndex is within valid range
                if (currentQuestionIndex >= questions.length) {
                    currentQuestionIndex = questions.length - 1;
                    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
                }
            }
            
            // Ensure userResponses array length matches questions
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
        const nextQuestion = questions[nextIndex];
        const nextQuestionId = nextQuestion.id;
        const nextVideoTime = nextQuestion.video_time || 'unknown';
        const videoPath = `additional_video_clips/${nextQuestionId}.mp4`;
        
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
    const storedKey = currentPart ? 
        `videoResponses_${currentDomain}_part${currentPart}_${userSessionId}` : 
        `videoResponses_${currentDomain}_${userSessionId}`;
    
    const positionKey = currentPart ?
        `videoPosition_${currentDomain}_part${currentPart}_${userSessionId}` :
        `videoPosition_${currentDomain}_${userSessionId}`;
    
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
    
    // Clear previous content - we only clear once
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
    
    // Dynamically update description text, display correct feedback type based on question.is_ge
    const descriptionText = questionElement.querySelector('#options-container h5');
    if (descriptionText) {
        const domainName = question.domain || currentDomain || "this domain";
        // Capitalize first letter of domain name
        const formattedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1).toLowerCase();
        const feedbackType = question.is_ge ? "good execution" : "tips for improvement";
        descriptionText.textContent = `This is a participant practicing ${formattedDomain.toLowerCase()}, here are some expert feedbacks (${feedbackType}). Please select the option you believe is correct:`;
    }
    
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
    
    // Create quality assessment section (but hide initially)
    createQualityAssessmentUI(questionElement, response);
    
    // Set up the comments textarea
    const commentsTextarea = questionElement.querySelector('#comments');
    if (commentsTextarea) {
        commentsTextarea.value = response.comments || '';
        commentsTextarea.addEventListener('input', function() {
            response.comments = this.value;
            saveUserResponses();
        });
    }
    
    // Directly add content to DOM (important: don't clear container a second time)
    videoContainer.appendChild(questionElement);
    
    // Important: This is our core fix - binding option click events after adding to the DOM
    // Now elements are in the document, we can reliably access all related elements
    videoContainer.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', function() {
            // If already submitted, don't allow selection
            if (response.feedbackShown) return;
            
            // Remove selected class from all options
            const allOptionCards = videoContainer.querySelectorAll('.option-card');
            allOptionCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected class to the current selected option
            this.classList.add('selected');
            
            // Update user response data
            userResponses[currentQuestionIndex].selectedOption = parseInt(this.dataset.index, 10);
            
            // Now the button is in the DOM, can be reliably found
            const submitBtn = videoContainer.querySelector('#reveal-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
            } else {
                console.warn('Submit button (#reveal-btn) not found in the DOM');
            }
            
            // Save response
            saveUserResponses();
        });
    });
    
    // If this question was already answered, show Phase 2
    if (response.feedbackShown) {
        showFeedback(questionElement);
    }
}

// New function: Create quality assessment UI
function createQualityAssessmentUI(questionElement, response) {
    // Get or create ground-truth-container
    let groundTruthContainer = questionElement.querySelector('#ground-truth-container');
    if (!groundTruthContainer) {
        groundTruthContainer = document.createElement('div');
        groundTruthContainer.id = 'ground-truth-container';
        groundTruthContainer.className = 'mt-4';
        groundTruthContainer.style.display = 'none';
        
        // Add container to question element
        const optionsSection = questionElement.querySelector('.options-section');
        if (optionsSection) {
            optionsSection.parentNode.insertBefore(groundTruthContainer, optionsSection.nextSibling);
        } else {
            questionElement.appendChild(groundTruthContainer);
        }
    }
    
    // Create Ground Truth title and content
    groundTruthContainer.innerHTML = `
        <h5>Ground Truth:</h5>
        <div class="comment-card" id="ground-truth-text"></div>
        <div class="feedback-message" id="feedback-message"></div>
    `;
    
    // Create quality assessment container
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container mt-4';
    groundTruthContainer.appendChild(filterContainer);
    
    // Add quality assessment content
    filterContainer.innerHTML = `
        <h5>Sample Quality Assessment:</h5>
        
        <!-- Add quality selection section at top -->
        <div class="quality-selection mb-4">
            <p>How would you rate the overall quality of this sample?</p>
            <div class="form-check mb-2">
                <input class="form-check-input" type="radio" name="qualityRating" id="quality-good" value="good" checked>
                <label class="form-check-label" for="quality-good">
                    <strong>Good quality</strong> - The video and the ground truth match well
                </label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="qualityRating" id="quality-bad" value="bad">
                <label class="form-check-label" for="quality-bad">
                    <strong>Poor quality</strong> - There are issues with this sample
                </label>
            </div>
        </div>
        
        <!-- Issue identification section, always shown -->
        <div id="quality-issues-container">
            <p>Please identify any issues with this sample (if any):</p>
            
            <div class="filter-options">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="filter-groundtruth">
                    <label class="form-check-label" for="filter-groundtruth">
                        The video does NOT clearly contain the action described in the ground truth
                    </label>
                </div>
                
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="filter-others">
                    <label class="form-check-label" for="filter-others">
                        One or more of the other options (not ground truth) ARE also supported by the video
                    </label>
                </div>
                
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="filter-language">
                    <label class="form-check-label" for="filter-language">
                        There are language issues (grammatically incorrect, illogical, or other language problems)
                    </label>
                </div>
                
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="filter-other-issues">
                    <label class="form-check-label" for="filter-other-issues">
                        Other issues
                    </label>
                </div>
                
                <div class="flag-reasons" id="flag-reasons-container" style="display: none;">
                    <label for="flag-reasons" class="form-label">Please specify the issues:</label>
                    <textarea class="form-control" id="flag-reasons" rows="3" placeholder="Describe what problems you noticed..."></textarea>
                </div>
            </div>
        </div>
        
        <div class="mb-3 mt-4">
            <label for="comments" class="form-label">Additional Comments (Optional)</label>
            <textarea class="form-control" id="comments" placeholder="Any comments about your selection"></textarea>
        </div>
        
        <div class="confirmation-buttons">
            <button type="button" id="confirm-filter-btn" class="btn btn-success" onclick="handleConfirmFilterBtnClick(this)">Submit Quality Assessment</button>
        </div>
    `;
    
    // Set initial state of quality selection (if saved values exist)
    if (response.filterFlags && response.filterFlags.overallQuality) {
        const qualityGood = filterContainer.querySelector('#quality-good');
        const qualityBad = filterContainer.querySelector('#quality-bad');
        
        if (qualityGood && qualityBad) {
            if (response.filterFlags.overallQuality === 'good') {
                qualityGood.checked = true;
                qualityBad.checked = false;
            } else {
                qualityGood.checked = false;
                qualityBad.checked = true;
            }
        }
    }
    
    // Set up event handling for other issues checkbox
    const otherIssuesCheckbox = filterContainer.querySelector('#filter-other-issues');
    const flagReasonsContainer = filterContainer.querySelector('#flag-reasons-container');
    
    if (otherIssuesCheckbox && flagReasonsContainer) {
        otherIssuesCheckbox.addEventListener('change', function() {
            flagReasonsContainer.style.display = this.checked ? 'block' : 'none';
        });
        
        // If other issues already selected, show reasons text box
        if (response.filterFlags && response.filterFlags.otherIssues) {
            otherIssuesCheckbox.checked = true;
            flagReasonsContainer.style.display = 'block';
            
            const flagReasons = flagReasonsContainer.querySelector('#flag-reasons');
            if (flagReasons) {
                flagReasons.value = response.flagReasons || '';
            }
        }
    }
}

// Save filter flags from the form
function saveFilterFlags(index, questionElement) {
    const filterGroundtruth = questionElement.querySelector('#filter-groundtruth');
    const filterOthers = questionElement.querySelector('#filter-others');
    const filterLanguage = questionElement.querySelector('#filter-language');
    const filterOtherIssues = questionElement.querySelector('#filter-other-issues');
    const flagReasons = questionElement.querySelector('#flag-reasons');
    
    // Get overall quality assessment
    const qualityGood = questionElement.querySelector('#quality-good');
    const overallQuality = qualityGood && qualityGood.checked ? 'good' : 'bad';
    
    userResponses[index].filterFlags = {
        groundTruthNotClear: filterGroundtruth ? filterGroundtruth.checked : false,
        otherOptionsSupported: filterOthers ? filterOthers.checked : false,
        languageIssues: filterLanguage ? filterLanguage.checked : false,
        otherIssues: filterOtherIssues ? filterOtherIssues.checked : false,
        overallQuality: overallQuality // Add overall quality assessment
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
    console.log(`Updating progress bar: ${progress}%, currentQuestionIndex: ${currentQuestionIndex}, questions.length: ${questions.length}`);
    
    // Directly set DOM element width property to avoid potential CSS conflicts
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').setAttribute('aria-valuenow', progress);
    
    // Update progress count text
    document.getElementById('progress-count').textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
}

// Go to the next question
function goToNextQuestion() {
    // Check if the current question has been fully answered
    if (currentQuestionIndex < questions.length) {
        const currentResponse = userResponses[currentQuestionIndex];
        
        // First checkpoint: If flag data shows this question is already complete, proceed directly
        if (currentResponse.assessmentSubmitted === true || 
            (currentResponse.feedbackShown && currentResponse.filterFlags && currentResponse.filterFlags.overallQuality)) {
            console.log("Stored state data indicates question is complete, proceeding to next question");
        }
        // Otherwise perform UI checks and prompts
        else {
            // Check if an option has been selected
            if (currentResponse.selectedOption === null) {
                alert('Please complete Step 1: Select an option and click "Confirm Selection".');
                
                // Highlight the confirm button
                const confirmBtn = document.querySelector('#reveal-btn');
                if (confirmBtn && !confirmBtn.disabled) {
                    confirmBtn.classList.add('btn-pulse');
                    setTimeout(() => confirmBtn.classList.remove('btn-pulse'), 3000);
                }
                return;
            }
            
            // Check if feedback has been shown
            if (!currentResponse.feedbackShown) {
                alert('Please click the "Confirm Selection" button to submit your answer (Step 1).');
                
                // Highlight the confirm button
                const confirmBtn = document.querySelector('#reveal-btn');
                if (confirmBtn && !confirmBtn.disabled) {
                    confirmBtn.classList.add('btn-pulse');
                    setTimeout(() => confirmBtn.classList.remove('btn-pulse'), 3000);
                }
                return;
            }
            
            // Check quality assessment button state
            const submitBtn = document.querySelector('#confirm-filter-btn');
            if (submitBtn) {
                // Button is enabled, indicating assessment not submitted
                if (!submitBtn.disabled && !submitBtn.classList.contains('btn-secondary')) {
                    alert('Please complete Step 2: Submit your quality assessment before proceeding.');
                    
                    // Highlight the assessment submission button
                    submitBtn.classList.add('btn-pulse');
                    setTimeout(() => submitBtn.classList.remove('btn-pulse'), 3000);
                    
                    // Scroll to assessment section
                    const assessmentContainer = document.querySelector('.filter-container');
                    if (assessmentContainer) {
                        assessmentContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                    return;
                }
            }
            
            // Check if quality assessment is complete
            if (!currentResponse.filterFlags || !currentResponse.filterFlags.overallQuality) {
                alert('Please complete Step 2: Rate the overall quality (good or poor) before continuing.');
                
                // Scroll to assessment section
                const qualitySelection = document.querySelector('.quality-selection');
                if (qualitySelection) {
                    qualitySelection.scrollIntoView({ behavior: 'smooth' });
                }
                return;
            }
        }
    }
    
    // All checks passed, proceed to next question
    if (currentQuestionIndex < questions.length - 1) {
        // Clear any next question prompts (if present)
        const nextPrompt = document.querySelector('.navigation-buttons .text-center.mt-2');
        if (nextPrompt) nextPrompt.remove();
        
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
        updateNavigationButtons();
        updateProgressBar();
    } else {
        // Show submission form
        videoContainer.style.display = 'none';
        nextBtn.style.display = 'none';
        submissionForm.style.display = 'block';
    }
}

// Update navigation buttons' state
function updateNavigationButtons() {
    // 不再处理prevBtn: prevBtn.disabled = currentQuestionIndex === 0;
    
    // Update next button text
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
    
    // Check for incomplete responses
    const incompleteResponses = userResponses.filter(r => 
        r.selectedOption === null || // No option selected
        !r.feedbackShown || // Confirmation button not clicked
        !r.filterFlags || !r.filterFlags.overallQuality // Quality not assessed
    );
    
    if (incompleteResponses.length > 0) {
        const confirmSubmit = confirm(`You have ${incompleteResponses.length} question(s) that are not fully completed. Do you want to submit anyway?`);
        if (!confirmSubmit) return;
    }
    
    // Calculate statistics but don't display on screen
    const statistics = generateSubmissionStatistics(false);
    
    // Original unanswered check logic can be kept as backup
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
        statistics: statistics, // Add statistics (only included in submission data)
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

// New function: Generate submission statistics
function generateSubmissionStatistics(showOnScreen = true) {
    // Calculate various statistics
    const totalQuestions = questions.length;
    
    // Modify definition of answered questions to fully answered
    const answeredQuestions = userResponses.filter(r => 
        r.selectedOption !== null && // Option selected
        r.feedbackShown && // Confirmed
        r.filterFlags && r.filterFlags.overallQuality // Quality assessment completed
    ).length;
    
    const correctAnswers = userResponses.filter(r => r.isCorrect).length;
    const flaggedQuestions = userResponses.filter(r => 
        r.filterFlags && (
            r.filterFlags.groundTruthNotClear || 
            r.filterFlags.otherOptionsSupported || 
            r.filterFlags.languageIssues || 
            r.filterFlags.otherIssues
        )
    ).length;
    
    // Count various issue flags
    const groundTruthIssues = userResponses.filter(r => r.filterFlags && r.filterFlags.groundTruthNotClear).length;
    const otherOptionsIssues = userResponses.filter(r => r.filterFlags && r.filterFlags.otherOptionsSupported).length;
    const languageIssues = userResponses.filter(r => r.filterFlags && r.filterFlags.languageIssues).length;
    const otherIssues = userResponses.filter(r => r.filterFlags && r.filterFlags.otherIssues).length;
    
    // Only create HTML and add to page if showOnScreen is true
    if (showOnScreen) {
        // Create statistics table
        let statsHtml = `
        <div class="submission-stats card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Submission Statistics</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <h6>Overall Statistics</h6>
                        <table class="table table-sm">
                            <tr>
                                <td>Total Questions</td>
                                <td>${totalQuestions}</td>
                            </tr>
                            <tr>
                                <td>Answered Questions</td>
                                <td>${answeredQuestions} (${Math.round(answeredQuestions/totalQuestions*100)}%)</td>
                            </tr>
                            <tr>
                                <td>Correct Answers</td>
                                <td>${correctAnswers} (${Math.round(correctAnswers/answeredQuestions*100)}%)</td>
                            </tr>
                            <tr>
                                <td>Questions with Quality Issues</td>
                                <td>${flaggedQuestions} (${Math.round(flaggedQuestions/totalQuestions*100)}%)</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Quality Issues Breakdown</h6>
                        <table class="table table-sm">
                            <tr>
                                <td>Ground Truth Unclear</td>
                                <td>${groundTruthIssues} (${Math.round(groundTruthIssues/flaggedQuestions*100 || 0)}%)</td>
                            </tr>
                            <tr>
                                <td>Other Options Also Valid</td>
                                <td>${otherOptionsIssues} (${Math.round(otherOptionsIssues/flaggedQuestions*100 || 0)}%)</td>
                            </tr>
                            <tr>
                                <td>Language Issues</td>
                                <td>${languageIssues} (${Math.round(languageIssues/flaggedQuestions*100 || 0)}%)</td>
                            </tr>
                            <tr>
                                <td>Other Issues</td>
                                <td>${otherIssues} (${Math.round(otherIssues/flaggedQuestions*100 || 0)}%)</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <div class="mt-3">
                    <p class="text-muted small">Note: These statistics will be included in your submission.</p>
                </div>
            </div>
        </div>`;
        
        // Add to page
        const submissionForm = document.getElementById('submission-form');
        const submitButton = document.getElementById('submit-all-btn');
        const statsContainer = document.createElement('div');
        statsContainer.id = 'stats-container';
        statsContainer.innerHTML = statsHtml;
        
        // Ensure only added once
        const existingStats = document.getElementById('stats-container');
        if (existingStats) {
            existingStats.innerHTML = statsHtml;
        } else {
            submissionForm.insertBefore(statsContainer, submitButton);
        }
    }
    
    // Log statistics to console (for debugging)
    console.log("Submission Statistics:", {
        totalQuestions,
        answeredQuestions,
        correctAnswers,
        flaggedQuestions,
        issueBreakdown: {
            groundTruthIssues,
            otherOptionsIssues,
            languageIssues,
            otherIssues
        }
    });
    
    return {
        totalQuestions,
        answeredQuestions,
        correctAnswers,
        flaggedQuestions,
        issueBreakdown: {
            groundTruthIssues,
            otherOptionsIssues,
            languageIssues,
            otherIssues
        }
    };
}

// Function to submit to FormSpree
function submitToFormSpree(data) {
    // FormSpree endpoint - use the same as in text_questionnaire.js
    const formSpreeEndpoint = 'https://formspree.io/f/xdkeaypg';
    
    // Remove test mode flag for basketball submissions
    // Modify data in test mode, add flags
    // if (currentDomain === "basketball" && data.responses && data.responses.length <= 10) {
    //     data.isTestSubmission = true;
    //     data.testInfo = {
    //         testMode: true,
    //         message: "This is a test submission, containing only the first 10 basketball samples",
    //         timestamp: new Date().toISOString()
    //     };
    //     console.log("Test mode: Submission data marked as test submission");
    // }
    
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
            
            // Remove test mode notice
            // Display special notice in test mode
            // if (currentDomain === "basketball" && data.responses && data.responses.length <= 10) {
            //     const testNotice = document.createElement('div');
            //     testNotice.className = 'alert alert-warning mt-3';
            //     testNotice.innerHTML = `
            //         <h5><i class="bi bi-exclamation-triangle"></i> Test Mode Submission</h5>
            //         <p>You just made a <strong>test mode</strong> submission, containing only the first 10 basketball samples.</p>
            //         <p>This submission has been marked as test data.</p>
            //     `;
            //     submissionSuccess.appendChild(testNotice);
            // }
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
        phaseIndicator.textContent = 'Phase 2: Quality Assessment';
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
    
    // Change button text and disable
    button.style.display = 'none';
    
    // Show ground truth container (show assessment section)
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
    
    // Clearly prompt user for step 2 action
    const assessmentHeader = questionElement.querySelector('.filter-container h5');
    if (assessmentHeader) {
        assessmentHeader.innerHTML = '<i class="bi bi-arrow-down-circle"></i> Step 2: Please complete the quality assessment below';
        assessmentHeader.style.color = '#0d6efd';
        assessmentHeader.style.fontSize = '1.1rem';
        assessmentHeader.style.marginBottom = '1rem';
    }
};

// Handle confirm filter button clicks - make global
window.handleConfirmFilterBtnClick = function(button) {
    const questionElement = button.closest('.video-container');
    if (!questionElement) return;
    
    // Save quality assessment information
    saveFilterFlags(currentQuestionIndex, questionElement);
    
    // Ensure overallQuality was saved
    const response = userResponses[currentQuestionIndex];
    if (!response.filterFlags || !response.filterFlags.overallQuality) {
        alert('Please select an overall quality rating (Good quality or Poor quality) before continuing.');
        return;
    }
    
    // Ensure this state is correctly set and saved - important
    response.assessmentSubmitted = true;
    saveUserResponses(); // Ensure state is saved
    
    // Change button text to indicate submission
    button.textContent = 'Assessment Submitted';
    button.disabled = true;
    button.classList.remove('btn-success');
    button.classList.add('btn-secondary');
    
    // Don't automatically advance, let the user manually click the "Next" button
    // goToNextQuestion();
    
    // Prompt user to click next
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.classList.add('btn-pulse');  // Can add pulse animation effect in CSS
    }
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
        phaseIndicator.textContent = 'Phase 2: Quality Assessment';
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
    
    // Set up quality rating based on stored values
    if (response.filterFlags) {
        // Set overall quality assessment radio button state
        const qualityGood = questionElement.querySelector('#quality-good');
        const qualityBad = questionElement.querySelector('#quality-bad');
        
        if (qualityGood && qualityBad && response.filterFlags.overallQuality) {
            if (response.filterFlags.overallQuality === 'good') {
                qualityGood.checked = true;
                qualityBad.checked = false;
            } else {
                qualityGood.checked = false;
                qualityBad.checked = true;
            }
        }
        
        // Set detailed issue checkbox states
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
        
        // If quality assessment is complete, disable confirm button and mark state
        if (response.filterFlags.overallQuality && response.assessmentSubmitted) {
            const confirmFilterBtn = questionElement.querySelector('#confirm-filter-btn');
            if (confirmFilterBtn) {
                confirmFilterBtn.textContent = 'Assessment Submitted';
                confirmFilterBtn.disabled = true;
                confirmFilterBtn.classList.remove('btn-success');
                confirmFilterBtn.classList.add('btn-secondary');
            }
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

    // Ensure button state is correct for completed questions
    ensureQuestionButtonState();
}

// Ensure button state is correct for completed questions
function ensureQuestionButtonState() {
    const currentResponse = userResponses[currentQuestionIndex];
    if (!currentResponse) return;
    
    // Check if button state is consistent with data state
    if (currentResponse.assessmentSubmitted) {
        const confirmFilterBtn = document.querySelector('#confirm-filter-btn');
        if (confirmFilterBtn && !confirmFilterBtn.disabled) {
            confirmFilterBtn.textContent = 'Assessment Submitted';
            confirmFilterBtn.disabled = true;
            confirmFilterBtn.classList.remove('btn-success');
            confirmFilterBtn.classList.add('btn-secondary');
            console.log("Button state restored to submitted");
        }
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
    
    const videoWrapper = videoPlayer.closest('.video-wrapper');
    
    console.log(`Attempting to load video: ${fileName}, attempt number: ${videoLoadAttempts[fileName]}`);
    
    // Extract base filename without path
    const baseFileName = fileName.replace(/^.*[\\\/]/, '');
    
    // Check if this is Safari browser
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log(`Browser detection - Safari: ${isSafari}`);
    
    // First try loading from Amazon S3 using video_mapping.js
    const s3Url = getVideoUrlFromMapping(baseFileName);
    
    if (s3Url && videoWrapper) {
        console.log(`Found Amazon S3 URL for ${baseFileName}: ${s3Url}`);
        
        // Clear existing content from video container
        while (videoWrapper.firstChild) {
            videoWrapper.removeChild(videoWrapper.firstChild);
        }
        
        // SIMPLIFIED VIDEO CONTAINER with Safari-specific optimizations
        videoWrapper.innerHTML = `
            <div class="video-player-wrapper" style="position: relative; width: 100%; max-width: 800px; margin: 0 auto;">
                <video 
                    id="video-player" 
                    width="100%" 
                    height="350px" 
                    controls 
                    controlsList="nodownload" 
                    crossorigin="anonymous" 
                    playsinline 
                    ${isSafari ? 'webkit-playsinline' : ''} 
                    style="display: block; margin: 0 auto; border-radius: 4px; max-width: 100%;">
                    <source src="${s3Url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <div class="video-loading" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.5); color: white; z-index: 5;">
                    <div style="text-align: center;">
                        <div class="spinner-border text-light" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p style="margin-top: 10px;">Loading video...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Get the video element and add event listeners
        const videoElement = videoWrapper.querySelector('video');
        const loadingOverlay = videoWrapper.querySelector('.video-loading');
        
        // Safari-specific optimization
        if (isSafari) {
            // 为Safari添加metadata预加载
            videoElement.preload = "metadata";
            
            // 如果Safari重试次数超过1，尝试使用不同的加载方式
            if (videoLoadAttempts[fileName] > 1) {
                console.log("Safari retry: Using alternative video loading method");
                
                // 添加load事件监听
                videoElement.addEventListener('loadstart', function() {
                    console.log("Safari: Video loadstart event fired");
                });
                
                // 明确触发加载
                setTimeout(() => {
                    videoElement.load();
                }, 100);
            }
        }
        
        // Setup seeking functionality
        let userSeeking = false;
        let targetTime = 0;
        window.videoSeekEnabled = true;
        
        // Add seeking event listeners
        videoElement.addEventListener('seeking', function() {
            // Mark that user is dragging
            userSeeking = true;
            targetTime = videoElement.currentTime;
            console.log("User seeking to time:", targetTime);
        });
        
        videoElement.addEventListener('seeked', function() {
            // Video has jumped to new position
            console.log("Seeked to:", videoElement.currentTime);
            
            // Keep userSeeking true for a while to ensure time updates are correctly applied
            setTimeout(() => {
                userSeeking = false;
            }, 300);
        });
        
        // Prevent progress bar from resetting
        videoElement.addEventListener('timeupdate', function() {
            // If user just dragged and position is incorrect, fix it
            if (userSeeking && Math.abs(videoElement.currentTime - targetTime) > 0.5) {
                console.log("Correcting time from", videoElement.currentTime, "to", targetTime);
                videoElement.currentTime = targetTime;
            }
        });
        
        // Add error handling with Safari-specific logging
        videoElement.addEventListener('error', function(e) {
            const errorCode = videoElement.error ? videoElement.error.code : "unknown";
            const errorMessage = videoElement.error ? videoElement.error.message : "unknown";
            
            console.error(`Video loading error with Amazon S3 (${isSafari ? 'Safari' : 'Other browser'}):`);
            console.error("Error code:", errorCode);
            console.error("Error message:", errorMessage);
            
            // Enhanced Safari-specific error logging
            if (isSafari) {
                console.log("Safari error details - networkState:", videoElement.networkState);
                console.log("Safari error details - readyState:", videoElement.readyState);
            }
            
            // Hide loading overlay
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            
            // Add visible error message to page
            const errorMsg = document.createElement('div');
            errorMsg.className = "alert alert-danger mt-2";
            errorMsg.innerHTML = `<strong>Error loading video from Amazon S3:</strong> ${errorMessage}`;
            videoWrapper.appendChild(errorMsg);
            
            // Safari-specific fallback - try direct video URL
            if (isSafari && videoLoadAttempts[fileName] <= 2) {
                console.log("Safari fallback: Attempting direct video load");
                setTimeout(() => {
                    // Try direct video loading without source element
                    videoElement.innerHTML = '';
                    videoElement.src = s3Url;
                    videoElement.load();
                }, 500);
            } else {
                // Fall back to local video loading after a short delay
                setTimeout(() => {
                    tryLoadFromLocalPaths(videoWrapper, videoWrapper, fileName);
                }, 500);
            }
        });
        
        // Add additional debug events for Safari
        if (isSafari) {
            videoElement.addEventListener('loadstart', () => console.log('Safari video event: loadstart'));
            videoElement.addEventListener('durationchange', () => console.log('Safari video event: durationchange'));
            videoElement.addEventListener('loadedmetadata', () => console.log('Safari video event: loadedmetadata'));
            videoElement.addEventListener('loadeddata', () => console.log('Safari video event: loadeddata'));
            videoElement.addEventListener('progress', () => console.log('Safari video event: progress'));
            videoElement.addEventListener('waiting', () => console.log('Safari video event: waiting'));
            videoElement.addEventListener('suspend', () => console.log('Safari video event: suspend'));
        }
        
        // Add success handler
        videoElement.addEventListener('canplay', function() {
            console.log(`Video ${fileName} successfully loaded from Amazon S3!`);
            
            // Hide loading overlay
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            
            // Ensure video is visible
            videoElement.style.display = "block";
        });
        
        // For Safari, use a slight delay before loading to avoid some timing issues
        if (isSafari) {
            setTimeout(() => {
                videoElement.load();
            }, 50);
        } else {
            // Load video immediately for other browsers
            videoElement.load();
        }
        return;
    } else {
        console.log(`No Amazon S3 URL found for ${baseFileName}, trying local paths`);
        // Fall back to local paths if no Amazon S3 URL found
        if (videoWrapper) {
            // Clear existing content if any
            while (videoWrapper.firstChild) {
                videoWrapper.removeChild(videoWrapper.firstChild);
            }
            
            tryLoadFromLocalPaths(videoWrapper, videoWrapper, fileName);
        }
    }
}

// 修改tryLoadFromLocalPaths函数以支持Safari
function tryLoadFromLocalPaths(container, videoWrapper, fileName) {
    // Try multiple possible local paths
    const questionId = fileName.replace('.mp4', '');
    
    // 提取questionId和video_time
    let videoId = questionId;
    let videoTime = 'unknown';
    
    // 如果文件名已经包含下划线，尝试分割出video_time
    if (questionId.includes('_')) {
        const parts = questionId.split('_');
        // 假设最后一部分是video_time
        videoTime = parts[parts.length - 1];
        // 前面的部分组成videoId
        videoId = parts.slice(0, -1).join('_');
    }
    
    const videoPaths = [
        `additional_video_clips/${fileName}`,
        `additional_video_clips/${questionId}.mp4`,
        `additional_video_clips/${videoId}.mp4`,
        `additional_video_clips/${videoId.toLowerCase()}.mp4`
    ];
    
    // 检测Safari浏览器
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    console.log(`Trying to load from local path: ${videoPaths[0]}, Safari: ${isSafari}`);
    
    // SIMPLIFIED CONTAINER STRUCTURE - create video directly in wrapper
    // 为Safari添加特定的属性
    container.innerHTML = `
        <video
            id="video-player"
            width="100%"
            height="350px"
            controls
            controlsList="nodownload"
            crossorigin="anonymous"
            playsinline
            ${isSafari ? 'webkit-playsinline' : ''} 
            ${isSafari ? 'preload="metadata"' : 'preload="auto"'}
            style="display: block; margin: 0 auto; border-radius: 4px; max-width: 100%;">
            <source src="${videoPaths[0]}${isSafari ? '?nocache=' + Date.now() : ''}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    
    // Get the video element
    const videoElement = container.querySelector('video');
    
    // Setup seeking functionality
    let userSeeking = false;
    let targetTime = 0;
    window.videoSeekEnabled = true;
    
    // Add seeking event listeners
    videoElement.addEventListener('seeking', function() {
        // Mark that user is dragging
        userSeeking = true;
        targetTime = videoElement.currentTime;
        console.log("User seeking to time:", targetTime);
    });
    
    videoElement.addEventListener('seeked', function() {
        // Video has jumped to new position
        console.log("Seeked to:", videoElement.currentTime);
        
        // Keep userSeeking true for a while to ensure time updates are correctly applied
        setTimeout(() => {
            userSeeking = false;
        }, 300);
    });
    
    // Prevent progress bar from resetting
    videoElement.addEventListener('timeupdate', function() {
        // If user just dragged and position is incorrect, fix it
        if (userSeeking && Math.abs(videoElement.currentTime - targetTime) > 0.5) {
            console.log("Correcting time from", videoElement.currentTime, "to", targetTime);
            videoElement.currentTime = targetTime;
        }
    });
    
    // Add enhanced error handling for Safari
    videoElement.addEventListener('error', function(e) {
        const errorMsg = videoElement.error ? videoElement.error.message : "unknown error";
        console.error(`Local video loading error (${isSafari ? 'Safari' : 'Other browser'}):`, errorMsg);
        
        // 针对Safari，尝试其他视频源
        if (isSafari) {
            console.log("Safari error - attempting alternative local paths");
            
            // 为Safari尝试其他本地路径
            let altPathIndex = videoLoadAttempts[fileName] % videoPaths.length;
            if (altPathIndex === 0) altPathIndex = 1; // 跳过第一个路径，因为已经尝试过了
            
            if (altPathIndex < videoPaths.length) {
                const altPath = videoPaths[altPathIndex] + `?safari_retry=${Date.now()}`;
                console.log(`Safari retry with path: ${altPath}`);
                
                videoElement.src = altPath;
                videoElement.load();
                videoLoadAttempts[fileName]++;
                return;
            }
        }
        
        // If local loading fails, try Google Drive
        const fileId = getFileIdFromName(fileName);
        if (fileId) {
            console.log(`Local loading failed, trying to load from Google Drive: ${fileName}, ID: ${fileId}`);
            tryLoadFromGoogleDrive(container, fileId, fileName);
        } else {
            // Display error message
            showVideoErrorMessage(videoWrapper, fileName);
        }
    });
    
    // Add success handler
    videoElement.addEventListener('canplay', function() {
        console.log(`Video ${fileName} successfully loaded from local source!`);
    });
    
    // Safari特定优化：添加更多调试事件
    if (isSafari) {
        videoElement.addEventListener('loadstart', () => console.log('Safari local video: loadstart'));
        videoElement.addEventListener('durationchange', () => console.log('Safari local video: durationchange'));
        videoElement.addEventListener('loadedmetadata', () => console.log('Safari local video: loadedmetadata'));
        videoElement.addEventListener('loadeddata', () => console.log('Safari local video: loadeddata'));
        videoElement.addEventListener('stalled', () => console.log('Safari local video: stalled'));
    }
    
    // Load video - Safari延迟加载
    if (isSafari) {
        setTimeout(() => {
            videoElement.load();
        }, 50);
    } else {
        videoElement.load();
    }
}

// Get file ID from filename using the video mapping
function getFileIdFromName(fileName) {
    // Extract base filename without path and extension
    const baseFileName = fileName.replace(/^.*[\\\/]/, '');
    const baseNameWithoutExt = baseFileName.replace(/\.[^/.]+$/, '');
    
    // Check all possible variations for match in videoFileMapping
    const possibleKeys = [
        baseFileName,
        baseNameWithoutExt,
        baseFileName + '.mp4',
        baseNameWithoutExt + '.mp4'
    ];
    
    // Try all possible keys
    for (const key of possibleKeys) {
        if (window.videoFileMapping && window.videoFileMapping[key]) {
            console.log(`Found Amazon S3 URL for ${key}`);
            return window.videoFileMapping[key];
        }
    }
    
    // No matching URL found
    console.warn(`No Amazon S3 URL found for video ${baseFileName}`);
    return null;
}

// Display video error message
function showVideoErrorMessage(videoWrapper, fileName) {
    if (!videoWrapper) return;
    
    // Check if error message is already displayed
    if (videoWrapper.querySelector('.alert-warning')) return;
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'alert alert-warning mt-2';
    errorMessage.innerHTML = `
        <strong>Unable to load video</strong><br>
        <p>Please try the following methods to access video "${fileName}":</p>
        <ol>
            <li>Refresh the page and try again</li>
            <li>Check if the video file is correctly configured in Amazon S3</li>
            <li>Check if the video file is correctly placed in the video_clips or videos folder on the local server</li>
        </ol>
        <p class="mt-2">You can continue evaluating other questions and come back to this video later.</p>
    `;
    videoWrapper.appendChild(errorMessage);
}

// Load video from Google Drive (kept for fallback compatibility)
function tryLoadFromGoogleDrive(container, fileId, fileName) {
    if (!container) return;
    
    // If fileId is actually an Amazon S3 URL (from getFileIdFromName)
    if (fileId.startsWith('http')) {
        // Create video element
        const videoElement = document.createElement('video');
        videoElement.id = 'direct-video-player';
        videoElement.width = "100%";
        videoElement.height = "350px";
        videoElement.controls = true;
        videoElement.controlsList = "nodownload";
        videoElement.preload = "auto";
        videoElement.style.backgroundColor = "#000";
        
        // Create source element
        const source = document.createElement('source');
        source.type = "video/mp4";
        source.src = fileId; // The URL from Amazon S3
        videoElement.appendChild(source);
        
        // Add error handling
        videoElement.addEventListener('error', function(e) {
            console.error("Amazon S3 video loading error:", e);
            showFallbackMessage(container, fileName);
        });
        
        // Add success handler
        videoElement.addEventListener('canplay', function() {
            console.log(`Video ${fileName} successfully loaded from Amazon S3!`);
        });
        
        // Add video element to container
        container.appendChild(videoElement);
        
        // Load video
        videoElement.load();
        return;
    }
    
    // If no valid URL, show fallback message
    showFallbackMessage(container, fileName);
}

// Show fallback message when all video loading methods fail
function showFallbackMessage(container, fileName) {
    // Clear container first to remove any potential extra elements
    container.innerHTML = '';
    
    // Add a black placeholder with play icon as a visual fallback
    const placeholderContainer = document.createElement('div');
    placeholderContainer.style.width = '100%';
    placeholderContainer.style.height = '350px';
    placeholderContainer.style.backgroundColor = '#000';
    placeholderContainer.style.display = 'flex';
    placeholderContainer.style.alignItems = 'center';
    placeholderContainer.style.justifyContent = 'center';
    placeholderContainer.style.borderRadius = '5px';
    placeholderContainer.style.marginBottom = '15px';
    
    // Add a play icon to make it look like a video
    placeholderContainer.innerHTML = `
        <div style="color: white; text-align: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" class="bi bi-play-circle" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M6.271 5.055a.5.5 0 0 1 .52.038l3.5 2.5a.5.5 0 0 1 0 .814l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .271-.445z"/>
            </svg>
            <p style="margin-top: 15px;">Video preview unavailable</p>
        </div>
    `;
    
    // Create fallback message
    const fallbackElement = document.createElement('div');
    fallbackElement.className = 'alert alert-warning mt-3 mb-3';
    fallbackElement.innerHTML = `
        <strong>Unable to load video: ${fileName}</strong>
        <p>The video could not be loaded from any source. Please try refreshing the page or contact support.</p>
    `;
    
    // Add to container
    container.appendChild(placeholderContainer);
    container.appendChild(fallbackElement);
    
    console.log(`Failed to load video: ${fileName} from all sources`);
}

// Standardize file name
function getStandardizedFileName(questionId) {
    // 检查问题数据是否可用
    const question = questions[currentQuestionIndex];
    if (question) {
        const videoTime = question.video_time || 'unknown';
        return `${questionId}.mp4`;
    }
    return `${questionId}.mp4`;
}

// Helper function to get URL from video_mapping.js
function getVideoUrlFromMapping(fileName) {
    // Check if video_mapping.js is loaded and accessible
    if (typeof window.videoFileMapping === 'undefined') {
        console.error("Video mapping is not available: window.videoFileMapping is undefined");
        console.log("Available on window object:", Object.keys(window).filter(k => k.includes('video')));
        return null;
    }
    
    console.log(`Searching for video URL mapping for: ${fileName}`);
    
    // Check if the mapping has data
    const mappingSize = Object.keys(window.videoFileMapping).length;
    console.log(`Video mapping contains ${mappingSize} entries`);
    
    // Debug: Log the first few entries for inspection
    if (mappingSize > 0) {
        const sampleKeys = Object.keys(window.videoFileMapping).slice(0, 3);
        console.log("Sample mapping entries:", sampleKeys);
    }
    
    let foundUrl = null;
    
    // Try exact match first
    if (window.videoFileMapping[fileName]) {
        console.log(`Found exact match for ${fileName}`);
        foundUrl = window.videoFileMapping[fileName];
    }
    
    // Try without .mp4 extension if not found
    if (!foundUrl) {
        const baseNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const withExtension = baseNameWithoutExt + '.mp4';
        
        if (window.videoFileMapping[withExtension]) {
            console.log(`Found match for ${fileName} using "${withExtension}"`);
            foundUrl = window.videoFileMapping[withExtension];
        }
    }
    
    // Try with different versions of the filename
    if (!foundUrl) {
        const baseNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const variations = [
            fileName,
            baseNameWithoutExt,
            baseNameWithoutExt + '.mp4',
            fileName.toLowerCase(),
            baseNameWithoutExt.toLowerCase(),
            (baseNameWithoutExt + '.mp4').toLowerCase()
        ];
        
        for (const variant of variations) {
            if (window.videoFileMapping[variant]) {
                console.log(`Found match for ${fileName} using variant "${variant}"`);
                foundUrl = window.videoFileMapping[variant];
                break;
            }
        }
    }
    
    // If URL is found, use it directly
    if (foundUrl) {
        // 检测是否为Safari浏览器
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        // 对Safari进行特殊处理
        if (isSafari) {
            console.log("Safari browser detected, applying special URL handling");
            
            // 如果URL包含Amazon S3，确保使用HTTPS
            if (foundUrl.includes('amazonaws.com') && !foundUrl.startsWith('https:')) {
                foundUrl = foundUrl.replace(/^http:/, 'https:');
                console.log("Converted URL to HTTPS for Safari compatibility");
            }
            
            // 添加时间戳防止缓存问题
            if (!foundUrl.includes('?')) {
                foundUrl += `?safari=${Date.now()}`;
            } else {
                foundUrl += `&safari=${Date.now()}`;
            }
            
            console.log("Safari-optimized URL:", foundUrl);
        }
        
        return foundUrl;
    }
    
    // No matching URL found
    console.warn(`No Amazon S3 URL found for video ${fileName} after trying all variations`);
    return null;
}