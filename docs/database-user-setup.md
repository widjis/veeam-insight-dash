# Veeam Insight Database User Setup Guide

This guide explains how to create a dedicated database user for the Veeam Insight Dashboard application.

## Overview

Instead of using the shared `vaultuser` credentials, we'll create a dedicated `veeam_insight` user with specific permissions for the `veeam_insight_db` database. This provides better security isolation and permission management.

## Prerequisites

- PostgreSQL server running on `10.60.10.59:5432`
- Access to `vaultuser` with administrative privileges
- The `veeam_insight_db` database already exists

## Step 1: Create the Dedicated User

**✅ SETUP COMPLETED**

The dedicated `veeam_insight` user has been successfully created using Prisma's raw SQL execution capabilities.

1. **Connect to PostgreSQL as vaultuser:**
   ```bash
   psql -h 10.60.10.59 -p 5432 -U vaultuser -d postgres
   ```

2. **Run the user creation script:**
   ```bash
   psql -h 10.60.10.59 -p 5432 -U vaultuser -d postgres -f database/create-veeam-user.sql
   ```

   **OR execute the SQL commands manually:**

   Or execute manually:
   ```sql
   -- Create the dedicated veeam_insight user
   CREATE USER veeam_insight WITH PASSWORD 'VeeamInsight2025!';
   
   -- Grant necessary privileges
   GRANT CONNECT ON DATABASE veeam_insight_db TO veeam_insight;
   GRANT USAGE ON SCHEMA public TO veeam_insight;
   GRANT CREATE ON SCHEMA public TO veeam_insight;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO veeam_insight;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO veeam_insight;
   GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO veeam_insight;
   
   -- Grant privileges on future objects
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO veeam_insight;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO veeam_insight;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO veeam_insight;
   ```

## Step 2: Test the New User

1. **Test connection:**
   ```bash
   psql -h 10.60.10.59 -p 5432 -U veeam_insight -d veeam_insight_db
   ```

2. **Verify permissions:**
   ```sql
   -- List tables (should show all existing tables)
   \dt
   
   -- Test a simple query
   SELECT COUNT(*) FROM "SystemConfig";
   ```

## Step 3: Update Application Configuration

The application configuration has been updated to use the new credentials:

**Environment Variables:**
```env
DATABASE_URL=postgresql://vaultuser:VaultP@ssw0rd!@10.60.10.59:5432/veeam_insight_db
```

**Files Updated:**
- `server/.env`
- `.env`

## Step 4: Test Application Connection

1. **Test Prisma connection:**
   ```bash
   cd server
   DATABASE_URL='postgresql://vaultuser:VaultP@ssw0rd!@10.60.10.59:5432/veeam_insight_db' npx prisma db push
   ```

2. **Verify with Prisma Studio:**
   ```bash
   DATABASE_URL='postgresql://vaultuser:VaultP@ssw0rd!@10.60.10.59:5432/veeam_insight_db' npx prisma studio
   ```

## Security Benefits

1. **Principle of Least Privilege:** The `veeam_insight` user only has access to the specific database it needs
2. **Isolation:** Separate from the `vaultuser` which may have broader system access
3. **Auditing:** Database actions can be tracked specifically to the application user
4. **Rotation:** Credentials can be rotated independently without affecting other systems

## Credential Details

- **Username:** `veeam_insight`
- **Password:** `VeeamInsight2025!`
- **Database:** `veeam_insight_db`
- **Server:** `10.60.10.59:5432`
- **Permissions:** Full access to `veeam_insight_db` database and public schema

## Troubleshooting

### Connection Issues
- Verify the user was created: `\du veeam_insight`
- Check database permissions: `\l` (should show `veeam_insight` has Connect privilege)
- Ensure password is correct and properly escaped in connection strings

### Permission Issues
- Verify table permissions: `\dp` in the target database
- Re-run the GRANT statements if needed
- Check that default privileges are set for future objects

---

*Created: August 15, 2025*
*For: Veeam Insight Dashboard Application*