"use strict";
// Modern VolunteerHub Application with Real-time Features
var _a, _b, _c, _d, _e;
// Global variables
let currentUser = null;
let token = null;
let socket = null;
let currentSection = 'hero';
function normalizeEvent(event) {
    return {
        ...event,
        volunteers: (event.volunteers || []).filter(Boolean),
        pendingVolunteers: (event.pendingVolunteers || []).filter(Boolean)
    };
}
function normalizeEvents(events) {
    return events.map(normalizeEvent);
}
// DOM elements
const heroSection = document.getElementById('hero-section');
const eventsSection = document.getElementById('events-section');
const dashboardSection = document.getElementById('dashboard-section');
const adminSection = document.getElementById('admin-section');
// Navigation elements
const homeLink = document.getElementById('home-link');
const eventsLink = document.getElementById('events-link');
const dashboardLink = document.getElementById('dashboard-link');
const adminLink = document.getElementById('admin-link');
// User menu elements
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const userProfile = document.getElementById('user-profile');
const userName = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
// Modal elements
const modalOverlay = document.getElementById('modal-overlay');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const eventModal = document.getElementById('event-modal');
const createEventModal = document.getElementById('create-event-modal');
// Form elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const createEventForm = document.getElementById('create-event-form');
// Content containers
const eventsGrid = document.getElementById('events-grid');
const myEventsList = document.getElementById('my-events-list');
const adminContent = document.getElementById('admin-content');
// Filter and search elements
const filterTabs = document.querySelectorAll('.filter-tab');
const eventSearch = document.getElementById('event-search');
// Stats elements
const totalEventsStat = document.getElementById('total-events');
const totalVolunteersStat = document.getElementById('total-volunteers');
const totalOrganizationsStat = document.getElementById('total-organizations');
// Admin elements
const createEventButtons = document.querySelectorAll('#create-event-btn, #create-event-admin-btn');
const adminTabs = document.querySelectorAll('.admin-tab');
// Notifications container
const notificationsContainer = document.getElementById('notifications');
// API configuration
const API_BASE = 'http://localhost:5000/api';
// Initialize application
document.addEventListener('DOMContentLoaded', init);
// Event listeners
homeLink.addEventListener('click', () => showSection('hero'));
eventsLink.addEventListener('click', () => showSection('events'));
dashboardLink.addEventListener('click', () => showSection('dashboard'));
adminLink.addEventListener('click', () => showSection('admin'));
loginBtn.addEventListener('click', showLoginModal);
registerBtn.addEventListener('click', showRegisterModal);
logoutBtn.addEventListener('click', logout);
(_a = document.getElementById('explore-events-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => showSection('events'));
(_b = document.getElementById('become-organizer-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', showRegisterModal);
(_c = document.getElementById('browse-events-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => showSection('events'));
(_d = document.getElementById('view-dashboard-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => showSection('dashboard'));
(_e = document.getElementById('manage-events-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => showSection('admin'));
// Modal close handlers
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', hideModals);
});
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay)
        hideModals();
});
// Form handlers
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
createEventForm.addEventListener('submit', handleCreateEvent);
// Filter and search handlers
filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filterEvents(tab.dataset.filter || 'all');
    });
});
eventSearch.addEventListener('input', debounce(filterEventsBySearch, 300));
// Admin handlers
createEventButtons.forEach(button => {
    button.addEventListener('click', showCreateEventModal);
});
adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        adminTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        showAdminTab(tab.dataset.tab || 'events');
    });
});
// Initialize app
async function init() {
    // Hide loading screen after a short delay
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1500);
    // Check for existing token
    token = localStorage.getItem('token');
    if (token) {
        currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        updateUI();
        initializeSocket();
    }
    // Load initial data
    try {
        await loadStats();
    }
    catch (error) {
        console.error('Failed to load stats:', error);
    }
    try {
        await loadEvents();
    }
    catch (error) {
        console.error('Failed to load events:', error);
    }
    // Set up periodic updates
    setInterval(loadStats, 30000); // Update stats every 30 seconds
}
// Socket.IO initialization
function initializeSocket() {
    if (!window.io) {
        console.warn('Socket.IO client not available; continuing without real-time updates.');
        return;
    }
    socket = window.io('http://localhost:5000');
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    socket.on('event-created', (event) => {
        showNotification('success', 'New Event Created', `A new event "${event.title}" has been created!`);
        loadEvents();
        loadStats();
    });
    socket.on('event-updated', (event) => {
        showNotification('info', 'Event Updated', `Event "${event.title}" has been updated.`);
        loadEvents();
    });
    socket.on('event-deleted', (data) => {
        showNotification('warning', 'Event Removed', 'An event has been removed.');
        loadEvents();
        loadStats();
    });
    socket.on('volunteer-signed-up', (data) => {
        if (currentUser && data.volunteer._id !== currentUser._id) {
            showNotification('info', 'New Volunteer', `${data.volunteer.name} joined "${data.event.title}"`);
        }
        loadEvents();
        loadStats();
    });
    socket.on('volunteer-pending', (data) => {
        if ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) === 'admin') {
            showNotification('info', 'New Join Request', `${data.volunteer.name} requested to join "${data.event.title}"`);
        }
        loadEvents();
        loadStats();
        if (currentSection === 'admin')
            loadAdminPanel();
    });
    socket.on('volunteer-cancelled', (data) => {
        if (currentUser && data.volunteer._id !== currentUser._id) {
            showNotification('warning', 'Volunteer Withdrew', `${data.volunteer.name} left "${data.event.title}"`);
        }
        loadEvents();
        loadStats();
    });
}
// UI Navigation
function showSection(section) {
    if (section === 'dashboard' && !currentUser) {
        showLoginModal();
        return;
    }
    if (section === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
        showNotification('error', 'Access Denied', 'Admin access required');
        return;
    }
    currentSection = section;
    // Hide all sections
    heroSection.style.display = 'none';
    eventsSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    adminSection.style.display = 'none';
    // Update navigation
    [homeLink, eventsLink, dashboardLink, adminLink].forEach(link => {
        link.classList.remove('active');
    });
    // Show selected section
    switch (section) {
        case 'hero':
            heroSection.style.display = 'grid';
            homeLink.classList.add('active');
            break;
        case 'events':
            eventsSection.style.display = 'block';
            eventsLink.classList.add('active');
            loadEvents();
            break;
        case 'dashboard':
            dashboardSection.style.display = 'block';
            dashboardLink.classList.add('active');
            loadDashboard();
            break;
        case 'admin':
            adminSection.style.display = 'block';
            adminLink.classList.add('active');
            loadAdminPanel();
            break;
    }
}
// Modal functions
function showLoginModal() {
    hideModals();
    modalOverlay.style.display = 'flex';
    loginModal.style.display = 'block';
}
window.showLoginModal = showLoginModal;
function showRegisterModal() {
    hideModals();
    modalOverlay.style.display = 'flex';
    registerModal.style.display = 'block';
}
function showOrganizerProfileModal(organizer) {
    const events = window.currentEvents || [];
    const organizerEvents = events.filter((event) => event.createdBy._id === organizer._id);
    const totalVolunteers = organizerEvents.reduce((sum, event) => sum + event.volunteers.length, 0);
    const modalTitle = document.getElementById('event-modal-title');
    const modalBody = document.getElementById('event-modal-body');
    modalTitle.textContent = `${organizer.name}'s Profile`;
    modalBody.innerHTML = `
    <div class="organizer-profile-modal">
      <div class="profile-header">
        <div class="profile-avatar">
          <i class="fas fa-user-tie"></i>
        </div>
        <div class="profile-info">
          <h3>${organizer.name}</h3>
          <p class="profile-role">Event Organizer</p>
          <p class="profile-email">${organizer.email || 'Email unavailable'}</p>
        </div>
      </div>
      <div class="profile-stats">
        <div class="stat-card">
          <div class="stat-number">${organizerEvents.length}</div>
          <div class="stat-label">Events Created</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalVolunteers}</div>
          <div class="stat-label">Volunteers Helped</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${organizer.createdAt ? new Date(organizer.createdAt).getFullYear() : '2024'}</div>
          <div class="stat-label">Member Since</div>
        </div>
      </div>
      <div class="organizer-events">
        <h4>Recent Events by ${organizer.name}</h4>
        <div class="events-list">
          ${organizerEvents.slice(0, 5).map((event) => `
            <div class="event-item-compact">
              <div class="event-info">
                <h5>${event.title}</h5>
                <p>${formatDate(event.date)} - ${event.location}</p>
                <p>${event.volunteers.length}/${event.requiredVolunteers} volunteers</p>
              </div>
              <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">View</button>
            </div>
          `).join('')}
          ${organizerEvents.length === 0 ? '<p>No events created yet.</p>' : ''}
        </div>
      </div>
    </div>
  `;
    modalOverlay.style.display = 'flex';
    eventModal.style.display = 'block';
}
function showEventModal(event) {
    var _a, _b;
    const modalTitle = document.getElementById('event-modal-title');
    const modalBody = document.getElementById('event-modal-body');
    modalTitle.textContent = event.title;
    modalBody.innerHTML = `
    <div class="event-details-modal">
      <div class="event-meta">
        <div class="event-organizer-info">
          <i class="fas fa-user-tie"></i>
          <span>Organized by ${event.createdBy.name}</span>
        </div>
        <div class="event-date-time">
          <i class="fas fa-calendar"></i>
          <span>${formatDate(event.date)} at ${event.startTime} - ${event.endTime}</span>
        </div>
        <div class="event-location">
          <i class="fas fa-map-marker-alt"></i>
          <span>${event.location}</span>
        </div>
      </div>
      <div class="event-description-full">
        <h4>Description</h4>
        <p>${event.description || 'No description provided.'}</p>
      </div>
      <div class="event-volunteers-info">
        <h4>Volunteers Needed</h4>
        <p>${event.volunteers.length} / ${event.requiredVolunteers} volunteers confirmed</p>
        <div class="volunteers-list">
          ${event.volunteers.length > 0 ?
        event.volunteers.map(v => `<span class="volunteer-tag">${v.name}</span>`).join('') :
        '<span class="no-volunteers">No volunteers yet</span>'}
        </div>
        ${((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.length) ? `
          <h4>Pending Requests</h4>
          <div class="volunteers-list">
            ${event.pendingVolunteers.map(v => `<span class="volunteer-tag pending">${v.name}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      ${currentUser ? `
        <div class="event-actions-modal">
          ${currentUser.role === 'admin' ?
        '<span class="event-full">Admins manage requests from the Admin panel.</span>' :
        event.volunteers.some(v => v._id === currentUser._id) ?
            `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Participation</button>` :
            ((_b = event.pendingVolunteers) === null || _b === void 0 ? void 0 : _b.some(v => v._id === currentUser._id)) ?
                `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Request</button>` :
                event.volunteers.length < event.requiredVolunteers ?
                    `<button class="btn btn-primary" onclick="joinEvent('${event._id}')">Request to Join</button>` :
                    '<span class="event-full">Event is full</span>'}
        </div>
      ` : ''}
    </div>
  `;
    modalOverlay.style.display = 'flex';
    eventModal.style.display = 'block';
}
function showCreateEventModal() {
    hideModals();
    modalOverlay.style.display = 'flex';
    createEventModal.style.display = 'block';
}
function hideModals() {
    modalOverlay.style.display = 'none';
    [loginModal, registerModal, eventModal, createEventModal].forEach(modal => {
        modal.style.display = 'none';
    });
}
// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');
    const submitBtn = loginForm.querySelector('.btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.btn-spinner');
    // Show loading state
    submitBtn.disabled = true;
    btnText.textContent = 'Logging in...';
    spinner.style.display = 'block';
    try {
        const response = await apiRequest('/auth/login', 'POST', { email, password });
        token = response.token;
        currentUser = response.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateUI();
        initializeSocket();
        hideModals();
        showNotification('success', 'Welcome back!', `Hello ${currentUser.name}!`);
        showSection('dashboard');
    }
    catch (error) {
        showNotification('error', 'Login Failed', error.message || 'Invalid credentials');
    }
    finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Login';
        spinner.style.display = 'none';
    }
}
async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const role = formData.get('role');
    const submitBtn = registerForm.querySelector('.btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.btn-spinner');
    submitBtn.disabled = true;
    btnText.textContent = 'Creating account...';
    spinner.style.display = 'block';
    try {
        const response = await apiRequest('/auth/register', 'POST', {
            name, email, password, role
        });
        token = response.token;
        currentUser = response.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateUI();
        initializeSocket();
        hideModals();
        showNotification('success', 'Account Created!', `Welcome to VolunteerHub, ${currentUser.name}!`);
        showSection('dashboard');
    }
    catch (error) {
        showNotification('error', 'Registration Failed', error.message || 'Failed to create account');
    }
    finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Create Account';
        spinner.style.display = 'none';
    }
}
function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    updateUI();
    showSection('hero');
    showNotification('info', 'Logged Out', 'See you next time!');
}
// Event handlers
async function handleCreateEvent(e) {
    e.preventDefault();
    const formData = new FormData(createEventForm);
    const eventData = {
        title: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        startTime: formData.get('startTime'),
        endTime: formData.get('endTime'),
        location: formData.get('location'),
        requiredVolunteers: parseInt(formData.get('volunteers'))
    };
    const submitBtn = createEventForm.querySelector('.btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.btn-spinner');
    submitBtn.disabled = true;
    btnText.textContent = 'Creating event...';
    spinner.style.display = 'block';
    try {
        await apiRequest('/events', 'POST', eventData);
        hideModals();
        createEventForm.reset();
        showNotification('success', 'Event Created!', 'Your event has been created successfully.');
        loadEvents();
    }
    catch (error) {
        showNotification('error', 'Creation Failed', error.message || 'Failed to create event');
    }
    finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Create Event';
        spinner.style.display = 'none';
    }
}
// Global functions for onclick handlers
window.joinEvent = async (eventId) => {
    try {
        await apiRequest(`/volunteers/events/${eventId}/signup`, 'POST');
        showNotification('success', 'Request Sent', 'Your request is pending admin confirmation.');
        loadEvents();
        if (currentSection === 'dashboard')
            loadDashboard();
    }
    catch (error) {
        showNotification('error', 'Signup Failed', error.message || 'Failed to join event');
    }
};
window.cancelEvent = async (eventId) => {
    try {
        await apiRequest(`/volunteers/events/${eventId}/cancel`, 'POST');
        showNotification('warning', 'Cancelled', 'Your participation or pending request was cancelled.');
        loadEvents();
        if (currentSection === 'dashboard')
            loadDashboard();
    }
    catch (error) {
        showNotification('error', 'Cancellation Failed', error.message || 'Failed to cancel participation');
    }
};
window.confirmVolunteer = async (eventId, volunteerId) => {
    try {
        await apiRequest(`/events/${eventId}/confirm/${volunteerId}`, 'POST');
        showNotification('success', 'Volunteer Confirmed', 'The volunteer has been added to the event.');
        await loadEvents();
        if (currentSection === 'admin')
            loadAdminPanel();
    }
    catch (error) {
        showNotification('error', 'Confirm Failed', error.message || 'Failed to confirm volunteer');
    }
};
window.rejectVolunteer = async (eventId, volunteerId) => {
    try {
        await apiRequest(`/events/${eventId}/reject/${volunteerId}`, 'POST');
        showNotification('warning', 'Request Rejected', 'The pending request has been removed.');
        await loadEvents();
        if (currentSection === 'admin')
            loadAdminPanel();
    }
    catch (error) {
        showNotification('error', 'Reject Failed', error.message || 'Failed to reject volunteer');
    }
};
window.viewEvent = (eventId) => {
    var _a;
    const event = (_a = window.currentEvents) === null || _a === void 0 ? void 0 : _a.find((e) => e._id === eventId);
    if (event) {
        showEventModal(event);
    }
};
window.viewOrganizerProfile = async (organizerId) => {
    const events = window.currentEvents || [];
    const organizerEvent = events.find((event) => event.createdBy._id === organizerId);
    if (!organizerEvent) {
        showNotification('error', 'Profile Error', 'Could not find this organizer.');
        return;
    }
    showOrganizerProfileModal(organizerEvent.createdBy);
};
window.editEvent = (eventId) => {
    // TODO: Implement edit event functionality
    showNotification('info', 'Coming Soon', 'Edit event functionality will be available soon.');
};
window.deleteEvent = async (eventId) => {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            await apiRequest(`/events/${eventId}`, 'DELETE');
            showNotification('success', 'Event Deleted', 'The event has been deleted.');
            loadEvents();
        }
        catch (error) {
            showNotification('error', 'Deletion Failed', error.message || 'Failed to delete event');
        }
    }
};
// Data loading functions
async function loadStats() {
    try {
        const events = await apiRequest('/events', 'GET');
        const normalizedEvents = normalizeEvents(events);
        const uniqueOrgs = new Set(normalizedEvents.map((e) => e.createdBy._id)).size;
        const totalVolunteers = normalizedEvents.reduce((sum, event) => sum + event.volunteers.length, 0);
        totalEventsStat.textContent = events.length.toString();
        totalVolunteersStat.textContent = totalVolunteers.toString();
        totalOrganizationsStat.textContent = uniqueOrgs.toString();
        if (currentUser) {
            if (currentUser.role === 'admin') {
                const adminEvents = normalizedEvents.filter((event) => event.createdBy._id === currentUser._id);
                const adminVolunteersCount = adminEvents.reduce((sum, event) => sum + event.volunteers.length, 0);
                const adminPendingCount = adminEvents.reduce((sum, event) => { var _a; return sum + (((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0);
                const adminEventsCountEl = document.getElementById('admin-events-count');
                const adminVolunteersCountEl = document.getElementById('admin-volunteers-count');
                const adminParticipationCountEl = document.getElementById('admin-participation-count');
                if (adminEventsCountEl)
                    adminEventsCountEl.textContent = adminEvents.length.toString();
                if (adminVolunteersCountEl)
                    adminVolunteersCountEl.textContent = totalVolunteers.toString();
                if (adminParticipationCountEl)
                    adminParticipationCountEl.textContent = (adminVolunteersCount + adminPendingCount).toString();
            }
            else {
                const userEvents = normalizedEvents.filter((event) => event.volunteers.some(v => v._id === currentUser._id));
                const availableEvents = normalizedEvents.filter((event) => {
                    var _a;
                    return !event.volunteers.some(v => v._id === currentUser._id) &&
                        !((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.some(v => v._id === currentUser._id)) &&
                        event.volunteers.length < event.requiredVolunteers;
                });
                const volunteerEventsCountEl = document.getElementById('volunteer-events-count');
                const availableEventsCountEl = document.getElementById('available-events-count');
                const totalOrganizersCountEl = document.getElementById('total-organizers-count');
                if (volunteerEventsCountEl)
                    volunteerEventsCountEl.textContent = userEvents.length.toString();
                if (availableEventsCountEl)
                    availableEventsCountEl.textContent = availableEvents.length.toString();
                if (totalOrganizersCountEl)
                    totalOrganizersCountEl.textContent = uniqueOrgs.toString();
            }
        }
    }
    catch (error) {
        console.error('Failed to load stats:', error);
    }
}
async function loadEvents() {
    try {
        const events = await apiRequest('/events', 'GET');
        const normalizedEvents = normalizeEvents(events);
        window.currentEvents = normalizedEvents;
        renderEvents(normalizedEvents);
    }
    catch (error) {
        console.error('Failed to load events:', error);
        eventsGrid.innerHTML = '<p class="error">Failed to load events. Please try again.</p>';
    }
}
async function loadDashboard() {
    if (!currentUser)
        return;
    try {
        const events = await apiRequest('/volunteers/events', 'GET');
        const normalizedEvents = normalizeEvents(events);
        const myEvents = normalizedEvents.filter((event) => {
            var _a;
            return event.volunteers.some(v => v._id === currentUser._id) ||
                ((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.some(v => v._id === currentUser._id));
        });
        renderMyEvents(myEvents);
        // Update stats
        document.getElementById('events-participated').textContent = myEvents.length.toString();
        // TODO: Calculate actual hours and certificates
    }
    catch (error) {
        console.error('Failed to load dashboard:', error);
        myEventsList.innerHTML = '<p class="error">Failed to load your events.</p>';
    }
}
async function loadAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin')
        return;
    try {
        const [events, users] = await Promise.all([
            apiRequest('/events', 'GET'),
            apiRequest('/admin/users', 'GET')
        ]);
        const normalizedEvents = normalizeEvents(events);
        renderAdminEvents(normalizedEvents);
        window.adminUsers = users;
        window.adminEvents = normalizedEvents;
        window.currentEvents = normalizedEvents;
    }
    catch (error) {
        console.error('Failed to load admin data:', error);
        adminContent.innerHTML = '<p class="error">Failed to load admin data.</p>';
    }
}
// Rendering functions
function renderEvents(events) {
    eventsGrid.innerHTML = '';
    if (events.length === 0) {
        eventsGrid.innerHTML = `
      <div class="no-events">
        <i class="fas fa-calendar-times"></i>
        <h3>No events found</h3>
        <p>Check back later for new volunteer opportunities!</p>
      </div>
    `;
        return;
    }
    events.forEach(event => {
        var _a, _b;
        const isJoined = currentUser && event.volunteers.some(v => v._id === currentUser._id);
        const isPending = currentUser && ((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.some(v => v._id === currentUser._id));
        const isFull = event.volunteers.length >= event.requiredVolunteers;
        const canManage = currentUser && currentUser.role === 'admin';
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.innerHTML = `
      <div class="event-header">
        <h3 class="event-title">${event.title}</h3>
        <div class="event-organizer-badge">
          <i class="fas fa-user-tie"></i>
          <span class="organizer-label">Organized by</span>
          <span class="organizer-name" onclick="viewOrganizerProfile('${event.createdBy._id}')" style="cursor: pointer;">${event.createdBy.name}</span>
          <span class="organizer-role">Admin</span>
        </div>
      </div>
      <div class="event-body">
        <p class="event-description">${event.description || 'No description provided.'}</p>
        <div class="event-details">
          <div class="event-detail">
            <i class="fas fa-calendar"></i>
            <span>${formatDate(event.date)}</span>
          </div>
          <div class="event-detail">
            <i class="fas fa-clock"></i>
            <span>${event.startTime} - ${event.endTime}</span>
          </div>
          <div class="event-detail">
            <i class="fas fa-map-marker-alt"></i>
            <span>${event.location}</span>
          </div>
        </div>
        <div class="event-volunteers">
          <i class="fas fa-users"></i>
          <span class="volunteers-count">${event.volunteers.length}/${event.requiredVolunteers}</span>
          ${((_b = event.pendingVolunteers) === null || _b === void 0 ? void 0 : _b.length) ? `<span class="pending-count">${event.pendingVolunteers.length} pending</span>` : ''}
        </div>
      </div>
      <div class="event-footer">
        <div class="event-status ${isJoined ? 'joined' : isPending ? 'pending' : isFull ? 'full' : 'available'}">
          ${isJoined ? 'Joined' : isPending ? 'Pending' : isFull ? 'Full' : 'Available'}
        </div>
        <div class="event-actions">
          <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">
            <i class="fas fa-eye"></i>
          </button>
          ${currentUser ? (currentUser.role === 'admin' ?
            '' :
            isJoined ?
                `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel</button>` :
                isPending ?
                    `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Request</button>` :
                    !isFull ?
                        `<button class="btn btn-primary" onclick="joinEvent('${event._id}')">Request</button>` :
                        '') : `<button class="btn btn-primary" onclick="showLoginModal()">Login to Join</button>`}
          ${canManage ? `
            <button class="btn btn-ghost" onclick="editEvent('${event._id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-ghost" onclick="deleteEvent('${event._id}')">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
        eventsGrid.appendChild(eventCard);
    });
}
function renderMyEvents(events) {
    myEventsList.innerHTML = '';
    if (events.length === 0) {
        myEventsList.innerHTML = `
      <div class="no-events">
        <i class="fas fa-calendar-times"></i>
        <h3>No events joined yet</h3>
        <p>Browse available events and start volunteering!</p>
      </div>
    `;
        return;
    }
    events.forEach(event => {
        var _a;
        const isPending = (_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.some(v => v._id === currentUser._id);
        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';
        eventItem.innerHTML = `
      <div class="event-info">
        <h4>${event.title}</h4>
        <p>${formatDate(event.date)} - ${event.location}</p>
        <span class="event-status inline ${isPending ? 'pending' : 'joined'}">${isPending ? 'Pending approval' : 'Confirmed'}</span>
      </div>
      <div class="event-actions">
        <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">View</button>
        <button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">${isPending ? 'Cancel Request' : 'Cancel'}</button>
      </div>
    `;
        myEventsList.appendChild(eventItem);
    });
}
function renderAdminEvents(events) {
    const pendingTotal = events.reduce((sum, event) => { var _a; return sum + (((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0);
    const confirmedTotal = events.reduce((sum, event) => sum + event.volunteers.length, 0);
    const openSlots = events.reduce((sum, event) => sum + Math.max(event.requiredVolunteers - event.volunteers.length, 0), 0);
    adminContent.innerHTML = `
    <div class="admin-summary-grid">
      <div class="admin-summary-card">
        <span class="summary-label">Events</span>
        <strong>${events.length}</strong>
      </div>
      <div class="admin-summary-card">
        <span class="summary-label">Confirmed</span>
        <strong>${confirmedTotal}</strong>
      </div>
      <div class="admin-summary-card warning">
        <span class="summary-label">Pending</span>
        <strong>${pendingTotal}</strong>
      </div>
      <div class="admin-summary-card">
        <span class="summary-label">Open Slots</span>
        <strong>${openSlots}</strong>
      </div>
    </div>
    <div class="admin-events-table">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Location</th>
            <th>Volunteers</th>
            <th>Pending</th>
            <th>Organizer</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(event => {
        var _a;
        return `
            <tr>
              <td>
                <div class="admin-event-title">
                  <strong>${event.title}</strong>
                  <span>${event.description || 'No description'}</span>
                </div>
              </td>
              <td>
                <div class="admin-meta-cell">
                  <i class="fas fa-calendar"></i>
                  <span>${formatDate(event.date)}</span>
                </div>
              </td>
              <td>
                <div class="admin-meta-cell">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>${event.location}</span>
                </div>
              </td>
              <td><span class="volunteer-pill">${event.volunteers.length}/${event.requiredVolunteers}</span></td>
              <td>
                ${((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.length) ? `
                  <div class="pending-requests">
                    ${event.pendingVolunteers.map(volunteer => `
                      <div class="pending-request">
                        <span>${volunteer.name}</span>
                        <button class="btn btn-primary btn-mini" onclick="confirmVolunteer('${event._id}', '${volunteer._id}')">Confirm</button>
                        <button class="btn btn-secondary btn-mini" onclick="rejectVolunteer('${event._id}', '${volunteer._id}')">Reject</button>
                      </div>
                    `).join('')}
                  </div>
                ` : '<span class="muted-text">None</span>'}
              </td>
              <td><span class="organizer-chip">${event.createdBy.name}</span></td>
              <td>
                <div class="admin-row-actions">
                  <button class="btn btn-ghost" onclick="viewEvent('${event._id}')" title="View event">
                  <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn btn-ghost" onclick="editEvent('${event._id}')" title="Edit event">
                  <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-ghost danger" onclick="deleteEvent('${event._id}')" title="Delete event">
                  <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
    }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
// Filter and search functions
function filterEvents(filter = 'all') {
    const events = window.currentEvents || [];
    let filteredEvents = events;
    switch (filter) {
        case 'available':
            filteredEvents = events.filter((event) => event.volunteers.length < event.requiredVolunteers);
            break;
        case 'my-events':
            if (currentUser) {
                filteredEvents = events.filter((event) => {
                    var _a;
                    return event.volunteers.some(v => v._id === currentUser._id) ||
                        ((_a = event.pendingVolunteers) === null || _a === void 0 ? void 0 : _a.some(v => v._id === currentUser._id));
                });
            }
            else {
                showLoginModal();
                return;
            }
            break;
        default:
            filteredEvents = events;
    }
    renderEvents(filteredEvents);
}
function filterEventsBySearch() {
    const searchTerm = eventSearch.value.toLowerCase();
    const events = window.currentEvents || [];
    const filteredEvents = events.filter((event) => {
        var _a;
        return event.title.toLowerCase().includes(searchTerm) ||
            ((_a = event.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchTerm)) ||
            event.location.toLowerCase().includes(searchTerm) ||
            event.createdBy.name.toLowerCase().includes(searchTerm);
    });
    renderEvents(filteredEvents);
}
function showAdminTab(tab) {
    switch (tab) {
        case 'events':
            loadAdminPanel();
            break;
        case 'users':
            renderAdminUsers();
            break;
        case 'stats':
            renderAdminStats();
            break;
    }
}
function renderAdminUsers() {
    const users = window.adminUsers || [];
    adminContent.innerHTML = `
    <div class="admin-users-table">
      <table>
        <thead>
          <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((user) => `
          <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
              <button class="btn btn-ghost" onclick="editUser('${user._id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-ghost" onclick="deleteUser('${user._id}')">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  `;
}
function renderAdminStats() {
    const events = window.adminEvents || [];
    const users = window.adminUsers || [];
    const totalEvents = events.length;
    const totalVolunteers = users.filter((u) => u.role === 'volunteer').length;
    const totalAdmins = users.filter((u) => u.role === 'admin').length;
    const totalParticipants = events.reduce((sum, event) => sum + event.volunteers.length, 0);
    adminContent.innerHTML = `
    <div class="admin-stats">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-calendar-alt"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">${totalEvents}</div>
            <div class="stat-label">Total Events</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">${totalVolunteers}</div>
            <div class="stat-label">Volunteers</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-user-tie"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">${totalAdmins}</div>
            <div class="stat-label">Administrators</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-handshake"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">${totalParticipants}</div>
            <div class="stat-label">Total Participations</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
// Utility functions
function updateUI() {
    const guestHero = document.getElementById('guest-hero');
    const volunteerHero = document.getElementById('volunteer-hero');
    const adminHero = document.getElementById('admin-hero');
    const volunteerNameDisplay = document.getElementById('volunteer-name-display');
    const adminNameDisplay = document.getElementById('admin-name-display');
    if (currentUser) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        userName.textContent = currentUser.name;
        dashboardLink.style.display = 'flex';
        if (currentUser.role === 'admin') {
            adminLink.style.display = 'flex';
        }
        guestHero.style.display = 'none';
        volunteerHero.style.display = currentUser.role === 'admin' ? 'none' : 'block';
        adminHero.style.display = currentUser.role === 'admin' ? 'block' : 'none';
        volunteerNameDisplay.textContent = currentUser.name;
        adminNameDisplay.textContent = currentUser.name;
    }
    else {
        loginBtn.style.display = 'inline-flex';
        registerBtn.style.display = 'inline-flex';
        userProfile.style.display = 'none';
        dashboardLink.style.display = 'none';
        adminLink.style.display = 'none';
        guestHero.style.display = 'block';
        volunteerHero.style.display = 'none';
        adminHero.style.display = 'none';
    }
}
window.editUser = async (userId) => {
    const users = window.adminUsers || [];
    const user = users.find((item) => item._id === userId);
    if (!user)
        return;
    const role = prompt('Enter role for this user: volunteer or admin', user.role);
    if (!role || !['volunteer', 'admin'].includes(role))
        return;
    try {
        await apiRequest(`/admin/users/${userId}`, 'PUT', { role });
        showNotification('success', 'User Updated', 'The user role has been updated.');
        loadAdminPanel();
    }
    catch (error) {
        showNotification('error', 'Update Failed', error.message || 'Failed to update user');
    }
};
window.deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?'))
        return;
    try {
        await apiRequest(`/admin/users/${userId}`, 'DELETE');
        showNotification('success', 'User Deleted', 'The user has been removed.');
        loadAdminPanel();
    }
    catch (error) {
        showNotification('error', 'Delete Failed', error.message || 'Failed to delete user');
    }
};
function showNotification(type, title, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
  `;
    notificationsContainer.appendChild(notification);
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
async function apiRequest(endpoint, method = 'GET', data) {
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(data ? { body: JSON.stringify(data) } : {})
    };
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'API request failed');
    }
    return response.json();
}
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(null, args), wait);
    };
}
