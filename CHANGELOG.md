# Changelog — Railway frontend

Each version is delivered as `railway-frontend-vX.Y.Z.zip`.

## v1.10.0 — 9 Nov 2026
Quotas, Tatkal and charts. Use with backend v1.6.0.
- Quota choice in the search form and the results bar: General, Tatkal, Premium Tatkal, Ladies,
  Senior citizen, with each quota's rules shown under it.
- Class tiles show availability, waitlist (WL / TQWL) and fare for the chosen quota; classes that
  don't offer the quota (no Tatkal in 1A, no Senior citizen in chair cars) are greyed out.
- "Tatkal opens on 9 Nov at 11:00" and "chart prepared" messages on the train card; booking is
  disabled until it opens.
- Booking form: max 4 passengers for Tatkal / Premium Tatkal, 2 for Senior citizen; Ladies and
  Senior citizen rules checked as you type; no waitlist where the quota has none.
- Tickets show the quota, "Chart prepared", TQWL numbers and "Not confirmed at charting".
- Admin: quota split per class (Tatkal, Premium Tatkal, Ladies, Senior citizen %) under the train's
  coaches, with how many seats each quota has now.

## v1.9.1 — 8 Nov 2026
Fix: opening the app from a phone on the same Wi-Fi failed with "Something went wrong".
- The dev and preview servers now listen on the network (`npm.cmd run dev` prints a "Network"
  address to open on the phone) and drop the browser's Origin header when forwarding API calls,
  so Spring's CORS check no longer refuses the phone's address. No CORS_ORIGINS change needed.
- If the server ever refuses a page's address, the app says so instead of "Something went wrong".

## v1.9.0 — 8 Nov 2026
Security. Use with backend v1.5.0 (see docs/SECURITY.md; set JWT_SECRET once).
- Backend v1.5.0:
  - Admin endpoints need an admin token (a passenger's token used to work for adding, changing
    and deleting trains). Roles are enforced by Spring Security in one place.
  - Password reset is tied to a 10-minute reset token from the OTP step; the account can no
    longer be chosen by the email in the request.
  - Password hashes, OTPs and photos are never returned. Sign-up and admin creation can't set
    their own id, role or verified flag.
  - Log-in tokens use a fixed secret (JWT_SECRET), so restarts no longer log everyone out.
  - Real logout, "log out on all devices", and a password reset ends other sessions.
  - Lockout after 5 wrong passwords or OTPs; 5 wrong OTPs cancel the OTP; OTP emails at most
    once a minute.
  - Server-side checks for sign-up details and photos; errors no longer leak internal details;
    CORS limited to the app's own pages; Swagger and SQL logging off by default.
- Frontend:
  - Passwords and OTPs are sent in the request body, not the URL.
  - Session expiry comes from the token itself; logged out after 30 minutes without activity;
    a hand-edited session is dropped. "Log out on all devices" in the log-out menu.
  - Content-Security-Policy in the built site and security headers on the dev and preview servers.
  - Length limits on every text box; photo must be JPG, PNG or WebP.
  - Clearer messages: "Wrong email or password", tries left on a wrong OTP, lockout wait time.
- Admin: search the train list by number, name, station name or station code. Long lists scroll.

## v1.8.0 — 8 Nov 2026
Editing a train, more classes and automatic km. Use with backend v1.4.0.
- Every finished setup step can be changed: "Change days", "Edit stops and timings", "Change fare",
  "Change coaches". Each opens with what is saved and has Cancel.
  - Stops: add, remove or reorder stops and change timings and km. While the train has upcoming
    bookings only timings and km can change (tickets store their stops by position).
  - Running days: a day can't be dropped while passengers are booked on that weekday.
  - Fare: tickets already booked keep the fare they were sold at.
- Km between stops is filled in automatically when both stations are in the directory
  (straight-line distance x 1.25, marked "est."). Typed values are kept; "Replace distances
  with estimates" re-fills them. The total route km is shown under the stops.
- "Add a station" takes an optional map position (paste "lat, long" from Google Maps).
- New classes: AC chair car (CC, 78 seats, 3+2), Executive chair car (EC, 56 seats, 2+2) and
  AC 3 economy (3E, 81 berths, M1…). They appear in admin coaches, search, results and tickets.
- Fares step is just the base fare; start and end come from the stops.

## v1.7.0 — 8 Nov 2026
Station codes and live station search. Use with backend v1.3.0.
- Fix: the admin train list came from the browser's saved copy, so a train that was deleted (or
  never saved) still showed and then failed with "Train Not Found". The list now loads from the
  database (`GET /admin/trains`), has a refresh button, and a delete of a train that is already
  gone just refreshes the list.
