# Railway — train ticket booking (web app)

The web app for the Railway booking system: passengers search trains, book and pay, follow their
PNR, download e-tickets and cancel; admins set up trains, prepare charts, run the trains and see reports.

It talks to the Spring Boot API in [Railway](https://github.com/vikashalikatti/Railway), which must
be running for the app to work.

> This is a learning project. Payments go through the backend's **test gateway**: no real money moves.
> It is not affiliated with Indian Railways or IRCTC.

---

## Screens

**Passengers**

| Page | Address | What it does |
|---|---|---|
| Book tickets | `/` and `/trains` | Search between stations or cities; filters (class, AC only, berths available, train type, departure and arrival time); sort; class availability, fare, RAC / waitlist and chance of confirmation; connecting journeys when no direct train |
| Booking | on a train card | Passengers (saved passengers in one click), children without a berth, meals, bedroll, quotas incl. Divyangjan, boarding help, Vikalp, then **Pay and book** |
| My bookings | `/bookings` | Tickets with live status, RAC / waitlist position, running status, coach map, **e-ticket PDF with QR code**, cancel with the refund shown first |
| PNR status | `/pnr` | Status of any PNR without logging in (no names) |
| Chart & vacancy | `/chart` | Vacant and booked berths after the chart is prepared |
| Timetable | `/timetable` | Every stop of a train: times, day, halt, km |
| Ticket check | `/ticket-check` | Opened by scanning an e-ticket's QR code: genuine or not, and live status |
| Passengers | `/passengers` | Saved travellers |
| Account | `/signup`, `/login`, `/verify`, `/forgot` | Sign-up with email OTP, log-in, password reset |

**Admin** (log in at `/console/login`; create the admin once at `/console/create`)

| Page | Address | What it does |
|---|---|---|
| Manage trains | `/console` | Search trains; add or edit a train step by step (details, running days, stops with km estimates and days, fare, coaches, quotas and RAC berths, coaches by date) |
| Import trains | `/console/import` | Bundled list of 438 Karnataka trains (with the Vande Bharat trains) and their stations, or a CSV / JSON file; progress and problems |
| Charts | `/console/chart` | Reservation chart with every passenger |
| Train runs | `/console/runs` | Live position and delay, reschedule, cancel a run |
| Reports | `/console/reports` | Occupancy, revenue, cancellations, waitlist results |
| Customers | `/console/customers` | Search customers, their bookings, block / unblock |
| Audit log | `/console/audit` | Every admin change: who, what, when |

---

## Tech stack

React 18, React Router 6, React Bootstrap / Bootstrap 5.3 (Sass), Vite 5, jsPDF and qrcode (e-tickets,
loaded only when a ticket is downloaded).

---

## Getting started

### 1. Requirements
- **Node.js 22 LTS.** Newer versions (Node 26) can fail on some Windows PCs with
  "entropy source strength too weak".
- The backend running on `http://localhost:8080` (see its README).

### 2. Install and run
```powershell
npm.cmd install
npm.cmd run dev
```
(On macOS / Linux use `npm` instead of `npm.cmd`.)

Open **http://localhost:5173**. In development, Vite forwards `/customer` and `/admin` calls to the
backend, so the browser never makes a cross-site request.

**From a phone on the same Wi-Fi:** open `http://<your PC's IP>:5173` (Vite prints it). Allow port
5173 through the Windows firewall if it doesn't load.

**Backend somewhere else:**
```powershell
$env:BACKEND_URL="http://192.168.1.10:8080"; npm.cmd run dev
```

### 3. Build for production
```powershell
npm.cmd run build      # output in dist/
npm.cmd run preview    # serves dist/ on http://localhost:4173
```
Serve `dist/` from any web server and forward `/customer` and `/admin` to the backend (or set
`VITE_API_BASE` at build time and add the site's address to the backend's `CORS_ORIGINS`). Use the
security headers from `vite.config.js` on the real server too.

### 4. Run in Docker
The `Dockerfile` builds the app with Node and serves it with nginx, which also forwards `/customer`
and `/admin` to the backend (no CORS setup needed) and sends the same security headers as the
preview server (`docker/nginx.conf.template`).

```powershell
docker build -t railway-frontend:1.17.0 .
docker run -p 8081:8080 -e BACKEND_URL=http://host.docker.internal:8080 railway-frontend:1.17.0
```
`BACKEND_URL` is where the API runs (here: on your PC, outside Docker). To run MySQL, the API and the
web app together with one command, or on Kubernetes, use `docker-compose.yml` and the guide in the
backend repository: [docs/DEPLOYMENT.md](https://github.com/vikashalikatti/Railway/blob/master/docs/DEPLOYMENT.md).

### 5. Windows: "An Application Control policy has blocked this file"
Some Windows PCs (Smart App Control or company policy) block the native files that Vite's tools
normally use. This project already uses their WebAssembly versions (`overrides` in `package.json`),
so it runs anyway. If you still see the error, delete `node_modules` and `package-lock.json` and run
`npm.cmd install` again.

---

## Trying it out

1. Create the admin at `/console/create`, log in, and **Import trains → Import Karnataka trains**
   (set "At most" to 20 for a quick try) or **Add a train**. Try searching **SBC → DWR** for the
   Vande Bharat.
2. Register a passenger at `/signup` (an OTP is emailed), search the route, pick a class and book.
3. Pay with the test card **4111 1111 1111 1111**, any future expiry, any CVV, OTP **123456**.
   To see a failed payment use card **4000 0000 0000 0002** or UPI **failure@upi**.
4. In **My bookings**, download the e-ticket and scan its QR code with a phone on the same Wi-Fi.

---

## Project structure

```
src/
├── App.jsx              routes, menu, footer
├── api.js               every backend call; quota, class and travel rules shared with the server
├── session.jsx          log-in session (token kept in memory and sessionStorage), idle log-out, toasts
├── journey.js           journey times, days and durations for a search result
├── coachLayout.js       coach layouts for the coach map
├── eticket.js           e-ticket PDF with a signed QR code
├── validate.js, useForm.js   form checks
├── components/          shared pieces: search card, station input, coach map, chart board,
│                        payment dialog, train picker, confirm dialog, UI kit
├── pages/customer/      passenger pages
├── pages/admin/         admin pages
└── styles/app.scss      the app's look (Bootstrap theme and components)
Dockerfile, docker/nginx.conf.template   container: built app served by nginx
```

Security: the built app has a strict Content-Security-Policy (no inline scripts, API calls only to
its own address); tokens are never put in URLs; sessions end after an hour or 30 minutes idle.

What changed in each version: [CHANGELOG.md](CHANGELOG.md).
