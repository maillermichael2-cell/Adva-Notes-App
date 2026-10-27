# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## API configuration

All backend requests are defined in `src/api/client.js`. The API base URL comes from
`VITE_API_BASE_URL`; for local development, copy `.env.example` to `.env.local` and
adjust the URL if the Django server is not running at `http://localhost:8080`.

## Deploying to Render

The repository-root `render.yaml` defines both the Django API and this static frontend.
Create a Blueprint from the repository and set the backend `DATABASE_URL` to the Supabase
transaction-pooler URL. Render generates `DJANGO_SECRET_KEY`. Add the Google OAuth client
ID and secret if Google sign-in is enabled.

The Blueprint configures the frontend URL on Django for credentialed CORS and CSRF requests,
and sets the frontend's API base URL to the backend service. If you use a custom domain or
Render assigns different service URLs, update `FRONTEND_URL` on the backend and
`VITE_API_BASE_URL` on the frontend to match, then redeploy the frontend so Vite rebuilds
with the updated URL.

For Google sign-in, add
`https://api-practice-backend.onrender.com/accounts/google/login/callback/` to the
Google OAuth client's authorized redirect URIs.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
