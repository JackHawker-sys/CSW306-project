const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const loginBtn = document.getElementById('loginBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');
const forgotLink = document.getElementById('forgot-link');


const forgotPasswordEmailForm = document.getElementById('forgotPasswordEmailForm');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const spinnerForgot = document.getElementById('spinnerForgot');
const btnTextForgot = document.getElementById('btnTextForgot');
const backBtn = document.getElementById('backBtn');
const headerSubtitle = document.getElementById('headerSubtitle');

// API endpoint configuration (change the URL to match your backend server)
const API_URL = 'https://localhost:7037/api/auth/login';
const EMAIL_VERIFICATION_API = 'https://localhost:7037/api/auth/email-verification';

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
            console.log('Login Response:', result);

            // Save token
            if (result.token) {
                localStorage.setItem('authToken', result.token);

                // Decode token to get role - CÁCH 1: Dùng hàm parseJwt
                const decodedToken = parseJwt(result.token);
                console.log('Decoded token:', decodedToken);

                // Tìm role trong token - có thể ở nhiều key khác nhau
                let role = null;
                if (decodedToken) {
                    // Thử các key có thể có
                    role = decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
                        || decodedToken['role']
                        || decodedToken['Role']
                        || decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'];
                }

                // CÁCH 2: Nếu API trả về role trực tiếp (ưu tiên hơn)
                if (result.role) {
                    role = result.role;
                    console.log('Role from response:', role);
                }

                console.log('Final role detected:', role);
                localStorage.setItem('userRole', role);

                // Lấy username từ token hoặc response
                let userName = username;
                if (decodedToken) {
                    userName = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                        || decodedToken['unique_name']
                        || decodedToken['name']
                        || username;
                }
                localStorage.setItem('adminName', userName);
                localStorage.setItem('currentUser', userName);

                // Show success message
                successMessage.textContent = '✓ Login successful! Redirecting...';
                successMessage.style.display = 'block';

                // Redirect based on role
                if (role === 'Admin') {
                    console.log('Redirecting to admin-dashboard.html');
                    setTimeout(() => {
                        window.location.href = 'admin-dashboard.html';
                    }, 1000);
                } else if (role === 'Chef') {
                    console.log('Redirecting to chef-orders.html');
                    setTimeout(() => {
                        window.location.href = 'chef-orders.html';
                    }, 1000);
                } else {
                    console.log('Redirecting to BDrestaurant.html (Customer)');
                    setTimeout(() => {
                        window.location.href = 'BDrestaurant.html';
                    }, 1000);
                }
            } else {
                console.error('No token in response');
                errorMessage.textContent = 'No token received from server!';
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    window.location.href = 'BDrestaurant.html';
                }, 1000);
            }
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

// Forgot password link handler
forgotLink.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    forgotPasswordEmailForm.style.display = 'block';
    headerSubtitle.textContent = 'Reset Your Password';
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
});

// Back to login button handler
backBtn.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'block';
    forgotPasswordEmailForm.style.display = 'none';
    headerSubtitle.textContent = 'Sign in to continue';
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    forgotPasswordEmailForm.reset();
});

// Forgot password email form submission
forgotPasswordEmailForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('forgotEmail').value.trim();

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Client-side validation
    if (!email) {
        errorMessage.textContent = 'Please enter your email address!';
        errorMessage.style.display = 'block';
        return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorMessage.textContent = 'Please enter a valid email address!';
        errorMessage.style.display = 'block';
        return;
    }

    // Show loading spinner
    sendCodeBtn.disabled = true;
    spinnerForgot.classList.add('show');
    btnTextForgot.textContent = 'Sending...';

    try {
        // Call email-verification API
        const response = await fetch(EMAIL_VERIFICATION_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(email)
        });

        const result = await response.text();

        if (response.ok) {
            // Success - store email in session storage and show success message
            sessionStorage.setItem('forgotPasswordEmail', email);

            successMessage.textContent = '✓ Verification code sent to your email! Redirecting...';
            successMessage.style.display = 'block';

            console.log('Email verification request successful:', email);

            // Redirect to changepassword page after 1 seconds
            setTimeout(() => {
                window.location.href = 'changepassword.html';
            }, 1000);
        } else {
            // Error response
            let errorText = result;
            try {
                const jsonResult = JSON.parse(result);
                errorText = jsonResult.message || result;
            } catch (e) {
                // If not JSON, use text as is
            }

            errorMessage.textContent = errorText || 'Failed to send verification code. Please try again!';
            errorMessage.style.display = 'block';
            console.error('Email verification failed:', result);
        }
    } catch (error) {
        // Request error
        errorMessage.textContent = 'Connection error: ' + error.message + '. Please try again!';
        errorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading spinner
        sendCodeBtn.disabled = false;
        spinnerForgot.classList.remove('show');
        btnTextForgot.textContent = 'Send Verification Code';
    }
});
