// RedMist Authentication Module
// OAuth 2.0 Client Credentials Flow

import type { TokenResponse } from '../types/redmist';

// Use proxy in development to bypass CORS
const AUTH_URL = import.meta.env.DEV 
  ? '/auth/realms/redmist/protocol/openid-connect/token'
  : 'https://auth.redmist.racing/realms/redmist/protocol/openid-connect/token';
const TOKEN_REFRESH_MARGIN = 30000; // Refresh 30 seconds before expiry

interface AuthConfig {
  clientId: string;
  clientSecret: string;
}

class TokenManager {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private refreshPromise: Promise<string> | null = null;
  private config: AuthConfig | null = null;
  private listeners: Set<(token: string | null) => void> = new Set();

  /**
   * Initialize the token manager with client credentials
   */
  configure(config: AuthConfig): void {
    this.config = config;
    // Clear existing token when config changes
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Check if the token manager is configured
   */
  isConfigured(): boolean {
    return this.config !== null && 
           this.config.clientId.length > 0 && 
           this.config.clientSecret.length > 0;
  }

  /**
   * Subscribe to token changes
   */
  subscribe(listener: (token: string | null) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current token
    listener(this.accessToken);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of token change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.accessToken));
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - TOKEN_REFRESH_MARGIN) {
      return this.accessToken;
    }

    // If we're already refreshing, wait for that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start a new refresh
    this.refreshPromise = this.refreshToken();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Token manager not configured. Call configure() first.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);

    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} ${errorText}`);
    }

    const data: TokenResponse = await response.json();
    
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    this.notifyListeners();
    
    console.log(`[Auth] Token refreshed, expires in ${data.expires_in} seconds`);
    
    return this.accessToken;
  }

  /**
   * Clear the current token (logout)
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.notifyListeners();
  }

  /**
   * Check if currently authenticated with a valid token
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && 
           this.tokenExpiry !== null && 
           Date.now() < this.tokenExpiry;
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(): number | null {
    return this.tokenExpiry;
  }

  /**
   * Get time until token expires (in ms)
   */
  getTimeUntilExpiry(): number | null {
    if (!this.tokenExpiry) return null;
    return Math.max(0, this.tokenExpiry - Date.now());
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Auto-refresh token before expiry
let refreshInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoRefresh(): void {
  if (refreshInterval) return;
  
  // Check every minute if we need to refresh
  refreshInterval = setInterval(async () => {
    const timeUntilExpiry = tokenManager.getTimeUntilExpiry();
    
    // If token expires in less than 1 minute, refresh it
    if (timeUntilExpiry !== null && timeUntilExpiry < 60000 && tokenManager.isConfigured()) {
      try {
        await tokenManager.getToken();
      } catch (error) {
        console.error('[Auth] Auto-refresh failed:', error);
      }
    }
  }, 30000); // Check every 30 seconds
}

export function stopAutoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

