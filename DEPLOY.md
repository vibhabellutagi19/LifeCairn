# Deploying LifeCairn to AWS EC2 (Ubuntu)

Architecture: you build Docker images on your computer and push them to a private Amazon ECR repository. The EC2 instance only pulls and runs them (app + PostgreSQL + Caddy for HTTPS). **Nothing is compiled on EC2**, which avoids out-of-memory failures on small instances.

These are manual steps you run yourself in the AWS Console and in terminals. Charges can apply for EC2, public IPv4, EBS and ECR storage; set a billing alarm.

You will need: an AWS account, the AWS CLI configured on your computer, Docker Desktop with Buildx, a Clerk application, and (for HTTPS) a domain name.

Replace `YOUR_REGION`, `YOUR_ACCOUNT`, and similar placeholders with your own values.

## 1. Create the ECR repository and IAM role

**ECR repository** (Console → ECR → Private registry → Repositories → Create repository):

- Name: `lifecairn`
- Tag immutability: enabled

You can skip this: `deploy/push-ecr.sh` creates the repository if it is missing.

**IAM role for the instance** (Console → IAM → Roles → Create role):

1. Trusted entity: AWS service → EC2.
2. Attach the policy `AmazonEC2ContainerRegistryReadOnly`.
3. Name it `lifecairn-ec2`.

The instance uses this role to pull images, so no AWS access keys are stored on the server.

## 2. Launch the EC2 instance

Console → EC2 → Launch instance:

| Setting | Value |
| --- | --- |
| Name | `lifecairn` |
| AMI | Ubuntu Server 24.04 LTS |
| Architecture | x86_64 (recommended; remember your choice for step 4) |
| Instance type | `t3.small` (2 GB) recommended; `t3.micro` (1 GB) works for running only, since nothing is built on it |
| Key pair | Create a new key pair (RSA, `.pem`) and save it; you cannot download it again |
| Network | Default VPC, auto-assign public IP enabled |
| Storage | 20 GB gp3 |
| Advanced → IAM instance profile | `lifecairn-ec2` |

**Security group** (create new), inbound rules:

| Port | Source | Purpose |
| --- | --- | --- |
| 22 | My IP | SSH |
| 80 | Anywhere | HTTP / certificate issuance |
| 443 | Anywhere | HTTPS |

Do not open 3000 or 5432.

After launch, allocate an **Elastic IP** (EC2 → Elastic IPs → Allocate, then Associate with the instance) so the address survives restarts. Release it if you delete the instance.

## 3. Prepare the server

On your computer:

```bash
chmod 400 /path/to/key.pem
ssh -i /path/to/key.pem ubuntu@YOUR_ELASTIC_IP
```

