const changePasswordForm = document.getElementById('changePasswordForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');
const emailInput = document.getElementById('email');

// API endpoint configuration (change the URL to match your backend server)
const FORGOT_PASSWORD_API = 'https://localhost:7037/api/auth/forgot-password';

// Initialize page with email from session storage
document.addEventListener('DOMContentLoaded', function() {
    const forgotEmail = sessionStorage.getItem('forgotPasswordEmail');

    if (forgotEmail) {
        emailInput.value = forgotEmail;
    } else {
        // If no email in session, show error and redirect
        errorMessage.textContent = 'No email found. Please start the forgot password process again.';
        errorMessage.style.display = 'block';
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    }
});

changePasswordForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const activeCode = document.getElementById('activeCode').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Client-side validation
    if (!email || !activeCode || !password || !confirmPassword) {
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

    // Show loading state
    changePasswordBtn.disabled = true;
    spinner.classList.add('show');
    btnText.textContent = 'Processing...';

    try {
        // Prepare request body
        const requestBody = {
            Email: email,
            ActiveCode: activeCode,
            Password: password,
            ConfirmPassword: confirmPassword
        };

        // Send request to API
        const response = await fetch(FORGOT_PASSWORD_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (response.ok) {
            // Password reset successful
            successMessage.textContent = '✓ ' + (result.message || 'Password has been reset successfully! Redirecting to login...');
            successMessage.style.display = 'block';

            console.log('Password reset successful:', result);

            // Clear session storage
            sessionStorage.removeItem('forgotPasswordEmail');

            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            // Password reset failed
            errorMessage.textContent = result.message || 'Failed to reset password. Please try again!';
            errorMessage.style.display = 'block';
            console.error('Password reset failed:', result);
        }
    } catch(error) {
        // Request error
        errorMessage.textContent = 'Connection error: ' + error.message + '. Please try again!';
        errorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading state
        changePasswordBtn.disabled = false;
        spinner.classList.remove('show');
        btnText.textContent = 'Reset Password';
    }
});
