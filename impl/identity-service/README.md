# identity-service

PT Kharade Drycleaners — Identity, Auth, RBAC, Customers, Vendors, Tenants and Branches.

## Run locally

```bash
cd impl
npm install
npm run up                              # bring up postgres + redis
npm run identity:dev                    # http://localhost:4001
```

Health check: `GET /health-check`

## Folder layout

```
src/
├── api/                  domain modules (controller, routes, validator, auth)
├── auth/                 authenticator middlewares (user + client-app)
├── common/               api errors, response handler, utilities
├── config/               configuration manager + json overrides
├── database/             TypeORM data source, models, services, mappers
├── domain.types/         enums + DTOs
├── events/               domain event initializer
├── logger/               winston-backed logger
├── middlewares/          common + error-handling middleware
├── modules/              module injector (email, sms, cache, etc.)
├── startup/              loader, injector, route-handler, seeder, scheduler
├── app.ts                singleton bootstrap
└── index.ts              entry point
```
