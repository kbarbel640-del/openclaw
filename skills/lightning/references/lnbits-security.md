# LNbits Security Controls

## Admin UI + allowed users

- Admin UI is disabled by default; enabling it initializes settings in DB and can override .env on restart.
- Allowed users can lock down public access.
  Sources:
- https://github.com/lnbits/lnbits/wiki/LNbits-Documentation/39b05a433f0f8502c220a5e81956ba4a7d4c0124
- https://github.com/lnbits/lnbits/wiki/LNbits-Documentation

## Extensions security

- Only install extensions from trusted manifests; extensions can be malicious or buggy.
  Source:
- https://docs.lnbits.org/guide/extension-install.html

## Vulnerability note

- CVE-2025-32013: LNURL-auth SSRF risk; keep LNURL-auth disabled if not needed.
  Source:
- https://advisories.gitlab.com/pkg/pypi/lnbits/CVE-2025-32013/
