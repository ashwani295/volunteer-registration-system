// Modern VolunteerHub Application with Real-time Features

// TypeScript interfaces
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Event {
  _id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  requiredVolunteers: number;
  volunteers: User[];
  pendingVolunteers: User[];
  createdBy: User;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface NotificationData {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface AdminVolunteerAssignment {
  eventId: string;
  eventTitle: string;
  status: 'confirmed' | 'pending';
  volunteer: User & { createdAt?: string };
}

// Global variables
let currentUser: User | null = null;
let token: string | null = null;
let socket: any = null;
let currentSection: string = 'hero';

function normalizeEvent(event: Event): Event {
  return {
    ...event,
    volunteers: (event.volunteers || []).filter(Boolean),
    pendingVolunteers: (event.pendingVolunteers || []).filter(Boolean)
  };
}

function normalizeEvents(events: Event[]): Event[] {
  return events.map(normalizeEvent);
}

// DOM elements
const heroSection = document.getElementById('hero-section') as HTMLElement;
const eventsSection = document.getElementById('events-section') as HTMLElement;
const dashboardSection = document.getElementById('dashboard-section') as HTMLElement;
const adminSection = document.getElementById('admin-section') as HTMLElement;

// Navigation elements
const homeLink = document.getElementById('home-link') as HTMLAnchorElement;
const eventsLink = document.getElementById('events-link') as HTMLAnchorElement;
const dashboardLink = document.getElementById('dashboard-link') as HTMLAnchorElement;
const adminLink = document.getElementById('admin-link') as HTMLAnchorElement;

// User menu elements
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const registerBtn = document.getElementById('register-btn') as HTMLButtonElement;
const userProfile = document.getElementById('user-profile') as HTMLElement;
const userName = document.getElementById('user-name') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

// Modal elements
const modalOverlay = document.getElementById('modal-overlay') as HTMLElement;
const loginModal = document.getElementById('login-modal') as HTMLElement;
const registerModal = document.getElementById('register-modal') as HTMLElement;
const eventModal = document.getElementById('event-modal') as HTMLElement;
const createEventModal = document.getElementById('create-event-modal') as HTMLElement;

// Form elements
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const registerForm = document.getElementById('register-form') as HTMLFormElement;
const createEventForm = document.getElementById('create-event-form') as HTMLFormElement;

// Content containers
const eventsGrid = document.getElementById('events-grid') as HTMLElement;
const myEventsList = document.getElementById('my-events-list') as HTMLElement;
const adminContent = document.getElementById('admin-content') as HTMLElement;

// Filter and search elements
const filterTabs = document.querySelectorAll('.filter-tab') as NodeListOf<HTMLButtonElement>;
const eventSearch = document.getElementById('event-search') as HTMLInputElement;

// Stats elements
const totalEventsStat = document.getElementById('total-events') as HTMLElement;
const totalVolunteersStat = document.getElementById('total-volunteers') as HTMLElement;
const totalOrganizationsStat = document.getElementById('total-organizations') as HTMLElement;

// Admin elements
const createEventButtons = document.querySelectorAll('#create-event-btn, #create-event-admin-btn') as NodeListOf<HTMLButtonElement>;
const adminTabs = document.querySelectorAll('.admin-tab') as NodeListOf<HTMLButtonElement>;

// Notifications container
const notificationsContainer = document.getElementById('notifications') as HTMLElement;

// API configuration
const API_ORIGIN = 'http://localhost:5000';
const API_BASE = `${API_ORIGIN}/api`;

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

document.getElementById('explore-events-btn')?.addEventListener('click', () => showSection('events'));
document.getElementById('become-organizer-btn')?.addEventListener('click', showRegisterModal);
document.getElementById('browse-events-btn')?.addEventListener('click', () => showSection('events'));
document.getElementById('view-dashboard-btn')?.addEventListener('click', () => showSection('dashboard'));
document.getElementById('manage-events-btn')?.addEventListener('click', () => showSection('admin'));

// Modal close handlers
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', hideModals);
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) hideModals();
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
async function init(): Promise<void> {
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
  } catch (error) {
    console.error('Failed to load stats:', error);
  }

  try {
    await loadEvents();
  } catch (error) {
    console.error('Failed to load events:', error);
  }

  // Set up periodic updates
  setInterval(loadStats, 30000); // Update stats every 30 seconds
}

