const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
let index = 0;
let autoSlideInterval;

// Only run hamburger menu if elements exist (on pages that have them)
if (hamburger && navLinks) {
    // Hamburger menu toggle
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

// Only run slider if elements exist
if (slides.length > 0 && dots.length > 0) {
    function updateSlide(newIndex) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        slides[newIndex].classList.add('active');
        dots[newIndex].classList.add('active');
    }

    function showSlide() {
        index = (index + 1) % slides.length;
        updateSlide(index);
    }

    function goToSlide(newIndex) {
        index = newIndex;
        updateSlide(index);
        clearInterval(autoSlideInterval);
        autoSlideInterval = setInterval(showSlide, 3000);
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const newIndex = parseInt(dot.dataset.index);
            goToSlide(newIndex);
        });
    });

    autoSlideInterval = setInterval(showSlide, 3000);
} 


// Express API on Render
const API_ORIGIN = 'https://offishall-backend.onrender.com';

function getApiBase() {
    if (typeof window !== 'undefined' && window.API_URL) {
        return window.API_URL.replace(/\/$/, '');
    }
    return `${API_ORIGIN}/api`;
}
const API_BASE = getApiBase();

async function readJsonResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { error: text.slice(0, 120) || 'Invalid server response' };
    }
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

const USERS_STORAGE_KEY = 'offishall_users';
const OTP_TTL_MS = 10 * 60 * 1000;

function getUsersLocal() {
    try {
        return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveUsersLocal(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function goToDashboard() {
    window.location.replace('dashboard.html');
}

function goToVerification() {
    window.location.replace('verification.html');
}

function setSessionUser(username, email) {
    if (username) localStorage.setItem('currentUsername', username);
    if (email) localStorage.setItem('currentEmail', email);
}

function prepareSignupPending(username, email, password, otp) {
    const code = otp || generateOTP();
    const users = getUsersLocal();
    users[email] = {
        username,
        password,
        verified: false,
        otp: code,
        otpExpiresAt: Date.now() + OTP_TTL_MS
    };
    saveUsersLocal(users);
    localStorage.setItem('pendingEmail', email);
    localStorage.setItem('pendingUsername', username);
    localStorage.setItem('prefillOtp', code);
    return code;
}

function signinLocal(email, password) {
    const user = getUsersLocal()[email];
    if (!user || user.password !== password) {
        return { ok: false, error: 'Invalid email or password' };
    }
    if (!user.verified) {
        return { ok: false, error: 'Account not verified. Complete verification first.' };
    }
    setSessionUser(user.username, email);
    return { ok: true, user: { username: user.username, email } };
}

// Utility function to show messages
function showMessage(message, isError = false) {
    const existingMsg = document.querySelector('.message');
    if (existingMsg) existingMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isError ? 'error' : 'success'}`;
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
        padding: 10px;
        margin: 10px 0;
        border-radius: 5px;
        color: white;
        background-color: ${isError ? '#dc3545' : '#28a745'};
        text-align: center;
        z-index: 1000;
    `;

    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(msgDiv, container.firstChild);
    } else {
        // Fallback: insert at body if container not found
        document.body.insertBefore(msgDiv, document.body.firstChild);
    }

    setTimeout(() => msgDiv.remove(), 5000);
}

// Signup form handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const email = normalizeEmail(document.getElementById('email').value);
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!username || !email || !password || !confirmPassword) {
            showMessage('All fields are required', true);
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Passwords do not match', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await readJsonResponse(response);

            if (response.ok) {
                prepareSignupPending(username, email, password, data.testOtp);
                showMessage('✓ Verification code sent. Redirecting…');
                setTimeout(goToVerification, 400);
                return;
            }
            showMessage(data.error || 'Signup failed', true);
        } catch (error) {
            prepareSignupPending(username, email, password);
            showMessage('✓ Account created. Redirecting to verify…');
            setTimeout(goToVerification, 400);
        }
    });
}