On the instance, add a small swap file (safety net on small instances):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Docker and Compose:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nano openssl unzip
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Install the AWS CLI v2 (Ubuntu's apt package is not suitable):

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o awscliv2.zip
unzip -q awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip
```

Verify:

```bash
sudo docker version
sudo docker compose version
aws --version
uname -m                      # x86_64 -> linux/amd64, aarch64 -> linux/arm64
aws sts get-caller-identity   # should show the lifecairn-ec2 role
```

If `get-caller-identity` fails, the IAM role is not attached: EC2 → Actions → Security → Modify IAM role.

## 4. Build and push images (on your computer)

Make sure Docker Desktop is running and the AWS CLI is authenticated (`aws sts get-caller-identity`). Your identity needs ECR push permissions (`ecr:GetAuthorizationToken`, `CreateRepository`, `DescribeRepositories`, `DescribeImages`, `BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`).

From the repo root:

```bash
export AWS_REGION=YOUR_REGION
# export AWS_PROFILE=YOUR_PROFILE        # if you use a named profile
export PLATFORM=linux/amd64              # must match `uname -m` on EC2
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

bash deploy/push-ecr.sh
```

The script builds the app and database-tools images, pushes both, and prints:

```
APP_IMAGE=...
TOOLS_IMAGE=...
```

Copy these. The publishable key is baked into the image at build time. Never pass `CLERK_SECRET_KEY` or `DATABASE_URL` to the build. Tags are immutable, so each run uses a new timestamp tag.

## 5. Get the deployment files onto EC2

Push the repo (including `deploy/`) to GitHub, then on the instance:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git ~/lifecairn
cd ~/lifecairn
```

For a private repo, use your GitHub username and a read-only token when prompted.

## 6. Configure environment variables

```bash
cd ~/lifecairn
cp deploy/ec2.env.example deploy/ec2.env
chmod 600 deploy/ec2.env
openssl rand -hex 32       # use as POSTGRES_PASSWORD
nano deploy/ec2.env
```

Fill in:

```dotenv
APP_IMAGE=<printed by push-ecr.sh>
TOOLS_IMAGE=<printed by push-ecr.sh>
SITE_ADDRESS=your-domain.example      # or :80 for an HTTP-only test
POSTGRES_PASSWORD=<generated>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...   # same key used for the build
CLERK_SECRET_KEY=sk_...                    # from the same Clerk instance
```

The database password is fixed when the volume is first created; changing it later does not change the existing database. Never commit `deploy/ec2.env`.

## 7. Log in to ECR and pull

```bash
export AWS_REGION=YOUR_REGION
export ECR_REGISTRY=YOUR_ACCOUNT.dkr.ecr.YOUR_REGION.amazonaws.com

aws ecr get-login-password --region "$AWS_REGION" \
  | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"

cd ~/lifecairn
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml --profile tools pull app tools db
```

Always use `sudo docker login`: credentials are stored per user, and the compose commands run with `sudo`. Login tokens expire after 12 hours.

## 8. Create the database schema

```bash
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml up -d db
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml --profile tools run --rm tools
```

This creates a new, empty database. Existing local data needs a separate export/import.

## 9. Start the app

```bash
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml up -d --no-build app
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml ps
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml logs --tail=100 app
```

The app listens on `127.0.0.1:3000` on the instance only. To test before enabling public access, tunnel from your computer:

```bash
ssh -i /path/to/key.pem -L 6003:localhost:3000 ubuntu@YOUR_ELASTIC_IP
```

then open http://localhost:6003.

## 10. Enable public HTTPS

1. Point your domain's DNS **A record** at the Elastic IP.
2. In Clerk, configure the production instance and your domain, and use its production keys in `deploy/ec2.env`. If the publishable key changed, rebuild and push new images (step 4) and update `APP_IMAGE` / `TOOLS_IMAGE`. Clerk development and production have separate user pools; moving existing data requires remapping owner IDs.
3. Set `SITE_ADDRESS` to your domain, then start the proxy:

```bash
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml up -d proxy
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml logs --tail=100 proxy
```

Caddy obtains and renews the certificate automatically once DNS and ports 80/443 work. Open `https://your-domain.example` and sign in.

## 11. Deploy updates

On your computer: `bash deploy/push-ecr.sh` (new tag each time). Then on EC2:

```bash
cd ~/lifecairn
git pull --ff-only
nano deploy/ec2.env     # update APP_IMAGE and TOOLS_IMAGE together

aws ecr get-login-password --region "$AWS_REGION" \
  | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml --profile tools pull app tools

# only if the schema changed (back up first):
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml --profile tools run --rm tools

sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml up -d --no-build app
```

Rollback: set the previous `APP_IMAGE` and `TOOLS_IMAGE` and recreate the app. This does not undo database changes.

## Backups and data safety

PostgreSQL data lives in a Docker volume on this instance, which is not an off-instance backup. Back up regularly:

```bash
sudo docker compose --env-file deploy/ec2.env -f deploy/compose.yaml exec -T db \
  pg_dump -U lifecairn lifecairn > ~/lifecairn-$(date +%F).sql
```

Copy dumps off the instance (for example to S3). **Never run `docker compose down -v`**; it deletes the database volume.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `aws: command not found` on EC2 | Install AWS CLI v2 (step 3) |
| `Unable to locate credentials` / `AccessDenied` on EC2 | Attach the `lifecairn-ec2` IAM role to the instance |
| `no basic auth credentials` on pull | Log in with `sudo docker login`, and log in again if 12 hours have passed |
| `exec format error` / no matching manifest | `PLATFORM` doesn't match `uname -m`; rebuild with the right one |
| Pull hangs | Instance lacks outbound internet or HTTPS egress |
| Push fails from your computer | Your AWS identity lacks ECR push permissions |
| No certificate | Check DNS A record and that ports 80/443 are open in the security group |
