const API_BASE = 'https://localhost:7037/api';

// Chưa login thì về trang login
const token = localStorage.getItem('authToken');
if (!token) {
    window.location.href = 'login.html';
}

// Nav: inject Login/Logout
const profileNavItem = document.querySelector('.primary-menu > ul > li.page');
if (!token) {
    if (profileNavItem) profileNavItem.style.display = 'none';
    document.querySelector('.primary-menu ul').insertAdjacentHTML('beforeend', `<li><a href="login.html">Login</a></li>`);
} else {
    document.querySelector('.primary-menu ul').insertAdjacentHTML('beforeend', `<li><a href="#" id="logout-btn">Logout</a></li>`);
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    });
}

// Hamburger menu
const openMenu = document.querySelector('#hamburger');
const closeMenu = document.querySelector('#close-btn');
const primaryMenu = document.querySelector('#primary-menu');
const overlay = document.querySelector('#overlay');

openMenu.addEventListener('click', function () {
    primaryMenu.classList.add('active');
    closeMenu.style.display = 'block';
    overlay.style.display = 'block';
});
closeMenu.addEventListener('click', function () {
    primaryMenu.classList.remove('active');
    closeMenu.style.display = 'none';
    overlay.style.display = 'none';
});

// Go top button
(function () {
    const btn = document.getElementById('goTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('show', window.scrollY > 120);
    }, { passive: true });
})();

// Footer email validate
document.querySelector('#footer-btn').addEventListener('click', function () {
    const FEmail = document.querySelector('#footer-email');
    const FEmailE = document.querySelector('#f-email-error');
    FEmailE.innerText = FEmail.value ? '' : '*Email must be filled!';
});

// Load profile
async function loadProfile() {
    const card = document.getElementById('profileCard');

    try {
        console.log('[Profile] token:', token);
        console.log('[Profile] calling:', `${API_BASE}/User/me`);

        const res = await fetch(`${API_BASE}/User/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('[Profile] status:', res.status);

        // Log raw text trước để debug
        const text = await res.text();
        console.log('[Profile] raw response:', text);

        if (res.status === 401) {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

        const user = JSON.parse(text);
        console.log('[Profile] user:', user);
        renderProfile(card, user);

    } catch (err) {
        console.error('[Profile] error:', err);
        card.innerHTML = `
            <div class="profile-error">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Cannot load profile. Please try again later.</p>
                <small style="color:#888">${err.message}</small>
            </div>
        `;
    }
}

function renderProfile(card, user) {
    card.innerHTML = `
        <div class="profile-card-header">
            <div class="profile-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
            <h2>${user.fullName ?? '—'}</h2>
            <p>User ID: #${user.userId}</p>
        </div>
        <div class="profile-card-body">
            <div class="profile-field">
                <div class="profile-field-icon">
                    <i class="fa-solid fa-user"></i>
                </div>
                <div class="profile-field-info">
                    <label>Full Name</label>
                    <span>${user.fullName ?? '—'}</span>
                </div>
            </div>
            <div class="profile-field">
                <div class="profile-field-icon">
                    <i class="fa-solid fa-envelope"></i>
                </div>
                <div class="profile-field-info">
                    <label>Email</label>
                    <span>${user.email ?? '—'}</span>
                </div>
            </div>
            <div class="profile-field">
                <div class="profile-field-icon">
                    <i class="fa-solid fa-phone"></i>
                </div>
                <div class="profile-field-info">
                    <label>Phone</label>
                    <span>${user.phone ?? '—'}</span>
                </div>
            </div>
            <div class="profile-field">
                <div class="profile-field-icon">
                    <i class="fa-solid fa-shield"></i>
                </div>
                <div class="profile-field-info">
                    <label>Role</label>
                    <span class="badge-role">${user.role ?? '—'}</span>
                </div>
            </div>
        </div>
    `;
}

loadProfile();