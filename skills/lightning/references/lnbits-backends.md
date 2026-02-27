# LNbits Backend Configuration

Source: https://docs.lnbits.org/guide/wallets.html

## LND (gRPC)

- `LNBITS_BACKEND_WALLET_CLASS=LndWallet`
- `LND_GRPC_ENDPOINT`
- `LND_GRPC_PORT`
- `LND_GRPC_CERT`
- `LND_GRPC_MACAROON`

## LND (REST)

- `LNBITS_BACKEND_WALLET_CLASS=LndRestWallet`
- `LND_REST_ENDPOINT`
- `LND_REST_CERT`
- `LND_REST_MACAROON`

## Core Lightning (CLN)

- `LNBITS_BACKEND_WALLET_CLASS=CoreLightningWallet`
- `CORELIGHTNING_RPC=/path/to/lightning-rpc`

## Notes

- LNbits supports multiple wallet backends; check the wallets guide for the current list.
