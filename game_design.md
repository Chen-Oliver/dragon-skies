# Game Design Document: Dragon Skies

## 1. Overview

- **Genre:** Multiplayer 3D Action/Fantasy
- **Platform:** Web (using Three.js)
- **Perspective:** Third-person point of view (POV)
- **Target Audience:** Teens and adults who enjoy fantasy settings, multiplayer interaction, and competitive gameplay
- **Unique Selling Points:**
  - Control and grow your own dragon from a baby to a formidable beast
  - Free-flight mechanics in a 3D medieval world
  - Multiplayer combat with fireball attacks
  - Dynamic progression system tied to exploration and player interaction

*Dragon Skies* is a web-based, multiplayer game where players spawn as baby dragons in a medieval-inspired open world. They fly through the skies collecting experience points to level up, growing in size and health while engaging in aerial combat with other players using fireballs. When a dragon’s health depletes, it dies and resets to level 1, creating a cycle of growth and competition.

---

## 2. Game Mechanics

### 2.1 Player Characters: Dragons

- **Starting State:** Players begin as small baby dragons.
- **Growth:** Dragons increase in size and health as they level up (details in *Section 2.5*).
- **Abilities:**
  - **Flight:** Free movement in 3D space.
  - **Fireball Attack:** A projectile fired from the dragon’s mouth to damage other players.
- **Attributes:**
  - **Health Points (HP):** Base value increases with level.
  - **Experience Points (XP):** Collected to level up.
  - **Level:** Determines size, health, and fireball strength (max level: 10).

### 2.2 Game World

- **Setting:** A 3D medieval-themed environment.
  - **Sky:** Wide open field for flying, populated with floating experience point orbs.
  - **Ground:** Features castles, villages, houses, forests, and mountains for visual depth (dragons cannot land).
- **Collectibles:**
  - **Experience Orbs:** Small glowing spheres scattered in the sky.
  - **Distribution:** Randomly placed, respawn every 30 seconds.
  - **Interaction:** Collected by flying through them.

### 2.3 Flying Mechanics

- **Controls:**
  - WASD: Directional movement (forward, backward, strafe left, strafe right).
  - Mouse: Camera control and aiming.
  - Spacebar: Ascend.
  - Shift: Descend.
- **Physics:**
  - Gravity applies; dragons must periodically flap wings to maintain altitude.
  - Speed and maneuverability remain constant across levels for balance.
- **Feedback:** Wing-flapping animations and sound effects enhance immersion.

### 2.4 Collecting Experience

- **Method:** Players fly through experience orbs to collect them.
- **Feedback:** Visual glow and a satisfying “ping” sound upon collection.
- **Respawn:** Orbs reappear in random sky locations every 30 seconds.

### 2.5 Leveling Up

- **Progression:** XP required increases exponentially per level (see *Section 6* for table).
- **Effects of Leveling Up:**
  - **Size:** Increases by 10% per level.
  - **Health:** Increases by 20 HP per level.
  - **Fireball Damage:** Increases by 1 damage point per level.
- **Max Level:** 10.
- **Feedback:** Visual growth animation, level-up sound, and HUD update.

### 2.6 Combat System

- **Fireball Mechanics:**
  - **Type:** Straight-line projectile shot from the dragon’s mouth.
  - **Range:** 50 meters.
  - **Cooldown:** 2 seconds between shots.
  - **Aiming:** Manual targeting via mouse.
  - **Damage:** Base 10 damage + 1 per level (e.g., Level 5 = 15 damage).
- **Health System:**
  - **Base HP:** 100 at Level 1.
  - **Increase:** +20 HP per level (e.g., Level 5 = 200 HP).
  - **Regeneration:** 1 HP per second when not taking damage.
- **Display:** Health bar visible on HUD.

### 2.7 Death and Reset

- **Condition:** Health reaches zero.
- **Consequence:** Dragon dies, player resets to Level 1 with 100 HP.
- **Respawn:** After a 10-second delay at a random spawn point in the sky.
- **Feedback:** Death animation (e.g., dragon falls with smoke), respawn countdown.

---

## 3. Multiplayer

### 3.1 Networking

- **Architecture:** Authoritative server to manage game state and prevent cheating.
- **Technology:** WebSocket for real-time communication.
- **Player Capacity:** Up to 20 players per server instance.
- **Synchronization:** Server updates positions, health, levels, and combat actions every tick.

### 3.2 Player Interaction

