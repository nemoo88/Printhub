# PrintHub

A self-hosted 3D printer control dashboard for Anycubic Kobra / Klipper-based printers, with integrated ACE filament dryer control, Spoolman filament tracking, camera monitoring, and print job management.

Built with **React + Vite + TypeScript + Tailwind + shadcn/ui**, talking to **Moonraker** (Klipper) and **Spoolman** over HTTP.

---

## Features

- **Live printer status** — temps, progress, current job, remaining time
- **ACE filament dryer** — manual + auto-start synced with print duration, auto-stop on print end/cancel
- **Filament slot mapping** — auto-detects filament IDs from G-code and deducts grams from the right Spoolman spool
- **Camera monitoring** — MJPEG stream from the printer
- **Print history** — view past jobs with metadata
- **Bed mesh visualization**
- **Multi-language** — English / Swedish

---

## Architecture

```
┌─────────────┐      HTTP       ┌──────────────┐
│  Browser    │ ──────────────▶ │  Nginx       │
│  (PrintHub) │                 │  (port 80)   │
└─────────────┘                 └──────┬───────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
          ┌───────────────┐   ┌───────────────┐    ┌───────────────┐
          │  Moonraker    │   │   Spoolman    │    │   Camera      │
          │  :7125        │   │   :7912       │    │   :8080       │
          └───────────────┘   └───────────────┘    └───────────────┘
```

The app is a static SPA. All API calls go directly from the browser to the printer/services on the local network — no backend server required.

---

## Quick Start (Development)

```bash
git clone https://github.com/nemoo88/ace-dashboard-ui-ac3acc8e.git printhub
cd printhub
npm install
npm run dev
```

Open http://localhost:5173 and point it at your printer's IP in the settings dialog.

**Requirements:** Node.js 18+ and npm.

---

## Self-Hosting on a Raspberry Pi

This is the recommended setup: serve the built SPA via Nginx on the same Pi (or a separate one) on your local network.

### 1. Install dependencies on the Pi

```bash
sudo apt update
sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone and build

```bash
cd ~
git clone https://github.com/nemoo88/ace-dashboard-ui-ac3acc8e.git printhub
cd printhub
npm install
npm run build
```

### 3. Deploy to Nginx

```bash
sudo mkdir -p /var/www/printhub
sudo rsync -av --delete dist/ /var/www/printhub/
```

### 4. Configure Nginx

Create `/etc/nginx/sites-available/printhub`:

```nginx
server {
    listen 80 default_server;
    server_name _;

    root /var/www/printhub;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: long cache for static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and restart:

```bash
sudo ln -sf /etc/nginx/sites-available/printhub /etc/nginx/sites-enabled/printhub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Visit `http://<pi-ip>/` from any device on the LAN.

> **Note:** Use **HTTP**, not HTTPS. Moonraker, Spoolman and the camera stream are typically served over HTTP on the LAN, and browsers block mixed content if the dashboard runs over HTTPS.

---

## Updating

After pulling new changes:

```bash
cd ~/printhub
git pull
npm install        # only if dependencies changed
npm run build
sudo rsync -av --delete dist/ /var/www/printhub/
```

A one-liner deploy script (`deploy.sh`) you can drop in the repo root:

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
git pull
npm install
npm run build
sudo rsync -av --delete dist/ /var/www/printhub/
echo "✓ PrintHub updated"
```

---

## Configuration

All connection settings (Moonraker URL, Spoolman URL, camera URL) are configured in the in-app **Settings** dialog and stored in `localStorage` on each browser. There are no environment variables to set.

Defaults assume:
- Moonraker on `http://<same-host>:7125`
- Spoolman on `http://<same-host>:7912`
- Camera MJPEG on `http://<same-host>:8080/?action=stream`

---

## Filament Auto-Mapping

PrintHub reads filament IDs embedded in the G-code by your slicer (OrcaSlicer / Bambu Studio: set the **Filament ID** field per filament to match the Spoolman spool ID). When a print starts, each tool slot is mapped to the corresponding Spoolman spool, and grams are deducted from that spool as the print progresses.

---

## Tech Stack

- **Vite 5** + **React 18** + **TypeScript 5**
- **Tailwind CSS v3** + **shadcn/ui**
- **TanStack Query** for data fetching
- **Moonraker JSON-RPC** over HTTP
- **Spoolman REST API**

---

## License

MIT
