# Railway — React frontend

React (Vite) + Bootstrap 5 UI for the Spring Boot backend in this repo.

## Run it

1. Start the backend (port 8080):
   ```bash
   ./mvnw spring-boot:run
   ```
2. In another terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open http://localhost:5173

In development Vite forwards every `/customer/...` and `/admin/...` request to `http://localhost:8080`,
so there are no CORS issues. To point at a different backend, start Vite with
`BACKEND_URL=http://host:port npm run dev`.

For a production build, `npm run build` writes static files to `frontend/dist`. Either serve them
from any static host with `VITE_API_BASE=https://your-backend` set at build time, or copy `dist/*` into
`src/main/resources/static` and allow those paths in `SecurityConfiguration`.

## What's in it

**Passengers** (home page `/`, results at `/trains`)
- Journey search card on the home page; searching while logged out opens the log-in dialog and keeps the search
- Results with a modify-search bar, filters (class, train type, departure time) and sorting
- Train cards with running days, departure/arrival dates, duration, full schedule, per-class availability and fare
- Sign up (with profile photo), verify the SMS OTP, forgot password (OTP → new password)
- Passenger details form to book

**Admin** (at `/console` — not `/admin`, which is the API path)
- Create the admin account and log in
- Set up a train in order: details → running days → stops and timings → fares → seats and coaches
- Delete a train

## Backend notes

- The JWT is sent in a header named `Bearer`, as the controllers expect.
- Customer login returns HTTP 400 even when it succeeds, so `src/api.js` decides success from the
  `status` field in the response body instead of the HTTP status.
- Seat allocation, waitlist and locking are explained in `docs/SEAT-ALLOCATION.md`.
- There is no endpoint that lists trains, so the admin screen remembers the trains it created in the
  browser's localStorage.
- Stops: the backend adds each stop's `km` to get the route distance, so the form asks for
  "km from the previous stop".