- **Visibility:** Players see each other’s dragons with name tags and level indicators above them.
- **Combat:** Free-for-all; no friendly fire restrictions (all players are opponents).
- **Communication:** Simple text chat system for basic interaction (e.g., “Nice shot!”).

---

## 4. Technical Specifications

### 4.1 Graphics

- **Engine:** Three.js
- **Assets:**
  - **Dragons:** 3D model chibi.
  - **Environment:** Modular medieval assets (castles, houses, trees).
  - **Effects:** Particle systems for fireballs (fire trail) and orbs (glow).
- **Requirements:** Optimized for web performance, targeting 60 FPS on mid-range hardware.

### 4.2 Physics

- **Flight:** Custom physics for smooth 3D movement with gravity and wing flapping.
- **Collisions:** Detection for collecting orbs and fireball hits (no environmental collisions).

### 4.3 User Interface (UI)

- **HUD:**
  - Health bar (top left).
  - Experience bar (bottom center).
  - Level indicator (next to XP bar).
- **Menus:**
  - Main menu: Start, settings, exit.
  - Settings: Audio levels, graphics quality.
  - Login: Simple username entry for multiplayer identification.

### 4.4 Sound

- **Music:** Looping medieval/fantasy background track.
- **Effects:**
  - Wing flaps (during flight).
  - Fireball shot and hit (whoosh and explosion).
  - Orb collection (ping).
  - Level up (triumphant chime).
  - Death (dramatic crash).

---

## 5. Art and Animation

- **Dragons:**
  - Animations: Flying (wing flaps), fireball shot (mouth opens), damage taken (flinch), death (falling spiral).
- **Environment:**
  - Static 3D models for castles, houses, etc., with medieval textures (stone, wood).
- **Effects:**
  - Fireballs: Red-orange projectile with trailing flames.
  - Orbs: Glowing spheres with subtle pulsing animation.

---

## 6. Progression System

- **Experience Table:**
  | Level | XP Required | Total XP |
  |-------|-------------|----------|
  | 1–2   | 100         | 100      |
  | 2–3   | 200         | 300      |
  | 3–4   | 300         | 600      |
  | 4–5   | 400         | 1,000    |
  | 5–6   | 500         | 1,500    |
  | 6–7   | 600         | 2,100    |
  | 7–8   | 700         | 2,800    |
  | 8–9   | 800         | 3,600    |
  | 9–10  | 900         | 4,500    |

- **Attributes per Level:**
  - **Size:** Base size × (1 + 0.1 × level) (e.g., Level 5 = 1.5× base size).
  - **Health:** 100 + (20 × level) (e.g., Level 5 = 200 HP).
  - **Fireball Damage:** 10 + (1 × level) (e.g., Level 5 = 15 damage).

---

## 7. Game Flow

- **Start:** Players join a server, spawn as Level 1 baby dragons at random sky points.
- **Core Loop:**
  - Fly to collect experience orbs and level up.
  - Engage in combat with other players using fireballs.
- **Death:** If HP hits zero, players die, wait 10 seconds, and respawn at Level 1.
- **Objective:** No formal endgame; players compete for dominance and personal growth in an ongoing world.

---

## 8. Monetization (Optional)

- **Cosmetics:** In-game purchases for dragon skins (e.g., golden scales, blue flames) or fireball effects.
- **Ads:** Banner ads on the main menu for free players (optional premium ad-free version).

---

## 9. Development Milestones

- **Prototype (1–2 months):**
  - Basic flight mechanics, simple environment, orb collection.
- **Alpha (3–4 months):**
  - Multiplayer networking, combat system, leveling mechanics.
- **Beta (2–3 months):**
  - Polished graphics, sound integration, UI refinement, bug fixes.
- **Release:**
  - Fully functional game with all features implemented.

---

## 10. Team Roles

- **Programmers:** Implement game logic, networking, physics, and Three.js rendering.
- **Artists:** Design and create 3D models, textures, and animations.
- **Designers:** Balance gameplay (XP rates, combat), design world layout, and UI.
- **Sound Engineers:** Compose music and produce sound effects.

---

## Additional Notes

- **Balance:** To prevent high-level players from dominating, consider bonus XP for defeating stronger dragons (e.g., +50 XP per level of defeated dragon).
- **Scalability:** The document assumes a small-scale game (20 players/server). For larger audiences, adjust server capacity and world size accordingly.
- **Future Features:** Optional additions like NPC enemies, team modes, or environmental hazards could enhance replayability.