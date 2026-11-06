<p align="center">
  <img src="app/icon.png" alt="Noty logo" width="96" height="96" />
</p>

<h1 align="center">Noty</h1>

<p align="center">
  A notes-and-projects app with rich text, structured projects, and tags.<br />
  <a href="https://noty-delta.vercel.app"><strong>Live demo »</strong></a>
</p>

## Overview

Noty helps you keep notes organized. Write rich-text notes, group them into projects so related work stays together, and label projects with tags to find them later.

- **Rich-text notes** built on the Tiptap editor, with formatting, sections, and a plain-text search index.
- **Projects** that collect related notes and can link to a tag.
- **Tags** that you create and attach to projects.
- **Accounts** with cookie-based sessions, refresh tokens, and password changes.

## Tech Stack

| Area       | Technology                                         |
| ---------- | -------------------------------------------------- |
| Framework  | [Next.js](https://nextjs.org) 16 (App Router), React 19 |
| Language   | TypeScript                                         |
| Styling    | Tailwind CSS 4                                     |
| Editor     | [Tiptap](https://tiptap.dev)                       |
| Database   | PostgreSQL with [Prisma](https://www.prisma.io) 7 |
| Auth       | JWT via [jose](https://github.com/panva/jose), bcrypt for passwords |
| Testing    | Vitest, Testing Library, Testcontainers            |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20.9 or later
- A PostgreSQL database (any local or hosted instance)
- [Docker](https://www.docker.com) if you want to run the integration tests

### Installation

1. Clone the repository and install dependencies:

   ```bash
   git clone <your-repo-url> noty
   cd noty
   npm install
   ```

2. Create a `.env` file from the example and fill in the values:

   ```bash
   cp .env.example .env
   ```

   | Variable       | Description                                                  |
   | -------------- | ------------------------------------------------------------ |
   | `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:password@localhost:5432/noty` |
   | `JWT_SECRET`   | Secret used to sign access tokens                            |

3. Sync the database schema and generate the Prisma client:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

   The SQL migrations in [`docs/db/`](docs/db) are the source of truth for the schema. `prisma db push` applies the same schema from `prisma/schema.prisma`.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

> [!WARNING]
> Use a long, random value for `JWT_SECRET` in any environment that is reachable from the internet. Anyone who knows the secret can forge sessions.

## Scripts

| Command                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| `npm run dev`             | Start the development server                 |
| `npm run build`           | Build the app for production                 |
| `npm run start`           | Serve the production build                   |
| `npm run lint`            | Run ESLint                                   |
| `npm test`                | Run unit tests                               |
| `npm run test:watch`      | Run unit tests in watch mode                 |
| `npm run test:integration`| Run integration tests against a real database |

> [!NOTE]
> Integration tests start a temporary PostgreSQL container with Testcontainers, so Docker must be running.

## Project Structure

```text
app/           Next.js routes: landing page, auth pages, dashboard, and API routes
components/    React components for the dashboard, auth, and shared UI
services/      Business logic for notes, projects, tags, and auth
validators/    Input validation schemas
types/         Shared TypeScript types
lib/           Utilities: API helpers, Prisma client, JWT and cookie handling
prisma/        Prisma schema and generated client
docs/          SQL migrations and the OpenAPI specification
__test__/      Unit and integration tests
```

## API

The REST API lives under `/api` and uses cookie-based authentication. Endpoints cover auth, tags, projects, and notes, and collection responses are paginated.

The full specification is in [`docs/api/openapi.yaml`](docs/api/openapi.yaml). You can open it in any OpenAPI viewer, such as [Swagger Editor](https://editor.swagger.io).

## Deployment

Noty is deployed on Vercel at [noty-delta.vercel.app](https://noty-delta.vercel.app).

To deploy your own copy, import the repository into Vercel and set `DATABASE_URL` and `JWT_SECRET` as environment variables. Run the schema sync against your production database before the first deploy.
