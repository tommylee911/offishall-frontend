# Offishall Stores

Static frontend + **Express.js** backend for signup, verification, and sign-in.

## Run locally

```bash
cd backend
npm install
npm start
```

API: **https://offishall-backend.onrender.com** (frontend calls `https://offishall-backend.onrender.com/api`).

For local dev: `cd backend && npm start` (uses port from `backend/.env`).

## Project layout

- `index.html`, `dashboard.html`, … — frontend pages
- `script.js` — UI, cart, auth API calls
- `backend/server.js` — Express API

See `backend/README.md` for API routes and email setup.
