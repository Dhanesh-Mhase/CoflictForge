# ConflictForge — Backend Service

Backend REST API service for **ConflictForge**, built with Express.js 5, Prisma ORM, MySQL, and Google OAuth 2.0 with JWT session management.

> [!NOTE]
> For the complete, in-depth architectural guide, request lifecycle breakdown, technical choices, and layer-by-layer explanation, see [TECHNICAL_DOCUMENTATION.md](file:///c:/Users/admin/Desktop/devops%20project/TECHNICAL_DOCUMENTATION.md).

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Ensure your `.env` file in `backend/.env` is configured:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://root:password@localhost:3306/conflictforge"
JWT_ACCESS_SECRET="your-strong-access-secret"
JWT_REFRESH_SECRET="your-strong-refresh-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
FRONTEND_URL="http://localhost:5173"
```

### 3. Generate Prisma Client & Sync Schema
```bash
npm run prisma:generate
npm run prisma:push
```

### 4. Start Development Server
```bash
npm run dev
```

The server will be available at `http://localhost:5000` with the health check at `GET http://localhost:5000/health`.

---

## API Endpoints Overview

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Liveness probe & timestamp |
| `POST` | `/api/auth/signin` | Public | Google ID token verification & session issuance |
| `POST` | `/api/auth/refresh` | Public (`httpOnly` cookie) | Refresh token rotation & new access token issuance |
| `POST` | `/api/auth/signout` | Public (`httpOnly` cookie) | Session deletion & cookie invalidation |
| `GET` | `/api/auth/me` | Protected (`Bearer` token) | Returns currently authenticated user profile |
