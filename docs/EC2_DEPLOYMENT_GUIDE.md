# AWS EC2 Deployment Guide with GitHub Actions CI/CD

This guide provides step-by-step instructions to deploy **Taskr** to an **AWS EC2** instance using **Docker Compose** and automated deployments via **GitHub Actions**.

---

## Architecture Overview

- **Frontend**: Vite React SPA served by high-performance Nginx on port `80` (and `443` for SSL).
- **Backend**: Express API running on Node.js 22 inside a Docker container (port `4000`), reverse-proxied by Nginx at `/api/`.
- **Database**: External PostgreSQL (Supabase) via SSL.
- **CI/CD**: GitHub Actions runs automated typecheck, integration tests, and triggers zero-downtime container updates on EC2 via SSH upon pushing to `main`.

---

## Step 1: Launch an AWS EC2 Instance

1. Open the [AWS EC2 Console](https://console.aws.amazon.com/ec2/).
2. Click **Launch Instance** and configure:
   - **Name**: `worklog-server`
   - **AMI**: **Ubuntu Server 24.04 LTS (HVM)**, SSD Volume Type (64-bit x86).
   - **Instance Type**: 
     - Recommended: `t3.small` (2 vCPU, 2 GB RAM).
     - Free Tier: `t2.micro` or `t3.micro` (1 GB RAM — requires the swap memory configured in Step 2).
   - **Key pair (login)**: Select or create a new key pair (e.g., `worklog-key.pem`). Save the `.pem` file securely on your computer.
   - **Network Settings (Security Group)**:
     - Allow **SSH** traffic (Port `22`) from anywhere (`0.0.0.0/0`) or your custom IP.
     - Allow **HTTP** traffic (Port `80`) from the Internet (`0.0.0.0/0`).
     - Allow **HTTPS** traffic (Port `443`) from the Internet (`0.0.0.0/0`).
   - **Storage**: At least **20 GiB gp3**.
3. Click **Launch Instance**.
4. *(Recommended)* Under **Network & Security** > **Elastic IPs**, allocate an Elastic IP and associate it with your EC2 instance so the IP address remains permanent across reboots.

---

## Step 2: One-Time EC2 Server Preparation

Connect to your EC2 instance via terminal (or PowerShell / Git Bash):

```bash
ssh -i "path/to/worklog-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

Once connected, run the following setup commands:

### A. Add 2 GB Swap Memory (Essential for Micro Instances)
Prevents out-of-memory errors during Docker builds:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### B. Install Docker & Docker Compose
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release git

# Add Docker GPG key & repository
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Docker Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow 'ubuntu' user to run Docker without sudo
sudo usermod -aG docker ubuntu
```

> **Note**: Log out and log back in for the Docker group changes to take effect:
> ```bash
> exit
> ```
> Reconnect:
> ```bash
> ssh -i "path/to/worklog-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
> ```
> Verify Docker works:
> ```bash
> docker --version
> docker compose version
> ```

---

## Step 3: Configure GitHub Repository Secrets

In your GitHub repository ([https://github.com/DridhaTeamHQ/Worklog](https://github.com/DridhaTeamHQ/Worklog)):
1. Go to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add the following four secrets:

| Secret Name | Description / Value |
|---|---|
| `EC2_HOST` | Your EC2 Public IPv4 Address or Elastic IP (e.g. `13.233.xxx.xxx`) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | The **entire contents** of your `.pem` key file (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`) |
| `PROD_ENV` | The production `.env` configuration (see template below) |

### Sample `PROD_ENV` Secret Content:
```env
NODE_ENV=production
PORT=4000
APP_NAME=Dridha Worklog
CORS_ORIGIN=*

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.teavegzlffiegsjjhgdb:WorkLog$2026@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
DB_CLIENT=postgres

# Auth
JWT_SECRET=97d0bb4e313af7cbaf650a93406d7ceabfe9da056c8dc2066c723624cca35e8662f83080ead22b6a12c9f710f8a77bdd
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
COOKIE_SECURE=false

# App URL (Change to your domain or http://<EC2_IP>)
APP_URL=http://<YOUR_EC2_IP>

# Seed Admin (Optional)
SEED_ADMIN_EMAIL=admin@company.com
SEED_ADMIN_PASSWORD=Admin@123
SEED_ADMIN_NAME=Admin
```

---

## Step 4: Deploy via GitHub Actions

1. Commit and push the new deployment configuration to GitHub:
   ```bash
   git add .
   git commit -m "Configure Docker, Nginx, and GitHub Actions CI/CD for EC2"
   git push origin main
   ```
2. Open your repository on GitHub and click the **Actions** tab.
3. You will see the **CI/CD Pipeline - Test & Deploy to EC2** workflow running:
   - **Job 1**: Runs linting, typechecks TypeScript, and runs automated integration test flows.
   - **Job 2**: Connects via SSH to your EC2 instance, pulls the latest code, builds the Docker containers, runs database migrations, and brings the services online.
4. Once completed (green checkmark), open your browser and navigate to:
   ```
   http://<YOUR_EC2_PUBLIC_IP>/
   ```
5. Sign in using your Admin credentials (`admin@company.com` / `Admin@123`).

---

## Step 5: (Optional) Adding a Custom Domain & Free SSL (HTTPS)

If you point a domain name (e.g., `worklog.yourcompany.com`) to your EC2 Elastic IP:

1. SSH into the EC2 instance:
   ```bash
   ssh -i "path/to/worklog-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
   ```
2. Install Certbot:
   ```bash
   sudo apt install -y certbot
   ```
3. Stop the frontend container temporarily to free port 80:
   ```bash
   docker stop worklog-frontend
   ```
4. Obtain the certificate:
   ```bash
   sudo certbot certonly --standalone -d worklog.yourcompany.com
   ```
5. Mount the certificate directory in `docker-compose.yml` under `frontend`:
   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
   ```
   And add port `"443:443"`.
6. Restart containers:
   ```bash
   docker compose up -d
   ```
