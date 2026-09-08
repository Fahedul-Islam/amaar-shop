# Deploying Amaar Shop — a complete first-time guide

**Frontend on Vercel · PostgreSQL + backend on Oracle Cloud · $0 only for eligible non-commercial use within free quotas**

This guide assumes you have **never deployed anything before**. Every command is
written out in full, every button is named, and after each stage there is a
**Checkpoint** that tells you exactly how to know it worked before you continue.

Read it top to bottom. Do not skip ahead — several later steps fail in confusing
ways if an earlier one was skipped.

> **Time needed:** 2–3 hours the first time, most of it waiting for Oracle's
> signup verification and the first Docker build. Budget an evening.

---

## Start here — review before deploying (8 September 2026)

The frontend upgrade and build fixes are complete. Finish the hosting setup and
live checks below before accepting real orders.

- **Frontend runtime updated:** Next.js 15.5.24 and React 19.2.8, with matching
  React types. Use **Node.js 22** (`frontend/.nvmrc` and `package.json` engines);
  both frontend Dockerfiles use Node 22 and `npm ci`.
  The storefront awaits route parameters as required by Next.js 15.
  [Next.js security release](https://nextjs.org/blog/august-2026-security-release).
- **Confirm this is a personal demo.** Vercel Hobby is for personal,
  non-commercial use. A live selling business can be commercial even before you
  charge sellers. For commercial use choose a paid Vercel plan or host the frontend
  on Oracle too (Appendix A). [Vercel policy](https://vercel.com/docs/plans/hobby).
- **Pass the local checks below**, then repeat the live smoke test in Part 8.
- **Commit the deployment files.** At review time `deploy/` and this guide were
  untracked. `.env` and `deploy/.env` are ignored, and no real env file was tracked.
- **Back up and practise recovery before accepting real orders.** The existing
  backup script sources `.env` as shell code; use shell-compatible quoted values
  and never put commands in that file. It copies the database and images separately,
  so pause writes for a consistent recovery point.
- **Check proxy rate limiting before launch.** Caddy defaults and Vercel forwarding
  need testing with two separate clients: the backend reads the first
  `X-Forwarded-For` address. Configure trusted proxy handling deliberately so users
  neither share one rate-limit bucket nor spoof their identity.

Run on your laptop before deploying future changes:

```bash
cd /home/fhedul/amaarshop/frontend
nvm use # if you use nvm; otherwise install/select Node.js 22
npm ci
npm run build
npm run typecheck
npm run lint
npm audit
cd ../backend
go test ./...
go vet ./...
```

Verification on 8 September 2026:

- Clean `npm ci` completed and reported **zero vulnerabilities**.
- The production build passed on Node 22, including lint/type checking and all
  34 prerendered pages. Five existing non-blocking lint warnings remain about
  memo dependencies and an unoptimized image.
- The built frontend returned HTTP 200 for `/`, `/login`, `/signup`, `/shops`,
  `/dashboard` and `/admin/login` in a local smoke test.
- Backend `go test ./...` passed in the preceding review; backend code was not
  changed by this upgrade.

The earlier generic webpack failure was caused by blocked Google Fonts downloads.
`next/font/google` in the root layout needs build-time access to
`fonts.googleapis.com` and `fonts.gstatic.com`. Use Node 22 and allow these
hosts when building; an offline/restricted build can still fail to fetch fonts.

The package overrides keep PostCSS, Browserslist and the 6.x selector parser on
patched compatible releases. Keep the committed lockfile and use `npm ci` on
Vercel and Docker. Recheck the audit whenever changing dependencies.

No live Oracle/Vercel deployment or database recovery was performed. The local
HTTP checks do not verify browser login, image uploads or checkout with a backend.

Fix failures before continuing. A passing build is not a substitute for the live
login, image-upload and checkout checks. This review is deployment-focused, not
an exhaustive security audit.

### The simple order to follow

1. Finish the checks above and push the reviewed code to your GitHub production branch.
2. Create an Oracle **Always Free eligible Ubuntu ARM VM**, in your home region,
   with **2 OCPUs, 12 GB RAM and a 50 GB boot disk**, subject to your available quota.
3. SSH into it; install Docker and clone your repository (Parts 2–3).
4. Point a DuckDNS hostname to its public IP; allow TCP 80/443 and SSH (Parts 4–5).
5. Fill `deploy/.env` with new production secrets. Run `docker compose up -d --build`
   from `deploy/`. Verify the public `/health` and `/ready` URLs (Part 6).
6. Import the repo into Vercel. Select **Next.js**, Root Directory **frontend**,
   and set **BACKEND_URL=https://your-api.duckdns.org** for Production. Deploy (Part 7).
7. Put the resulting Vercel URL into the server's `CORS_ALLOWED_ORIGINS`, then run
   `docker compose up -d`. Verify login, uploads and a test order (Part 8).
8. Schedule backups and copy them to another machine (Part 10).

Use the detailed parts below for the exact commands. Oracle account approval and
ARM capacity may take longer than an evening; free capacity is not guaranteed.

---

## Table of contents

| Part | What you do | Time |
| ---- | ----------- | ---- |
| [0](#part-0--what-you-are-building) | Understand the architecture, gather prerequisites | 10 min |
| [1](#part-1--prepare-your-code-and-push-to-github) | Push the code to GitHub | 10 min |
| [2](#part-2--create-the-oracle-cloud-server) | Create an Oracle Cloud account and a free VM | 40 min |
| [3](#part-3--first-login-and-server-setup) | SSH in, install Docker, add swap | 20 min |
| [4](#part-4--get-a-free-domain-for-the-api) | Free domain name pointing at the server | 10 min |
| [5](#part-5--open-the-firewall-both-layers) | Open ports 80 and 443 (two firewalls!) | 15 min |
| [6](#part-6--launch-the-database-and-backend) | Run Postgres + API + HTTPS | 20 min |
| [7](#part-7--deploy-the-frontend-to-vercel) | Deploy Next.js to Vercel | 15 min |
| [8](#part-8--connect-the-two-halves) | Wire frontend ↔ backend, end-to-end test | 20 min |
| [9](#part-9--optional-use-your-own-domain-name) | Custom domain (optional) | 15 min |
| [10](#part-10--day-2-operations) | Backups, updates, logs, restarts | 20 min |
| [11](#part-11--troubleshooting) | When something breaks | — |
| [12](#part-12--security-checklist-and-known-limits) | Final review, honest limitations | 10 min |

---

## Part 0 — What you are building

### The architecture

```
                    ┌──────────────────────────────────────┐
   Buyer's phone ──►│  Vercel  (free)                      │
   (browser)        │  Next.js frontend                    │
                    │  https://amaarshop.vercel.app        │
                    └───────────────┬──────────────────────┘
                                    │  Next.js rewrites forward
                                    │  /api/*  and  /uploads/*
                                    │  over the internet (HTTPS)
                                    ▼
                    ┌──────────────────────────────────────┐
                    │  Oracle Cloud VM  (free tier)     │
                    │  https://your-api.duckdns.org        │
                    │                                      │
                    │   ┌────────┐   ┌─────────┐   ┌─────┐ │
                    │   │ Caddy  │──►│ Go API  │──►│ PG  │ │
                    │   │ HTTPS  │   │  :8080  │   │ 16  │ │
                    │   └────────┘   └─────────┘   └─────┘ │
                    │    port 443     (internal)  (internal)│
                    │                                      │
                    │   Docker volumes: pgdata, uploads    │
                    └──────────────────────────────────────┘
```

**Why this shape?** Look at [frontend/next.config.mjs](../frontend/next.config.mjs):

```js
{ source: '/api/:path*',     destination: `${BACKEND}/api/:path*` },
{ source: '/uploads/:path*', destination: `${BACKEND}/uploads/:path*` },
```

The frontend **proxies** API calls instead of the browser calling your API
directly. That matters for one specific reason: your login cookie is set with
`SameSite=Strict` ([backend/internal/handler/http/auth/handler.go:38](../backend/internal/handler/http/auth/handler.go#L38)).
Because every request the browser makes goes to the Vercel domain, the browser
treats it all as one site, and the cookie works. If the browser called
`api.duckdns.org` directly from `amaarshop.vercel.app`, that would be a
different site, the cookie would be dropped, and **nobody could stay logged in**.

So: keep the proxy. Do not "simplify" it later.

### Three things to know up front

**1. "Database on Oracle" means PostgreSQL in Docker on the Oracle VM — not
Oracle Autonomous Database.** Oracle's free managed database speaks Oracle SQL.
This app needs PostgreSQL 16 specifically: it uses `pgcrypto`, `citext`,
`pg_trgm` extensions and `tsvector` full-text search
([backend/migrations/000001_extensions.up.sql](../backend/migrations/000001_extensions.up.sql)).
It will not run on Oracle ADB. We run Postgres 16 in a container on the same
free VM — same $0 cost, fully compatible.

**2. Migrations run themselves.** The API applies all 22 migrations at startup
([backend/internal/app/app.go:69](../backend/internal/app/app.go#L69)). There is
no separate migration step in production.

**3. Vercel's free "Hobby" plan is for non-commercial use.** While this is a
portfolio project it's fine. For commercial use, including a real selling business, you need a paid Vercel plan — or move the frontend onto the same Oracle VM for free. See
[Appendix A](#appendix-a--running-the-frontend-on-oracle-instead-of-vercel).

### Prerequisites — collect these before you start

| You need | Notes |
| -------- | ----- |
| A GitHub account | Free. The code must be on GitHub for Vercel to deploy it. |
| A credit or debit card | Oracle requires one to verify identity. A temporary verification hold may apply. Check Oracle’s accepted card requirements and your bank’s international transaction support; acceptance is not guaranteed. |
| A phone number | For Oracle's SMS verification. |
| An email address | Use a real one; you need the verification link. |
| A terminal | Linux/macOS: the built-in Terminal. Windows: **PowerShell** (built into Windows 10/11) or Git Bash. |
| ~2 hours | Oracle account verification alone can take 5–30 minutes. |

### Terms you will see

| Term | Plain meaning |
| ---- | ------------- |
| **VM / instance** | A computer you rent (here: for free) in a data centre. |
| **SSH** | The way you log into that computer from your own machine's terminal. |
| **Docker container** | An app packaged with everything it needs, so it runs the same everywhere. |
| **Docker volume** | A folder Docker manages, where data survives even when containers are rebuilt. Your database and uploads live here. |
| **Reverse proxy** | A doorway program (here: Caddy) that receives internet traffic, handles HTTPS, and passes requests to your app. |
| **Ingress rule** | A firewall rule that says "allow traffic in on this port". |
| **DNS / A record** | The address book that maps a name like `myshop.duckdns.org` to an IP like `140.238.x.x`. |

---

## Part 1 — Prepare your code and push to GitHub

Everything in this part happens **on your own laptop**, in the project folder. Complete the Start here checklist first.

### 1.1 Confirm nothing secret is committed

```bash
cd ~/amaarshop
git status
git check-ignore -v .env
```

The last command must print a line mentioning `.gitignore` — that means your
local `.env` (with dev passwords) is ignored and will **not** go to GitHub. If it
prints nothing, stop and fix [.gitignore](../.gitignore) before continuing.

### 1.2 Commit the deployment files

This guide ships with four files under [deploy/](../deploy/) that the server
will use. Commit them:

```bash
cd ~/amaarshop
git add deploy/ docs/DEPLOYMENT.md
git commit -m "chore: add production deployment files for Oracle + Vercel"
```

What you just committed:

| File | Purpose |
| ---- | ------- |
| [deploy/docker-compose.yml](../deploy/docker-compose.yml) | The production stack: Postgres + Go API + Caddy. Note there is **no** `ports:` on Postgres or the backend — only Caddy touches the internet. |
| [deploy/Caddyfile](../deploy/Caddyfile) | Three lines that give you automatic, auto-renewing HTTPS. |
| [deploy/.env.example](../deploy/.env.example) | Template for the real secrets you will create on the server. |
| [deploy/backup.sh](../deploy/backup.sh) | Nightly database + uploads backup. |

### 1.3 Push to GitHub

Your repo already points at GitHub:

```bash
git remote -v
# origin  https://github.com/Fahedul-Islam/amaar-shop.git (fetch)
```

Check `git branch --show-current`, push that branch, and open a pull request on
GitHub into your chosen production branch (usually `main`). Review and merge it
there. Do not copy a branch name from an old guide. Select that same production
branch in Vercel, and clone/check out it on Oracle.

> If `git push` asks for a password: GitHub no longer accepts account passwords.
> Create a **Personal Access Token** at
> <https://github.com/settings/tokens> → *Generate new token (classic)* → tick
> **repo** → copy the token and paste it as the password.

### ✅ Checkpoint 1

Open <https://github.com/Fahedul-Islam/amaar-shop> in a browser. You should see
the `deploy/` folder and, inside it, `docker-compose.yml`. You should **not** see
a `.env` file anywhere.

---

## Part 2 — Create the Oracle Cloud server

### 2.1 Sign up

1. Go to <https://www.oracle.com/cloud/free/> and click **Start for free**.
2. Fill in country: **Bangladesh**. Enter your name and email, verify the email.
3. **Choose your Home Region very carefully — it can never be changed.** Pick the
   one closest to your buyers:
   - **Singapore (ap-singapore-1)** — recommended for Bangladesh, ~60 ms.
   - **India South (Hyderabad) / India West (Mumbai)** — also good, ~40–50 ms.

   Avoid US/EU regions: every page load would carry ~250 ms of extra delay.
4. Verify your phone by SMS.
5. Add your card. Oracle places a temporary ~$1 authorisation hold and refunds
   it. If the card is declined, try a different card that has international
   transactions enabled — this is the single most common signup blocker in BD.
6. Wait for the "Your account is ready" email (5–30 minutes, sometimes longer).

> **Will I ever be charged?** Not while you stay on Always Free resources.
> Your account starts as a 30-day trial *with* free credits; when the trial
> ends, anything beyond the Always Free allowance is simply shut down, not
> billed. The VM this guide creates is Always Free.

### 2.2 Create the SSH key (on your laptop)

An SSH key is a pair of files: a **private** key that stays on your laptop and a
**public** key you give to the server. Never share the private one.

```bash
ssh-keygen -t ed25519 -C "amaarshop-oracle" -f ~/.ssh/amaarshop_oracle
```

- When it asks for a passphrase, press **Enter** twice to skip it (simpler for a
  first deployment).
- This creates two files: `~/.ssh/amaarshop_oracle` (private) and
  `~/.ssh/amaarshop_oracle.pub` (public).

Print the public key and copy the whole line — you will paste it into Oracle in
a moment:

```bash
cat ~/.ssh/amaarshop_oracle.pub
# ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... amaarshop-oracle
```

> **Windows PowerShell:** the same commands work. Your keys land in
> `C:\Users\<you>\.ssh\`. Use `type $env:USERPROFILE\.ssh\amaarshop_oracle.pub`
> to print the public key.

### 2.3 Create the VM

1. In the Oracle Cloud console, open the hamburger menu **☰ → Compute →
   Instances**, then click **Create instance**.
2. **Name:** `amaarshop-prod`
3. **Placement:** leave the default availability domain (you may need to change
   this later if you hit a capacity error — see below).
4. **Image and shape** → click **Edit**:
   - **Image:** click *Change image* → **Canonical Ubuntu 24.04** → Select.
   - **Shape:** click *Change shape* → **Ampere** tab → **VM.Standard.A1.Flex**.
     Set **OCPUs = 2** and **Memory = 12 GB**.

   > Oracle currently documents **2 OCPUs / 12 GB total** for Always Free A1,
   > so this uses that full allocation. Check the Console's current allowance,
   > existing resources and Always Free eligibility before creating anything.
   > [Oracle quotas](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
   > The 1 GB AMD micro shape is not recommended for building this stack.

5. **Networking:** create/select a public subnet with an Internet Gateway and a
   route for `0.0.0.0/0` to that gateway.
   Make sure **Assign a public IPv4 address** is **Yes**.
6. **Add SSH keys:** choose **Paste public keys** and paste the `ssh-ed25519 ...`
   line you copied in step 2.2.
7. **Boot volume:** tick *Specify a custom boot volume size* and enter **50** GB.
   (Free tier allows 200 GB total; 50 GB is comfortable for a database, uploads
   and Docker images.)
8. Click **Create**. Provisioning takes 1–3 minutes; the box turns **RUNNING**
   and green.

> **"Out of host capacity" error?** Free ARM capacity is genuinely scarce in
> popular regions. Options, in order of effort:
> 1. Change the **availability domain** (AD-1 / AD-2 / AD-3) and retry.
> 2. Retry every few hours — capacity frees up constantly.
> 3. Reduce to 1 OCPU / 6 GB, which is still enough (builds are just slower).
> Do not upgrade to Pay As You Go just to follow this free guide. Paid accounts
> can incur charges above their free allowances; budget alerts do not cap spending.

### 2.4 Note the public IP

Copy the public IP from the instance page. An ephemeral IP survives stop/start,
but is lost when its associated instance/private IP is deleted. It is sufficient
for this first deployment. A reserved IP can be moved to a replacement instance.
If you choose one, remove the ephemeral assignment and assign a new reserved IP
through the VNIC's IPv4 address settings. **The address changes**: copy the new
address and use it for SSH and DNS. An ephemeral IP cannot be converted in place.
[Oracle public IP documentation](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingpublicIPs.htm).

### ✅ Checkpoint 2

The instance shows **RUNNING**, and you have written down its public IP.

---

## Part 3 — First login and server setup

### 3.1 SSH in

From your laptop:

```bash
ssh -i ~/.ssh/amaarshop_oracle ubuntu@140.238.12.34
```

Replace `140.238.12.34` with your IP. The username for Ubuntu images is always
`ubuntu`.

- First connection asks `Are you sure you want to continue connecting?` → type
  `yes` and press Enter.
- You should land on a prompt like `ubuntu@amaarshop-prod:~$`.

**If it hangs or times out**, jump to
[Troubleshooting → cannot SSH](#i-cannot-ssh-into-the-server).

> **Make future logins shorter.** On your laptop (not the server), add this to
> `~/.ssh/config`:
> ```
> Host amaarshop
>     HostName 140.238.12.34
>     User ubuntu
>     IdentityFile ~/.ssh/amaarshop_oracle
> ```
> Now `ssh amaarshop` is enough.

### 3.2 Update the system

Everything from here runs **on the server** (your prompt says `ubuntu@...`).

```bash
sudo apt update && sudo apt upgrade -y
```

This takes 2–5 minutes. If a purple screen appears asking about restarting
services, press **Tab** to highlight `<Ok>` and Enter. If it asks about a
modified config file, keep the default (`N`).

### 3.3 Add swap space

Swap is emergency memory on disk. Docker builds sometimes spike; swap stops the
build from being killed.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verify:

```bash
free -h
#                total   used   free  shared  buff/cache  available
# Mem:            11Gi   ...
# Swap:          4.0Gi     0B  4.0Gi
```

The `Swap:` line must show 4.0Gi.

### 3.4 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
```

This takes ~2 minutes and installs Docker plus the Compose plugin.

Let your user run Docker without `sudo`:

```bash
sudo usermod -aG docker ubuntu
```

**This only takes effect on a new login session.** Log out and back in:

```bash
exit
```
```bash
ssh -i ~/.ssh/amaarshop_oracle ubuntu@140.238.12.34
```

Verify both tools:

```bash
docker --version          # Docker version 27.x.x
docker compose version    # Docker Compose version v2.x.x
docker run hello-world    # prints "Hello from Docker!"
```

If `docker run hello-world` says *permission denied*, you skipped the logout —
run `exit` and SSH back in.

### 3.5 Get the code onto the server

```bash
cd ~
git clone https://github.com/Fahedul-Islam/amaar-shop.git
cd amaar-shop
ls
# backend  deploy  docs  docker-compose.yml  frontend  Makefile  README.md
```

> **If the repo is private,** the clone will ask for credentials. Use your GitHub
> username and a **Personal Access Token** (from Part 1.3) as the password.

### ✅ Checkpoint 3

```bash
docker compose version && ls ~/amaar-shop/deploy
```

prints a Compose version and lists `Caddyfile`, `backup.sh`,
`docker-compose.yml`, `.env.example`.

---

## Part 4 — Get a free domain for the API

Your API needs a hostname so it can have an HTTPS certificate (this guide uses hostname-based certificate issuance). DuckDNS gives you one free, forever, in two
minutes.

> Already own a domain (e.g. `amaarshop.com`)? Skip DuckDNS: in your registrar's
> DNS panel create an **A record** with name `api` pointing to your VM's IP, then
> use `api.amaarshop.com` everywhere this guide says `<your-api-domain>`.

1. Go to <https://www.duckdns.org> and sign in with Google/GitHub (free, no card).
2. In the **domains** box type a name, e.g. `amaarshop-api`, and click
   **add domain**. You now own `amaarshop-api.duckdns.org`.
3. In the **current ip** field for that domain, type your Oracle **public IP**
   (`140.238.12.34`) and click **update ip**.

Verify the name resolves — run this **on your laptop**:

```bash
nslookup amaarshop-api.duckdns.org
# ...
# Address: 140.238.12.34      ← must match your Oracle IP
```

DNS updates are usually instant with DuckDNS. If the address is wrong or the
lookup fails, wait 2 minutes and try again.

### ✅ Checkpoint 4

`nslookup <your-api-domain>` returns your Oracle VM's public IP.

**Write your API domain down.** From here on, `<your-api-domain>` means this
name, e.g. `amaarshop-api.duckdns.org`.

---

## Part 5 — Open the firewall (both layers!)

**This is the step everyone gets wrong.** An Oracle VM has *two* independent
firewalls, and traffic is blocked unless **both** allow it:

1. The **VCN Security List** — a cloud firewall, configured in the Oracle web console.
2. **iptables on the VM itself** — Oracle's Ubuntu images ship with rules that
   reject everything except SSH.

### 5.1 Layer 1 — VCN Security List (in the browser)

1. Oracle console → **☰ → Networking → Virtual Cloud Networks**.
2. Click your VCN (something like `vcn-20260810-1042`).
3. Left panel → **Security Lists** → click **Default Security List for vcn-...**.
4. Click **Add Ingress Rules**, and add the first rule:

   | Field | Value |
   | ----- | ----- |
   | Stateless | leave unchecked |
   | Source Type | CIDR |
   | Source CIDR | `0.0.0.0/0` |
   | IP Protocol | TCP |
   | Source Port Range | *(leave empty)* |
   | Destination Port Range | `80` |
   | Description | `HTTP - Caddy / Lets Encrypt` |

5. Click **+ Another Ingress Rule** and repeat with **Destination Port Range =
   `443`**, description `HTTPS - API`.
6. Click **Add Ingress Rules** to save.

Your list should now have ingress rules for ports 22, 80 and 443. **Do not add a
rule for 5432 or 8080** — the database and the API must never be directly
reachable from the internet.

### 5.2 Layer 2 — iptables (on the server)

Back in your SSH session:

```bash
sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 443 -j ACCEPT
```

Check that the new rules sit **above** the `REJECT` line:

```bash
sudo iptables -L INPUT --line-numbers -n
```

```
num  target     prot opt source     destination
1    ACCEPT     all  --  0.0.0.0/0  0.0.0.0/0    state RELATED,ESTABLISHED
...
6    ACCEPT     tcp  --  0.0.0.0/0  0.0.0.0/0    state NEW tcp dpt:443
7    ACCEPT     tcp  --  0.0.0.0/0  0.0.0.0/0    state NEW tcp dpt:80
8    REJECT     all  --  0.0.0.0/0  0.0.0.0/0    reject-with icmp-host-prohibited
```

The two `ACCEPT` lines for 80 and 443 must appear **before** `REJECT`. If they
landed after it, remove them (`sudo iptables -D INPUT <num>`) and re-add with a
lower number, e.g. `-I INPUT 1`.

Make the rules survive a reboot:

```bash
sudo apt install -y iptables-persistent
```

When the installer asks *"Save current IPv4 rules?"* answer **Yes** (and Yes for
IPv6 too). If you already have the package installed, run this instead:

```bash
sudo netfilter-persistent save
```

> Keep the existing firewall setup for this walkthrough. Docker-published ports
> also use forwarding/NAT rules, so INPUT rules alone do not prove access works.
> Test 80/443 from your laptop after launch. Do not flush firewall rules; keep
> your SSH session open while making changes.

### ✅ Checkpoint 5

Nothing listens on port 80 yet, so you cannot fully test this until Part 6.
For now just confirm the two ACCEPT rules appear above REJECT in the output
above, and that ports 80 + 443 appear in the Oracle console's ingress rules.

---

## Part 6 — Launch the database and backend

### 6.1 Create the secrets file

```bash
cd ~/amaar-shop/deploy
cp .env.example .env
```

Generate two strong secrets and keep the output on screen:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
```

Now edit the file:

```bash
nano .env
```

Fill in every blank. A completed file looks like this (**use your own generated
values, never these**):

```dotenv
POSTGRES_DB=amaarshop
POSTGRES_USER=amaarshop
POSTGRES_PASSWORD=9f3c2a1b7e5d4c8a6b0f2e9d1c3a5b7e8f0a2c4d6e8f1a3b

JWT_SECRET=Xk9mP2vQ8sR4tY7uI1oA3dF5gH6jK8lZ0xC2vB4nM6qW8eR1tY3uI5oP7aS9dF2g

ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-password-you-will-remember

API_DOMAIN=amaarshop-api.duckdns.org

CORS_ALLOWED_ORIGINS=https://placeholder.vercel.app
```

Rules that matter:

- `POSTGRES_PASSWORD` — **letters and numbers only**. It is embedded in a
  connection URL, and characters like `@ : / # ?` silently break it.
- `API_DOMAIN` — hostname only. No `https://`, no trailing slash.
- `CORS_ALLOWED_ORIGINS` — you don't know your Vercel URL yet. Put a placeholder;
  you will fix it in Part 8.
- No spaces around `=`. Single-quote passwords containing spaces, `$` or `#`
  so Compose treats them literally; the backup script also requires valid shell syntax.
  A generated hex admin password avoids these parsing issues.

Save and exit nano: **Ctrl+O**, **Enter**, **Ctrl+X**.

Lock the file down so only you can read it:

```bash
chmod 600 .env
```

### 6.2 Build and start

```bash
cd ~/amaar-shop/deploy
docker compose up -d --build
```

The first run downloads Postgres, Caddy and Go, then compiles the backend.
**On 2 ARM cores this takes 5–12 minutes.** You'll see a lot of scrolling
output; that is normal. It ends with something like:

```
[+] Running 7/7
 ✔ Network amaarshop_default      Created
 ✔ Volume "amaarshop_pgdata"      Created
 ✔ Volume "amaarshop_upload_data" Created
 ✔ Volume "amaarshop_caddy_data"  Created
 ✔ Container amaarshop-postgres-1 Healthy
 ✔ Container amaarshop-backend-1  Started
 ✔ Container amaarshop-caddy-1    Started
```

### 6.3 Verify the containers are alive

```bash
docker compose ps
```

All three must show `running` (postgres also shows `(healthy)`):

```
NAME                   IMAGE               STATUS
amaarshop-backend-1    deploy-backend      Up 2 minutes
amaarshop-caddy-1      caddy:2-alpine      Up 2 minutes
amaarshop-postgres-1   postgres:16-alpine  Up 2 minutes (healthy)
```

If any says `Restarting` or `Exited`, read its log — that's where the answer is:

```bash
docker compose logs backend --tail 50
```

### 6.4 Verify migrations and the admin user

```bash
docker compose logs backend | head -20
```

You are looking for these three lines, in this order:

```
level=INFO msg="database connected"
level=INFO msg="migrations applied"
level=INFO msg="server starting" port=8080
```

`migrations applied` means all 22 SQL migrations ran and your schema exists.

Confirm the tables and your admin account:

```bash
docker compose exec postgres psql -U amaarshop -d amaarshop -c '\dt' | head -20
docker compose exec postgres psql -U amaarshop -d amaarshop \
  -c 'SELECT email, is_admin FROM users;'
```

The second command should show the `ADMIN_EMAIL` you set, with `is_admin = t`.

> **No admin row?** The admin is seeded only when that email does not already exist. If you
> started the stack once with an empty `ADMIN_EMAIL`, fix `.env` and run
> `docker compose up -d --force-recreate backend`.

### 6.5 Verify the API answers internally

```bash
docker compose exec backend wget -qO- http://localhost:8080/health
# {"status":"ok"}

docker compose exec backend wget -qO- http://localhost:8080/ready
# {"status":"ready"}
```

`ready` also proves the API can reach the database.

### 6.6 Verify HTTPS from the outside

Give Caddy about 30 seconds after startup to obtain its certificate, then run
this **on your laptop**:

```bash
curl https://amaarshop-api.duckdns.org/health
# {"status":"ok"}
```

Also open `https://<your-api-domain>/health` in a browser — you should see the
JSON and a **padlock** in the address bar.

**If you get a certificate error or a connection timeout**, check Caddy's log:

```bash
docker compose logs caddy --tail 30
```

- `certificate obtained successfully` → all good.
- `could not get certificate` / `timeout during connect` → port 80 is not open.
  Re-check **both** firewall layers in Part 5. Let's Encrypt must reach port 80
  from the internet to verify you own the domain.
- `no such host` → DuckDNS isn't pointing at this IP yet (Part 4).

### ✅ Checkpoint 6

`curl https://<your-api-domain>/health` returns `{"status":"ok"}` from your
laptop, over HTTPS, with a valid certificate.

**Your backend and database are now live.** Half the job is done.

---

## Part 7 — Deploy the frontend to Vercel

### 7.1 Import the project

1. Go to <https://vercel.com/signup> and choose **Continue with GitHub**. Free,
   no card.
2. On the dashboard click **Add New… → Project**.
3. Find `amaar-shop` in the repository list and click **Import**.
   - Don't see it? Click **Adjust GitHub App Permissions** and grant Vercel
     access to that repository.

### 7.2 Configure the project — the important screen

Vercel shows a *Configure Project* page. Three settings matter:

| Setting | Value | Why |
| ------- | ----- | --- |
| **Framework Preset** | Next.js *(auto-detected)* | Leave it. |
| **Root Directory** | `frontend` | **Critical.** Click **Edit**, select the `frontend` folder, click **Continue**. Your Next.js app is not at the repo root; without this the build fails immediately. |
| **Environment Variables** | see below | The frontend cannot find your API without it. |

Expand **Environment Variables** and add one:

| Name | Value |
| ---- | ----- |
| `BACKEND_URL` | `https://amaarshop-api.duckdns.org` |

Use *your* API domain, with `https://` and **no trailing slash**. Apply it to **Production**. Configure Preview separately against a test backend;
preview deployments should not accidentally write to your production database.

> **Why not `NEXT_PUBLIC_BACKEND_URL`?** Because the browser never uses this
> value. Only the Next.js server does — for its rewrites and for server-rendered
> storefront pages ([frontend/src/lib/api.ts:13](../frontend/src/lib/api.ts#L13)).
> Keeping it non-public means your API hostname never gets baked into JavaScript
> shipped to buyers.

### 7.3 Deploy

Click **Deploy**. The build takes 2–4 minutes. When it finishes you get
confetti and a URL like `https://amaar-shop.vercel.app`.

**Copy that URL — you need it in Part 8.**

If the build fails, open the log and look at the first red error:

| Error text | Fix |
| ---------- | --- |
| `No Next.js version detected` | Root Directory isn't set to `frontend`. Settings → General → Root Directory. |
| `Module not found: Can't resolve '@/...'` | Usually a case-sensitivity issue: Linux is case-sensitive, your laptop may not be. Check the import matches the real filename exactly. |
| `Type error: ...` | A real TypeScript error. Reproduce locally with `cd frontend && ./node_modules/.bin/tsc --noEmit`. |

### ✅ Checkpoint 7

Opening your `*.vercel.app` URL shows the Amaar Shop homepage. Some data may
not load yet — that's expected until Part 8.

---

## Part 8 — Connect the two halves

The frontend knows about the backend now, but the backend doesn't know about the
frontend.

### 8.1 Tell the backend its allowed origin

On the server:

```bash
cd ~/amaar-shop/deploy
nano .env
```

Replace the placeholder with your real Vercel URL:

```dotenv
CORS_ALLOWED_ORIGINS=https://amaar-shop.vercel.app
```

No trailing slash. Save (**Ctrl+O**, **Enter**, **Ctrl+X**), then apply:

```bash
docker compose up -d
```

Compose notices the changed environment and recreates the backend container
(about 5 seconds — no rebuild, because the code didn't change).

Confirm it came back:

```bash
docker compose logs backend --tail 5
```

### 8.2 Confirm the proxy path works end to end

On your laptop, call the API **through Vercel**:

```bash
curl https://amaar-shop.vercel.app/api/marketplace/shops
```

You should get JSON — probably `{"data":{"shops":[],...}}` or similar, since you
have no shops yet. What matters is that it's **JSON from your Go API**, not a
Next.js 404 page. That single response proves: browser → Vercel → internet →
Caddy → Go API → Postgres, all working.

If you get an HTML 404 page instead, the rewrite isn't active: `BACKEND_URL`
was missing at build time. Add it in Vercel → Settings → Environment Variables,
then **redeploy** (see the box below).

> **Remember: rewrites are baked in at build time.** Whenever you change
> `BACKEND_URL` in Vercel, you must redeploy for it to take effect —
> Vercel → your project → **Deployments** → ⋮ on the newest one → **Redeploy**.

### 8.3 The full smoke test

Do this in a real browser, in order. Each step exercises a different piece.

| # | Action | Proves |
| - | ------ | ------ |
| 1 | Open `https://amaar-shop.vercel.app` | Frontend serves |
| 2 | Register a new seller account | POST through proxy, database writes |
| 3 | Log out, then log back in | **Cookies + HTTPS + `SameSite=Strict` all work** |
| 4 | Reload the dashboard page | Refresh-token flow works (this is the step that fails if HTTPS is misconfigured) |
| 5 | Create a shop in the dashboard | Multi-tenant setup |
| 6 | Upload a shop logo | File upload through the proxy → Docker volume |
| 7 | Add a product with an image and a cost price | Uploads + product pipeline |
| 8 | Open the storefront at `/s/<your-slug>` | Server-rendered page fetching directly from `BACKEND_URL` |
| 9 | Place a test order as a buyer (COD) | Reservations, checkout, orders |
| 10 | Find the order in the dashboard, mark it delivered | Order state machine |
| 11 | Log in as your admin (`ADMIN_EMAIL`) at `/admin` | Admin console + seeded admin |

**Step 3 or 4 failing (logged out immediately / "unauthorized" on reload)** is
almost always one of:

- You opened the site over `http://` instead of `https://` — the refresh cookie
  is `Secure` in production and browsers discard it over plain HTTP.
- You are hitting the API domain directly in the browser instead of going
  through the Vercel domain. Always use the Vercel URL.

**Step 6 or 7 failing on large images:** photos straight off a phone can exceed
5 MB, which the backend rejects
([backend/internal/storage/local/storage.go:86](../backend/internal/storage/local/storage.go#L86)).
Resize before uploading — this is a limit of the app, not the hosting.

### ✅ Checkpoint 8

You have registered, logged in, created a shop and a product, and placed a test
order — all on the live site. **You are deployed.**

Clean up test data through the dashboard. Keep production volumes intact.

---

## Part 9 — Optional: use your own domain name

`amaar-shop.vercel.app` works fine. If you'd rather have `amaarshop.com`
(~$10/year from Namecheap, Porkbun or Cloudflare):

1. **Vercel** → your project → **Settings → Domains** → add `amaarshop.com` and
   `www.amaarshop.com`.
2. Vercel shows the DNS records to create. In your registrar's DNS panel:
   - `A` record, name `@` → `76.76.21.21`
   - `CNAME` record, name `www` → `cname.vercel-dns.com`
   (Use whatever values Vercel displays — they are authoritative.)
3. Wait for the checkmarks (usually minutes, up to 24 hours). HTTPS is automatic.
4. **Point the API at a subdomain of your own domain too** (nicer than DuckDNS):
   - Add an `A` record, name `api` → your Oracle IP.
   - On the server: `nano ~/amaar-shop/deploy/.env`, set
     `API_DOMAIN=api.amaarshop.com`, then `docker compose up -d`.
     Caddy fetches a new certificate automatically within a minute.
5. **Update both origins:**
   - Server `.env`: `CORS_ALLOWED_ORIGINS=https://amaarshop.com,https://www.amaarshop.com`
     then `docker compose up -d`.
   - Vercel env var: `BACKEND_URL=https://api.amaarshop.com`, then **redeploy**.

---

## Part 10 — Day-2 operations

### 10.1 Set up automatic backups

Your database and every uploaded photo live on one VM. Back them up.

```bash
chmod +x ~/amaar-shop/deploy/backup.sh
~/amaar-shop/deploy/backup.sh          # run once by hand to check it works
ls -lh ~/backups
# db_2026-08-10_1432.sql.gz   uploads_2026-08-10_1432.tar.gz
```

Schedule it nightly at 2 AM:

```bash
crontab -e
```

(Choose `1` for nano if asked.) Add this line at the bottom, save, exit:

```
0 2 * * * /home/ubuntu/amaar-shop/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
```

The script keeps 7 days and deletes older files.

**Copy backups off the server too** — a backup that only exists on the machine
it protects isn't a backup. From your laptop, weekly:

```bash
mkdir -p ~/amaarshop-backups
scp -i ~/.ssh/amaarshop_oracle "ubuntu@140.238.12.34:~/backups/*" ~/amaarshop-backups/
```

### 10.2 Practise recovery on a fresh server

Restore into a **new, empty database and uploads volume** on a separate recovery
VM, using the same PostgreSQL major version and the application revision matching
the backup. Do not import a plain SQL dump over an existing database: duplicate
objects and rows can leave an incomplete restore.

1. Set up Docker, clone the matching revision, and create `deploy/.env` as in Part 6.
2. Copy the selected database and uploads archives to `~/backups` on the recovery VM.
3. Start only PostgreSQL, before any backend migrations run:

```bash
cd ~/amaar-shop/deploy
docker compose up -d postgres
# Wait until postgres is healthy:
docker compose ps
# Replace filenames with your actual backups. Defaults below assume amaarshop DB/user.
set -o pipefail
gunzip -c ~/backups/db_2026-08-10_1432.sql.gz \
  | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U amaarshop -d amaarshop
# Create the backend container and its empty uploads volume without starting it:
docker compose create --build backend
docker run --rm -v amaarshop_upload_data:/data -v ~/backups:/backup:ro alpine \
  tar xzf /backup/uploads_2026-08-10_1432.tar.gz -C /data
```

4. Only after both commands succeed, start the stack with `docker compose up -d`.
5. Test readiness, login, products, orders and images with a test hostname before
   switching production DNS. Do not let a recovery copy send real courier or Meta
   events. A second VM must fit your free quota or it can cost money.

### 10.3 Deploy an update

**Frontend (Vercel):** just push to `main`. Vercel builds and deploys
automatically, in about two minutes.

```bash
git push origin main
```

**Backend (Oracle):**

```bash
ssh amaarshop
cd ~/amaar-shop
git pull
cd deploy
docker compose up -d --build
```

New migrations run automatically at startup. Then verify:

```bash
docker compose logs backend --tail 20
curl https://<your-api-domain>/ready
```

> **Habit worth forming:** run `~/amaar-shop/deploy/backup.sh` before any backend
> update that includes new migrations.

### 10.4 Everyday commands

Run these from `~/amaar-shop/deploy`:

| Command | What it does |
| ------- | ------------ |
| `docker compose ps` | Are the containers up? |
| `docker compose logs -f backend` | Live API logs (Ctrl+C to stop) |
| `docker compose logs --tail 100 caddy` | HTTPS / certificate logs |
| `docker compose restart backend` | Restart just the API |
| `docker compose up -d` | Apply `.env` changes |
| `docker compose up -d --build` | Rebuild after a code change |
| `docker compose down` | Stop everything (data is safe in volumes) |
| `docker compose exec postgres psql -U amaarshop -d amaarshop` | Open a SQL shell (`\dt` list tables, `\q` quit) |
| `df -h /` | Disk space — investigate above 80% |
| `free -h` | Memory use |
| `docker system prune -af` | Reclaim disk from old images (safe; never touches volumes) |

### 10.5 Keep the server patched

Once a month:

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

The VM comes back in ~40 seconds and Docker restarts everything by itself
(`restart: unless-stopped`). Verify after: `curl https://<your-api-domain>/health`.

### 10.6 Plan for idle-instance reclamation

Oracle may reclaim idle Always Free compute under its documented utilization
criteria. Some real traffic is not a guarantee against reclamation. Keep copies
of backups off the VM and be prepared to recreate it; do not rely on a PAYG upgrade
as a guarantee of permanent availability.
[Oracle reclamation policy](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

---

## Part 11 — Troubleshooting

### I cannot SSH into the server

Work through these in order:

1. **Right IP?** Compare against the instance page in the console.
2. **Right user?** Ubuntu images use `ubuntu`, not `root` or `opc`.
3. **Right key?** `ssh -i ~/.ssh/amaarshop_oracle ubuntu@IP` — the path must be
   the **private** key (no `.pub`).
4. **Permissions error** (`UNPROTECTED PRIVATE KEY FILE`):
   `chmod 600 ~/.ssh/amaarshop_oracle`
5. **Timeout?** The instance may still be booting — wait 2 minutes. Otherwise
   check the console: is it **RUNNING**? Does the Default Security List still
   have its ingress rule for port 22?
6. **Locked out completely?** Use an OCI instance console connection for recovery; ordinary Cloud Shell SSH
   does not automatically bypass network rules.

### `curl https://<api-domain>/health` times out

| Check | Command / place |
| ----- | --------------- |
| Is Caddy running? | `docker compose ps` on the server |
| Does DNS point here? | `nslookup <your-api-domain>` on your laptop |
| VCN ingress for 80 + 443? | Oracle console → VCN → Security Lists |
| iptables ACCEPT above REJECT? | `sudo iptables -L INPUT --line-numbers -n` |
| Certificate obtained? | `docker compose logs caddy \| grep -i certificate` |

Open both TCP 80 and 443 for this walkthrough. Caddy can use different ACME
challenges; HTTP validation uses 80 and TLS-ALPN validation uses 443.

### The backend container keeps restarting

```bash
docker compose logs backend --tail 40
```

| Log message | Cause | Fix |
| ----------- | ----- | --- |
| `DATABASE_URL is required` | `.env` not loaded | Run compose from inside `~/amaar-shop/deploy` |
| `JWT_SECRET is required` | Blank in `.env` | Fill it in, `docker compose up -d` |
| `connect database: ... password authentication failed` | Password changed after the volume was created | The DB keeps its original password. Restore the original environment password, or deliberately change the database role password to match; keep the data volume |
| `connect database: ... connection refused` | Postgres still starting | Usually self-heals; check `docker compose ps` for `(healthy)` |
| `run migrations: ... Dirty database version N` | A migration failed halfway | See below |
| `invalid port` / URL parse errors | Special characters in `POSTGRES_PASSWORD` | Use letters and numbers only |

**Dirty database version:** stop the backend and take a backup. Inspect the
failed migration and database state with an experienced maintainer. Do not simply
set `schema_migrations.dirty = false`: that can mark a partially applied schema
as complete. Repair to a known schema version or restore a verified backup first.

### The Vercel site loads but no data appears

1. Open the browser DevTools (**F12**) → **Network** tab → reload.
2. Find a failing `/api/...` request and read its status:

| Status | Meaning | Fix |
| ------ | ------- | --- |
| 404 with an HTML body | The rewrite isn't active | `BACKEND_URL` missing at build time → set it in Vercel and **redeploy** |
| 502 / 504 | Vercel can't reach your API | Is Caddy up? Does `curl https://<api-domain>/health` work? |
| 401 on every call | Not logged in / cookie dropped | See the next section |
| CORS error in the console | Origin mismatch | `CORS_ALLOWED_ORIGINS` must exactly match the Vercel URL, with `https://` and no trailing slash |

### I get logged out immediately after logging in

The refresh-token cookie is `HttpOnly; Secure; SameSite=Strict`. It survives only
if:

- You're browsing over **https://** (not http).
- You're on the **Vercel domain**, not the API domain directly.
- `ENV=production` is set for the backend — it is, in
  [deploy/docker-compose.yml](../deploy/docker-compose.yml). Confirm with
  `docker compose exec backend env | grep ENV`.

Check it in DevTools → **Application → Cookies**: you should see a cookie on your
Vercel domain after login.

### Docker build fails or the server freezes during build

Low memory. Confirm swap is on (`free -h`), and build one service at a time:

```bash
docker compose build backend
docker compose up -d
```

### `docker compose` says `variable is not set`

You are in the wrong directory. Compose reads `.env` from the folder containing
the compose file:

```bash
cd ~/amaar-shop/deploy && docker compose ps
```

### The disk is full

```bash
df -h /
docker system prune -af   # removes unused images/build cache; volumes untouched
sudo journalctl --vacuum-time=7d
du -sh ~/backups          # old backups add up
```

---

## Part 12 — Security checklist and known limits

### Before you tell anyone the URL

- [ ] `POSTGRES_PASSWORD` and `JWT_SECRET` were generated with `openssl rand` —
      not typed by hand, not reused from `.env.example`.
- [ ] `ADMIN_PASSWORD` is long and unique, and is **not** `admin123`.
- [ ] `deploy/.env` is `chmod 600` and was never committed
      (`git status` in `~/amaar-shop` shows a clean tree).
- [ ] Postgres has **no** `ports:` entry — verify with
      `docker compose ps` (the PORTS column should be empty for postgres).
- [ ] Oracle ingress rules exist only for 22, 80, 443.
- [ ] `https://<your-api-domain>/health` shows a padlock, no warning.
- [ ] `~/amaar-shop/deploy/backup.sh` runs nightly via cron, and you have
      restored from a backup once as a test.
- [ ] You never ran `backend/scripts/seed.sql` against production — it creates a
      demo seller with the password `seller123`.

### Honest limitations of this setup

| Limitation | Impact | When to fix it |
| ---------- | ------ | -------------- |
| **One VM, no redundancy** | If the VM dies, the site is down until you restore | When downtime costs real money — add a second VM or a managed database |
| **Uploads on local disk** | A lost VM loses images not yet backed up | Move to object storage (Oracle Object Storage / Cloudflare R2) when uploads exceed a few GB |
| **Vercel Hobby is non-commercial** | For personal non-commercial use only; real selling can already be commercial | Vercel Pro (~$20/mo), or [Appendix A](#appendix-a--running-the-frontend-on-oracle-instead-of-vercel) |
| **All traffic proxies through Vercel** | API and image proxying consume Vercel transfer/request quotas; monitor usage | Serve `/uploads` from a CDN when traffic grows |
| **5 MB upload cap** | Phone photos may be rejected | Add client-side image compression before upload |
| **No error monitoring** | You learn about crashes from users | Add Sentry, or at minimum check `docker compose logs` weekly |
| **DuckDNS dependency** | If DuckDNS is down, new TLS certificates can't be issued (existing ones keep working) | Move to your own domain ([Part 9](#part-9--optional-use-your-own-domain-name)) |

### What this setup costs

| Item | Cost |
| ---- | ---- |
| Oracle VM (2 ARM cores, 12 GB RAM, 50 GB disk) | $0 — Always Free |
| Oracle bandwidth (10 TB/month) | $0 |
| PostgreSQL, Caddy, TLS certificates | $0 — open source / Let's Encrypt |
| Vercel Hobby (100 GB bandwidth/month) | $0 |
| DuckDNS domain | $0 |
| **Total** | **$0/month** |
| *Optional:* your own `.com` domain | ~$10–15/year |

---

## Appendix A — Running the frontend on Oracle instead of Vercel

If Vercel's non-commercial Hobby terms become a problem, the same VM can serve
the frontend. The repo already has what you need
([docker-compose.prod.yml](../docker-compose.prod.yml),
[frontend/Dockerfile](../frontend/Dockerfile)).

Add a frontend service to `deploy/docker-compose.yml`:

```yaml
  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      args:
        BACKEND_URL: http://backend:8080
    restart: unless-stopped
    environment:
      BACKEND_URL: http://backend:8080
    depends_on:
      - backend
    logging: *logging
```

Then route the site domain to it in `deploy/Caddyfile`, keeping the API on its
own hostname:

```
{$SITE_DOMAIN} {
	encode gzip
	request_body {
		max_size 10MB
	}
	reverse_proxy frontend:3000
}

{$API_DOMAIN} {
	encode gzip
	reverse_proxy backend:8080
}
```

Add `SITE_DOMAIN=amaarshop.com` to `.env`, pass it into the caddy service's
`environment:` alongside `API_DOMAIN`, point that domain's DNS at your Oracle IP,
and run `docker compose up -d --build`. Note that the frontend still reaches the
API over the internal Docker network, so `BACKEND_URL` stays `http://backend:8080`.

---

## Appendix B — Quick reference

```bash
# Connect
ssh -i ~/.ssh/amaarshop_oracle ubuntu@<your-ip>

# Everything below runs here:
cd ~/amaar-shop/deploy

docker compose ps                      # status
docker compose logs -f backend         # live logs
docker compose up -d                   # apply .env changes
docker compose up -d --build           # deploy new code (after git pull)
docker compose restart backend         # restart the API
./backup.sh                            # back up now

# Health checks (from anywhere)
curl https://<your-api-domain>/health   # {"status":"ok"}
curl https://<your-api-domain>/ready    # {"status":"ready"} — API + DB
```

| Thing | Where |
| ----- | ----- |
| Server code | `~/amaar-shop` on the VM |
| Secrets | `~/amaar-shop/deploy/.env` (chmod 600, never committed) |
| Database data | Docker volume `amaarshop_pgdata` |
| Uploaded images | Docker volume `amaarshop_upload_data` |
| TLS certificates | Docker volume `amaarshop_caddy_data` |
| Backups | `~/backups` on the VM |
| Frontend hosting | Vercel dashboard → project → Deployments |
| API domain DNS | duckdns.org (or your registrar) |
| Firewall layer 1 | Oracle console → Networking → VCN → Security Lists |
| Firewall layer 2 | `sudo iptables -L INPUT -n --line-numbers` on the VM |
