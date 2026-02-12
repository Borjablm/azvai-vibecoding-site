# ai.azvai.com (Portfolio + Vibecoding Playground)

## Infra
- Astro frontend
- GitHub repository
- Netlify deployment

## Routes
- `/projects`
- `/projects/project-name`
- `/training`
- `/training/course-name`
- `/training/leadership-decision-simulator`

## Netlify Environment Variables
- `LUMINATION_API_BASE_URL` (example: `https://your-host.com`)
- `LUMINATION_API_KEY`

The simulator calls Lumination through a server route:
- `POST /api/training/leadership-decision-simulator`

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```
