# Getting Your GitHub Personal Access Token

## Quick Steps (2 minutes)

### 1. Create a Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `openclaw-fork` (or any name you prefer)
4. Set expiration: 30 days (or your preference)
5. Select scopes:
   - ☑️ **repo** (full control of private repositories)
   - ☑️ **admin:repo_hook** (write access to hooks)
6. Click **"Generate token"**
7. **Copy the token** (you won't see it again!)

### 2. Run the Fork Script

```bash
# Set your token (replace with actual token)
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Run the fork creation script
./create-fork.sh
```

### 3. Verify

After the script completes, you should see:
- ✓ Fork created
- ✓ Branch pushed to your fork
- ✓ Links to your fork and PR creation page

### What the Script Does

1. ✅ Creates a fork of openclaw/openclaw on your trungutt account
2. ✅ Waits for fork to be ready (handles GitHub's async process)
3. ✅ Adds fork as git remote
4. ✅ Pushes optimize/docker-buildkit-cache branch
5. ✅ Shows you the PR creation link

## Security Notes

⚠️ **Keep your token secret!**

- Never commit it to version control
- Never share it publicly
- Delete it after you're done (good practice)

## Alternative: Manual Steps (if script fails)

If you prefer to do it manually:

```bash
# 1. Fork on GitHub web UI
# Go to: https://github.com/openclaw/openclaw/fork
# Click Fork, select trungutt account

# 2. Add remote
git remote add fork https://github.com/trungutt/openclaw.git

# 3. Push branch
git push -u fork optimize/docker-buildkit-cache

# 4. Create PR
# Go to: https://github.com/trungutt/openclaw
# Click "Compare & pull request"
```

## Troubleshooting

### "GITHUB_TOKEN not set"
```bash
export GITHUB_TOKEN="your-token-here"
./create-fork.sh
```

### "Fork creation failed"
- Make sure your token has the right scopes
- Check that you're not already creating a fork
- Try again in 30 seconds

### "Failed to push branch"
- Make sure fork was created successfully
- Check internet connection
- Verify git credentials: `git config user.name`

## After Fork Creation

Once the fork is created and branch is pushed:

1. ✅ Visit your fork: https://github.com/trungutt/openclaw
2. ✅ See your branch: https://github.com/trungutt/openclaw/tree/optimize/docker-buildkit-cache
3. ✅ Create PR: https://github.com/trungutt/openclaw/pull/new/optimize/docker-buildkit-cache
4. ✅ Use PR_SUMMARY.md as description

## Help

- GitHub Token Docs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Fork Help: https://docs.github.com/en/get-started/quickstart/fork-a-repo
- Push Help: https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository

---

**Ready?** Just get your token and run `./create-fork.sh`! 🚀
