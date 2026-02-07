# Shadow Puppet Monster

Draw a monster silhouette. Stats come from geometry: **area = HP**, **sharp corners = attack**, **symmetry = defense**, **long legs = speed**.

## Multiplayer

1. **Run the server:** `npm install && npm start`
2. **Create game:** Click "Create Game" → share the 6-letter code
3. **Join:** Other player enters code and clicks "Join"
4. **Draw:** Both draw your monsters (closed shapes)
5. **Fight:** Click "Done - Fight!" when ready. Auto-battle!

## Deploy to Render

1. Push this project to a **GitHub** repository
2. Go to [render.com](https://render.com) and sign up (free)
3. Click **New** → **Web Service**
4. Connect your GitHub account and select the repo
5. Render auto-detects Node.js. Use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Click **Create Web Service**
7. When deployed, your game URL: `https://your-service-name.onrender.com`

## Bundle Size

Game: ~7.5 KB (under 15 KB requirement)
