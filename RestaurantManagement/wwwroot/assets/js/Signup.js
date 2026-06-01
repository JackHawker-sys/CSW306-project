const signupForm = document.getElementById('signupForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const signupBtn = document.getElementById('signupBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');

// Activation form elements
const activationForm = document.getElementById('activationForm');
const activateFormElement = document.getElementById('activateCodeForm');
const activationErrorMessage = document.getElementById('activationErrorMessage');
const activationSuccessMessage = document.getElementById('activationSuccessMessage');
const activateBtn = document.getElementById('activateBtn');
const activationSpinner = document.getElementById('activationSpinner');
const activateBtnText = document.getElementById('activateBtnText');
const activationCodeInput = document.getElementById('activationCode');
const resendCodeBtn = document.getElementById('resendCodeBtn');
const loginLink = document.getElementById('loginLink');

// Request new code form elements
const requestNewCodeForm = document.getElementById('requestNewCodeForm');
const newCodeForm = document.getElementById('newCodeForm');
const requestCodeErrorMessage = document.getElementById('requestCodeErrorMessage');
const requestCodeSuccessMessage = document.getElementById('requestCodeSuccessMessage');
const requestCodeBtn = document.getElementById('requestCodeBtn');
const requestCodeSpinner = document.getElementById('requestCodeSpinner');
const requestCodeBtnText = document.getElementById('requestCodeBtnText');
const requestCodeUsername = document.getElementById('requestCodeUsername');
const requestCodePassword = document.getElementById('requestCodePassword');
const backToActivationBtn = document.getElementById('backToActivationBtn');

// API endpoint configuration (change the URL to match your backend server)
const API_URL = 'https://localhost:7037/api/user/register'; // Change this URL if needed
const ACTIVATE_API_URL = 'https://localhost:7037/api/user/activate'; // Activation API endpoint
const GET_NEW_CODE_API_URL = 'https://localhost:7037/api/user/new-active-code'; // Request new code API endpoint

let registeredUserEmail = ''; // Store email for activation
let registeredUsername = ''; // Store username for requesting new code
let currentActivationCode = ''; // Store current activation code

signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Client-side validation
    if (!username || !fullname || !email || !phone || !password || !confirmPassword) {
        errorMessage.textContent = 'Please fill in all fields!';
        errorMessage.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        errorMessage.textContent = 'Password must be at least 6 characters!';
        errorMessage.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        errorMessage.textContent = 'Passwords do not match!';
        errorMessage.style.display = 'block';
        return;
    }

    // Prepare FormData for RegisterDto binding
    const formData = new FormData();
    formData.append('Username', username);
    formData.append('Fullname', fullname);
    formData.append('Email', email);
    formData.append('Phone', phone);
    formData.append('PasswordHash', password);

    // Show loading spinner
    signupBtn.disabled = true;
    spinner.classList.add('show');
    btnText.textContent = 'Processing...';

    try {
        // Send request to API
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
            credentials: 'include' // Send cookies if available
        });

        const result = await response.json();

        if (response.ok) {
            // Registration successful
            successMessage.style.display = 'none';
            errorMessage.style.display = 'none';

            // Debug output
            console.log('Register Data:', { username, fullname, email, phone });
            console.log('Server Response:', result);
            console.log('Activation Code:', result.activeCode);

            // Store data for activation
            registeredUserEmail = email;
            registeredUsername = username;
            currentActivationCode = result.activeCode;

            // Hide signup form and show activation form after 1 second
            setTimeout(() => {
                signupForm.style.display = 'none';
                loginLink.style.display = 'none';
                activationForm.style.display = 'block';

                // Show activation code display
                showActivationCodeDisplay(currentActivationCode);
            }, 1000);
        } else {
            // Registration failed
            errorMessage.textContent = result.message || 'Registration failed! Please try again.';
            errorMessage.style.display = 'block';
            console.error('Register failed:', result);
        }
    } catch (error) {
        // Request error
        errorMessage.textContent = 'Connection error: ' + error.message;
        errorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading spinner
        signupBtn.disabled = false;
        spinner.classList.remove('show');
        btnText.textContent = 'Create Account';
    }
});

// Function to display activation code
function showActivationCodeDisplay(code) {
    // Show the success message at top with the code
    activationSuccessMessage.innerHTML = `✓ Account created successfully, activateCode: <strong>${code}</strong>`;
    activationSuccessMessage.style.display = 'block';
    activationErrorMessage.style.display = 'none';

    // Show the activation code input form
    activateFormElement.style.display = 'block';
}

