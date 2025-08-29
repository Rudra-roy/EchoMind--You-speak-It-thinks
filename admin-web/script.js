// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';

// Global variables
let authToken = null;
let currentUsers = [];
let currentFilter = '';
let currentSearch = '';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginSpinner = document.getElementById('loginSpinner');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const adminName = document.getElementById('adminName');

// Stats elements
const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const onlineUsers = document.getElementById('onlineUsers');
const totalConversations = document.getElementById('totalConversations');
const recentUsers = document.getElementById('recentUsers');

// User management elements
const searchUsers = document.getElementById('searchUsers');
const usersTableBody = document.getElementById('usersTableBody');
const refreshUsers = document.getElementById('refreshUsers');
const addUserBtn = document.getElementById('addUserBtn');
const addUserModal = document.getElementById('addUserModal');
const addUserForm = document.getElementById('addUserForm');
const closeModal = document.getElementById('closeModal');
const cancelAddUser = document.getElementById('cancelAddUser');
const loadingOverlay = document.getElementById('loadingOverlay');

// Utility Functions
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

function hideError(element) {
    element.classList.add('hidden');
}

function showLoading(show = true) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// API Functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        ...options
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw new Error('Network error occurred');
    }
}

// Authentication Functions
async function login(email, password) {
    return await apiCall('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

async function getDashboardStats() {
    return await apiCall('/admin/dashboard');
}

async function getUsers(search = '', status = '') {
    let endpoint = '/admin/users?limit=50';
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (status) endpoint += `&status=${status}`;
    
    return await apiCall(endpoint);
}

async function addUser(userData) {
    return await apiCall('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
}

async function deleteUser(userId) {
    return await apiCall(`/admin/users/${userId}`, {
        method: 'DELETE'
    });
}

async function toggleUserStatus(userId) {
    return await apiCall(`/admin/users/${userId}/toggle-status`, {
        method: 'PUT'
    });
}

// UI Functions
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboardScreen() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}

function updateStats(stats) {
    totalUsers.textContent = stats.totalUsers;
    activeUsers.textContent = stats.activeUsers;
    onlineUsers.textContent = stats.onlineUsers || 0;
    totalConversations.textContent = stats.totalConversations;
    recentUsers.textContent = stats.recentUsers;
}

function renderUsers(users) {
    if (users.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">No users found</td>
            </tr>
        `;
        return;
    }

    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                    ${user.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <span class="online-status ${user.isCurrentlyOnline ? 'online' : 'offline'}">
                    <span class="status-dot"></span>
                    ${user.isCurrentlyOnline ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <div class="user-actions">
                    <button class="btn btn-warning" onclick="toggleStatus('${user._id}', ${user.isActive})">
                        ${user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    ${user.role !== 'admin' ? `
                        <button class="btn btn-danger" onclick="confirmDeleteUser('${user._id}', '${user.name}')">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Event Handlers
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginBtn.disabled = true;
    loginBtnText.textContent = 'Logging in...';
    loginSpinner.classList.remove('hidden');
    hideError(loginError);
    
    try {
        const result = await login(email, password);
        
        if (result.success) {
            authToken = result.token;
            adminName.textContent = result.user.name;
            
            showDashboardScreen();
            await loadDashboard();
        } else {
            showError(loginError, result.message || 'Login failed');
        }
    } catch (error) {
        showError(loginError, error.message);
    } finally {
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Login';
        loginSpinner.classList.add('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUsers = [];
    showLoginScreen();
});

searchUsers.addEventListener('input', debounce(async (e) => {
    currentSearch = e.target.value;
    await loadUsers();
}, 300));

refreshUsers.addEventListener('click', loadUsers);

addUserBtn.addEventListener('click', () => {
    addUserModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
    addUserModal.classList.add('hidden');
});

cancelAddUser.addEventListener('click', () => {
    addUserModal.classList.add('hidden');
});

addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        name: formData.get('userName') || document.getElementById('userName').value,
        email: formData.get('userEmail') || document.getElementById('userEmail').value,
        password: formData.get('userPassword') || document.getElementById('userPassword').value,
        role: formData.get('userRole') || 'user'
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = document.getElementById('addUserBtnText');
    const spinner = document.getElementById('addUserSpinner');
    const errorDiv = document.getElementById('addUserError');
    
    submitBtn.disabled = true;
    btnText.textContent = 'Creating...';
    spinner.classList.remove('hidden');
    hideError(errorDiv);
    
    try {
        const result = await addUser(userData);
        
        if (result.success) {
            addUserModal.classList.add('hidden');
            addUserForm.reset();
            await loadUsers();
            alert('User created successfully!');
        } else {
            showError(errorDiv, result.message || 'Failed to create user');
        }
    } catch (error) {
        showError(errorDiv, error.message);
    } finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Create User';
        spinner.classList.add('hidden');
    }
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        // Remove active class from all buttons
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        
        currentFilter = e.target.dataset.status;
        await loadUsers();
    });
});

// Global functions for inline event handlers
window.toggleStatus = async function(userId, isActive) {
    const action = isActive ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
        showLoading();
        try {
            const result = await toggleUserStatus(userId);
            if (result.success) {
                await loadUsers();
                alert(result.message);
            } else {
                alert(result.message || 'Failed to update user status');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            showLoading(false);
        }
    }
};

window.confirmDeleteUser = async function(userId, userName) {
    if (confirm(`Are you sure you want to delete "${userName}"? This action cannot be undone and will delete all their conversations and messages.`)) {
        showLoading();
        try {
            const result = await deleteUser(userId);
            if (result.success) {
                await loadUsers();
                alert('User deleted successfully');
            } else {
                alert(result.message || 'Failed to delete user');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            showLoading(false);
        }
    }
};

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load functions
async function loadDashboard() {
    try {
        const statsResult = await getDashboardStats();
        if (statsResult.success) {
            updateStats(statsResult.stats);
        }
        
        await loadUsers();
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        alert('Failed to load dashboard data');
    }
}

async function loadUsers() {
    try {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-cell">Loading users...</td>
            </tr>
        `;
        
        const result = await getUsers(currentSearch, currentFilter);
        if (result.success) {
            currentUsers = result.users;
            renderUsers(currentUsers);
        } else {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-cell">Failed to load users</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-cell">Error loading users</td>
            </tr>
        `;
    }
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === addUserModal) {
        addUserModal.classList.add('hidden');
    }
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    showLoginScreen();
});
