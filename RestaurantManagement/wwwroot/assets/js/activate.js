const activateForm = document.getElementById('activateForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const activateBtn = document.getElementById('activateBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');
const emailInput = document.getElementById('email');
const activationCodeInput = document.getElementById('activationCode');
const resendBtn = document.getElementById('resendBtn');

// API endpoint configuration
const ACTIVATE_API_URL = 'https://localhost:7037/api/user/activate';
const RESEND_VERIFICATION_API_URL = 'https://localhost:7037/api/auth/send-verification';

activateForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const activationCode = activationCodeInput.value.trim();

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Client-side validation
    if (!email || !activationCode) {
        errorMessage.textContent = 'Please fill in all fields!';
        errorMessage.style.display = 'block';
        return;
    }

    // Show loading spinner
    activateBtn.disabled = true;
    spinner.classList.add('show');
    btnText.textContent = 'Activating...';

    try {
        // Send activation request
        const response = await fetch(ACTIVATE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                activeCode: activationCode
            }),
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            // Activation successful
            successMessage.textContent = `✓ ${result.message || 'Account activated successfully!'}`;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';

            console.log('Activation Response:', result);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            // Activation failed
            errorMessage.textContent = result.message || 'Activation failed! Please try again.';
            errorMessage.style.display = 'block';
            console.error('Activation failed:', result);
        }
    } catch (error) {
        // Request error
        errorMessage.textContent = 'Connection error: ' + error.message;
        errorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Hide loading spinner
        activateBtn.disabled = false;
        spinner.classList.remove('show');
        btnText.textContent = 'Activate Account';
    }
});

// Resend verification code handler
resendBtn.addEventListener('click', async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Validate email input
    if (!email) {
        errorMessage.textContent = 'Please enter your email address!';
        errorMessage.style.display = 'block';
        return;
    }

    // Change to loading state
    resendBtn.disabled = true;
    const originalText = resendBtn.textContent;
    resendBtn.textContent = 'Sending...';

    try {
        // Send resend verification code request
        const response = await fetch(RESEND_VERIFICATION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(email),
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            // Resend successful
            successMessage.textContent = `✓ ${result.message || 'Verification code resent successfully!'}`;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';

            console.log('Resend Response:', result);
        } else {
            // Resend failed
            errorMessage.textContent = result.message || 'Failed to resend verification code. Please try again.';
            errorMessage.style.display = 'block';
            console.error('Resend failed:', result);
        }
    } catch (error) {
        // Request error
        errorMessage.textContent = 'Connection error: ' + error.message;
        errorMessage.style.display = 'block';
        console.error('API Error:', error);
    } finally {
        // Restore button state
        resendBtn.disabled = false;
        resendBtn.textContent = originalText;
    }
});
