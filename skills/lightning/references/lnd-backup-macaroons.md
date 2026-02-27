# LND Backups + Macaroons

## Static Channel Backups (SCB)

- LND exposes `export-all-channel-backups` / `restore-channel-backups` APIs for SCB.  
  References:
  - https://api.lightning.community/api/lnd/lightning/export-all-channel-backups/
  - https://api.lightning.community/api/lnd/lightning/restore-channel-backups/index.html

## Disaster Recovery

- Official recovery planning and disaster recovery guides:
  - https://docs.lightning.engineering/lightning-network-tools/lnd/recovery-planning-for-failure
  - https://docs.lightning.engineering/lightning-network-tools/lnd/disaster-recovery

## Macaroon Security

- Macaroon security guidance:
  - https://docs.lightning.engineering/lightning-network-tools/lnd/macaroons
  - Delete macaroons via API:
    - https://lightning.engineering/api-docs/api/lnd/lightning/delete-macaroon-i-d/index.html

## Operational Guidance

- Secure your node:
  - https://docs.lightning.engineering/lightning-network-tools/lnd/secure-your-lightning-network-node
