const login_button = document.getElementById("login-button");
const rememberLogin = document.getElementById("remember_me");
const form = document.getElementById("login-form");

// Check for existing token on page load
window.addEventListener('DOMContentLoaded', checkExistingToken);

// Proper event listener
login_button.addEventListener("click", function(e) {
  e.preventDefault();
  login();
});

form.addEventListener('submit', function(e) {
  e.preventDefault();
  login();
});

async function checkExistingToken() {
  const token = getStoredToken();
  if (token && isValidToken(token)) {
    // Redirect to dashboard if valid token exists
    window.location.href = '/App/home/home.html';
  }
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const rememberMe = rememberLogin?.checked || false;

  if (!username || !password) {
    showError('Per favore inserisci username e password');
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password,
        needToken: rememberMe,
      }),
    });

    const data = await response.json();

    if (response.ok && data.stato === 'login succesfull') {
      if (rememberMe && data.token) {
        saveToken(data.token, data.role, data.username);
      } else {
        // Store session token without persistence
        sessionStorage.setItem('sessionActive', 'true');
        sessionStorage.setItem('username', username);
        if (data.role) {
          sessionStorage.setItem('role', data.role);
        }
      }
      
      // Redirect based on role
      if (data.role === 'admin') {
        window.location.href = '/App/admin/admin.html';
      } else {
        window.location.href = '/App/home/home.html';
      }
    } else {
      showError(data.stato || 'Errore durante il login');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Errore di connessione. Riprova più tardi.');
  }
}

function saveToken(token, role, username) {
  const tokenData = {
    token: token,
    role: role,
    username: username,
    timestamp: Date.now()
  };
  
  localStorage.setItem('authToken', JSON.stringify(tokenData));
}

function getStoredToken() {
  const tokenData = localStorage.getItem('authToken');
  if (!tokenData) return null;
  
  try {
    return JSON.parse(tokenData);
  } catch (e) {
    localStorage.removeItem('authToken');
    return null;
  }
}

function isValidToken(tokenData) {
  if (!tokenData || !tokenData.token || !tokenData.timestamp) {
    return false;
  }
  
  // Check if token is older than 24 hours (JWT expiry)
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return (Date.now() - tokenData.timestamp) < twentyFourHours;
}

function showError(message) {
  // Create or update error message
  let errorDiv = document.getElementById('login-error');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'login-error';
    errorDiv.style.cssText = 'color: #dc3545; text-align: center; margin-top: 10px; font-size: 14px;';
    form.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorDiv) {
      errorDiv.textContent = '';
    }
  }, 5000);
}
