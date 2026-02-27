# Security

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/93/security
```

## Omarchy security posture

- Full-disk encryption (LUKS) is mandatory.
- Firewall enabled by default (allows SSH and LocalSend ports).
- Omarchy uses Arch rolling updates plus its own package repo and mirror.
- Distribution infra is behind Cloudflare.

## Signing key

```
40DFB630FF42BCFFB047046CF0134EE680CAC571
```

ISO signature example:

```
https://iso.omarchy.org/omarchy-x.x.x.iso.sig
```
