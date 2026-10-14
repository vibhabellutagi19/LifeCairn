# Deploy LifeCairn using ECR and AWS Systems Manager

Run these instructions yourself. No AWS resources have been deployed or verified by the assistant.

This guide deploys **LifeCairn**. Manifestation is a separate application and database.

Build the Docker images on your computer and push them to private Amazon ECR. EC2 pulls and runs the images; it never compiles Next.js. This avoids the EC2 build that previously ran out of memory. ECR image storage and transfers can incur charges.

## Before you start

Push the latest LifeCairn code to GitHub, including:

- `Dockerfile`
- `.dockerignore`
- `next.config.ts`
- `deploy/compose.yaml`
- `deploy/Caddyfile`
- `deploy/ec2.env.example`
- `deploy/push-ecr.sh`

Keep `.env`, `deploy/ec2.env`, private keys, and database backups out of GitHub.

Replace `YOUR_REGION`, `YOUR_INSTANCE_ID`, `YOUR_USERNAME`, `YOUR_REPOSITORY`, and domain placeholders locally. You do not need to share them with the assistant.

## 1. Enable SSM access in the AWS Console

1. Select your EC2 instance.
2. Open **Actions → Security → Modify IAM role**.
3. Attach an EC2 IAM role containing **AmazonSSMManagedInstanceCore** and **AmazonEC2ContainerRegistryReadOnly**. If a role is already attached, preserve its existing permissions and add the required policies to it. The ECR policy allows the instance to pull images without storing AWS access keys on the server. Use an ECR repository in the same AWS account for this guide; cross-account access requires additional repository permissions.
4. Ensure your own AWS identity has permission to start Session Manager sessions.
5. Ensure SSM Agent is installed and running on the instance.
6. Ensure the instance can reach Systems Manager over outbound HTTPS, using internet connectivity or appropriate VPC endpoints.
7. Select **Connect → Session Manager → Connect**.

SSM does not require inbound SSH access or an SSH private key.

References:

