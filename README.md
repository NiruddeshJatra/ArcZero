#### **Tech Stack**

JavaScript (ES Modules), HTML5 Canvas, Vite, Supabase (PostgreSQL, Edge Functions), Vitest, Playwright, CSS3

#### **Overview**

ArcZero is a browser-based 2D physics arcade game where players calculate trajectories and manage launcher momentum to intercept incoming missile strikes. Built for arcade and competitive gamers, it features 10 escalating difficulty levels, seeded daily challenges, and real-time global leaderboards.

#### **Key Features**

- **Custom 2D Ballistic Engine:** Real-time physics simulation handling missile gravity, launcher angle controls, and split trajectory mechanics (MIRVs, Couriers).
- **Multiple Game Modes:** Includes progressive Campaign mode, seeded Daily Challenges with shareable results, and isolated Level Select practice runs.
- **Global & Daily Leaderboards:** Real-time ranking tables powered by Supabase with persistent player handles and daily reset schedules.
- **Cross-Device Controls:** Dual control scheme featuring keyboard charge controls for desktop and a touch-optimized layout for mobile screens.
- **Custom Visual & Audio Engine:** Native HTML5 Canvas renderer with particle explosions, screen-shake effects, and Web Audio API integration.

#### **Technical Highlights**

- **Anti-Cheat Score Validation:** Uses serverless Supabase Edge Functions with HMAC-SHA256 tokens and server-side plausibility checks to prevent forged score submissions.
- **Deterministic 20-Tick Engine:** Implements a fixed-timestep physics loop for consistent frame-independent rendering across variable display refresh rates without external game libraries.
- **Automated Quality Assurance:** Includes unit testing via Vitest for physics equations and plausibility boundaries, alongside Playwright E2E suites for mobile touch controls.
