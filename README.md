# Gutech LMS — Admin Portal

React web app (Create React App) for **administrators**.
Administrators: enrollment and student import, courses, terms, attendance, marks view, class schedule, account approvals, and (super admin only) managing administrators.

> **Keep this file up to date.** If a hosting account, URL, environment variable or branch rule
> changes, change it here in the same pull request.

## Where everything runs

| Part | Host | Address | Account |
|---|---|---|---|
| **Backend API** | **Render** — service `gutech-lms-backend` | https://gutech-lms-backend.onrender.com | **zohamobin@gmail.com** |
| Admin portal | **Vercel** | https://gutech-adminportal-new.vercel.app | **zohamobin@gmail.com** |
| Teacher portal | **Vercel** | https://gutech-teacherportal.vercel.app | **zohamobin@gmail.com** |
| Student portal | **Vercel** | https://gutech-studentportal-ten.vercel.app | **zohamobin@gmail.com** |
| Database | MongoDB Atlas (`Cluster0`), database `GuPortalQA` = live data | used only by the backend | — |

- **This portal (https://gutech-adminportal-new.vercel.app)** is hosted on **Vercel**, under the account **zohamobin@gmail.com**.
  Deploys, environment variables and logs are managed there.
- It calls the **Render** backend. (A second, unused copy of the backend exists on Railway; changing
  Railway settings does not affect this portal.)
- Full backend, database and release details are in the backend repo:
  https://github.com/ZohaMobin/Gutech-LMS-Backend

## Configuration

The only setting is the backend address:

| Variable | Live value | Where it is set |
|---|---|---|
| `REACT_APP_BACKEND_URL` | `https://gutech-lms-backend.onrender.com` | **Vercel → this project → Settings → Environment Variables** |

- It is **baked in when the portal is built**, so after changing it in Vercel you must **redeploy**.
- The `.env` file committed in this repo contains only a `localhost` placeholder and is **not** what
  the live site uses.
- If the browser shows a **CORS error** on login, this portal's address (`https://gutech-adminportal-new.vercel.app`, exactly, with
  `https://` and no trailing slash) must be in the backend's `CORS_ORIGINS` variable on Render.

## Branches and releases

| Branch | Meaning |
|---|---|
| `qa` | **What Vercel deploys to real users.** |
| `staging` | Integration branch: work is merged here and tested locally first. |
| `w1/…`, `fix/…`, `chore/…` | One small change each. |

Release: feature branch → `staging` → test locally → merge `staging` into `qa`. To undo a release,
revert the merge on `qa` (`git revert -m 1 <merge commit>`) and push. GitHub Actions runs the tests
and a production build on every push.

## Local development

Requirements: Node 18 or newer (CI runs Node 22).

```bash
npm ci
echo "REACT_APP_BACKEND_URL=http://localhost:5001" > .env.development.local   # git-ignored
PORT=3001 npm start
```

Run the backend locally against the **staging** database (see the backend README) — never against
live data. Other commands:

```bash
npm test -- --watchAll=false     # unit tests
npm run build                    # production build
```

## Admin-specific notes

- **Login only.** There is no sign-up here. Administrator accounts are created by the **super admin**
  from the profile menu → *Administrators*, or for the very first admin with
  `scripts/create-admin.js` in the backend repo.
- The profile menu (top right) holds **Account Approvals**, **Administrators** (super admin only),
  **Change password** and **Logout**.
- A missing `REACT_APP_BACKEND_URL` makes the app show a clear message instead of a blank page.

## Maintaining this README

Update it whenever the hosting provider or account, the portal's address, the backend address, or
the release rules change. The "Where everything runs" table is the same in all four repos; keep
them consistent.