- [Instance permissions for Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-instance-profile.html)
- [Start a Session Manager session](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html)
- [Troubleshoot SSM Agent connectivity](https://docs.aws.amazon.com/systems-manager/latest/userguide/troubleshooting-ssm-agent.html)

## 2. Identify the operating system

**Run inside the SSM session:**

```bash
bash
cat /etc/os-release
uname -m
```

The supplied AMI ID, `ami-0602d54def0ad09dc`, does not establish the operating system without its region. Use the installation steps matching the actual OS. If it is neither Ubuntu nor Amazon Linux 2023, use Docker's instructions for that distribution.

## 3. Install Docker and Git

Run only the block matching your OS, inside the SSM session.

### Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nano openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Reference: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

### Amazon Linux 2023

```bash
sudo dnf install -y docker git nano openssl
sudo systemctl enable --now docker

sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fL \
  "https://github.com/docker/compose/releases/download/v5.6.0/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

The manually installed Compose plugin needs manual updates.

References:

- [Install Docker on Amazon Linux](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html)
- [Install the Docker Compose plugin](https://docs.docker.com/compose/install/linux/)

### Verify installation

```bash
sudo docker version
sudo docker compose version
```

Both should report their versions, and Docker should report a working server.

## 4. Build and push images from your computer

The Dockerfile runs Next.js compilation on Docker’s native build CPU using `BUILDPLATFORM`. It installs production dependencies separately for the selected EC2 CPU. On an ARM Mac targeting x86 EC2, compilation runs natively on ARM; only target dependency installation may still use emulation. The final app and database tools images match EC2. Full target production dependencies make the app image larger than a traced-only standalone image.

On your computer, install Docker with Buildx, start Docker, and configure AWS CLI authentication. Use your own AWS profile; never put AWS access keys in the repository.

The publishing identity needs `ecr:GetAuthorizationToken` and repository permissions for `DescribeRepositories`, `DescribeImages`, `BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, and `PutImage`. It also needs `CreateRepository` if the repository does not already exist. The script creates a private repository with immutable tags only when it is missing. It does not change an existing repository's settings.

Check the architecture inside the SSM session with `uname -m`:

| EC2 output | Build platform |
| --- | --- |
| `x86_64` | `linux/amd64` |
| `aarch64` | `linux/arm64` |

**Run on your computer, from your local LifeCairn repository:**

```bash
export AWS_REGION=YOUR_REGION
# Optional, if you use a named AWS CLI profile:
# export AWS_PROFILE=YOUR_PROFILE
export ECR_REPOSITORY=lifecairn
export PLATFORM=linux/amd64
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY

bash deploy/push-ecr.sh
```

The script builds the current working tree, including uncommitted application changes. It uses a timestamp as the release tag by default. You can set `IMAGE_TAG` to a unique release name before running it. Use a new tag on each run; immutable ECR tags cannot be overwritten. If a partial push fails, retry with a new tag.

The Clerk publishable key is public and must be available during the image build. Do not provide `CLERK_SECRET_KEY` or `DATABASE_URL` to the build; those belong only in the server's runtime environment. Local environment files and backups are excluded by `.dockerignore`.

The script prints the resulting `APP_IMAGE` and `TOOLS_IMAGE` values after verifying both release tags in ECR. Save them for the EC2 configuration below. Docker must have enough memory for the build on your computer. Docker Desktop supports cross-architecture builds; other builders may need emulation configured.

References:

- [ECR authentication](https://docs.aws.amazon.com/cli/latest/reference/ecr/get-login-password.html)
- [Docker Buildx platform and push options](https://docs.docker.com/reference/cli/docker/buildx/build/)
- [EC2 ECR read-only permissions](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonEC2ContainerRegistryReadOnly.html)

## 5. Download LifeCairn deployment files from GitHub

**Run inside the SSM session:**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git ~/lifecairn
cd ~/lifecairn
```

If you already cloned the repository at `~/lifecairn`, run `cd ~/lifecairn` and `git pull --ff-only` instead. EC2 uses the deployment files from GitHub and executable images from ECR.

For a private repository, use your GitHub username and a read-only repository token when Git prompts for credentials. Do not include the token in the clone URL.

## 6. Configure environment variables

**Run inside SSM, from `~/lifecairn`:**

```bash
cp deploy/ec2.env.example deploy/ec2.env
chmod 600 deploy/ec2.env
openssl rand -hex 32
nano deploy/ec2.env
```

Use the generated password and fill in the file:

```dotenv
APP_IMAGE=YOUR_ACCOUNT.dkr.ecr.YOUR_REGION.amazonaws.com/lifecairn:YOUR_RELEASE
TOOLS_IMAGE=YOUR_ACCOUNT.dkr.ecr.YOUR_REGION.amazonaws.com/lifecairn:YOUR_RELEASE-tools
SITE_ADDRESS=your-domain.example
POSTGRES_PASSWORD=PASTE_GENERATED_PASSWORD
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_CLERK_SECRET_KEY
```

Copy the exact `APP_IMAGE` and `TOOLS_IMAGE` values printed by the publishing script. Use matching publishable and secret keys from the same Clerk instance, with the same publishable key used to build the app image. If a database volume already exists, retain its original `POSTGRES_PASSWORD`; changing this variable does not change the database password in that volume.

For an initial **private SSM test**, use your existing Clerk development keys. If you have no domain yet, set `SITE_ADDRESS=:80`. The proxy is not started during private testing.

For public use, configure your domain and Clerk production instance. Clerk development and production have separate user pools. Moving existing LifeCairn records to production also requires mapping their stored owner IDs to the corresponding production users; changing keys alone does not migrate ownership.

Reference: [Clerk environments](https://clerk.com/docs/guides/development/managing-environments).

## 7. Log in to ECR from EC2 and pull the images

EC2 needs AWS CLI installed. Check with `aws --version`; if it is missing, follow the [AWS CLI Linux installation instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), choosing the package matching `uname -m`. Use the instance IAM role rather than configuring access keys on EC2.

**Run inside SSM:**

```bash
export AWS_REGION=YOUR_REGION
export ECR_REGISTRY=YOUR_ACCOUNT.dkr.ecr.YOUR_REGION.amazonaws.com

aws ecr get-login-password --region "$AWS_REGION" \
  | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"

cd ~/lifecairn
sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml --profile tools pull app tools db
```

Use `sudo docker login` because the Compose commands also run with `sudo`. ECR login tokens expire after 12 hours; repeat the login before pulling new releases if needed.

## 8. Start PostgreSQL and create the schema

**Run inside SSM, from `~/lifecairn`:**

```bash
sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml up -d db

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml --profile tools run --rm tools
```

This creates a **new, empty database**. GitHub transfers code, not your local database records. Existing records require a separate export/import before you begin using the hosted app as your main copy.

On future schema updates, back up the database first and review Drizzle's proposed changes before accepting them.

## 9. Start LifeCairn from the ECR image

**Run inside SSM, from `~/lifecairn`:**

```bash
sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml up -d --no-build app

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml ps

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml logs --tail=100 app
```

Expect the database to be healthy and the app to remain running. The Next.js startup log should indicate that it is ready. EC2 needs outbound connectivity to ECR and its image storage, and to Docker Hub for PostgreSQL and Caddy. Only your computer needs the package registry and Google Fonts access used during the app build.

## 10. Open LifeCairn privately through SSM

On **your computer**, install and configure the AWS CLI and install the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).

**Run on your computer, not inside EC2:**

```bash
aws ssm start-session \
  --region YOUR_REGION \
  --target YOUR_INSTANCE_ID \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["3000"],"localPortNumber":["6003"]}'
```

Add `--profile YOUR_PROFILE` if you use a named AWS CLI profile.

Keep the terminal open and visit **http://localhost:6003**. Verify sign-in and the main pages. The app's port is bound only to the EC2 host's loopback interface; no public port 3000 rule is needed.

## 11. Enable public HTTPS when ready

1. Assign or use a stable public IP for the instance. Public IPv4 addresses and other AWS resources can incur charges.
2. Point your domain's DNS A record to that IP. Add an AAAA record only if IPv6 is configured and reachable.
3. Allow inbound TCP **80 and 443** in the instance's security group and any host firewall. These rules make the web service publicly reachable. Keep **3000 and 5432** closed publicly.
4. Configure the production domain and required DNS records in Clerk.
5. Build and push a new image release on your computer using the production Clerk publishable key. Update `APP_IMAGE`, `TOOLS_IMAGE`, `SITE_ADDRESS`, and the matching production Clerk keys in `deploy/ec2.env` on EC2.
6. Resolve existing data ownership before relying on migrated records with production accounts.

Reference: [Deploy Clerk to production](https://clerk.com/docs/guides/development/deployment/production).

**Run inside SSM, from `~/lifecairn`:**

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml --profile tools pull app tools

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml up -d --no-build app

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml up -d proxy

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml logs --tail=100 proxy
```

Build a new image on your computer whenever the Clerk publishable key changes; it is embedded at build time. Pull that release on EC2 before restarting the app. Do not rebuild on EC2.

Caddy obtains and renews HTTPS certificates for the configured hostname once DNS and inbound connectivity are correct. Open `https://YOUR_DOMAIN` and verify sign-in and the application pages yourself.

## 12. Publish and deploy updates

1. On your computer, run `bash deploy/push-ecr.sh` with a new release tag and the intended Clerk publishable key.
2. Push any changed deployment files to GitHub.
3. Inside SSM, update the deployment files and edit `APP_IMAGE` and `TOOLS_IMAGE` together to the matching release values.
4. Keep the database password unchanged. Back up the database before schema changes.

**Run inside SSM:**

```bash
cd ~/lifecairn
git pull --ff-only
nano deploy/ec2.env

export AWS_REGION=YOUR_REGION
export ECR_REGISTRY=YOUR_ACCOUNT.dkr.ecr.YOUR_REGION.amazonaws.com
aws ecr get-login-password --region "$AWS_REGION" \
  | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml --profile tools pull app tools
```

If the release changes the schema, back up first, then run and review:

```bash
sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml --profile tools run --rm tools
```

Start the new release:

```bash
sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml up -d --no-build app

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml ps

sudo docker compose --env-file deploy/ec2.env \
  -f deploy/compose.yaml logs --tail=100 app
```

This recreates the app container and can briefly interrupt requests. For an application rollback, restore the previous `APP_IMAGE` and matching `TOOLS_IMAGE`, pull them, and recreate the app. Application rollback does not undo database changes; those need a compatible schema or a separate recovery plan. Keep previous release tags until the new release is verified.

## Database persistence

PostgreSQL data persists in a Docker volume on this EC2 instance. A volume is not an off-instance backup.

**Do not run `docker compose down -v`: it deletes the database volume.**

The deployment is complete only after you verify the running app and confirm whether you need to import your existing local data.

## Troubleshoot a local cross-architecture build

The earlier Dockerfile compiled Next.js under QEMU when an ARM computer targeted `linux/amd64`. Both Turbopack and Webpack crashed with SIGSEGV in that setup. The current Dockerfile pins compilation to `BUILDPLATFORM` and replaces traced build-CPU dependencies with a fresh production dependency install for the target CPU.

**Run on your computer with the updated Dockerfile:**

```bash
export AWS_PROFILE=lifecairn
export AWS_REGION=YOUR_REGION
export PLATFORM=linux/amd64
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
unset NEXT_BUILD_BUNDLER IMAGE_TAG
bash deploy/push-ecr.sh
```

Keep `PLATFORM` matched to EC2: `linux/amd64` for `x86_64`, or `linux/arm64` for `aarch64`. Do not switch to an ARM image solely to avoid emulation if EC2 is x86.

`unset IMAGE_TAG` generates a fresh timestamp tag; omit it if you deliberately selected a new release tag. The default bundler is Turbopack. `NEXT_BUILD_BUNDLER=webpack` remains available as an optional bundler choice.

A remaining crash during `npm ci` in `runtime-dependencies` or `tools` is a target dependency installation problem rather than the native Next.js compilation step. Update Docker Desktop and retry; report the failing stage if it persists. No GitHub Actions workflow is required.

Reference: [Docker native build stages and target platforms](https://docs.docker.com/build/building/multi-platform/).
