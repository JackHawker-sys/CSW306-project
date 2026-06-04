const signupForm = document.getElementById('signupForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const signupBtn = document.getElementById('signupBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');

// API endpoint configuration (change the URL to match your backend server)
const API_URL = 'https://localhost:7037/api/user/register'; // Change this URL if needed

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

    // Email validation - only @gmail.com or @eiu.edu.vn
    const validEmailDomains = ['@gmail.com', '@eiu.edu.vn'];
    const isValidEmail = validEmailDomains.some(domain => email.endsWith(domain));

    if (!isValidEmail) {
        errorMessage.textContent = 'Email must be @gmail.com or @eiu.edu.vn!';
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

            // Redirect to activation page after 1 second
            setTimeout(() => {
                window.location.href = 'activate.html';
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
