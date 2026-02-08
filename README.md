# Shadow Puppet Arena

Draw a shape silhouette. Battle AI opponents in a real-time arena! Shape geometry determines your stats: **spiky = damage**, **round = tanky**, **long limbs = speed**.

**Play online (multiplayer):** [https://shadow-puppet-arena.onrender.com/](https://shadow-puppet-arena.onrender.com/) *(first load may take ~30 sec on free tier)*

## How to Play

### Offline (vs AI)

1. Pick a mode: **1 vs 1**, **1 vs 3**, or **1 vs 5**
2. **Draw** a shape in one stroke (it auto-closes) — or click **Load Scotty** for a preset Scottish Terrier shape
3. Click **Fight!** to enter the arena
4. Move with **WASD / Arrow Keys**, press **Space** to Blast, **E / Shift** for your Ability

### Multiplayer

1. **Create game:** Click "Create Game" → share the QR code or 4-letter code
2. **Join:** Scan QR or enter code (or open the join URL directly)
3. **Draw:** All players draw shapes (closed loops)
4. **Arena:** When everyone submits, shapes battle in real-time!

## Game Mechanics

### How Drawing Affects Stats

| Draw This | Stat | Effect in Battle |
|-----------|------|------------------|
| **Sharp, jagged edges** | Spikes (max 5) | Deal more collision damage |
| **Round, symmetrical** | Stability (max 2) | Take less damage, resist knockback |
| **Round, symmetrical** | HP (80–150) | More health from higher symmetry |
| **Long protrusions** | Speed (1.0–1.5) | Move faster across arena |

### Special Abilities

Shapes unlock a unique ability based on their geometry:

| Shape Type | Ability | Effect |
|------------|---------|--------|
| **Circle** (≤1 corner, high symmetry) | **Absorb** | Passive: Heal for 50% of damage dealt on collision |
| **Snake** (3+ long segments) | **Dash** | 3s speed burst + instant velocity boost |
| **Square/Star** (4+ corners) | **Block** | 3s invincibility shield |

Abilities have a **10-second cooldown** (shown on the button).

### Combat & Physics

- **Collision damage** = (attacker's spikes − defender's stability) × 3, multiplied by velocity factor
- **Velocity bonus** = damage scales with speed — faster hits deal more damage (yellow damage numbers)
- **Damage boost** power-up doubles spike damage; **Shield** negates all damage
- **Ghost** effect lets you pass through enemies (no collision)
- **Knockback** on collision based on combined spike/stability difference
- **I-frames:** 20 ticks of invulnerability after each hit to prevent instant kills
- **Low-HP speed boost:** Shapes move faster as they lose health (up to 3× at critical HP)
- **Shrinking size:** Shapes visually shrink as HP drops

### Power-Ups

Collect colored orbs to gain a temporary buff:

| Power-Up | Color | Duration | Effect |
|----------|-------|----------|--------|
| ⚡ Speed | Yellow | 5s | 2× movement speed |
| 🛡️ Shield | Blue | 3s | Immune to all damage |
| 💥 Damage | Red | 5s | 2× spike damage on collision |
| 👻 Ghost | Gray | 4s | Pass through enemies, no collision |

### Hazards

Appear later in the match as the battle intensifies:

| Hazard | Effect |
|--------|--------|
| 🔥 **Fire Zones** | 3 damage per tick to shapes inside (radius 50) |
| 🌀 **Vortexes** | Pull shapes toward the center (radius 100) |
| ⚡ **Lightning** | Warning circle appears, then strikes for 25 damage after 1 second |

### Arena Events

- **Health Packs** (green ✚) spawn periodically — heal 20–50 HP on pickup
- **Arena Shrinks** every ~10 seconds — border turns red, out-of-bounds area is deadly
- **Sudden Death** triggers when the arena is very small — all unshielded shapes take 2 damage/second
- **Blast** (Space / button) — pushes all nearby enemies away with a shockwave (3s cooldown)

### Big Arena Events (Simulation Mode)

Every **7 seconds**, a massive arena-wide event triggers with a 2-second warning buildup. Each event has an equal chance of occurring:

| Event | Visual | Effect |
|-------|--------|--------|
| ☄️ **Meteor Shower** | Fireballs rain from the sky with streaks, impact craters, red sky tint | Each meteor deals up to 15 damage + knockback in a 70px radius |
| 💥 **Shockwave** | Triple expanding rings from center + white flash + heavy screen shake | 12 damage to all + massive outward push wave |
| 🌑 **Eclipse** | Arena goes dark, stars twinkle, eerie purple glow | 3 damage to all every ~0.6s while darkness lasts |
| 🌀 **Gravity Surge** | 12 spiraling purple vortex lines converge to center + glowing core | Pulls all monsters to center; 5 damage if caught in the core |
| ❄️ **Frost Nova** | Blue arena tint, animated ice crystals, frozen glowing border | Halves all monster speeds + periodic 2 damage ticks |
| 🔥 **Inferno** | Orange fire gradient rising from floor, 40 flame particles, heat shimmer waves | 4 damage to all every ~0.4s + random velocity jitter |

### Controls

| Action | Keyboard | Button |
|--------|----------|--------|
| Move | WASD / Arrow Keys | — |
| Blast | Space | Blast |
| Ability | E / Shift | Ability |

### Load Scotty

Click the **Load Scotty** button on the draw screen to load a pre-made Scottish Terrier silhouette with boosted stats (max spikes, speed, and symmetry). It's an overpowered preset for fun!

### Tips

- Draw a **star** for Block or a **circle** for tankiness (Absorb)
- Use **Blast** to push enemies into the shrinking border for sudden death damage
- **Charge** at enemies at full speed for bonus velocity damage
- Pick up **Ghost** to safely reposition, then ambush when it wears off
- Low on health? Your speed boost kicks in — use it to kite and grab health packs

## Deploy to Render

- **Build Command:** `npm install`
- **Start Command:** `npm start`

## Contest Entry (Offline Mode)

This repository includes a standalone, offline-compatible version of the game designed for the 15KB challenge.

- **Artifact:** `shadow-puppet-arena.tar.gz` (contains `dist/index.html`)
- **Bundle Size:** ~8.3 KB (well under the 15KB limit)
- **Features:**
  - Single-player vs AI opponents (No network requests)
  - Full game mechanics (drawing, physics, abilities, power-ups, hazards)
  - Works completely offline (tested with `verify.ps1`)

### How to Compress & Verify

**One-step** (compress + verify) using the helper script:

```powershell
# Windows (PowerShell) — compresses then serves on port 8080
./compress-and-verify.ps1 offline.html
```

**Manual steps** if you prefer:

```powershell
# Windows (PowerShell): Compress
New-Item -ItemType Directory -Path "index_temp" -Force | Out-Null
Copy-Item "offline.html" "index_temp\index.html" -Force
tar -czf "offline.tar.gz" -C "index_temp" "index.html"
Remove-Item -Recurse -Force "index_temp"

# Verify — serves on port 8080
./verify.ps1 offline.tar.gz
```

```bash
# Linux / macOS: Compress
mkdir -p index_temp
cp offline.html index_temp/index.html
tar -czf offline.tar.gz -C index_temp index.html
rm -rf index_temp

# Verify — serves on port 8000
./verify.sh offline.tar.gz
```

## Bundle Size

Online Version: ~30 KB (uncompressed)
**Contest Offline Version:** ~8.3 KB (Compressed .tar.gz)
