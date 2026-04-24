# Aegis Recovery Protocol

## Overview
The **Aegis Recovery Protocol** is a level-progressive health and defense system designed to mitigate the significant difficulty spike beginning at Level 3. It replaces passive health recovery with an active, skill-based energy accumulation system.

## The Aegis Gauge
A new gauge appears below the launcher starting at Level 3. It holds up to 100 Energy. When filled, the gauge triggers the **Aegis Payload**, resetting the gauge and applying defensive benefits based on the player's current level.

## Energy Generation Mechanics
Energy is gained purely through active and skillful gameplay. The mechanics unlock progressively:
- **Level 3+ | Low-Angle Intercept:** Hitting a missile with a launcher angle below 45° (+10 Energy).
- **Level 3+ | Combo Mastery:** Reaching a 3-chain (+10 Energy) or 5-chain (+25 Energy).
- **Level 4+ | Graze:** Near-misses with interceptors (+5 Energy).
- **Level 5+ | High-Altitude Intercept:** Hitting a missile above 70m altitude (+5 Energy).
- **Level 6+ | Courier Siphon:** Intercepting a Courier (gold) missile (+35 Energy).
- **Level 8+ | Scrap Recycling:** Achieving a 4-chain drops physical Scrap Orbs. Catching them with the launcher (+40 Energy).
- **Level 9+ | Medic Supply:** Intercepting a Medic (green) missile spawned during the Peak Phase (+100 Energy / Insta-fill).

## Aegis Payloads
When the gauge reaches 100 Energy, it triggers a payload that evolves as the player progresses:
- **Level 3+ | Base Heal:** Restores +20 Health.
- **Level 7+ | Defense Grid:** Along with the heal, it deploys a global horizontal shield across the ground. The shield absorbs exactly one missile impact (taking no health damage) before shattering.
- **Level 10+ | Over-Health:** The Base Heal can push the player's health beyond the maximum (100) up to 150. Over-health is displayed in gold.
- **Level 10+ | EMP Last Stand:** If the player suffers a lethal blow while the Aegis gauge is at least 50% full, the gauge breaks (offline for the rest of the run), all active missiles are destroyed, and the player is revived with 30 Health.

## UI & Audio
- **Gauge:** Located directly under the launcher, filling with a cyan gradient. Displays 'OFFLINE' in red if broken by the EMP Last Stand.
- **Shield:** A translucent blue hexagonal grid overlaid on the ground.
- **Scrap Orbs:** Pulsing green orbs falling from the sky.
- **Medic Missiles:** Green-bodied missiles with a bright green trail.
- **Audio Cues:** Distinct sounds for Aegis Trigger, Shield Shatter, Scrap Collection, and EMP Last Stand.