// Socket.IO initialization
function initializeSocket(): void {
  if (!(window as any).io) {
    console.warn('Socket.IO client not available; continuing without real-time updates.');
    return;
  }

  socket = (window as any).io(API_ORIGIN);

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('event-created', (event: Event) => {
    showNotification('success', 'New Event Created', `A new event "${event.title}" has been created!`);
    loadEvents();
    loadStats();
  });

  socket.on('event-updated', (event: Event) => {
    showNotification('info', 'Event Updated', `Event "${event.title}" has been updated.`);
    loadEvents();
  });

  socket.on('event-deleted', (data: { id: string }) => {
    showNotification('warning', 'Event Removed', 'An event has been removed.');
    loadEvents();
    loadStats();
  });

  socket.on('volunteer-signed-up', (data: { event: Event; volunteer: User }) => {
    if (currentUser && data.volunteer._id !== currentUser._id) {
      showNotification('info', 'New Volunteer', `${data.volunteer.name} joined "${data.event.title}"`);
    }
    loadEvents();
    loadStats();
  });

  socket.on('volunteer-pending', (data: { event: Event; volunteer: User }) => {
    if (currentUser?.role === 'admin') {
      showNotification('info', 'New Join Request', `${data.volunteer.name} requested to join "${data.event.title}"`);
    }
    loadEvents();
    loadStats();
    if (currentSection === 'admin') loadAdminPanel();
  });

  socket.on('volunteer-cancelled', (data: { event: Event; volunteer: User }) => {
    if (currentUser && data.volunteer._id !== currentUser._id) {
      showNotification('warning', 'Volunteer Withdrew', `${data.volunteer.name} left "${data.event.title}"`);
    }
    loadEvents();
    loadStats();
  });
}

