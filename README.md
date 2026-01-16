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

```bash
evt config remote \
  --storage-url "mongodb://localhost:27017" \
  --storage-database "version-tracker" \
  --storage-collection "versions"
```

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
- Options depend on storage type (see examples above)

**`push <version-tag> <environment> [options]`** - Record a deployment

- `version-tag`: `major`, `minor`, `patch`, or exact version like `1.2.3`
- `environment`: `dev`, `staging`, `preprod`, `production`
- `--track-author`: Include git author email

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
│   ├── config.json              # Your config
│   └── git-push-wrapper.sh     # Git push wrapper script
└── versions.json                # Version history (if local storage)
```

Config is stored in `.env-version-tracker/config.json` per project.

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

- [ ] On config, ask for env file instead of asking directly the remote storage path
- [ ] Use husky or another git hook instead of ppush alias
- [ ] Add another storage provider

## Requirements

- Node.js >= 14.0.0
- Git repo (for commit info)

## License

ISC
