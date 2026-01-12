# Data Directory - Frozen Database Setup

This directory contains the application's database and search indices that are "frozen" in git as a baseline.

## What's Here

- `blueprint.db` - SQLite database with MeetingBank evaluation data
- `faiss/` - FAISS vector search indices for semantic search

## Frozen Database System

These files are committed to git once as a baseline, but are protected from accidental commits during development.

### How It Works

- Files are tracked in git and downloaded when cloning
- `--skip-worktree` flag prevents `git add .` from including them
- Local changes during development don't get committed automatically
- You can always reset to the frozen baseline

### Normal Development Workflow

Your standard `git add . && git commit && git push` will **NOT** include these files.

### To Reset to Frozen Baseline

```bash
git checkout HEAD -- backend/data/blueprint.db backend/data/faiss/*.index backend/data/faiss/*.db
```

### To Temporarily Commit Database Updates (Rare)

```bash
# Remove protection
git update-index --no-skip-worktree backend/data/blueprint.db backend/data/faiss/*.index backend/data/faiss/*.db

# Add and commit
git add backend/data/blueprint.db backend/data/faiss/*.index backend/data/faiss/*.db
git commit -m "Updated frozen database"

# Restore protection
git update-index --skip-worktree backend/data/blueprint.db backend/data/faiss/*.index backend/data/faiss/*.db
```

### Cloning the Repository

When someone clones this repo, they **will** get these database files automatically. The files are part of the repository and will be downloaded with `git clone`.

**⚠️ Important: New clones must set up protection**

After cloning, run this command to protect the database files from accidental commits:

```bash
git update-index --skip-worktree backend/data/blueprint.db backend/data/faiss/*.index backend/data/faiss/*.db
```

Without this, `git add .` will include database changes in commits. The `--skip-worktree` flag is only set locally and not stored in the repository.