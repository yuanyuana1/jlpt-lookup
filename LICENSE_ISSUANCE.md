# Offline License Issuance

## Initial setup

Run this command once on the publisher's private computer:

```bash
node scripts/generate-license-keypair.js
```

It creates:

- `keys/license-private.pem`: signing private key. Keep this offline and never commit, upload, or send it to a purchaser.
- `src/main/license-public.pem`: verification public key. This file is bundled with the application and must be committed before release.

Back up the private key in a secure location. If it is lost, new licenses cannot be issued for builds that use its public key.

## Issuing a purchaser license

```bash
node scripts/issue-license.js --customer "订单号或买家昵称" --id "JL-YYYYMMDD-001"
```

The signed file is written to `issued-licenses/`. Send only the generated `.jlptlicense` file to the purchaser. Do not send the private key or the whole `keys/` directory.

## Purchaser activation

The purchaser installs the normal application, opens it, selects the `.jlptlicense` file, and then can use the application on devices they own or control. The license file is stored in the application's user-data directory, so normal application updates preserve activation.