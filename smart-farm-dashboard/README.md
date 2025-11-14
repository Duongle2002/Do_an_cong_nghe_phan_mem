# Smart Farm Dashboard (React)

A minimal React app to test the Smart Farm API and visualize device telemetry.

## Features
- Login (JWT) and token storage
- List devices
- Device detail with charts (temperature, humidity, soil moisture)
- Send control commands (fan, light, pump, main)

## Setup

1. Copy .env.example to .env and set the API base URL:

```
VITE_API_BASE_URL=http://localhost:3000
```

2. Install and run (PowerShell):

```powershell
npm install
npm run dev
```

The app opens at http://localhost:5173

## Build

```powershell
npm run build
npm run preview
```
