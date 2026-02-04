# Disk Space Management

The OpenClaw gateway automatically monitors disk space and cleans up caches when disk usage exceeds 85%.

## Automatic Cleanup

When the gateway starts, it checks disk space usage. If usage is above 85%, it automatically:

- Cleans npm cache (~10-15GB)
- Cleans Yarn cache (~15-20GB)
- Cleans pnpm store (~5GB)
- Cleans Homebrew cache (macOS, ~1-2GB)
- Cleans OpenClaw browser cache (~50-100MB)
- Removes old session logs (>7 days)
- Removes old memory snapshots (keeps last 10)

This cleanup runs silently in the background and typically frees **20-35GB** of disk space.

## Configuration

### Disable Automatic Cleanup

To disable automatic disk cleanup, set an environment variable:

```bash
export OPENCLAW_SKIP_DISK_CLEANUP=1
```

Or in your `.profile` / `.bashrc`:

```bash
echo 'export OPENCLAW_SKIP_DISK_CLEANUP=1' >> ~/.profile
```

### Manual Cleanup

To manually clean disk space at any time, use the cleanup script:

```bash
# Run cleanup script (from repo directory)
bash scripts/cleanup-disk-space.sh

# Quick cleanup without browser caches
echo "n" | bash scripts/cleanup-disk-space.sh
```

## How It Works

The gateway uses the `autoCleanDiskSpace()` function from `src/infra/disk-space.ts`:

1. **Check disk space** - Reads current disk usage via `df` (Unix) or `wmic` (Windows)
2. **Compare threshold** - If usage > 85%, trigger cleanup
3. **Run cleanup commands** - Execute safe cache cleanup commands
4. **Verify results** - Check disk space again and log results

## Threshold

The default threshold is **85%** disk usage. This threshold is hardcoded in `src/gateway/server-startup.ts` and can be adjusted if needed.

## Logs

Disk space check logs appear in the gateway logs:

```
[gateway] disk space: 95% used (25GB available)
[gateway] disk usage above 85% (95%), running cleanup...
[gateway] cleanup complete: 17% used (freed 31GB)
```

## Cross-Platform Support

The disk space utility works on:

- **macOS** - Uses `df -k` for space check, cleans Homebrew + npm/yarn/pnpm caches
- **Linux** - Uses `df -k` for space check, cleans npm/yarn/pnpm caches
- **Windows** - Uses `wmic logicaldisk` for space check, cleans npm/yarn/pnpm caches

## Safety

All cleanup operations are **safe**:

- Only removes **cache files** that can be re-downloaded
- Never touches user data, configuration, or session state
- Commands run with error suppression (failures are logged but don't crash the gateway)
- No destructive operations (no `rm -rf /` risks)

## When Cleanup Fails

If cleanup fails or disk space is still critically low:

1. Check logs: `openclaw logs gateway --tail 100`
2. Manually check disk usage: `df -h`
3. Identify large files: `du -sh ~/.openclaw/*`
4. Consider Docker cleanup: `docker system prune -af --volumes`
5. Review system temp files: `~/Library/Caches` (macOS) or `/tmp` (Linux)

## Troubleshooting

### Cleanup doesn't trigger

- Verify disk usage: `df -h`
- Check if disabled: `echo $OPENCLAW_SKIP_DISK_CLEANUP`
- Check gateway logs for errors

### Disk still full after cleanup

- Run manual cleanup script with browser caches: `bash scripts/cleanup-disk-space.sh`
- Check Docker disk usage: `docker system df`
- Look for large files outside OpenClaw: `du -sh ~/* | sort -hr | head -20`

### Permission errors during cleanup

- npm/yarn/pnpm caches are user-owned and don't require sudo
- Homebrew cleanup might fail if packages are locked (safe to ignore)
- OpenClaw directories are user-owned and should be writable

## Related Commands

- `openclaw logs gateway` - View gateway logs including disk space check
- `openclaw status` - View gateway status
- `df -h` - Check disk space manually (Unix)
- `du -sh ~/.openclaw/*` - Check OpenClaw directory sizes
