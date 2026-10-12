# Aerelle: studio booking (Aligné Pilates)

Aerelle is a standalone booking and studio-management app with a baby-blue and white design and a Three.js (WebGL) 3D scene. Members buy packages, book classes, join waitlists, cancel and rate classes. The studio runs its timetable, members, packages, check-in and reports from an admin.

It ships pre-loaded with Aligné Pilates' class types, instructors, location (Horizon Hills), RM pricing and package catalog. Members, bookings and reviews are invented demo data.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # rules + reports unit tests
npm run build    # static build in dist/
```

Demo accounts (password `demo1234`):
- `owner@aerelle.test`: studio admin
- `member@aerelle.test`: a member with Mat and Reformer packs

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

Data lives in each browser's `localStorage` (`src/lib/store.tsx`), so it is not shared between people yet.
1. Move `State` into a database (e.g. Firebase or Supabase) and run the pure functions in `src/lib/model.ts` server-side inside a transaction, so two members can't take the last spot.
2. Replace the demo password hashing with real auth (e.g. Firebase Auth).
3. Connect a payment gateway (e.g. Stripe or a Malaysian provider such as Billplz or iPay88) in `Packs.tsx`, and only create the package from its payment webhook.
4. Review capacities, durations and instructor-per-slot in the seed (`src/lib/seed.ts`). They are estimates.
