# Database Setup Guide

## Overview
This guide explains how to set up the PostgreSQL database for the Veeam Insight Dashboard.

## Prerequisites
- PostgreSQL server running on `10.60.10.59:5432`
- Access to `vaultuser` with password `VaultP@ssw0rd!`
- Remote PostgreSQL server accessible

## Setup Steps

### Option 1: Using psql Command Line

1. **Connect to PostgreSQL as vaultuser:**
   ```bash
   psql -h 10.60.10.59 -p 5432 -U vaultuser -d vault
   ```

2. **Run the initialization script:**
   ```bash
   psql -h 10.60.10.59 -p 5432 -U vaultuser -d vault -f database/init.sql
   ```

### Option 2: Using pgAdmin or Database GUI

1. Connect to the PostgreSQL server using your preferred GUI tool
2. Open and execute the `database/init.sql` script
3. Verify the database and user were created successfully

### Option 3: Manual SQL Execution

1. **Connect to PostgreSQL:**
   ```bash
   psql -h 10.60.10.59 -p 5432 -U vaultuser -d vault
   ```

2. **Execute these commands in your PostgreSQL client:**

```sql
-- Create database
CREATE DATABASE veeam_insight_db;

-- Grant privileges to existing vaultuser
GRANT ALL PRIVILEGES ON DATABASE veeam_insight_db TO vaultuser;

-- Connect to the new database
\c veeam_insight_db;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO vaultuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vaultuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vaultuser;
```

## After Database Creation

Once the database is created, run the Prisma commands:

```bash
# Navigate to server directory
cd server

# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# Optional: Seed the database with initial data
npm run seed
```

## Verification

To verify the setup is working:

```bash
# Test database connection
npx prisma db pull

# Check if tables were created
npx prisma studio
```

## Troubleshooting

### Authentication Failed (P1000)
- Verify the PostgreSQL server is running
- Check if the user `veeam_user` exists and has the correct password
- Ensure the user has proper privileges on the database

### Connection Refused (P1001)
- Verify the server address and port
- Check firewall settings
- Ensure PostgreSQL is configured to accept external connections

### Database Does Not Exist
- Run the initialization script first
- Verify the database was created successfully

## Environment Configuration

Ensure your `.env` file contains:

```env
DATABASE_URL=postgresql://vaultuser:VaultP@ssw0rd!@10.60.10.59:5432/veeam_insight_db
```

## Security Notes

- Change the default password in production
- Use environment variables for sensitive credentials
- Consider using connection pooling for production deployments
- Implement proper backup and recovery procedures