// Signin form handler
const signinForm = document.getElementById('signinForm');
if (signinForm) {
    signinForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = normalizeEmail(document.getElementById('email').value);
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE}/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await readJsonResponse(response);

            if (response.ok) {
                const users = getUsersLocal();
                const apiUser = data.user || {};
                users[email] = {
                    username: apiUser.username || email.split('@')[0],
                    password,
                    verified: true
                };
                saveUsersLocal(users);
                setSessionUser(apiUser.username || users[email].username, email);
                showMessage('Sign in successful!');
                setTimeout(goToDashboard, 400);
                return;
            }

            const localResult = signinLocal(email, password);
            if (localResult.ok) {
                showMessage('Sign in successful!');
                setTimeout(goToDashboard, 400);
                return;
            }
            showMessage(data.error || localResult.error || 'Sign in failed', true);
        } catch (error) {
            const localResult = signinLocal(email, password);
            if (localResult.ok) {
                showMessage('Sign in successful!');
                setTimeout(goToDashboard, 400);
                return;
            }
            showMessage(localResult.error || 'Sign in failed. Sign up first if you are new.', true);
        }
    });
}

// Verification form handler
const verificationForm = document.getElementById('verificationForm');
if (verificationForm) {
    const codeInput = document.getElementById('codeInput');

    if (codeInput) {
        const prefill = localStorage.getItem('prefillOtp');
        if (prefill) {
            codeInput.value = prefill;
            localStorage.removeItem('prefillOtp');
        }
    }

    (async () => {
        if (!codeInput || codeInput.value.trim()) return;
        const email = localStorage.getItem('pendingEmail');
        if (!email) return;
        try {
            const resp = await fetch(
                `${API_BASE}/dev/otp?email=${encodeURIComponent(normalizeEmail(email))}`
            );
            if (!resp.ok) return;
            const data = await readJsonResponse(resp);
            if (data.otp) codeInput.value = String(data.otp);
        } catch (_) {}
    })();

    verificationForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = normalizeEmail(localStorage.getItem('pendingEmail'));
        const otp = codeInput ? codeInput.value.trim() : '';

        if (!email) {
            showMessage('No email found. Please sign up again.', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await readJsonResponse(response);

            if (response.ok) {
                const users = getUsersLocal();
                const u = users[email];
                if (u) {
                    u.verified = true;
                    delete u.otp;
                    delete u.otpExpiresAt;
                    users[email] = u;
                    saveUsersLocal(users);
                    setSessionUser(u.username || localStorage.getItem('pendingUsername'), email);
                } else {
                    setSessionUser(localStorage.getItem('pendingUsername'), email);
                }
                localStorage.removeItem('pendingEmail');
                localStorage.removeItem('pendingUsername');
                localStorage.removeItem('prefillOtp');
                showMessage('Account verified successfully!');
                setTimeout(goToDashboard, 400);
                return;
            }

            const users = getUsersLocal();
            const user = users[email];
            if (user?.otp === otp && Date.now() <= (user.otpExpiresAt || 0)) {
                user.verified = true;
                delete user.otp;
                delete user.otpExpiresAt;
                users[email] = user;
                saveUsersLocal(users);
                setSessionUser(user.username, email);
                localStorage.removeItem('pendingEmail');
                localStorage.removeItem('pendingUsername');
                localStorage.removeItem('prefillOtp');
                showMessage('Account verified successfully!');
                setTimeout(goToDashboard, 400);
                return;
            }
            showMessage(data.error || 'Verification failed', true);
        } catch (error) {
            const users = getUsersLocal();
            const user = users[email];
            if (user?.otp === otp && Date.now() <= (user.otpExpiresAt || 0)) {
                user.verified = true;
                delete user.otp;
                delete user.otpExpiresAt;
                users[email] = user;
                saveUsersLocal(users);
                setSessionUser(user.username, email);
                localStorage.removeItem('pendingEmail');
                localStorage.removeItem('pendingUsername');
                localStorage.removeItem('prefillOtp');
                showMessage('Account verified successfully!');
                setTimeout(goToDashboard, 400);
                return;
            }
            showMessage('Verification failed. Check your code and try again.', true);
        }
    });
}

