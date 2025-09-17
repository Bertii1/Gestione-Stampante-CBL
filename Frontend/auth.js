// Authentication utilities for client-side
class AuthManager {
  constructor() {
    this.tokenKey = 'authToken';
  }

  // Get stored authentication data
  getAuthData() {
    const tokenData = localStorage.getItem(this.tokenKey);
    const sessionData = {
      active: sessionStorage.getItem('sessionActive') === 'true',
      username: sessionStorage.getItem('username'),
      role: sessionStorage.getItem('role')
    };

    if (tokenData) {
      try {
        const parsed = JSON.parse(tokenData);
        if (this.isValidToken(parsed)) {
          return {
            isAuthenticated: true,
            token: parsed.token,
            username: parsed.username,
            role: parsed.role,
            persistent: true
          };
        } else {
          localStorage.removeItem(this.tokenKey);
        }
      } catch (e) {
        localStorage.removeItem(this.tokenKey);
      }
    }

    if (sessionData.active) {
      return {
        isAuthenticated: true,
        username: sessionData.username,
        role: sessionData.role,
        persistent: false
      };
    }

    return { isAuthenticated: false };
  }

  // Check if token is valid and not expired
  isValidToken(tokenData) {
    if (!tokenData || !tokenData.token || !tokenData.timestamp) {
      return false;
    }
    
    // Check if token is older than 24 hours
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (Date.now() - tokenData.timestamp) < twentyFourHours;
  }

  // Make authenticated API request
  async makeAuthenticatedRequest(url, options = {}) {
    const authData = this.getAuthData();
    
    if (!authData.isAuthenticated) {
      throw new Error('Non autenticato');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add authorization header if token exists
    if (authData.token) {
      headers['Authorization'] = `Bearer ${authData.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle token expiry
    if (response.status === 401 || response.status === 403) {
      this.logout();
      window.location.href = '/App/login/login.html';
      throw new Error('Token scaduto');
    }

    return response;
  }

  // Check if user has admin role
  isAdmin() {
    const authData = this.getAuthData();
    return authData.isAuthenticated && authData.role === 'admin';
  }

  // Check if user has at least user role
  isUser() {
    const authData = this.getAuthData();
    return authData.isAuthenticated && (authData.role === 'user' || authData.role === 'admin');
  }

  // Logout and clear all authentication data
  logout() {
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem('sessionActive');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
  }

  // Redirect if not authenticated
  requireAuth(requiredRole = null) {
    const authData = this.getAuthData();
    
    if (!authData.isAuthenticated) {
      window.location.href = '/App/login/login.html';
      return false;
    }

    if (requiredRole && authData.role !== requiredRole) {
      // If admin access required but user doesn't have it
      if (requiredRole === 'admin' && authData.role !== 'admin') {
        window.location.href = '/App/home/home.html';
        return false;
      }
    }

    return true;
  }

  // Get current username
  getCurrentUsername() {
    const authData = this.getAuthData();
    return authData.isAuthenticated ? authData.username : null;
  }

  // Get current role
  getCurrentRole() {
    const authData = this.getAuthData();
    return authData.isAuthenticated ? authData.role : null;
  }
}

// Global auth manager instance
const authManager = new AuthManager();

// Auto-redirect if not authenticated (for protected pages)
function requireAuth(role = null) {
  return authManager.requireAuth(role);
}

// Check authentication on page load for protected pages
function checkAuthOnLoad(requiredRole = null) {
  document.addEventListener('DOMContentLoaded', function() {
    requireAuth(requiredRole);
  });
}