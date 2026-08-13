# Good News

This app is set up for Netlify deployment.

## Local development

```bash
npm install
npm run dev
```

## Deploy to Netlify

1. Push the repository to GitHub.
2. In Netlify, choose New site from Git and connect the repository.
3. Use these build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Netlify will read `netlify.toml`, including the function in `netlify/functions/article-image.mjs`.

## Notes

- GitHub Pages deployment is no longer used.
- The app keeps the GitHub Pages base path only when `NETLIFY` is not set, so Netlify builds work from `/`.