// Dashboard username reflection
const usernameNav = document.getElementById('usernameNav');
const usernameWelcome = document.getElementById('usernameWelcome');
if (usernameNav || usernameWelcome) {
    const name =
        localStorage.getItem('currentUsername') ||
        localStorage.getItem('pendingUsername') ||
        'User';

    if (usernameNav) usernameNav.textContent = name;
    if (usernameWelcome) usernameWelcome.textContent = name;
}

// Toggle password visibility
function togglepassword(event) {
    // Get the clicked element
    const toggleBtn = event ? event.target.closest('.toggle') : null;
    let passwordInput, eyeIcon;

    if (toggleBtn) {
        // If called from onclick, find the associated password input
        const container = toggleBtn.closest('.password-container');
        passwordInput = container.querySelector('input[type="password"], input[type="text"]');
        eyeIcon = toggleBtn.querySelector('i');
    } else {
        // Fallback for general usage
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        const eyes = document.querySelectorAll('#togglePassword');

        passwordInputs.forEach((password, index) => {
            const eye = eyes[index];
            if (password && eye) {
                if (password.type === 'password') {
                    password.type = 'text';
                    eye.classList.remove('fa-eye');
                    eye.classList.add('fa-eye-slash');
                } else {
                    password.type = 'password';
                    eye.classList.remove('fa-eye-slash');
                    eye.classList.add('fa-eye');
                }
            }
        });
        return;
    }

    // Toggle the specific password field
    if (passwordInput && eyeIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    }
}

// Navigation handlers
const signinBtn = document.getElementById('signinBtn');
if (signinBtn) {
    signinBtn.addEventListener('click', () => {
        window.location.href = 'signin.html';
    });
}

const signupBtn = document.getElementById('signupBtn');
if (signupBtn) {
    signupBtn.addEventListener('click', () => {
        window.location.href = 'signup.html';
    });
}

const verifyBtn = document.getElementById('verifyBtn');
if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
        window.location.href = 'verification.html';
    });
}

// Cart functionality
let cartCount = 0;
let cartItems = []; // Store cart items with details

function addToCart(button) {
    // Get product details from the card
    const card = button.closest('.card');
    if (card) {
        const productName = card.querySelector('h3').textContent;
        const productPrice = card.querySelector('.price').textContent;
        const productId = Math.random().toString(36).substr(2, 9); // Generate unique ID for each item
        
        // Add item to cart array
        cartItems.push({
            id: productId,
            name: productName,
            price: productPrice,
            image: card.querySelector('img').src
        });
        
        // Increment cart count
        cartCount++;
        
        // Update cart count display in header
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.textContent = cartCount;
        }
        
        // Show success message
        showMessage(`${productName} added to cart!`);
        
        // Add visual feedback to button
        button.style.backgroundColor = '#28a745';
        button.style.color = 'white';
        setTimeout(() => {
            button.style.backgroundColor = '';
            button.style.color = '';
        }, 500);
    }
}

// Open cart modal
function openCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.style.display = 'flex';
        updateCartDisplay();
    }
}

// Close cart modal
function closeCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Update cart items display in modal
function updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cartItems');
    if (!cartItemsContainer) return;
    
    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        return;
    }
    
    let cartHTML = '';
    cartItems.forEach((item, index) => {
        cartHTML += `
            <div class="cart-item">
                <div class="item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="item-details">
                    <h4>${item.name}</h4>
                    <p class="item-price">${item.price}</p>
                </div>
                <button class="btn-remove" onclick="removeFromCart(${index})">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = cartHTML;
}

// Remove item from cart
function removeFromCart(index) {
    if (index >= 0 && index < cartItems.length) {
        const removedItem = cartItems[index];
        cartItems.splice(index, 1);
        
        // Update cart count
        cartCount--;
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.textContent = cartCount;
        }
        
        // Update cart display
        updateCartDisplay();
        
        // Show message
        showMessage(`${removedItem.name} removed from cart`, false);
    }
}

// Cart icon click handler
const cartIcon = document.getElementById('cartIcon');
if (cartIcon) {
    cartIcon.addEventListener('click', openCartModal);
}

// Close modal when clicking outside the modal content
const modal = document.getElementById('cartModal');
if (modal) {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeCartModal();
        }
    });
}