/**
 * SECRETS CONFIGURATION - API KEYS
 * This file contains all API keys and sensitive information used by the application.
 * 
 * SECURITY APPROACH:
 * 1. No API keys are hardcoded in the frontend
 * 2. All sensitive credentials are fetched from the backend
 * 3. The backend loads API keys from environment variables
 * 4. This approach prevents exposing API keys in the client-side code
 */

// Store API keys and configuration once loaded
window.CONFIG = {
    loaded: false,
    keys: {},
    api_urls: {},
    mapboxToken: ''
};

// Function to get API key safely
function getAPIKey(keyName) {
    if (!window.CONFIG.loaded) {
        console.error('Configuration not yet loaded. Call loadConfiguration() first.');
        return null;
    }
    
    if (keyName in window.CONFIG.keys) {
        return window.CONFIG.keys[keyName];
    } else {
        console.error(`API key '${keyName}' not found in configuration`);
        return null;
    }
}

// Get API endpoint URLs
function getAPIUrl(endpointName) {
    if (!window.CONFIG.loaded) {
        console.error('Configuration not yet loaded. Call loadConfiguration() first.');
        return null;
    }
    
    if (endpointName in window.CONFIG.api_urls) {
        return window.CONFIG.api_urls[endpointName];
    } else {
        console.error(`API endpoint '${endpointName}' not found in configuration`);
        return null;
    }
}

// Asynchronously load configuration from the backend
async function loadConfiguration() {
    try {
        // Determine the backend URL (same origin by default)
        const backendUrl = getBackendUrl();
        const configUrl = `${backendUrl}/api/config`;
        
        console.log('Fetching configuration from:', configUrl);
        
        // Fetch configuration from backend
        const response = await fetch(configUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
        }
        
        const config = await response.json();
        console.log('Configuration loaded successfully');
        
        // Store API keys in the CONFIG object
        window.CONFIG.keys = {
            MAPBOX_TOKEN: config.mapbox_token || '',
            GEMINI_API_KEY: config.gemini_api_key || ''
        };
        
        // Store for debug panel
        window.CONFIG.mapboxToken = config.mapbox_token || '';
        
        // Store API URLs
        window.CONFIG.api_urls = config.api_urls || {};
        
        // Log any warnings
        if (config.warnings) {
            console.warn('Configuration warnings:', config.warnings.message);
            
            if (config.warnings.missing_keys && config.warnings.missing_keys.length > 0) {
                console.warn('Missing API keys:', config.warnings.missing_keys);
                window.CONFIG.warnings = config.warnings;
                
                // Show UI warning for missing keys
                showMissingKeysWarning(config.warnings.missing_keys);
            }
        }
        
        // Mark as loaded
        window.CONFIG.loaded = true;
        
        // Initialize APIs that depend on the configuration
        initializeAPIs();
        
        // Trigger any event listeners waiting for config
        document.dispatchEvent(new Event('configLoaded'));
        
        return true;
    } catch (error) {
        console.error('Error loading configuration:', error);
        
        // Show error UI
        showConfigurationError(error.message);
        
        return false;
    }
}

// Determine the backend URL (can be configured for different environments)
function getBackendUrl() {
    // For local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8000';
    }
    
    // For production, use the same origin (assuming backend and frontend are served from same domain)
    return window.location.origin;
}

// Show warning in UI for missing API keys
function showMissingKeysWarning(missingKeys) {
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    if (errorContainer && errorMessage) {
        let message = 'Warning: Some API keys are missing: ' + missingKeys.join(', ');
        message += '. Some features may not work properly.';
        
        errorMessage.textContent = message;
        errorMessage.style.color = 'orange';
        errorContainer.style.display = 'block';
        
        // Hide after 10 seconds
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 10000);
    }
}

// Show error in UI for configuration loading failure
function showConfigurationError(errorMessage) {
    const errorContainer = document.getElementById('error-container');
    const errorMessage_el = document.getElementById('error-message');
    
    if (errorContainer && errorMessage_el) {
        let message = 'Error loading configuration: ' + errorMessage;
        message += '. Please ensure the backend server is running.';
        
        errorMessage_el.textContent = message;
        errorMessage_el.style.color = 'red';
        errorContainer.style.display = 'block';
    }
}

