# Updates and recovery

Sources:

```
https://learn.omacom.io/2/the-omarchy-manual/68/updates
```

```
https://learn.omacom.io/2/the-omarchy-manual/101/system-snapshots
```

## Update flow

- Use Omarchy menu: Update > Omarchy (runs migrations + package updates).
- Channels: stable, edge, dev (switch via Update > Channel).
- Avoid direct `pacman -Syu`/`yay -Syu` if you want migrations in sync.

## Snapshots

- Automatic snapshots on every Omarchy update.
- Manual snapshot:

```
omarchy-snapshot create
```

- Restore snapshot:

```
omarchy-snapshot restore
```

- Snapshot boot and restore via Limine boot menu (default since Omarchy 2.0).
- Snapshots restore `/root`, not `/home`.

## Recovery

- Roll back to a snapshot from before an update if something breaks.
- Full reinstall (resets configs, downgrades to stable):

```
omarchy-reinstall
```
