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

Flash the updated firmware to your device so it has the `setState` cloud function. For the calibration page, flash the Light and Audio devices with firmware that exposes `Particle.variable("lux")`, `Particle.variable("mic")`, `Particle.variable("ambient")`, and `Particle.function("setThresholds", ...)`.

### Three-device family (Master / Light / Audio)

The firmware can be built as three separate roles so one **Master** device (touch + PIR) drives one **Light** device (NeoPixel + lux) and one **Audio** device (DFPlayer + mic) over Particle events.

- **Web** always talks only to the **Master** device.

### Separate URLs per family (A–D)

- **index.html** (or `/`) = Family A — setup `0`
- **family-b.html** = Family B — setup `1`
- **family-c.html** = Family C — setup `2`
- **family-d.html** = Family D — setup `3`
- **calibration.html** = Sensor calibration — use `?setup=0`–`3` to match the family (default `0`)

**Vercel environment variables:**

| Variable | Family | Description |
|----------|--------|-------------|
| `PARTICLE_ACCESS_TOKEN` | All | Particle API token |
| `PARTICLE_DEVICE_ID` | A | Master device ID |
| `PARTICLE_LIGHT_DEVICE_ID` | A | Light device ID (required for calibration, optional for device status) |
| `PARTICLE_SOUND_DEVICE_ID` | A | Audio device ID (required for calibration, optional for device status) |
| `PARTICLE_DEVICE_ID_SETUP1` | B | Master device ID |
| `PARTICLE_LIGHT_DEVICE_ID_SETUP1` | B | Light device ID (required for calibration) |
| `PARTICLE_SOUND_DEVICE_ID_SETUP1` | B | Audio device ID (required for calibration) |
| `PARTICLE_DEVICE_ID_SETUP2` | C | Master device ID |
| `PARTICLE_LIGHT_DEVICE_ID_SETUP2` | C | Light device ID |
| `PARTICLE_SOUND_DEVICE_ID_SETUP2` | C | Audio device ID |
| `PARTICLE_DEVICE_ID_SETUP3` | D | Master device ID |
| `PARTICLE_LIGHT_DEVICE_ID_SETUP3` | D | Light device ID |
| `PARTICLE_SOUND_DEVICE_ID_SETUP3` | D | Audio device ID |

- Build and flash each role — see `../FLASHING.md` in the project root. Use `./build-all.sh` for all setups.
- Master publishes `photon/state/SETUP_ID` (private); Light and Audio subscribe and drive outputs from that state.

## Troubleshooting

If **Save to Device** shows "Failed", check the red error message below the button:

| Error | Fix |
|-------|-----|
| *Server not configured...* | Add `PARTICLE_ACCESS_TOKEN` and `PARTICLE_DEVICE_ID` in Vercel → Settings → Environment Variables, then redeploy |
| *Device not found* or *404* | Wrong Device ID — get it from [console.particle.io](https://console.particle.io) → Devices |
| *timed_out* or *503* | Device offline or sleeping — ensure it's powered and connected to Wi‑Fi; check [console.particle.io](https://console.particle.io) for status |
| *invalid_grant* or *unauthorized* | Token expired or invalid — create a new token and update Vercel env vars |
| *Function setState not found* | Flash the updated firmware; the device needs the new code with `Particle.function("setState", ...)` |
| *Network error* or *Failed to fetch* | Test on your **deployed Vercel URL** — the API only works when the app is live on Vercel, not when opened locally |

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
- `0005.mp3` — Bubble
- `0007.mp3` — Fire
- `0009.mp3` — Hitting
- `0013.mp3` — River
- `0015.mp3` — Drilling
- `0017.mp3` — Cricket
- `0019.mp3` — Rain
- `0021.mp3` — Underwater

The player will work without these files; playback will fail gracefully until you add them.

**DFPlayer SD card (on device):** Copy files onto SD root (or into `mp3/`) in this exact order: 0001, 0003, 0005, 0007, 0009, 0011, 0013, 0015, 0017, 0019, 0021. First copied = Bird, second = Crowd, etc. Use `dot_clean` on Mac to remove hidden files. To calibrate the remap table: connect Serial (115200), type `play 1` through `play 11`, note what plays for each, then update `kTrackToPlayIndex` in `v1_sensor.cpp`.

## Local Development

Open `index.html` in a browser, or run a local server:

```bash
cd web
python -m http.server 8000
# or
npx serve .
```

Then visit http://localhost:8000
