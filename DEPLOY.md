# Deploying ConflictForge to AWS EC2

The whole app runs on one EC2 instance with Docker Compose:

| Container | What it does |
|---|---|
| `web` (Caddy) | Serves the React build, proxies `/api/*` to the backend, gets and renews HTTPS certificates automatically |
| `backend` | Node/Express API; runs `prisma db push` on start to create or update tables |
| `db` | MySQL 8.4, data stored in the `mysql_data` volume, not exposed to the internet |

HTTPS is required. Google Sign-In won't run on a plain-HTTP public origin, and the refresh cookie is `secure` in production.

---

## 1. Launch the instance (AWS console)

1. **EC2 → Launch instance**
   - AMI: **Ubuntu Server 24.04 LTS**
   - Type: **t3.small** (2 GB RAM). A t3.micro works only if you add swap (step 3).
   - Key pair: create or select one so you can SSH in.
   - Storage: 20 GB gp3.
2. **Security group, inbound rules:**
   - SSH, TCP 22, **My IP** only
   - HTTP, TCP 80, 0.0.0.0/0 (needed for the certificate challenge and the redirect to HTTPS)
   - HTTPS, TCP 443, 0.0.0.0/0
   - Do **not** open 3306 or 5000.
3. **Elastic IPs → Allocate → Associate** it with the instance so the IP survives reboots.

## 2. Point a domain at it

- **Own a domain:** add a DNS **A record**, e.g. `conflictforge.yourdomain.com` → your Elastic IP.
- **No domain:** use `sslip.io`, which needs no setup. For IP `3.110.45.12`, use `3-110-45-12.sslip.io`.

This value is `DOMAIN` below.

## 3. Install Docker on the instance

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # log out and back in so the group change applies

# Only if you chose t3.micro: add 2 GB swap so the builds don't run out of memory
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Get the code onto the server

```bash
git clone <your-repo-url> conflictforge   # or scp/rsync the folder
cd conflictforge
```

## 5. Configure secrets

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in every value. Generate the passwords and secrets with `openssl rand -hex 32`.

## 6. Update Google OAuth (Google Cloud Console)

**APIs & Services → Credentials →** your OAuth client ID → **Authorized JavaScript origins** → add `https://<DOMAIN>`. Changes can take a few minutes to apply.

## 7. Start it

```bash
docker compose --env-file .env.production up -d --build
docker compose logs -f        # watch for "Server running" and Caddy obtaining the certificate
```

Open `https://<DOMAIN>`. Health check: `https://<DOMAIN>/health`.

---

## Current deployment

| | |
|---|---|
| URL | https://3-219-14-5.sslip.io |
| Region | us-east-1 |
| Instance | `i-04bc29152bf7ab473` (t3.micro, Ubuntu 24.04, 2 GB swap) |
| Elastic IP | 3.219.14.5 (`eipalloc-06729eae44087ce19`) |
| Security group | `sg-0f03e0670c9f5fed6` (SSH limited to one admin IP; 80/443 open) |
| SSH | `ssh -i ~/.ssh/conflictforge-key.pem ubuntu@3.219.14.5` |
| App directory | `~/conflictforge` (`.env` is a symlink to `.env.production`, so plain `docker compose …` works) |

## Continuous deployment (Jenkins)

**Pushing to `main` deploys automatically.** Jenkins checks GitHub about every 2 minutes, or instantly once the webhook below is added. It then runs the [Jenkinsfile](Jenkinsfile): build images → `docker compose up -d` → health check. The MySQL data and HTTPS certificates are kept between deploys.

| | |
|---|---|
| Jenkins UI | https://jenkins.3-219-14-5.sslip.io (user `admin`) |
| Admin password | `ssh -i ~/.ssh/conflictforge-key.pem ubuntu@3.219.14.5 'grep JENKINS_ADMIN_PASSWORD ~/conflictforge/jenkins/.env'` |
| Job | `conflictforge-deploy`, defined in [jenkins/casc.yaml](jenkins/casc.yaml) |
| Jenkins stack | `~/conflictforge/jenkins` (separate compose project, so a deploy never restarts Jenkins) |
| Branch watched | `DEPLOY_BRANCH` in `~/conflictforge/jenkins/.env`, then `docker compose up -d` in that folder |
| Changing Jenkins itself | Edits to `jenkins/` are **not** auto-applied (Jenkins can't safely restart itself mid-build). After merging them: `cd ~/conflictforge && git -C . pull 2>/dev/null; rsync` the `jenkins/` folder, then `cd jenkins && docker compose up -d --build` |

Secrets never appear in the compose files: containers load them with `env_file`, and the pipeline's **Validate config** stage stops a deploy if a required setting is missing. Keep it that way, because GitGuardian checks every PR for `PASSWORD: …`-style values.

**Optional: instant builds through a GitHub webhook** (needs admin on the repo): Settings → Webhooks → Add webhook
- Payload URL: `https://jenkins.3-219-14-5.sslip.io/github-webhook/`
- Content type: `application/json`, event: **Just the push event**

**Secrets live only on the server:** `~/conflictforge/.env.production` (app) and `~/conflictforge/jenkins/.env` (Jenkins). Jenkins mounts the app file read-only. Don't overwrite `.env.production`: changing `MYSQL_PASSWORD` there locks the app out of the existing database.

**Sandbox is enabled:** the backend container has the host Docker socket (root-equivalent). To disable it, remove the `volumes`/`group_add` blocks from the `backend` service in [docker-compose.yml](docker-compose.yml) and push.

### Manual redeploy (fallback if Jenkins is down)

The code is copied from a local checkout with rsync, not git-cloned:

```bash
rsync -az -e "ssh -i ~/.ssh/conflictforge-key.pem" \
  --exclude node_modules --exclude dist --exclude .git --exclude .idea \
  --exclude '/.env' --exclude '/.env.production' --exclude backend/.env --exclude vite-project/.env \
  ./ ubuntu@3.219.14.5:conflictforge/
ssh -i ~/.ssh/conflictforge-key.pem ubuntu@3.219.14.5 'cd conflictforge && docker compose up -d --build'
```

If your IP changes, SSH stops working. Re-allow it with:
`aws ec2 authorize-security-group-ingress --group-id sg-0f03e0670c9f5fed6 --protocol tcp --port 22 --cidr $(curl -s https://checkip.amazonaws.com)/32`

## Day-to-day operations

```bash
# Deploy new code
git pull && docker compose --env-file .env.production up -d --build

# Logs
docker compose logs -f backend

# Back up the database
docker compose exec db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" conflictforge' > backup-$(date +%F).sql
```

## Troubleshooting

- **Certificate errors / site not loading:** confirm the DNS A record resolves to the Elastic IP and ports 80/443 are open, then check `docker compose logs web`.
- **Google button errors with "origin not allowed":** the origin in step 6 must exactly match `https://<DOMAIN>`, with no trailing slash.
- **Backend restarts in a loop:** run `docker compose logs backend`. If `prisma db push` refuses a change that would lose data, resolve it manually instead of forcing it.
- **GitHub rate limit errors:** set `GITHUB_TOKEN`.

## Security note

`GITHUB_TOKEN` is shared by every user. Any signed-in user can analyze any private repository that token can read. Until per-user GitHub authorization exists, use a token with **public-repo-only** access (a fine-grained token with no private repos selected), or restrict who can sign in.
