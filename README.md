# env-version-tracker

CLI tool to track which version is deployed in each environment. Works with local JSON files or MongoDB.

## Install

```bash
npm install --save-dev env-version-tracker
```

## Setup

### 1. Configure where to store versions

**Using a JSON file:**

```bash
env-version-tracker config local --storage-path ./versions.json
```

**Using MongoDB:**

```bash
env-version-tracker config remote \
  --storage-url "mongodb://localhost:27017" \
  --storage-database "version-tracker" \
  --storage-collection "versions"
```

### 2. Optional: Auto-track after git push

If you want the tool to ask for version info automatically after each `git push`:

```bash
env-version-tracker setup-hook
```

### 3. Track a deployment

**Manual:**

```bash
env-version-tracker push patch dev
env-version-tracker push minor staging
env-version-tracker push major production
```

**With alias installed:**
Just do `git push` normally. After a successful push, you'll be prompted for version tag and environment.

## Commands

**`config <storage> [options]`** - Set up where to store versions

- `storage`: `local` or `remote`
- Options depend on storage type (see examples above)

**`push <version-tag> <environment> [options]`** - Record a deployment

- `version-tag`: `major`, `minor`, `patch`, or exact version like `1.2.3`
- `environment`: `dev`, `staging`, `preprod`, `production`
- `--track-author`: Include git author email

**`setup-hook`** - Enable auto-tracking after git push

**`remove-hook`** - Disable auto-tracking

## How it works

- Calculates the next version based on the last version for that environment
- Gets commit info from git (hash, message, author if enabled)
- Handles merge commits by extracting the original commit
- Saves everything to your configured storage

## What gets created

After running `setup-hook`, a git alias 'push' is configured in your local git config.

Your project will have:

```
your-project/
├── .env-version-tracker/
│   └── config.json          # Your config
└── versions.json            # Version history (if local storage)
```

Config is stored in `.env-version-tracker/config.json` per project.

## Examples

**Basic usage:**

```bash
env-version-tracker push patch dev
# Version 1.0.1 pushed to dev
```

**With author tracking:**

```bash
env-version-tracker push minor staging --track-author true
```

**With alias (automatic):**

```bash
git push
# After successful push, prompts appear automatically:
# ? What version tag? (Use arrow keys)
# ? Which environment?
# ? Track the author? (y/N)
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

## TODO

- [ ] On config, ask for env file instead of asking directly the remote storage path
- [ ] Use husky or another git hook instead of gpush alias
- [ ] Add another storage provider

## Requirements

- Node.js >= 14.0.0
- Git repo (for commit info)

## License

ISC
