# Deploying to AWS EC2 (free tier)

Next.js 16 + Clerk + Postgres on a single EC2 instance, with nginx and HTTPS in front.

## 1. Launch the instance

- **Instance type:** `t3.micro` (or `t2.micro`, whichever your account marks free-tier eligible). 1 GB RAM, so swap is required (step 2).
- **AMI:** Ubuntu 24.04 LTS.
- **Storage:** 20-30 GB gp3 (free tier covers up to 30 GB).
- **Security group:** allow 22 (SSH, restricted to your IP), 80, 443.
- **Elastic IP:** allocate one and attach it. AWS charges for public IPv4 addresses; free-tier accounts get 750 hours/month. Release it if you stop using the instance.
- **Account credits:** accounts created after July 2025 use a credit-based free plan instead of the old 12-month tier. Check the Billing console for what you have.
- Set a billing alarm.

## 2. Prepare the server

```bash
ssh -i key.pem ubuntu@<elastic-ip>

# swap: next build will OOM on 1 GB without it
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 22, git, nginx, docker
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx docker.io docker-compose-v2
sudo usermod -aG docker ubuntu && sudo npm i -g pm2
```

Log out and back in so the docker group applies.

## 3. Database

**Option A: Postgres in Docker on the same box.** Uses the repo's `docker-compose.yml`. Before deploying, change the default `roadmap/roadmap` password and bind the port to localhost only (`"127.0.0.1:5432:5432"`).

**Option B: external Postgres** (Neon, Supabase, or RDS `db.t3.micro`). Frees RAM on the instance and gives you managed backups.

## 4. Deploy the app

```bash
git clone <your-repo> roadmap && cd roadmap
cp .env.example .env      # set DATABASE_URL and the Clerk keys
docker compose up -d      # if using Option A
npm ci
npm run db:push
npm run build
pm2 start npm --name roadmap -- start -- -p 6001
pm2 save && pm2 startup   # run the command it prints so the app survives reboots
```

`next start` defaults to port 3000; `-p 6001` keeps it consistent with dev.

To seed fresh data instead of migrating (see below): `SEED_USER_ID=user_... npm run db:seed`.

## 5. Nginx and HTTPS

Clerk production instances require HTTPS on a real domain. Point the domain's A record at the Elastic IP, then:

```nginx
# /etc/nginx/sites-available/roadmap
server {
  server_name yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:6001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/roadmap /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 6. Clerk

In the Clerk dashboard, create a **Production** instance and add your domain. Put the `pk_live_` / `sk_live_` keys in `.env` and add the DNS records Clerk asks for. Re-create your invitations there, since dev and prod instances have separate users.

`NEXT_PUBLIC_*` values are baked in at build time, so rebuild after changing them:

```bash
npm run build && pm2 restart roadmap
```

## 7. Copying your existing local data to EC2

### Dump locally

```bash
docker compose exec -T db pg_dump -U roadmap -d roadmap --no-owner --no-acl -Fc > roadmap.dump
```

### Copy to EC2

```bash
scp -i key.pem roadmap.dump ubuntu@<elastic-ip>:~/
```

### Restore on EC2

Make sure the app's `.env` points at the EC2 database first.

```bash
# Option A: Postgres in Docker on the box
docker compose up -d
docker compose exec -T db pg_restore -U roadmap -d roadmap --clean --if-exists --no-owner < roadmap.dump

# Option B: external Postgres
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" roadmap.dump
```

Then run `npm run db:push` to confirm the schema matches.

### Fix the user id

Every row is keyed by a Clerk `user_id`, and a production Clerk instance gives you a different id than your dev one. Pick one:

- **Keep the Clerk dev instance on EC2.** Use the same `pk_test_` / `sk_test_` keys. Your id is unchanged and the data works as is. Dev instances show a "development mode" banner and don't support custom domains.
- **Move to a Clerk production instance.** Sign in once on EC2 to create your new user, then copy the new `user_...` id from the Clerk dashboard. `db:claim` only handles rows with `user_id = 'legacy'`, so remap first, then claim:

```sql
-- psql on EC2: list tables that have user_id
SELECT table_name FROM information_schema.columns
WHERE column_name = 'user_id' AND table_schema = 'public';

-- repeat for each table
UPDATE <table> SET user_id = 'legacy' WHERE user_id = 'user_OLD';
```

```bash
npm run db:claim -- user_NEW
```

Per-user unique constraints (journal date, finance month, settings) can collide if you've already created rows under the new id, so sign in but don't add data until after the claim.

This is a one-time copy. Pick either local or EC2 as the source of truth afterwards.

## Updating later

```bash
git pull && npm ci && npm run db:push && npm run build && pm2 restart roadmap
```

## Gotchas

- **Backups:** if Postgres runs on the instance, set up a nightly `pg_dump` to S3 or somewhere off the box.
- **Builds:** if the build is still too heavy for 1 GB, build locally or in CI and copy `.next`, or set `output: "standalone"` in `next.config.ts` to shrink what you ship.
- **Secrets:** never commit `.env`; change the default Postgres password.