- Live station search in From/To: type a code (`SBC`), a city (`Bengaluru` = every station in
  the city) or a station name; arrow keys, Enter and Escape work. Results come from
  `GET /customer/trains`, which matches stops by code, city or name.
- Admin: train start/end and every stop use the same station search. A stop that isn't in the
  directory can be added on the spot with "Add … as a new station" (code, name, city, state).
- Admin: a duplicate train number is shown on the Train number field.

## v1.6.1 — 8 Nov 2026
Fix for "every class shows WL 1". Use with backend v1.2.1.
- Admin: the finished Coaches step has a "Change coaches" button, so a train's coaches can be
  set up again (allowed while the train has no bookings).
- Backend v1.2.1: on startup, coaches created by the old "total seats" step get their seats
  created automatically (they had none, so every class looked full). A class that still has no
  seats now shows a clear message instead of a waitlist.

## v1.6.0 — 8 Nov 2026
Run `npm install` once: adds bootstrap 5.3.3, react-bootstrap, bootstrap-icons and sass.
- Whole app rebuilt on Bootstrap 5 (React-Bootstrap) with a navy/orange theme: navbar that
  collapses on phones, cards, form controls with validation states, modal log-in, pills,
  tables, badges, list groups, loading placeholders and Bootstrap Icons.
- Toasts for every outcome. Failures say "Something went wrong" with the reason when it's
  something the user can fix (wrong password, OTP expired, no seats), or "Please try again in
  a moment" for server errors, network problems and backend bugs. Raw server error text is never shown.
- Pages that crash while rendering show a "Something went wrong" card with Reload, plus a toast.
  Uncaught script errors and failed promises also raise a toast.
- "No trains found" is shown as an empty result, not an error.
- Cancel and delete confirmations use a Bootstrap dialog instead of the browser's confirm box.
- Toasts sit under the navbar on desktop and at the bottom of the screen on phones.

## v1.5.0 — 8 Nov 2026
Needs backend v1.2.0 (seat allocation, waitlist, cancellation).
- Class tiles show the real status for your stretch of the route: AVAILABLE-0048, WL 13 or REGRET, with the fare.
- Booking form asks for name, age, gender and berth preference (choices depend on the class); up to 6 passengers.
- Booking into the waitlist when a class is full, with a note explaining it.
- Ticket view after booking: PNR, status, and coach/seat/berth or WL position per passenger.
- New "My bookings" page: upcoming and past bookings, refresh status, cancel one passenger or the whole booking.
- Admin: the last setup step now picks coaches per class (S1…S8, B1…) instead of a total seat count.
- Mobile: Trains and My bookings links show under the logo.

## v1.4.0 — 7 Nov 2026
Needs the backend email-OTP change (backend v1.1.0).
- OTP now comes by email instead of SMS: updated wording on Register, Verify and Reset password.
- Verify page: "Send a new OTP" button (calls `/customer/resend_otp`), with a 30-second wait between sends.
- Logging in before verifying shows "Your email isn’t verified yet" with an "Enter my OTP" button.
- Clearer OTP errors: wrong code and expired code are shown on the OTP field.

## v1.3.0 — 7 Nov 2026
- Frontend checks on every form, shown under each field as you leave it and again on submit:
  name, email format, 10-digit mobile starting 6–9, age 1–120, address length, 6-digit OTP,
  new passwords (8+ characters with a letter and a number) with a repeat-password field,
  photo type and size (5 MB), From ≠ To and no past dates in search, passenger details,
  admin name format, 5-digit train numbers, stop names/times/distances, fares and seat counts.
- Registration: when the backend reports a duplicate email or mobile, both fields are marked
  "already registered". Each passenger appears once per booking.
- Admin: a train number already in the list can't be added again (the backend would overwrite it).
- Show/hide button on every password field.
- Loaders: a moving bar under the header during any backend request, spinners with
  "Logging in…", "Searching…", "Checking…" etc. on buttons, and placeholder train cards while searching.
- Clearer log-in errors: "no account with this email" and "wrong password".

## v1.2.0 — 7 Nov 2026
- Treat `208 Already Reported` as a refusal. Only 200, 201 and 202 count as success, matching the backend.
- Admin create page explains that only one admin is allowed and links to admin log-in.
- Removed the 6-character password minimum, which the backend doesn't have.

## v1.1.0 — 7 Nov 2026
- Redesigned in a railway-booking portal layout: navy header, home page with journey search card,
  log-in dialog, results page with modify-search bar, filters, sorting and train cards with
  per-class availability.
- Restyled account and admin pages.

## v1.0.0 — 7 Nov 2026
- First React (Vite) frontend: passenger signup, OTP, login, password reset, train search,
  seat availability and booking form; admin account, five-step train setup and train deletion.
