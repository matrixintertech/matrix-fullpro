# matrix-saas structure

```txt
matrix-saas/
├─ prisma/
├─ public/
├─ scripts/
├─ src/
│  ├─ actions/
│  ├─ app/
│  │  ├─ api/
│  │  └─ bank/
│  ├─ components/
│  │  ├─ layout/
│  │  ├─ service/
│  │  └─ ui/
│  ├─ lib/
│  ├─ server/
│  │  ├─ db/
│  │  ├─ integrations/
│  │  ├─ interfaces/
│  │  ├─ repositories/
│  │  └─ services/
│  ├─ services/
│  │  ├─ chat/
│  │  └─ pdf/
│  └─ types/
├─ legacy-backend-js/
│  ├─ config/
│  ├─ middleware/
│  ├─ router/
│  └─ src/modules/
└─ package.json
```

## Notes
- This repository is now the single source for both frontend and backend concerns.
- `legacy-backend-js` is included only for controlled migration of old endpoints/modules.
- New development should go into `src/app/api`, `src/server`, and `src/actions`.
