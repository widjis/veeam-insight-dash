# Environment Files Guide - Veeam Insight Dashboard

## 🤔 The Confusion: .env vs .env.production

You're right to be confused! Let me clarify which file is actually used in production.

## 📋 Current Setup Analysis

### What Actually Happens in Production

**Docker Container Environment:**
- The application uses `dotenv.config()` which looks for `.env` file
- **NO environment files are copied into the Docker container** (check Dockerfile - no COPY for .env files)
- Environment variables are passed via `docker-compose.yml` using `${VARIABLE_NAME}` syntax
- Docker Compose reads from `.env` file in the host directory (if it exists)

### The Truth About Environment Files

| File | Purpose | Used By | Location |
|------|---------|---------|----------|
| `.env.production` | **Template/Reference** | Documentation | Host machine |
| `.env` | **Actually Used** | Docker Compose | Host machine |
| `server/.env.production` | **Template/Reference** | Documentation | Host machine |
| `server/.env` | **Not used in Docker** | Local development | Host machine |

## ✅ What You Need to Do for Production

### Step 1: Create the Actual .env File
```bash
# Copy the template to the actual file
cp .env.production .env
```

### Step 2: Edit Your Values
```bash
# Edit the .env file with your actual production values
nano .env
```

### Step 3: Verify Docker Compose Usage
Docker Compose will now read from `.env` file and pass variables to containers.

## 🔍 How It Actually Works

### Docker Compose Process:
1. Docker Compose reads `.env` file from the project root
2. Substitutes `${VARIABLE_NAME}` in `docker-compose.yml`
3. Passes environment variables to containers
4. Application inside container uses `process.env.VARIABLE_NAME`

### Example Flow:
```
.env file:           HTTP_PORT=8080
                     ↓
docker-compose.yml:  "${HTTP_PORT:-9007}:80"
                     ↓
Container:           Port 8080 mapped to container port 80
```

## 📁 File Structure Recommendation

```
veeam-insight-dash/
├── .env                    # ✅ ACTUAL production config (create this)
├── .env.production         # 📋 Template/reference (keep for documentation)
├── .env.example           # 📋 Example with dummy values
├── docker-compose.yml     # 🐳 Uses variables from .env
└── server/
    ├── .env.production    # 📋 Template (not used in Docker)
    └── .env.example       # 📋 Example for local development
```

## 🚨 Security Best Practices

### .gitignore Configuration
Make sure your `.gitignore` includes:
```
# Environment files with real credentials
.env
server/.env

# Keep templates for reference
# .env.production
# .env.example
```

### File Permissions
```bash
# Secure your actual environment file
chmod 600 .env
```

## 🛠️ Quick Setup Commands

### For New Production Deployment:
```bash
# 1. Create actual environment file
cp .env.production .env

# 2. Edit with your real values
nano .env

# 3. Secure the file
chmod 600 .env

# 4. Deploy
docker-compose up -d
```

### For Existing Deployment:
```bash
# Check if .env exists
ls -la .env

# If not, create it
cp .env.production .env

# Edit as needed
nano .env
```

## 🔧 Environment Variable Priority

1. **Docker Compose environment section** (highest priority)
2. **Container environment variables**
3. **Host .env file** (via Docker Compose)
4. **Application defaults** (in environment.ts)

## 📝 Summary

**For Production:**
- ✅ **Use**: `.env` (copy from `.env.production` template)
- ❌ **Don't use**: `.env.production` directly
- 📋 **Keep**: `.env.production` as template/reference

**The Confusion Explained:**
The documentation mentions "copy .env.production to .env" because:
- `.env.production` is a **template** with example values
- `.env` is the **actual file** Docker Compose reads
- This separation keeps real credentials out of version control

## 🎯 Action Required

If you haven't already:
1. Copy `.env.production` to `.env`
2. Edit `.env` with your real production values
3. Restart your Docker containers
4. Verify everything works with the new configuration

This explains why you might have seen inconsistent behavior - Docker Compose was looking for `.env` but only found `.env.production`!