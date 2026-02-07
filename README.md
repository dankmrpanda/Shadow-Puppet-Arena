# Shadow Puppet Arena

Draw a shape silhouette. Up to 6 players battle in a real-time arena! Shape affects behavior: **spiky = pushes others**, **round = stable**, **legs = speed**.

**Play now:** [https://shadow-puppet-arena.onrender.com/](https://shadow-puppet-arena.onrender.com/) *(first load may take ~30 sec on free tier)*

## Multiplayer

1. **Create game:** Click "Create Game" → share the QR code or 4-letter code
2. **Join:** Scan QR or enter code (or open the join URL directly)
3. **Draw:** All players draw shapes (closed loops)
4. **Arena:** When everyone submits, shapes battle in real-time!

## Game Mechanics

### How Drawing Affects Stats

| Draw This | Stat | Effect in Battle |
|-----------|------|------------------|
| **Large, filled shape** | HP | More health (60-150) |
| **Sharp, jagged edges** | Spikes | Deal more collision damage |
| **Round, symmetrical** | Stability | Take less damage, resist knockback |
| **Long protrusions** | Speed | Move faster across arena |

### Special Abilities

Shapes unlock unique abilities based on their geometry:

| Shape Type | Ability | Effect |
|------------|---------|--------|
| **Star** (5+ corners) | **Spike Burst** | 20 AoE damage to nearby enemies |
| **Circle** (Round) | **Absorb** | Passive: Heal for 50% of damage dealt |
| **Snake** (Long/Legs) | **Dash** | Burst of extreme speed (3s) |
| **Square** (4 corners) | **Block** | Turn invincible for 3s |

### Power-Ups & Hazards

Collect power-ups to gain an advantage:

- ⚡ **Speed Boost** (Yellow): 2x movement speed for 5s
- 🛡️ **Shield** (Blue): Immune to all damage for 3s
- 💥 **Damage Boost** (Red): 2x spike damage for 5s
- 👻 **Ghost** (White): Pass through enemies for 4s

Watch out for hazards appearing later in the match:

- � **Fire Zones**: Deal damage over time
- 🌀 **Vortexes**: Pull shapes towards the center
- ⚡ **Lightning**: Strikes random spots for massive damage

### Combat System

- **Collision damage** = attacker's spikes − defender's stability
- **Velocity Bonus** = significant damage boost when hitting at high speed (💨)
- **Team Mode** = automatic 2v2 or 3v3 teams (Red vs Blue) with no friendly fire
- **Sudden Death** = arena border turns red, continuous damage until one remains!

### Tips

- Draw a **star** for offense or a **circle** for tankiness
- Use **Blast** to push enemies into the shrinking border
- **Charge** at enemies for bonus velocity damage!
- Work with your team to corner opponents

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

**Compress** the offline HTML into a `.tar.gz` archive:

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Path "index_temp" -Force | Out-Null
Copy-Item "offline.html" "index_temp\index.html" -Force
tar -czf "offline.tar.gz" -C "index_temp" "index.html"
Remove-Item -Recurse -Force "index_temp"
```

```bash
# Linux / macOS
mkdir -p index_temp
cp offline.html index_temp/index.html
tar -czf offline.tar.gz -C index_temp index.html
rm -rf index_temp
```

**Verify** by extracting and serving locally:

```powershell
# Windows (PowerShell) — serves on port 8080
./verify.ps1 offline.tar.gz
```

```bash
# Linux / macOS — serves on port 8000
./verify.sh offline.tar.gz
```

## Bundle Size

Online Version: ~30 KB (uncompressed)
**Contest Offline Version:** ~8.3 KB (Compressed .tar.gz)
