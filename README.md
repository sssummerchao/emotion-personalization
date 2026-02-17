# Photon Control Dashboard

A web dashboard for controlling emotion state, light colors, sound tracks, and motor speed. Designed for Vercel deployment.

## Features

- **Emotion State**: Toggle between Positive and Negative
- **Light Color Switcher**: 6 gradient schemes (pink, blue, green, orange, purple, red)
- **Music Player**: 8 sound tracks with play/pause
- **Motor Speed**: Slider from Fast to Slow

## Connect to Particle/Photon

The web app syncs color, music, and motor settings to your Particle device. Set these in Vercel:

1. **Get your Particle access token**: Run `particle token create` or create one at [console.particle.io](https://console.particle.io)
2. **Get your Device ID**: In the Particle Console, open your device and copy the Device ID
3. In Vercel: Project → **Settings** → **Environment Variables**
   - `PARTICLE_ACCESS_TOKEN` = your token
   - `PARTICLE_DEVICE_ID` = your device ID
4. Redeploy after adding variables

Flash the updated firmware to your device so it has the `setState` cloud function.

## Deploy to Vercel

1. Push this `web` folder to a GitHub repo (or create a new repo with just the web files)
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click **Add New Project** → Import your repository
4. Set **Root Directory** to `web` if the repo contains other files
5. Add the Particle env vars (see above)
6. Deploy — no build step needed (static site)

## Audio Files

Add your MP3 files to the `music/` folder with these names:

- `0001.mp3` — Bird
- `0003.mp3` — Crowd noise
- `0005.mp3` — Forest
- `0007.mp3` — Static noise
- `0009.mp3` — Hitting
- `00011.mp3` — River
- `00013.mp3` — Rain
- `00015.mp3` — Drilling

The player will work without these files; playback will fail gracefully until you add them.

## Local Development

Open `index.html` in a browser, or run a local server:

```bash
cd web
python -m http.server 8000
# or
npx serve .
```

Then visit http://localhost:8000
