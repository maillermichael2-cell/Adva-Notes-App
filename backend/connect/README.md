## QR connections and Google OAuth

An authenticated user can request a short-lived QR token. Another authenticated
user scans that token and creates a mutual connection. QR payloads are signed
with Django's `SECRET_KEY`, expire after five minutes, and contain no profile
details. Connections are stored once per user pair, so rescanning an existing
connection is idempotent.

### Google OAuth setup

1. Create a Google OAuth 2.0 client ID for a **Web application**.
2. Add `http://localhost:3000` as an authorized JavaScript origin.
3. Add `http://localhost:8080/accounts/google/login/callback/` as an authorized
   redirect URI.
4. Add the client values to `backend/.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   FRONTEND_URL=http://localhost:3000
   FRONTEND_AUTH_REDIRECT_URL=http://localhost:3000/connect
   ```

   Do not commit OAuth credentials. For deployment, use the matching HTTPS
   frontend origin and register the exact backend callback URL with Google.
   Configure `DJANGO_SECRET_KEY` with a unique deployment secret as well; QR
   signatures and OAuth state use Django's signing key.
5. From the `apiPractice` project root, run migrations and start the local
   services:

   ```powershell
   Set-Location .\backend
   python manage.py migrate
   python manage.py runserver 8080

   Set-Location ..\frontend
   npm run dev
   ```

For non-local deployments, set `FRONTEND_URL` and
`FRONTEND_AUTH_REDIRECT_URL` to the deployed frontend origin and connect page.
Set the frontend's `VITE_API_BASE_URL` to the backend API root (including
`/api/V1`); `VITE_BACKEND_ORIGIN` can be set if the OAuth origin differs from
the API base URL's origin. Django loads backend `.env` values at startup;
restart the backend after editing that file.

The browser login route is `/accounts/google/login/`. Django-allauth completes
the Google OAuth 2.0 authorization-code flow and creates or logs in a Django
user. The browser session is then used for authenticated connect API calls.

### API contract

All endpoints are under `/api/V1/connect/`.

| Method | Endpoint | Authentication | Response / purpose |
| --- | --- | --- | --- |
| `GET` | `session/` | Public | Returns login state, the current CSRF token, and whether Google OAuth is configured. |
| `GET` | `connections/` | Django session | Returns the current profile and mutual connections. |
| `POST` | `qr-token/` | Django session + CSRF | Returns `{ "token": "...", "expires_in": 300 }` for display as a QR code. |
| `POST` | `scan/` | Django session + CSRF | Accepts `{ "token": "..." }`; creates a connection or reports an existing one. |
| `POST` | `logout/` | Django session + CSRF | Ends the current session. |

The React page requests a fresh QR token whenever needed and scans with the
device camera. Camera access requires HTTPS in deployed environments (localhost
is allowed for development).