// Initialize APIs that depend on the configuration
function initializeAPIs() {
    initializeGeminiAPI();
    initializeMapbox();
}

// Initialize Mapbox API
function initializeMapbox() {
    const mapboxToken = getAPIKey('MAPBOX_TOKEN');
    
    if (mapboxToken) {
        console.log('Setting up Mapbox with token');
        window.mapboxgl.accessToken = mapboxToken;
    } else {
        console.error('No Mapbox token available. Map functionality will be limited.');
    }
}

// Initialize Gemini API for direct HTTP calls
function initializeGeminiAPI() {
    const geminiKey = getAPIKey('GEMINI_API_KEY');
    
    console.log('Initializing Gemini API, key available:', !!geminiKey);
    
    if (geminiKey) {
        console.log('Setting up Gemini API with key starting with:', geminiKey.substring(0, 3) + '...');
        
        // Create a direct API call function and make it globally available
        window.gemini = {
            generateContent: function(prompt) {
                console.log('gemini.generateContent called with prompt length:', prompt.length);
                return callGeminiAPI(prompt, geminiKey);
            }
        };
        
        // Test if the API function is working
        console.log('Gemini API initialized. Testing window.gemini access:', !!window.gemini);
        console.log('Testing window.gemini.generateContent access:', typeof window.gemini.generateContent === 'function');
    } else {
        console.warn('No Gemini API key found. LLM functionality will be simulated.');
        
        // Create a simulated API for testing
        window.gemini = {
            generateContent: function(prompt) {
                console.log('[SIMULATED] gemini.generateContent called with prompt length:', prompt.length);
                // Return a simple promise that resolves with a simulated response
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            text: function() { 
                                return "This is a simulated response since no Gemini API key was found. Your prompt had " + prompt.length + " characters."; 
                            }
                        });
                    }, 1000);
                });
            }
        };
    }
}

// Function to call Gemini API directly via HTTP
function callGeminiAPI(prompt, apiKey) {
    console.log('Calling Gemini API with prompt length:', prompt.length);
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };
    
    console.log('Request body structure:', 
                JSON.stringify({
                    contents: [{ parts: [{ text: "Length: " + prompt.length }] }]
                })
               );
    
    return fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        console.log('API response status:', response.status);
        if (!response.ok) {
            // Log detailed error info
            return response.text().then(errorText => {
                console.error('Gemini API error response:', errorText);
                throw new Error(`Gemini API request failed with status: ${response.status}. Details: ${errorText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Received raw response from Gemini API:', JSON.stringify(data).substring(0, 200) + '...');
        
        // Better error handling
        if (!data) {
            throw new Error('Empty response from Gemini API');
        }
        
        // Handle API errors
        if (data.error) {
            console.error('Gemini API returned an error:', data.error);
            throw new Error(`API Error: ${data.error.message || 'Unknown API error'}`);
        }
        
        // Extract response text with better error handling
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            // Extract the response text from the API response
            const text = data.candidates[0].content.parts[0].text;
            console.log('Successfully extracted response text, length:', text.length);
            
            // Return in a format similar to the SDK for compatibility
            return {
                text: function() { return text; },
                rawResponse: data // Keep the raw response for debugging
            };
        } else {
            console.error('Unexpected or malformed response format from Gemini API:', data);
            throw new Error('Invalid response format from Gemini API');
        }
    })
    .catch(error => {
        console.error('Error in callGeminiAPI:', error);
        // Return a functioning error response object instead of throwing
        return {
            text: function() { 
                return `Sorry, I encountered an error: ${error.message}. Please try again later.`; 
            },
            error: error,
            isError: true
        };
    });
}

// Export API key getter for other modules
window.getAPIKey = getAPIKey;
window.getAPIUrl = getAPIUrl;

// Load configuration when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadConfiguration();
}); 