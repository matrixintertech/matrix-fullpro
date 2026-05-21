# matrix-saas

Unified full-stack SaaS project in a single Next.js 15 App Router codebase.

## Stack
- Next.js 15 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Tailwind CSS

## Project Structure
- `src/app`: Routes + API route handlers
- `src/components`: Shared UI components (`layout`, `service`, `ui`)
- `src/server`: Server-side DB/repository/service code
- `src/actions`: Server Actions
- `src/services`: Integration/service stubs
- `prisma`: Schema + migrations
- `legacy-backend-js`: Legacy Express/Mongo backend code kept for migration reference

## Phase Notes
- Twilio chat is stubbed in `src/server/integrations/twilio.ts`
- Puppeteer PDF generation is intentionally stubbed in `src/services/pdf/pdf.stub.ts`
- Legacy JS backend remains in `legacy-backend-js` for endpoint-by-endpoint migration to Next APIs

## Setup
1. Copy env file:
```bash
cp .env.example .env.local
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Prisma generate + migrate:
```bash
npm run prisma:generate
npx prisma migrate dev --name init
```

4. Run app:
```bash
npm run dev
```

## Useful Scripts
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run db:mongo-to-postgres`

## Migration Workflow
1. Keep business logic in `src/server/services`
2. Keep DB access in `src/server/repositories`
3. Expose APIs via `src/app/api/*`
4. Use `legacy-backend-js/src/modules/*` as source mapping reference while porting routes
