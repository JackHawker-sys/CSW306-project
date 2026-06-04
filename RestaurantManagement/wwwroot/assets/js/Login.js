const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const loginBtn = document.getElementById('loginBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');

// API endpoint configuration (ASP.NET Core backend)
const API_URL = 'https://localhost:7037/api/auth/login';

// Helper function to decode JWT token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('JWT decode error:', e);
        return null;
    }
}

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