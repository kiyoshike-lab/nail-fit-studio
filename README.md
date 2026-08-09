# Nail Fit Studio Next

Next.js / TypeScript / React App Router version of Nail Fit Studio.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deploy to Vercel

1. Push this `nail-fit-studio-next` directory to GitHub.
2. In Vercel, import the repository.
3. Set the project root / root directory to:

```text
nail-fit-studio-next
```

4. Framework preset: Next.js.
5. Build command: `npm run build`.
6. Install command: `npm install`.

The current app keeps all image assets under `public/assets`, so Vercel can serve them without extra storage settings.
