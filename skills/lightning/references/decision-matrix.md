# LND vs CLN Decision Matrix (Reliability-First)

| Dimension          | LND                                                 | CLN                              |
| ------------------ | --------------------------------------------------- | -------------------------------- |
| Recovery guidance  | Strongest official docs for SCB + disaster recovery | Fewer prescriptive recovery docs |
| LNbits integration | Native (gRPC/REST)                                  | Native (RPC socket)              |
| Extensibility      | Strong API ecosystem                                | Plugin-first architecture        |
| Operations         | Mature tooling and docs                             | Clean, minimal core with plugins |

Primary sources:

- LND security + recovery: https://docs.lightning.engineering/lightning-network-tools/lnd/secure-your-lightning-network-node
- LND recovery planning: https://docs.lightning.engineering/lightning-network-tools/lnd/recovery-planning-for-failure
- CLN REST: https://docs.corelightning.org/docs/rest
- LNbits wallets: https://docs.lnbits.org/guide/wallets.html
