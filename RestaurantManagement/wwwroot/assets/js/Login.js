const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const loginBtn = document.getElementById('loginBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');

// API endpoint configuration (ASP.NET Core backend)
const API_URL = 'https://localhost:44366/api/auth/login'; // Change to your backend URL if needed

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Client-side validation
    if (!username || !password) {
        errorMessage.textContent = 'Please fill in all fields!';
        errorMessage.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        errorMessage.textContent = 'Password must be at least 6 characters!';
        errorMessage.style.display = 'block';
        return;
    }

    // JSON body ([FromBody] LoginRequest expects Username and Password)
    const loginData = {
        Username: username,
        Password: password
    };

    // Show loading spinner
    loginBtn.disabled = true;
    spinner.classList.add('show');
    btnText.textContent = 'Processing...';

    try {
        // Send request to API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (response.ok) {
            // Login successful
            successMessage.textContent = '✓ Login successful! Redirecting...';
            successMessage.style.display = 'block';

            // Save token if available
            if (result.token) {
                localStorage.setItem('authToken', result.token);
            }

            // Save user info if available
            if (result.user) {
                localStorage.setItem('currentUser', JSON.stringify(result.user));
            }

            // Debug output
            console.log('Login Request:', loginData);
            console.log('Server Response:', result);

            // Redirect after 1 second
            setTimeout(() => {
                window.location.href = 'BDrestaurant.html';
            }, 1000);
        } else {
            // Login failed
            errorMessage.textContent = result.message || 'Incorrect username or password!';
            errorMessage.style.display = 'block';
            console.error('Login failed:', result);
        }
    } catch (error) {
        // Request error
        errorMessage.textContent = 'Connection error: ' + error.message + '. Please try again!';
        errorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading spinner
        loginBtn.disabled = false;
        spinner.classList.remove('show');
        btnText.textContent = 'Sign In';
    }
});