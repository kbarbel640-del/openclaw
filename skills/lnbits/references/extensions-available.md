# LNbits Available Extensions

49 extensions available in the LNbits extension registry. **Currently enabled: lnurlp, nwcprovider.**

## Currently Enabled

| Extension            | Code          | Description                                                    |
| -------------------- | ------------- | -------------------------------------------------------------- |
| Pay Links            | `lnurlp`      | Make reusable LNURL pay links, Lightning Addresses, Nostr zaps |
| NWC Service Provider | `nwcprovider` | Nostr Wallet Connect service provider for LNbits               |

## Available (Not Installed)

| Extension        | Code            | Category                                |
| ---------------- | --------------- | --------------------------------------- |
| Boltcards        | `boltcards`     | NFC payment cards                       |
| Boltz            | `boltz`         | Submarine swaps (LN↔onchain)            |
| Bitcoin Switch   | `bitcoinswitch` | IoT relay control via Lightning         |
| Bleskomat        | `bleskomat`     | ATM integration                         |
| Coinflip         | `coinflip`      | Lightning-powered coin flip game        |
| Discordbot       | `discordbot`    | Discord bot with Lightning payments     |
| Decoder          | `decoder`       | Decode Lightning invoices/LNURL         |
| Events           | `events`        | Ticket sales for events                 |
| Gerty            | `gerty`         | E-ink display dashboard                 |
| Invoices         | `invoices`      | Invoice management                      |
| Jukebox          | `jukebox`       | Spotify jukebox with Lightning          |
| LNCalendar       | `lncalendar`    | Calendar with Lightning bookings        |
| LNDHub           | `lndhub`        | BlueWallet/Zeus compatible interface    |
| LNPoS            | `lnpos`         | Point of Sale terminal                  |
| LNURLDevices     | `lnurldevice`   | LNURL device management                 |
| Livestream       | `livestream`    | Lightning-powered livestream tips       |
| Magic 8ball      | `eightball`     | Lightning-powered magic 8 ball          |
| Nostr Client     | `nostrclient`   | Nostr client integration                |
| Nostr Market     | `nostrmarket`   | Nostr-based marketplace                 |
| Nostr Relay      | `nostrrelay`    | Built-in Nostr relay                    |
| NostrNip5        | `nostrnip5`     | NIP-05 identity verification            |
| Numberlottery    | `numberlottery` | Number lottery game                     |
| Offlineshop      | `offlineshop`   | Offline merchant shop                   |
| Onchain Wallet   | `watchonly`     | Watch-only onchain wallet               |
| PaidReviews      | `paidreviews`   | Paid review system                      |
| Paywall          | `paywall`       | Content paywalls                        |
| FOSSA            | `fossa`         | Automated savings                       |
| SCRUB            | `scrub`         | Auto-forward payments to another wallet |
| SatsPay Server   | `satspay`       | Payment processing server               |
| Satsdice         | `satsdice`      | Provably fair dice game                 |
| Satspot          | `satspot`       | Location-based Lightning                |
| Scheduler        | `scheduler`     | Scheduled payment tasks                 |
| Scrum            | `scrum`         | Scrum poker with Lightning              |
| SellCoins        | `sellcoins`     | Sell coins for Lightning                |
| SMTP             | `smtp`          | SMTP email sending                      |
| Splitpayments    | `splitpayments` | Auto-split incoming payments            |
| Streamalerts     | `streamalerts`  | Streaming donation alerts               |
| Streamer Copilot | `copilot`       | Streaming assistant                     |
| Subdomains       | `subdomains`    | Sell subdomains for Lightning           |
| Support Tickets  | `lnticket`      | Lightning-powered support tickets       |
| Tip Jar          | `tipjar`        | Tip jar with donor messages             |
| TPoS             | `tpos`          | Touch Point of Sale                     |
| User Manager     | `usermanager`   | Multi-user management                   |
| Withdraw Links   | `withdraw`      | LNURL-withdraw links                    |
| Auction House    | `auction_house` | Lightning auctions                      |
| MyExtension      | `myextension`   | Template for custom extensions          |
| Build your own!  | `example`       | Example extension template              |

## Installing Extensions

```bash
# List all available
ssh klabo@honkbox "curl -s -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension/all"

# Install an extension
ssh klabo@honkbox "curl -s -X POST -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"ext_id\":\"withdraw\",\"source_repo\":\"https://github.com/lnbits/lnbits-extensions\"}' \
  http://127.0.0.1:5000/api/v1/extension"

# Enable after install
ssh klabo@honkbox "curl -s -X PUT -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension/withdraw/enable"

# Activate (make visible in UI)
ssh klabo@honkbox "curl -s -X PUT -H 'Authorization: Bearer $TOKEN' \
  http://127.0.0.1:5000/api/v1/extension/withdraw/activate"
```

## Extension Lifecycle

```
Available → Install → Enable → Activate → Running
                                           ↓
                              Deactivate → Disable → Uninstall
```

| Action     | Endpoint                               | Effect                   |
| ---------- | -------------------------------------- | ------------------------ |
| Install    | `POST /api/v1/extension`               | Downloads extension code |
| Enable     | `PUT /{ext_id}/enable`                 | Registers routes         |
| Activate   | `PUT /{ext_id}/activate`               | Shows in user sidebar    |
| Deactivate | `PUT /{ext_id}/deactivate`             | Hides from sidebar       |
| Disable    | `PUT /{ext_id}/disable`                | Unregisters routes       |
| Uninstall  | `DELETE /api/v1/extension/{ext_id}`    | Removes extension code   |
| Drop DB    | `DELETE /api/v1/extension/{ext_id}/db` | Deletes extension data   |

## Notable Extensions for klabo.world

| Extension       | Use Case                                  |
| --------------- | ----------------------------------------- |
| `withdraw`      | Create LNURL-withdraw links for giveaways |
| `lndhub`        | Connect BlueWallet/Zeus to LNbits         |
| `splitpayments` | Auto-split tips to multiple wallets       |
| `satspay`       | Payment processing for klabo.world        |
| `nostrnip5`     | NIP-05 verification (joel@klabo.world)    |
| `tpos`          | Mobile point of sale                      |
| `scrub`         | Auto-forward to cold storage              |
