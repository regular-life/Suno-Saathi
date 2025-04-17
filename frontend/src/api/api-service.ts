import { API_CONFIG } from '@/utils/constants';

export interface ApiConfig {
  baseUrl: string;
  endpoints: Record<string, string>;
}

export class ApiService {
  private baseUrl: string;
  private endpoints: Record<string, string>;
  private maxRetries: number = 2;

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl;
    this.endpoints = config.endpoints;
    
    console.log('API Service initialized with base URL:', this.baseUrl);
  }

  /**
   * Make a general API request
   */
  async request(endpoint: string, method: string = 'GET', data: any = null, retryCount: number = 0): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
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
    } catch (error: any) {
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
   */
  async getDirections(origin: string, destination: string, mode: string = 'driving', options: Record<string, any> = {}): Promise<any> {
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
    } catch (error: any) {
      console.error('Error getting directions:', error);
      return {
        status: 'error',
        message: 'Could not get directions. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Get traffic information between two points
   */
  async getTrafficInfo(origin: string, destination: string, departureTime: string = 'now'): Promise<any> {
    const data = {
      origin,
      destination,
      departure_time: departureTime
    };
    
    return this.request(this.endpoints.traffic, 'POST', data);
  }

  /**
   * Find nearby places of interest
   */
  async getNearbyPlaces(location: string, placeType: string, radius: number = 1000, language: string = 'en'): Promise<any> {
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
   */
  async processNavigationQuery(query: string, currentLocation: string | null = null): Promise<any> {
    const data = {
      query,
      current_location: currentLocation
    };
    
    return this.request(this.endpoints.query, 'POST', data);
  }

  /**
   * Generate a response using the LLM
   */
  async generateLLMResponse(prompt: string, options: Record<string, any> = {}): Promise<any> {
    const data = {
      prompt,
      ...options
    };
    
    return this.request(this.endpoints.llmGenerate, 'POST', data);
  }

  /**
   * Process a navigation-related prompt with context
   */
  async processNavigationPrompt(query: string, navigationContext: Record<string, any> | null = null): Promise<any> {
    const data = {
      query,
      navigation_context: navigationContext
    };
    
    return this.request(this.endpoints.navigationPrompt, 'POST', data);
  }

  /**
   * Detect if text contains a wake word
   */
  async detectWakeWord(text: string): Promise<any> {
    const data = { text };
    return this.request(this.endpoints.wakeWord, 'POST', data);
  }

}

// Create singleton instance with the API config
export const apiService = new ApiService(API_CONFIG); 