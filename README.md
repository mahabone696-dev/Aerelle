# Aerelle: studio booking (Aligné Pilates)

Aerelle is a standalone booking and studio-management app with a baby-blue and white design and a Three.js (WebGL) 3D scene. Members buy packages, book classes, join waitlists, cancel and rate classes. The studio runs its timetable, members, packages, check-in and reports from an admin.

It ships pre-loaded with Aligné Pilates' class types, instructors, location (Horizon Hills), RM pricing and package catalog. Members, bookings and reviews are invented demo data.

## Data and security

The live app uses **Firebase** (project `aerelle-studio-696`): Authentication for logins and Firestore (Singapore, `asia-southeast1`) for data. `src/lib/cloud.tsx` loads data and saves changes; `firestore.rules` decides who can read and write what:

- Each studio's members, bookings, packages and orders are visible only to that studio's owners and to the member they belong to.
- The timetable and ratings are public; other people's spots appear as anonymous ids, never names.
- Members can only book or cancel their own spots within capacity, can't change attendance, and can't give themselves classes. Packages bought online stay **unpaid** until the studio marks them paid.
- People a studio adds at the front desk get their records when they sign up with the same email **and verify it**.

```bash
npm run test:rules    # security rules against the Firestore emulator (needs Java)
npm run deploy:rules  # publish firestore.rules and indexes
```

`npm run dev` uses Firebase too; `VITE_DEMO=1 npm run dev` runs the in-browser demo with sample studios instead.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # rules + reports unit tests
npm run build    # static build in dist/
```

Demo accounts for `VITE_DEMO=1` (password `demo1234`):
- `owner@aerelle.test`: owns Aligné Pilates and Lumen Reformer Co.
- `tidal@aerelle.test`: owns Tidal Yoga & Barre
- `member@aerelle.test`: a member at Aligné Pilates and Lumen Reformer Co.

## Many studios

Aerelle hosts any number of studios. Each studio has its own classes, members, packages, orders, reviews and settings, and its own booking link (`#/s/<studio>/schedule`). Logins are shared: one account can own some studios and be a member at others.

- **Studio directory** (`#/studios`): browse and search studios. Opening a studio while signed in makes you a member there.
- **Create a studio** (`#/new-studio`): pick a Pilates, Yoga, Fitness or blank template to get starter class types and packages, then follow the setup checklist on Overview.
- **Studio switcher**: in the sidebar (owners) or header (members).
- Booking rules (`src/lib/model.ts`) run inside one studio; the platform layer (`src/lib/platform.ts`) handles accounts, studios and joining.

Aligné Pilates uses its real class types, instructors and packages. Lumen Reformer Co. and Tidal Yoga & Barre are fictional demo studios.

`#/login?next=%2Frating` signs in and lands on the rating page (studio rating for the owner, "rate your classes" for members).

## Features

**Members**
- Schedule: 14 days, filters by class group (Mat, Reformer, Private, Duet, Wellness), spots left, waitlist position, class ratings, and which package a booking will use
- Packages: only valid for their class groups and for a set time; trial packs limited to one per member; monthly memberships; promo codes at checkout
- Cancelling at least *N* hours before class (12 by default, set in Settings) returns the class to its package. A freed spot goes to the first waitlisted member who has a usable package.
- My bookings, and rating classes they attended (no-shows can't rate)

**Studio admin**
- Overview: classes today with check-in, booking rate for the next 7 days, weekly sales, unpaid total, rating
- Schedule: week view, one-off or weekly repeating classes, roster and waitlist, check-in or no-show, cancelling a class (or the rest of its weekly series) refunds everyone booked
- Members: search, birthdays this month, unpaid packages; per member: sales, active packages, bookings, attendance; add members at the desk; sell or assign packages (including staff-only ones), paid or unpaid; mark orders paid
- Packages: create and edit, choose which class groups they cover, staff-only, trial or monthly; promo codes with usage limits
- Reports with date range and CSV download: sales, packages sold, bookings and occupancy, cancellations (late or in time), instructor payroll (classes taught, members attended, average rating)
- Rating: overall score, star breakdown, filter by class, stars or with comments only
- Settings: studio details, currency, cancellation window, class types and groups, staff (role, shown on booking page)

## Design

- Baby blue and white theme: colors live as CSS variables at the top of `src/styles.css`
- Frosted-glass cards, nav and tables over a 3D scene (`src/three/Scene.tsx`): a pilates ring, stability balls, foam rollers and a slowly morphing glass form, with reflections, drifting light particles and mouse parallax
- Sign-in uses the full "hero" scene. Inside the app a quieter "ambient" version stays at the edges and runs at half frame rate.
- Three.js is loaded as a separate chunk after the app renders. Without WebGL, the page falls back to the CSS gradient. With "reduce motion" on, the scene is drawn once and stays still, and it pauses when the tab is hidden.

## Not built (Vibefam add-ons and integrations)

AI booking assistant, funding, marketing email, merchandise shop, door access, website builder, Malaysian e-Invoice (LHDN), ClassPass, WhatsApp, branded mobile app, appointment self-scheduling, member migration, and a real payment gateway (checkout is simulated).

## Going to production

Live at https://aerelle.vercel.app. Every push to `main` deploys automatically through Vercel.

Data, logins and security run on Firebase (see **Data and security** above). Still to do:
1. Connect a payment gateway (e.g. Stripe or a Malaysian provider such as Billplz or iPay88) in `Packs.tsx`. Online purchases are recorded as "pay at studio" until then.
2. Move multi-step changes that affect other people (e.g. promoting someone from a waitlist when a studio cancels a class) into Cloud Functions if you want those to happen even when the member's app is closed. Today a waitlisted member's own device claims a freed spot the next time they open the app.