// UI Navigation
function showSection(section: string): void {
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
function showLoginModal(): void {
  hideModals();
  modalOverlay.style.display = 'flex';
  loginModal.style.display = 'block';
}

(window as any).showLoginModal = showLoginModal;

function showRegisterModal(): void {
  hideModals();
  modalOverlay.style.display = 'flex';
  registerModal.style.display = 'block';
}

function showOrganizerProfileModal(organizer: User & { createdAt?: string }): void {
  const events = (window as any).currentEvents || [];
  const organizerEvents = events.filter((event: Event) => event.createdBy._id === organizer._id);
  const totalVolunteers = organizerEvents.reduce((sum: number, event: Event) => sum + event.volunteers.length, 0);

  const modalTitle = document.getElementById('event-modal-title') as HTMLElement;
  const modalBody = document.getElementById('event-modal-body') as HTMLElement;

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
          ${organizerEvents.slice(0, 5).map((event: Event) => `
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

function showEventModal(event: Event): void {
  const modalTitle = document.getElementById('event-modal-title') as HTMLElement;
  const modalBody = document.getElementById('event-modal-body') as HTMLElement;

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
            '<span class="no-volunteers">No volunteers yet</span>'
          }
        </div>
        ${event.pendingVolunteers?.length ? `
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
            event.volunteers.some(v => v._id === currentUser!._id) ?
            `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Participation</button>` :
            event.pendingVolunteers?.some(v => v._id === currentUser!._id) ?
            `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Request</button>` :
            event.volunteers.length < event.requiredVolunteers ?
              `<button class="btn btn-primary" onclick="joinEvent('${event._id}')">Request to Join</button>` :
              '<span class="event-full">Event is full</span>'
          }
        </div>
      ` : ''}
    </div>
  `;

  modalOverlay.style.display = 'flex';
  eventModal.style.display = 'block';
}

function showCreateEventModal(): void {
  hideModals();
  modalOverlay.style.display = 'flex';
  createEventModal.style.display = 'block';
}

function hideModals(): void {
  modalOverlay.style.display = 'none';
  [loginModal, registerModal, eventModal, createEventModal].forEach(modal => {
    modal.style.display = 'none';
  });
}

// Authentication handlers
async function handleLogin(e: Event): Promise<void> {
  e.preventDefault();

  const formData = new FormData(loginForm);
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const submitBtn = loginForm.querySelector('.btn') as HTMLButtonElement;
  const btnText = submitBtn.querySelector('.btn-text') as HTMLElement;
  const spinner = submitBtn.querySelector('.btn-spinner') as HTMLElement;

  // Show loading state
  submitBtn.disabled = true;
  btnText.textContent = 'Logging in...';
  spinner.style.display = 'block';

  try {
    const response = await apiRequest('/auth/login', 'POST', { email, password });

    token = response.token;
    currentUser = response.user;

    localStorage.setItem('token', token!);
    localStorage.setItem('user', JSON.stringify(currentUser));

    updateUI();
    initializeSocket();
    hideModals();
    showNotification('success', 'Welcome back!', `Hello ${currentUser!.name}!`);
    showSection('dashboard');

  } catch (error: any) {
    showNotification('error', 'Login Failed', error.message || 'Invalid credentials');
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Login';
    spinner.style.display = 'none';
  }
}

async function handleRegister(e: Event): Promise<void> {
  e.preventDefault();

  const formData = new FormData(registerForm);
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as string;

  const submitBtn = registerForm.querySelector('.btn') as HTMLButtonElement;
  const btnText = submitBtn.querySelector('.btn-text') as HTMLElement;
  const spinner = submitBtn.querySelector('.btn-spinner') as HTMLElement;

  submitBtn.disabled = true;
  btnText.textContent = 'Creating account...';
  spinner.style.display = 'block';

  try {
    const response = await apiRequest('/auth/register', 'POST', {
      name, email, password, role
    });

    token = response.token;
    currentUser = response.user;

    localStorage.setItem('token', token!);
    localStorage.setItem('user', JSON.stringify(currentUser));

    updateUI();
    initializeSocket();
    hideModals();
    showNotification('success', 'Account Created!', `Welcome to VolunteerHub, ${currentUser!.name}!`);
    showSection('dashboard');

  } catch (error: any) {
    showNotification('error', 'Registration Failed', error.message || 'Failed to create account');
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Create Account';
    spinner.style.display = 'none';
  }
}

function logout(): void {
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
async function handleCreateEvent(e: Event): Promise<void> {
  e.preventDefault();

  const formData = new FormData(createEventForm);
  const title = (formData.get('title') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();
  const rawDate = (formData.get('date') as string || '').trim();
  const rawStartTime = (formData.get('startTime') as string || '').trim();
  const rawEndTime = (formData.get('endTime') as string || '').trim();
  const location = (formData.get('location') as string || '').trim();
  const requiredVolunteers = parseInt(formData.get('volunteers') as string, 10);

  const eventData = {
    title,
    description,
    date: normalizeDateValue(rawDate),
    startTime: normalizeTimeValue(rawStartTime),
    endTime: normalizeTimeValue(rawEndTime),
    location,
    requiredVolunteers: Number.isFinite(requiredVolunteers) ? requiredVolunteers : 1
  };

  if (eventData.title.length < 3) {
    showNotification('error', 'Invalid Title', 'Title must be at least 3 characters.');
    return;
  }

  if (eventData.location.length < 3) {
    showNotification('error', 'Invalid Location', 'Location must be at least 3 characters.');
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventData.date)) {
    showNotification('error', 'Invalid Date', 'Please select a valid date.');
    return;
  }

  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(eventData.startTime) ||
      !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(eventData.endTime)) {
    showNotification('error', 'Invalid Time', 'Please select a valid start and end time.');
    return;
  }

  if (eventData.requiredVolunteers < 1) {
    showNotification('error', 'Invalid Volunteer Count', 'Required volunteers must be at least 1.');
    return;
  }

  const submitBtn = createEventForm.querySelector('.btn') as HTMLButtonElement;
  const btnText = submitBtn.querySelector('.btn-text') as HTMLElement;
  const spinner = submitBtn.querySelector('.btn-spinner') as HTMLElement;

  submitBtn.disabled = true;
  btnText.textContent = 'Creating event...';
  spinner.style.display = 'block';

  try {
    await apiRequest('/events', 'POST', eventData);
    hideModals();
    createEventForm.reset();
    showNotification('success', 'Event Created!', 'Your event has been created successfully.');
    loadEvents();

  } catch (error: any) {
    showNotification('error', 'Creation Failed', error.message || 'Failed to create event');
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Create Event';
    spinner.style.display = 'none';
  }
}

// Global functions for onclick handlers
(window as any).joinEvent = async (eventId: string) => {
  try {
    await apiRequest(`/volunteers/events/${eventId}/signup`, 'POST');
    showNotification('success', 'Request Sent', 'Your request is pending admin confirmation.');
    loadEvents();
    if (currentSection === 'dashboard') loadDashboard();
  } catch (error: any) {
    showNotification('error', 'Signup Failed', error.message || 'Failed to join event');
  }
};

(window as any).cancelEvent = async (eventId: string) => {
  try {
    await apiRequest(`/volunteers/events/${eventId}/cancel`, 'POST');
    showNotification('warning', 'Cancelled', 'Your participation or pending request was cancelled.');
    loadEvents();
    if (currentSection === 'dashboard') loadDashboard();
  } catch (error: any) {
    showNotification('error', 'Cancellation Failed', error.message || 'Failed to cancel participation');
  }
};

(window as any).confirmVolunteer = async (eventId: string, volunteerId: string) => {
  try {
    await apiRequest(`/events/${eventId}/confirm/${volunteerId}`, 'POST');
    showNotification('success', 'Volunteer Confirmed', 'The volunteer has been added to the event.');
    await loadEvents();
    if (currentSection === 'admin') loadAdminPanel();
  } catch (error: any) {
    showNotification('error', 'Confirm Failed', error.message || 'Failed to confirm volunteer');
  }
};

(window as any).rejectVolunteer = async (eventId: string, volunteerId: string) => {
  try {
    await apiRequest(`/events/${eventId}/reject/${volunteerId}`, 'POST');
    showNotification('warning', 'Request Rejected', 'The pending request has been removed.');
    await loadEvents();
    if (currentSection === 'admin') loadAdminPanel();
  } catch (error: any) {
    showNotification('error', 'Reject Failed', error.message || 'Failed to reject volunteer');
  }
};

(window as any).viewEvent = (eventId: string) => {
  const event = (window as any).currentEvents?.find((e: Event) => e._id === eventId);
  if (event) {
    showEventModal(event);
  }
};

(window as any).viewOrganizerProfile = async (organizerId: string) => {
  const events = (window as any).currentEvents || [];
  const organizerEvent = events.find((event: Event) => event.createdBy._id === organizerId);

  if (!organizerEvent) {
    showNotification('error', 'Profile Error', 'Could not find this organizer.');
    return;
  }

  showOrganizerProfileModal(organizerEvent.createdBy);
};

(window as any).editEvent = (eventId: string) => {
  // TODO: Implement edit event functionality
  showNotification('info', 'Coming Soon', 'Edit event functionality will be available soon.');
};

(window as any).deleteEvent = async (eventId: string) => {
  if (confirm('Are you sure you want to delete this event?')) {
    try {
      await apiRequest(`/events/${eventId}`, 'DELETE');
      showNotification('success', 'Event Deleted', 'The event has been deleted.');
      loadEvents();
    } catch (error: any) {
      showNotification('error', 'Deletion Failed', error.message || 'Failed to delete event');
    }
  }
};

// Data loading functions
async function loadStats(): Promise<void> {
  try {
    const normalizedEvents = currentUser?.role === 'admin'
      ? await loadScopedAdminEvents()
      : normalizeEvents(await apiRequest('/events', 'GET'));
    const uniqueOrgs = new Set(normalizedEvents.map((e: Event) => e.createdBy._id)).size;
    const totalVolunteers = normalizedEvents.reduce((sum: number, event: Event) => sum + event.volunteers.length, 0);

    totalEventsStat.textContent = normalizedEvents.length.toString();
    totalVolunteersStat.textContent = totalVolunteers.toString();
    totalOrganizationsStat.textContent = uniqueOrgs.toString();

    if (currentUser) {
      if (currentUser.role === 'admin') {
        const adminEvents = normalizedEvents.filter((event: Event) => event.createdBy._id === currentUser!._id);
        const adminVolunteersCount = adminEvents.reduce((sum: number, event: Event) => sum + event.volunteers.length, 0);
        const adminPendingCount = adminEvents.reduce((sum: number, event: Event) => sum + (event.pendingVolunteers?.length || 0), 0);

        const adminEventsCountEl = document.getElementById('admin-events-count');
        const adminVolunteersCountEl = document.getElementById('admin-volunteers-count');
        const adminParticipationCountEl = document.getElementById('admin-participation-count');

        if (adminEventsCountEl) adminEventsCountEl.textContent = adminEvents.length.toString();
        if (adminVolunteersCountEl) adminVolunteersCountEl.textContent = totalVolunteers.toString();
        if (adminParticipationCountEl) adminParticipationCountEl.textContent = (adminVolunteersCount + adminPendingCount).toString();
      } else {
        const userEvents = normalizedEvents.filter((event: Event) =>
          event.volunteers.some(v => v._id === currentUser!._id)
        );
        const availableEvents = normalizedEvents.filter((event: Event) =>
          !event.volunteers.some(v => v._id === currentUser!._id) &&
          !event.pendingVolunteers?.some(v => v._id === currentUser!._id) &&
          event.volunteers.length < event.requiredVolunteers
        );

        const volunteerEventsCountEl = document.getElementById('volunteer-events-count');
        const availableEventsCountEl = document.getElementById('available-events-count');
        const totalOrganizersCountEl = document.getElementById('total-organizers-count');

        if (volunteerEventsCountEl) volunteerEventsCountEl.textContent = userEvents.length.toString();
        if (availableEventsCountEl) availableEventsCountEl.textContent = availableEvents.length.toString();
        if (totalOrganizersCountEl) totalOrganizersCountEl.textContent = uniqueOrgs.toString();
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadEvents(): Promise<void> {
  try {
    const normalizedEvents = currentUser?.role === 'admin'
      ? await loadScopedAdminEvents()
      : normalizeEvents(await apiRequest('/events', 'GET'));
    (window as any).currentEvents = normalizedEvents;
    renderEvents(normalizedEvents);
  } catch (error) {
    console.error('Failed to load events:', error);
    eventsGrid.innerHTML = '<p class="error">Failed to load events. Please try again.</p>';
  }
}

async function loadDashboard(): Promise<void> {
  if (!currentUser) return;

  try {
    if (currentUser.role === 'admin') {
      const events = await loadScopedAdminEvents();
      renderAdminDashboardEvents(events);

      const volunteerIds = events.reduce((allIds: string[], event: Event) => {
        event.volunteers.forEach((volunteer: User) => allIds.push(volunteer._id));
        return allIds;
      }, []);
      const uniqueVolunteers = new Set(volunteerIds);
      const pendingCount = events.reduce((sum: number, event: Event) => sum + (event.pendingVolunteers?.length || 0), 0);

      document.getElementById('events-participated')!.textContent = events.length.toString();
      document.getElementById('hours-volunteered')!.textContent = uniqueVolunteers.size.toString();
      document.getElementById('certificates-earned')!.textContent = pendingCount.toString();
      return;
    }

    const events = await apiRequest('/volunteers/events', 'GET');
    const normalizedEvents = normalizeEvents(events);
    const myEvents = normalizedEvents.filter((event: Event) =>
      event.volunteers.some(v => v._id === currentUser!._id) ||
      event.pendingVolunteers?.some(v => v._id === currentUser!._id)
    );

    renderMyEvents(myEvents);

    // Update stats
    document.getElementById('events-participated')!.textContent = myEvents.length.toString();
    // TODO: Calculate actual hours and certificates

  } catch (error) {
    console.error('Failed to load dashboard:', error);
    myEventsList.innerHTML = '<p class="error">Failed to load your events.</p>';
  }
}

async function loadAdminPanel(): Promise<void> {
  if (!currentUser || currentUser.role !== 'admin') return;

  try {
    const [events, assignments] = await Promise.all([
      loadScopedAdminEvents(),
      apiRequest('/admin/users', 'GET')
    ]);

    renderAdminEvents(events);
    (window as any).adminAssignments = assignments;
    (window as any).adminEvents = events;
    (window as any).currentEvents = events;

  } catch (error) {
    console.error('Failed to load admin data:', error);
    adminContent.innerHTML = '<p class="error">Failed to load admin data.</p>';
  }
}

async function loadScopedAdminEvents(): Promise<Event[]> {
  if (!currentUser || currentUser.role !== 'admin') return [];

  const events = await apiRequest('/admin/events', 'GET');
  const normalizedEvents = normalizeEvents(events);

  // Extra client-side safety for older backend instances.
  return normalizedEvents.filter((event: Event) => {
    const creatorId = typeof event.createdBy === 'string' ? event.createdBy : event.createdBy?._id;
    return creatorId === currentUser!._id;
  });
}

// Rendering functions
function renderEvents(events: Event[]): void {
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
    const isJoined = currentUser && event.volunteers.some(v => v._id === currentUser!._id);
    const isPending = currentUser && event.pendingVolunteers?.some(v => v._id === currentUser!._id);
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
          ${event.pendingVolunteers?.length ? `<span class="pending-count">${event.pendingVolunteers.length} pending</span>` : ''}
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
          ${currentUser ? (
            currentUser.role === 'admin' ?
              '' :
            isJoined ?
              `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel</button>` :
            isPending ?
              `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Request</button>` :
              !isFull ?
                `<button class="btn btn-primary" onclick="joinEvent('${event._id}')">Request</button>` :
                ''
          ) : `<button class="btn btn-primary" onclick="showLoginModal()">Login to Join</button>`}
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

function renderMyEvents(events: Event[]): void {
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
    const isPending = event.pendingVolunteers?.some(v => v._id === currentUser!._id);
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

function renderAdminDashboardEvents(events: Event[]): void {
  myEventsList.innerHTML = '';

  if (events.length === 0) {
    myEventsList.innerHTML = `
      <div class="no-events">
        <i class="fas fa-calendar-times"></i>
        <h3>No events created yet</h3>
        <p>Create an event to start managing volunteers.</p>
      </div>
    `;
    return;
  }

  events.forEach(event => {
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.innerHTML = `
      <div class="event-info">
        <h4>${event.title}</h4>
        <p>${formatDate(event.date)} - ${event.location}</p>
        <span class="event-status inline joined">${event.volunteers.length} confirmed</span>
        <span class="event-status inline pending">${event.pendingVolunteers?.length || 0} pending</span>
        <div class="volunteers-list" style="margin-top: 10px;">
          ${event.volunteers.length
            ? event.volunteers.map((volunteer: User) => `
                <span class="volunteer-tag">
                  ${volunteer.name}
                  <button class="btn btn-ghost btn-mini" title="Remove from event" onclick="removeVolunteerFromEvent('${event._id}', '${volunteer._id}')">
                    <i class="fas fa-user-minus"></i>
                  </button>
                </span>
              `).join('')
            : '<span class="no-volunteers">No confirmed volunteers yet</span>'
          }
        </div>
      </div>
      <div class="event-actions">
        <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">View</button>
      </div>
    `;
    myEventsList.appendChild(eventItem);
  });
}

function renderAdminEvents(events: Event[]): void {
  const pendingTotal = events.reduce((sum, event) => sum + (event.pendingVolunteers?.length || 0), 0);
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
          ${events.map(event => `
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
                ${event.pendingVolunteers?.length ? `
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
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Filter and search functions
function filterEvents(filter: string = 'all'): void {
  const events = (window as any).currentEvents || [];
  let filteredEvents = events;

  switch (filter) {
    case 'available':
      filteredEvents = events.filter((event: Event) =>
        event.volunteers.length < event.requiredVolunteers
      );
      break;
    case 'my-events':
      if (currentUser) {
        filteredEvents = events.filter((event: Event) =>
          event.volunteers.some(v => v._id === currentUser!._id) ||
          event.pendingVolunteers?.some(v => v._id === currentUser!._id)
        );
      } else {
        showLoginModal();
        return;
      }
      break;
    default:
      filteredEvents = events;
  }

  renderEvents(filteredEvents);
}

function filterEventsBySearch(): void {
  const searchTerm = eventSearch.value.toLowerCase();
  const events = (window as any).currentEvents || [];

  const filteredEvents = events.filter((event: Event) =>
    event.title.toLowerCase().includes(searchTerm) ||
    event.description?.toLowerCase().includes(searchTerm) ||
    event.location.toLowerCase().includes(searchTerm) ||
    event.createdBy.name.toLowerCase().includes(searchTerm)
  );

  renderEvents(filteredEvents);
}

function showAdminTab(tab: string): void {
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

function renderAdminUsers(): void {
  const assignments = ((window as any).adminAssignments || []) as AdminVolunteerAssignment[];

  if (assignments.length === 0) {
    adminContent.innerHTML = `
      <div class="no-events">
        <i class="fas fa-users-slash"></i>
        <h3>No volunteers in your events</h3>
        <p>Volunteers who join your events will appear here.</p>
      </div>
    `;
    return;
  }

  adminContent.innerHTML = `
    <div class="admin-users-table">
      <table>
        <thead>
          <tr>
          <th>Volunteer</th>
          <th>Email</th>
          <th>Event</th>
          <th>Status</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${assignments.map((assignment: AdminVolunteerAssignment) => `
          <tr>
            <td>${assignment.volunteer.name}</td>
            <td>${assignment.volunteer.email}</td>
            <td>${assignment.eventTitle}</td>
            <td><span class="event-status inline ${assignment.status === 'pending' ? 'pending' : 'joined'}">${assignment.status}</span></td>
            <td>${assignment.volunteer.createdAt ? formatDate(assignment.volunteer.createdAt) : '-'}</td>
            <td>
              <button class="btn btn-ghost danger" title="Remove from event" onclick="removeVolunteerFromEvent('${assignment.eventId}', '${assignment.volunteer._id}')">
                <i class="fas fa-user-minus"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  `;
}

function renderAdminStats(): void {
  const events = (window as any).adminEvents || [];
  const assignments = ((window as any).adminAssignments || []) as AdminVolunteerAssignment[];

  const totalEvents = events.length;
  const uniqueVolunteers = new Set(assignments.map((a: AdminVolunteerAssignment) => a.volunteer._id)).size;
  const pendingRequests = assignments.filter((a: AdminVolunteerAssignment) => a.status === 'pending').length;
  const totalParticipants = events.reduce((sum: number, event: Event) => sum + event.volunteers.length, 0);

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
            <div class="stat-number">${uniqueVolunteers}</div>
            <div class="stat-label">Unique Volunteers</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-user-clock"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">${pendingRequests}</div>
            <div class="stat-label">Pending Requests</div>
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
function updateUI(): void {
  const guestHero = document.getElementById('guest-hero') as HTMLElement;
  const volunteerHero = document.getElementById('volunteer-hero') as HTMLElement;
  const adminHero = document.getElementById('admin-hero') as HTMLElement;
  const volunteerNameDisplay = document.getElementById('volunteer-name-display') as HTMLElement;
  const adminNameDisplay = document.getElementById('admin-name-display') as HTMLElement;

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
  } else {
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

(window as any).removeVolunteerFromEvent = async (eventId: string, volunteerId: string) => {
  if (!confirm('Remove this volunteer from the selected event?')) return;

  try {
    await apiRequest(`/events/${eventId}/remove/${volunteerId}`, 'POST');
    showNotification('success', 'Volunteer Removed', 'The volunteer was removed from the event.');
    await Promise.all([loadDashboard(), loadAdminPanel(), loadEvents(), loadStats()]);
  } catch (error: any) {
    showNotification('error', 'Remove Failed', error.message || 'Failed to remove volunteer from event');
  }
};

function showNotification(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string): void {
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

async function apiRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const raw = await response.text();
    let errorPayload: any = null;

    try {
      errorPayload = raw ? JSON.parse(raw) : null;
    } catch {
      errorPayload = null;
    }

    const validationErrors = Array.isArray(errorPayload?.errors)
      ? errorPayload.errors.map((item: any) => item.msg).filter(Boolean)
      : [];

    const message =
      errorPayload?.message ||
      (validationErrors.length ? validationErrors.join(', ') : '') ||
      raw ||
      'API request failed';

    throw new Error(message);
  }

  return response.json();
}

function normalizeDateValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return value;
}

function normalizeTimeValue(value: string): string {
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return value;

  const ampm = value.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!ampm) return value;

  let hours = parseInt(ampm[1], 10);
  const minutes = ampm[2];
  const suffix = ampm[3].toUpperCase();

  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function debounce(func: Function, wait: number): (...args: any[]) => void {
  let timeout: number;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}
