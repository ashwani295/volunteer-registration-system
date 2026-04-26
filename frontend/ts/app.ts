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

// Global variables
let currentUser: User | null = null;
let token: string | null = null;
let socket: any = null;
let currentSection: string = 'hero';

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
const createEventBtn = document.getElementById('create-event-btn') as HTMLButtonElement;
const adminTabs = document.querySelectorAll('.admin-tab') as NodeListOf<HTMLButtonElement>;

// Notifications container
const notificationsContainer = document.getElementById('notifications') as HTMLElement;

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

document.getElementById('explore-events-btn')?.addEventListener('click', () => showSection('events'));
document.getElementById('become-organizer-btn')?.addEventListener('click', showRegisterModal);

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
createEventBtn.addEventListener('click', showCreateEventModal);
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
  await loadStats();
  await loadEvents();

  // Set up periodic updates
  setInterval(loadStats, 30000); // Update stats every 30 seconds
}

// Socket.IO initialization
function initializeSocket(): void {
  socket = (window as any).io('http://localhost:5000');

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
      if (!currentUser) {
        showLoginModal();
        return;
      }
      dashboardSection.style.display = 'block';
      dashboardLink.classList.add('active');
      loadDashboard();
      break;
    case 'admin':
      if (!currentUser || currentUser.role !== 'admin') {
        showNotification('error', 'Access Denied', 'Admin access required');
        return;
      }
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

function showRegisterModal(): void {
  hideModals();
  modalOverlay.style.display = 'flex';
  registerModal.style.display = 'block';
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
        <p>${event.volunteers.length} / ${event.requiredVolunteers} volunteers signed up</p>
        <div class="volunteers-list">
          ${event.volunteers.length > 0 ?
            event.volunteers.map(v => `<span class="volunteer-tag">${v.name}</span>`).join('') :
            '<span class="no-volunteers">No volunteers yet</span>'
          }
        </div>
      </div>
      ${currentUser ? `
        <div class="event-actions-modal">
          ${event.volunteers.some(v => v._id === currentUser!._id) ?
            `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel Participation</button>` :
            event.volunteers.length < event.requiredVolunteers ?
              `<button class="btn btn-primary" onclick="joinEvent('${event._id}')">Join Event</button>` :
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
  const eventData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    date: formData.get('date') as string,
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string,
    location: formData.get('location') as string,
    requiredVolunteers: parseInt(formData.get('volunteers') as string)
  };

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
    showNotification('success', 'Joined Event!', 'You have successfully joined the event.');
    loadEvents();
    if (currentSection === 'dashboard') loadDashboard();
  } catch (error: any) {
    showNotification('error', 'Signup Failed', error.message || 'Failed to join event');
  }
};

(window as any).cancelEvent = async (eventId: string) => {
  try {
    await apiRequest(`/volunteers/events/${eventId}/cancel`, 'POST');
    showNotification('warning', 'Participation Cancelled', 'You have cancelled your participation.');
    loadEvents();
    if (currentSection === 'dashboard') loadDashboard();
  } catch (error: any) {
    showNotification('error', 'Cancellation Failed', error.message || 'Failed to cancel participation');
  }
};

(window as any).viewEvent = (eventId: string) => {
  const event = (window as any).currentEvents?.find((e: Event) => e._id === eventId);
  if (event) {
    showEventModal(event);
  }
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
    const events = await apiRequest('/events', 'GET');
    const uniqueOrgs = new Set(events.map((e: Event) => e.createdBy._id)).size;
    const totalVolunteers = events.reduce((sum: number, event: Event) => sum + event.volunteers.length, 0);

    totalEventsStat.textContent = events.length.toString();
    totalVolunteersStat.textContent = totalVolunteers.toString();
    totalOrganizationsStat.textContent = uniqueOrgs.toString();
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadEvents(): Promise<void> {
  try {
    const events = await apiRequest('/events', 'GET');
    (window as any).currentEvents = events;
    renderEvents(events);
  } catch (error) {
    console.error('Failed to load events:', error);
    eventsGrid.innerHTML = '<p class="error">Failed to load events. Please try again.</p>';
  }
}

async function loadDashboard(): Promise<void> {
  if (!currentUser) return;

  try {
    const events = await apiRequest('/volunteers/events', 'GET');
    const myEvents = events.filter((event: Event) =>
      event.volunteers.some(v => v._id === currentUser!._id)
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
    const [events, users] = await Promise.all([
      apiRequest('/events', 'GET'),
      apiRequest('/admin/users', 'GET')
    ]);

    renderAdminEvents(events);
    (window as any).adminUsers = users;
    (window as any).adminEvents = events;

  } catch (error) {
    console.error('Failed to load admin data:', error);
    adminContent.innerHTML = '<p class="error">Failed to load admin data.</p>';
  }
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
    const isFull = event.volunteers.length >= event.requiredVolunteers;
    const canManage = currentUser && (currentUser.role === 'admin' || event.createdBy._id === currentUser._id);

    const eventCard = document.createElement('div');
    eventCard.className = 'event-card';
    eventCard.innerHTML = `
      <div class="event-header">
        <h3 class="event-title">${event.title}</h3>
        <div class="event-organizer">
          <i class="fas fa-user-tie"></i>
          <span>${event.createdBy.name}</span>
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
        </div>
      </div>
      <div class="event-footer">
        <div class="event-status ${isJoined ? 'joined' : isFull ? 'full' : 'available'}">
          ${isJoined ? 'Joined' : isFull ? 'Full' : 'Available'}
        </div>
        <div class="event-actions">
          <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">
            <i class="fas fa-eye"></i>
          </button>
          ${currentUser ? (
            isJoined ?
              `<button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel</button>` :
              !isFull ?
                `<button class="btn btn-primary" onclick="joinEvent('${event._id}')">Join</button>` :
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
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.innerHTML = `
      <div class="event-info">
        <h4>${event.title}</h4>
        <p>${formatDate(event.date)} • ${event.location}</p>
      </div>
      <div class="event-actions">
        <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">View</button>
        <button class="btn btn-secondary" onclick="cancelEvent('${event._id}')">Cancel</button>
      </div>
    `;
    myEventsList.appendChild(eventItem);
  });
}

function renderAdminEvents(events: Event[]): void {
  adminContent.innerHTML = `
    <div class="admin-events-table">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Location</th>
            <th>Volunteers</th>
            <th>Organizer</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(event => `
            <tr>
              <td>${event.title}</td>
              <td>${formatDate(event.date)}</td>
              <td>${event.location}</td>
              <td>${event.volunteers.length}/${event.requiredVolunteers}</td>
              <td>${event.createdBy.name}</td>
              <td>
                <button class="btn btn-ghost" onclick="viewEvent('${event._id}')">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-ghost" onclick="editEvent('${event._id}')">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-ghost" onclick="deleteEvent('${event._id}')">
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
          event.volunteers.some(v => v._id === currentUser!._id)
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
  const users = (window as any).adminUsers || [];
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
        ${users.map((user: any) => `
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

function renderAdminStats(): void {
  const events = (window as any).adminEvents || [];
  const users = (window as any).adminUsers || [];

  const totalEvents = events.length;
  const totalVolunteers = users.filter((u: any) => u.role === 'volunteer').length;
  const totalAdmins = users.filter((u: any) => u.role === 'admin').length;
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
function updateUI(): void {
  if (currentUser) {
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    userProfile.style.display = 'flex';
    userName.textContent = currentUser.name;

    dashboardLink.style.display = 'flex';
    if (currentUser.role === 'admin') {
      adminLink.style.display = 'flex';
    }
  } else {
    loginBtn.style.display = 'inline-flex';
    registerBtn.style.display = 'inline-flex';
    userProfile.style.display = 'none';

    dashboardLink.style.display = 'none';
    adminLink.style.display = 'none';
  }
}

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
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
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