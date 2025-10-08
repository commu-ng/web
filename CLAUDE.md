# commu-ng

Don't try to run servers on your own. They are already running.

Don't use "any" type.

We use pnpm, not npm.

We use biome for linting and formatting: `pnpm biome lint --write` and `pnpm biome format --write`. Run formatter and linter command after file changes.

Use `psql commu_ng` to connect to the development PostgreSQL database.

## Caddyfile

Caddy configuration file that proxies the requests to api, console, and app in development environment.

## api

Hono API server. Uses Hono RPC, Drizzle ORM.

Run tests with `pnpm test`.

## console

React Router frontend for management console.

When adding routes, updates to `app/routes.ts` is required.

## app

React Router frontend for application, set up per-subdomain.

When adding routes, updates to `app/routes.ts` is required.
