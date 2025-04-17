/**
 * API Helper for Suno Saarthi application
 * Contains methods to interact with the backend API
 */

class ApiService {
    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.endpoints = config.endpoints;
        this.maxRetries = 2; // Maximum number of retry attempts
        
        console.log('API Service initialized with base URL:', this.baseUrl);
        
        // Check if we have all needed endpoints
        if (!this.endpoints) {
            console.error('API endpoints configuration missing');
        } else {
            console.log('API endpoints configured:', Object.keys(this.endpoints).join(', '));
        }
    }

    /**
     * Make a general API request
     * @param {string} endpoint - API endpoint path
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {Object} data - Request data (for POST, PUT, etc.)
     * @param {number} retryCount - Current retry attempt (internal)
     * @returns {Promise<Object>} - API response
     */
    async request(endpoint, method = 'GET', data = null, retryCount = 0) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            // Add credentials for CORS requests
            credentials: 'include'
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        console.log(`API Request: ${method} ${url}`, data ? { data } : '');
        
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error (${response.status}):`, errorText);
                
                // Handle specific error codes
                if (response.status === 401 || response.status === 403) {
                    console.error('Authentication error. User may need to log in again.');
                    // You could trigger a login screen here if needed
                }
                
                // Retry logic for server errors (5xx) or network issues
                if ((response.status >= 500 || response.status === 0) && retryCount < this.maxRetries) {
                    console.log(`Retrying request (${retryCount + 1}/${this.maxRetries})...`);
                    // Exponential backoff: wait longer between each retry
                    const backoffTime = 1000 * Math.pow(2, retryCount);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    return this.request(endpoint, method, data, retryCount + 1);
                }
                
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            // Handle empty responses (for example, 204 No Content)
            if (response.status === 204) {
                return { success: true };
            }
            
            const jsonResponse = await response.json();
            console.log(`API Response:`, jsonResponse);
            return jsonResponse;
        } catch (error) {
            console.error('API request error:', error);
            
            // Check if it's a network error and retry if possible
            if ((error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) 
                && retryCount < this.maxRetries) {
                console.log(`Network error, retrying (${retryCount + 1}/${this.maxRetries})...`);
                const backoffTime = 1000 * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                return this.request(endpoint, method, data, retryCount + 1);
            }
            
            throw error;
        }
    }

    /**
     * Get directions between two points
     * @param {string} origin - Starting point
     * @param {string} destination - Ending point
     * @param {string} mode - Transportation mode (driving, walking, cycling, etc.)
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Directions response
     */
    async getDirections(origin, destination, mode = 'driving', options = {}) {
        console.log(`Getting directions from ${origin} to ${destination} via ${mode}`, options);
        
        const data = {
            origin,
            destination,
            mode,
            ...options
        };
        
        try {
            const result = await this.request(this.endpoints.directions, 'POST', data);
            return result;
        } catch (error) {
            console.error('Error getting directions:', error);
            // Return a structured error object instead of throwing
            return {
                status: 'error',
                message: 'Could not get directions. Please try again.',
                error: error.message
            };
        }
    }

    /**
     * Get traffic information between two points
     * @param {string} origin - Starting point
     * @param {string} destination - Ending point
     * @param {string} departureTime - Departure time (or 'now')
     * @returns {Promise<Object>} - Traffic information
     */
    async getTrafficInfo(origin, destination, departureTime = 'now') {
        const data = {
            origin,
            destination,
            departure_time: departureTime
        };
        
        return this.request(this.endpoints.traffic, 'POST', data);
    }

    /**
     * Find nearby places of interest
     * @param {string} location - Center location (address or coordinates)
     * @param {string} placeType - Type of place to find
     * @param {number} radius - Search radius in meters
     * @param {string} language - Language for results
     * @returns {Promise<Object>} - Nearby places results
     */
    async getNearbyPlaces(location, placeType, radius = 1000, language = 'en') {
        const data = {
            location,
            place_type: placeType,
            radius,
            language
        };
        
        return this.request(this.endpoints.places, 'POST', data);
    }

    /**
     * Process a natural language navigation query
     * @param {string} query - The user's query
     * @param {string} currentLocation - User's current location (optional)
     * @returns {Promise<Object>} - Navigation query response
     */
    async processNavigationQuery(query, currentLocation = null) {
        const data = {
            query,
            current_location: currentLocation
        };
        
        return this.request(this.endpoints.query, 'POST', data);
    }

    /**
     * Generate a response using the LLM
     * @param {string} prompt - User prompt for the LLM
     * @param {Object} options - Additional options for LLM
     * @returns {Promise<Object>} - LLM response
     */
    async generateLLMResponse(prompt, options = {}) {
        const data = {
            prompt,
            ...options
        };
        
        return this.request(this.endpoints.llmGenerate, 'POST', data);
    }

    /**
     * Process a navigation-related prompt with context
     * @param {string} query - The user's navigation-related query
     * @param {Object} navigationContext - Additional context like current route
     * @returns {Promise<Object>} - LLM response specific to navigation
     */
    async processNavigationPrompt(query, navigationContext = null) {
        console.log(`Processing navigation prompt: "${query}"`, 
                    navigationContext ? { context: navigationContext } : '');
        
        const data = {
            query,
            navigation_context: navigationContext
        };
        
        try {
            return await this.request(this.endpoints.llmNavigation, 'POST', data);
        } catch (error) {
            console.error('Error processing navigation prompt:', error);
            // Return a user-friendly error response
            return {
                status: 'error',
                message: 'I encountered an issue processing your request. Please try again.',
                fallback_response: 'I\'m sorry, I couldn\'t process that request right now. How else can I help with your navigation?'
            };
        }
    }

    /**
     * Detect if text contains a wake word
     * @param {string} text - Text to check
     * @returns {Promise<Object>} - Wake word detection result
     */
    async detectWakeWord(text) {
        const data = {
            text
        };
        
        return this.request(this.endpoints.wakeDetect, 'POST', data);
    }

    /**
     * Check API availability with a simple health check
     * @returns {Promise<boolean>} - True if API is available
     */
    async checkHealth() {
        try {
            // Try to access a simple endpoint like health or status
            // Adjust the endpoint based on your API
            const healthEndpoint = this.endpoints.health || '/api/health';
            const response = await this.request(healthEndpoint, 'GET');
            return response && response.status === 'ok';
        } catch (error) {
            console.error('API health check failed:', error);
            return false;
        }
    }
}

// Create an instance of the API service using the configuration
const API = new ApiService(CONFIG.api);

// Log that API is ready
console.log('API Service ready', API); 