// Handle activation form submission
activateFormElement.addEventListener('submit', async function (e) {
    e.preventDefault();

    const activationCode = activationCodeInput.value.trim();

    activationErrorMessage.style.display = 'none';

    // Client-side validation
    if (!activationCode) {
        activationErrorMessage.textContent = 'Please enter the activation code!';
        activationErrorMessage.style.display = 'block';
        return;
    }

    // Show loading spinner
    activateBtn.disabled = true;
    activationSpinner.classList.add('show');
    activateBtnText.textContent = 'Activating...';

    try {
        // Send activation request
        const response = await fetch(ACTIVATE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                activeCode: activationCode,
                email: registeredUserEmail
            }),
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            // Activation successful
            activationErrorMessage.style.display = 'none';
            activationSuccessMessage.innerHTML = `✓ ${result.message || 'Account activated successfully!'}`;
            activationSuccessMessage.style.display = 'block';

            console.log('Activation Response:', result);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            // Activation failed
            activationErrorMessage.textContent = result.message || 'Activation failed! Please try again.';
            activationErrorMessage.style.display = 'block';
            console.error('Activation failed:', result);
        }
    } catch (error) {
        // Request error
        activationErrorMessage.textContent = 'Connection error: ' + error.message;
        activationErrorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading spinner
        activateBtn.disabled = false;
        activationSpinner.classList.remove('show');
        activateBtnText.textContent = 'Activate Account';
    }
});

// Handle resend code button click
resendCodeBtn.addEventListener('click', async function (e) {
    e.preventDefault();

    // Clear messages
    activationErrorMessage.style.display = 'none';
    requestCodeErrorMessage.style.display = 'none';
    requestCodeSuccessMessage.style.display = 'none';

    // Hide activation form and show request new code form
    activationForm.style.display = 'none';
    requestNewCodeForm.style.display = 'block';
    requestCodeUsername.focus();
});

// Handle back to activation button
backToActivationBtn.addEventListener('click', function (e) {
    e.preventDefault();

    // Clear messages
    requestCodeErrorMessage.style.display = 'none';
    requestCodeSuccessMessage.style.display = 'none';

    // Hide request new code form and show activation form
    requestNewCodeForm.style.display = 'none';
    activationForm.style.display = 'block';
    activationCodeInput.focus();
});

// Handle request new code form submission
newCodeForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = requestCodeUsername.value.trim();
    const password = requestCodePassword.value;

    requestCodeErrorMessage.style.display = 'none';
    requestCodeSuccessMessage.style.display = 'none';

    // Client-side validation
    if (!username || !password) {
        requestCodeErrorMessage.textContent = 'Please fill in all fields!';
        requestCodeErrorMessage.style.display = 'block';
        return;
    }

    // Show loading spinner
    requestCodeBtn.disabled = true;
    requestCodeSpinner.classList.add('show');
    requestCodeBtnText.textContent = 'Sending...';

    try {
        // Send request to get new activation code
        const response = await fetch(GET_NEW_CODE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            }),
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            // New code received
            console.log('New Code Response:', result);
            console.log('New Activation Code:', result.activeCode);

            // Update current code
            currentActivationCode = result.activeCode;
            registeredUsername = username;

            // Show success message with new code
            requestCodeSuccessMessage.innerHTML = `✓ New activation code sent: <strong>${result.activeCode}</strong>`;
            requestCodeSuccessMessage.style.display = 'block';

            // Auto-switch back to activation form after 3 seconds
            setTimeout(() => {
                requestNewCodeForm.style.display = 'none';
                activationForm.style.display = 'block';
                showActivationCodeDisplay(currentActivationCode);
                activationCodeInput.focus();
            }, 3000);
        } else {
            // Request failed
            requestCodeErrorMessage.textContent = result.message || 'Failed to get new code. Please try again.';
            requestCodeErrorMessage.style.display = 'block';
            console.error('Request new code failed:', result);
        }
    } catch (error) {
        // Request error
        requestCodeErrorMessage.textContent = 'Connection error: ' + error.message;
        requestCodeErrorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading spinner
        requestCodeBtn.disabled = false;
        requestCodeSpinner.classList.remove('show');
        requestCodeBtnText.textContent = 'Send New Code';
    }
});
