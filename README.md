# ai.azvai.com (Portfolio + Vibecoding Playground)

## Infra
- Astro frontend
- GitHub repository
- Netlify deployment

## Routes
- `/projects` and `/projects/project-name`
- `/training` — hub for all training tools
- `/training/ai-coach-chatbot` — AI tutor with PDF/image context and LaTeX support
- `/training/pdf-quiz-generator` — generate quizzes from uploaded PDFs
- `/training/leadership-decision-simulator` — interactive leadership scenarios

## Netlify Environment Variables
- `LUMINATION_API_BASE_URL` (example: `https://your-host.com`)
- `LUMINATION_API_KEY`

API routes (SSR):
- `POST /api/training/ai-coach-chatbot`
- `POST /api/training/pdf-quiz-generator`
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
