# NeuralMigrate — Frontend

React + Vite frontend for the NeuralMigrate code migration platform.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (default: `http://localhost:8080`) |

## Build for production

```bash
npm run build
# Output goes to dist/
npm run preview   # preview the production build locally
```

## Deploy to Vercel

1. Import this repo in Vercel
2. Set root directory to `frontend`
3. Framework preset: `Vite`
4. Add `VITE_API_URL` environment variable pointing to your Render backend
5. Deploy — Vercel handles the rest

The `vercel.json` in this folder configures SPA routing so all paths serve `index.html`.
