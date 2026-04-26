# Volunteer Registration System

A full-stack application for managing volunteer registrations and events for nonprofit organizations.

## Features

- User registration and authentication (Volunteers and Admins)
- Event management
- Volunteer sign-up for events
- Admin dashboard for managing users and events
- Responsive UI

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript, TypeScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB

## Setup Instructions

### Prerequisites

1. Install Node.js (https://nodejs.org/)
2. Install MongoDB (https://www.mongodb.com/try/download/community)
   - Start MongoDB service (usually `mongod` or via service manager)

### Installation

1. Clone or download the project
2. Navigate to the project root

#### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory with:

```
MONGO_URI=mongodb://localhost:27017/volunteer-system
JWT_SECRET=your_secret_key_here
PORT=5000
```

#### Frontend Setup

```bash
cd frontend
npm install
npm run build
```

### Running the Application

1. Ensure MongoDB is running locally.

2. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

3. Start the frontend server:
   ```bash
   cd frontend
   npm start
   ```

4. Access the application at `http://localhost:3000`

### Creating an Admin Account

- Register a new user and select "Admin" from the role dropdown during registration.
- Or, register as volunteer, then use another admin account to promote via the admin panel.
- Or, manually update in MongoDB: `db.users.updateOne({email: "your-email@example.com"}, {$set: {role: "admin"}})`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Volunteers
- `GET /api/volunteers/events` - Get all events
- `POST /api/volunteers/events/:id/signup` - Sign up for event
- `POST /api/volunteers/events/:id/cancel` - Cancel participation
- `GET /api/volunteers/dashboard` - Get user dashboard
- `PUT /api/volunteers/availability` - Update availability

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event (admin)
- `PUT /api/events/:id` - Update event (admin)
- `DELETE /api/events/:id` - Delete event (admin)
- `POST /api/events/:id/assign/:volunteerId` - Assign volunteer (admin)
- `POST /api/events/:id/remove/:volunteerId` - Remove volunteer (admin)

### Admin
- `GET /api/admin/users` - Get all users (admin)
- `POST /api/admin/users` - Create user (admin)
- `PUT /api/admin/users/:id` - Update user (admin)
- `DELETE /api/admin/users/:id` - Delete user (admin)
- `GET /api/admin/events` - Get all events with participants (admin)
- `GET /api/admin/stats` - Get dashboard stats (admin)

## Project Structure

```
volunteer-system/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   └── Event.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── volunteers.js
│   │   ├── events.js
│   │   └── admin.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── ts/
│   │   └── app.ts
│   ├── js/
│   │   └── app.js (compiled)
│   └── package.json
├── .env
└── README.md
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation
- Protected routes
- Role-based access control

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit a pull request