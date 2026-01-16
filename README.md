# env-version-tracker

CLI tool to track which version is deployed in each environment. Works with local JSON files or MongoDB.

## Install

```bash
npm install --save-dev env-version-tracker
```

After installation, use the `evt` command (short for **E**nv **V**ersion **T**racker).

## Setup

### 1. Configure where to store versions

**Using a JSON file:**

```bash
evt config local --storage-path ./versions.json
```

**Using MongoDB:**

You can configure a different `.env` file for each environment, or use the same file for all environments.

**Option 1: Same .env file for all environments**

1. Create a `.env` file in your project with the following variables:

```bash
# .env file
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=version-tracker
COLLECTION_NAME=versions
```

2. Configure the tool to use the `.env` file for all environments:

```bash
evt config remote --storage-env-file .env
```

**Option 2: Different .env file per environment (recommended)**

1. Create separate `.env` files for each environment:

```bash
# .env.dev
DATABASE_URL=mongodb://dev-server:27017
DATABASE_NAME=version-tracker-dev
COLLECTION_NAME=versions

# .env.staging
DATABASE_URL=mongodb://staging-server:27017
DATABASE_NAME=version-tracker-staging
COLLECTION_NAME=versions

# .env.production
DATABASE_URL=mongodb://prod-server:27017
DATABASE_NAME=version-tracker-prod
COLLECTION_NAME=versions
```

2. Configure each environment separately:

```bash
evt config remote \
  --env-file-dev .env.dev \
  --env-file-staging .env.staging \
  --env-file-preprod .env.preprod \
  --env-file-production .env.production
```

Or configure them one by one:

```bash
evt config remote --env-file-dev .env.dev
evt config remote --env-file-staging .env.staging
evt config remote --env-file-production .env.production
```

**Supported environment variable names (generic, provider-agnostic):**

- **URL**: `DATABASE_URL` (recommended), `DATABASE_URI`, `DB_URL`, or `DB_URI`
- **Database**: `DATABASE_NAME` (recommended), `DATABASE`, `DB_NAME`, or `DB`
- **Collection**: `COLLECTION_NAME` (recommended), `COLLECTION`, `TABLE_NAME`, or `TABLE`

**Legacy MongoDB-specific names** (still supported for backward compatibility):

- `MONGODB_URL`, `MONGO_URL`, `MONGODB_URI`, `MONGO_URI`
- `MONGODB_DATABASE`, `MONGO_DATABASE`, `MONGODB_DB`, `MONGO_DB`
- `MONGODB_COLLECTION`, `MONGO_COLLECTION`, `MONGODB_COL`, `MONGO_COL`

**Note:**

- The `.env` file path can be absolute or relative to your project root.
- **Security:** Make sure to add `.env` to your `.gitignore` file to avoid committing sensitive credentials.

### 2. Optional: Auto-track after git push

If you want the tool to ask for version info automatically after each git push:

```bash
evt setup-hook
```

This creates a `ppush` alias that you can use instead of `git push`. After a successful push, you'll be prompted for version tag and environment.

**To override `git push` directly (may cause conflicts):**

```bash
evt setup-push-alias
```

### 3. Track a deployment

**Manual:**

```bash
evt push patch dev
evt push minor staging
evt push major production
```

**With alias installed:**
Use `git ppush` instead of `git push`. After a successful push, you'll be prompted for version tag and environment.

```bash
git ppush origin main
# After successful push, prompts appear automatically:
# ? What version tag? (Use arrow keys)
# ? Which environment?
# ? Track the author? (y/N)
```

## Commands

**`config <storage> [options]`** - Set up where to store versions

- `storage`: `local` or `remote`
- **For local storage:**
  - `--storage-path <path>`: Path to JSON file
- **For remote storage:**
  - `--storage-env-file <path>`: Use same .env file for all environments
  - `--env-file-dev <path>`: .env file for dev environment
  - `--env-file-staging <path>`: .env file for staging environment
  - `--env-file-preprod <path>`: .env file for preprod environment
  - `--env-file-production <path>`: .env file for production environment

**`push <version-tag> <environment> [options]`** - Record a deployment

- `version-tag`: `major`, `minor`, `patch`, or exact version like `1.2.3`
- `environment`: `dev`, `staging`, `preprod`, `production`
- `--track-author`: Include git author email

**Note:** For remote storage, the tool automatically loads the `.env` file configured for the specified environment. If no `.env` file is configured, you'll get an error with instructions to configure it.

**`setup-hook`** - Enable auto-tracking by creating a `ppush` git alias

Creates a `git ppush` command that wraps `git push` and triggers version tracking after successful pushes. This is the recommended approach to avoid conflicts with the standard `git push` command.

**`setup-push-alias`** - Override `git push` directly with version tracking

⚠️ **Warning:** This overrides the standard `git push` command and may cause conflicts. Use `setup-hook` instead for a safer approach.

**`remove-hook`** - Remove git aliases (`ppush` and `push` if configured)

## How it works

- Calculates the next version based on the last version for that environment
- Gets commit info from git (hash, message, author if enabled)
- Handles merge commits by extracting the original commit
- Saves everything to your configured storage

## What gets created

After running `setup-hook`, a git alias `ppush` is configured in your local git config.

Your project will have:

```
your-project/
├── .env-version-tracker/
│   ├── config.json              # Your config (stores .env file paths per environment)
│   └── git-push-wrapper.sh     # Git push wrapper script
├── .env.dev                     # Dev environment credentials (add to .gitignore!)
├── .env.staging                 # Staging environment credentials (add to .gitignore!)
├── .env.production              # Production environment credentials (add to .gitignore!)
└── versions.json                # Version history (if local storage)
```

Config is stored in `.env-version-tracker/config.json` per project. For remote storage, only the paths to your `.env` files are stored (one per environment), not the actual credentials.

**Debug logs:** If something goes wrong, check `/tmp/evt-debug.log` for detailed logs.

## Examples

**Basic usage:**

```bash
evt push patch dev
# Version 1.0.1 pushed to dev
```

**With author tracking:**

```bash
evt push minor staging --track-author true
```

**With alias (automatic):**

```bash
git ppush origin main
# After successful push, prompts appear automatically:
# 🚀 Post-push handler triggered!
# Tracking version...
# ? What version tag? (Use arrow keys)
# ? Which environment?
# ? Track the author? (y/N)
# ✅ Version tracking completed!
```

## Data format

Versions are stored with:

- Version number (auto-incremented)
- Environment name
- Git commit hash and message
- Author (optional)
- Timestamp

**Local JSON example:**

```json
[
  {
    "version": "1.0.1",
    "environment": "dev",
    "commitHash": "abc123",
    "commitMessage": "feat: new feature",
    "author": "user@example.com",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

MongoDB uses the same structure.

## Troubleshooting

**Alias not working?**

- Check if the alias exists: `git config --local --get alias.ppush`
- Verify the script exists: `ls -la .env-version-tracker/git-push-wrapper.sh`
- Check debug logs: `cat /tmp/evt-debug.log`

**Want to remove the alias?**

```bash
evt remove-hook
# Or manually:
git config --local --unset alias.ppush
git config --local --unset alias.push
```

## TODO

- [x] On config, ask for env file instead of asking directly the remote storage path
- [ ] Use husky or another git hook instead of ppush alias
- [ ] Add another storage provider

## Requirements

- Node.js >= 14.0.0
- Git repo (for commit info)

## License

ISC
