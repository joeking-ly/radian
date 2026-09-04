# Studio connectors

Radian includes server-side adapters for Google Drive, Docs, Slides, Slack, Blender, Bambu Studio, Bambu LAN-mode printers, and operator-owned HTTP services. A connector is disabled until its settings are present in `.env`.

Copy `.env.example` to `.env`, keep `.env` private, and restart Radian after changing connector settings. Use a dedicated least-privilege account for every external service.

## Google Workspace

Create a Google Cloud OAuth client, enable the Drive, Docs, and Slides APIs, and authorize these scopes:

- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/presentations`

Generate an offline refresh token for the operator and configure:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

The included tools search Drive, create a Doc, and create a Slides deck. File creation pauses for approval. For a multi-user deployment, replace the single refresh token with an encrypted per-user credential store and an OAuth callback flow.

## Slack

Create a Slack app and install it for the operator. Add `search:read` to the user token scopes. Add `chat:write` only if approved message sending is required.

```dotenv
SLACK_USER_TOKEN=xoxp-...
```

Search is read-only. Sending displays the exact destination and content and pauses until approved.

## Blender

Install Blender and point Radian at its executable. All input files, output paths, and reviewed Python scripts must be under `STUDIO_ROOT`; path traversal outside that directory is rejected.

```dotenv
STUDIO_ROOT=/Users/studio/Production
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender
```

`blender_render` uses Blender background mode to render a frame. `blender_export` runs an operator-reviewed Python file against a `.blend` file. Treat export scripts as trusted local code: Radian does not generate and execute arbitrary Python text.

## Bambu Studio slicing

Install Bambu Studio and configure its executable:

```dotenv
BAMBU_STUDIO_PATH=/Applications/BambuStudio.app/Contents/MacOS/BambuStudio
```

`bambu_slice` calls Bambu Studio's documented command-line mode and writes a sliced 3MF under `STUDIO_ROOT`. Bambu Studio CLI behavior varies by operating system and release, so validate the exact printer, filament, and process profile on every workstation before production use.

## Bambu printer upload and start

The Bambu LAN connector is experimental because Bambu Lab does not publish a stable public print-control API. It uses local FTPS for upload and MQTT over TLS for print start.

On the printer, enable LAN-only mode and obtain its IP address, serial number, and access code. Put the printer and Radian host on a trusted, isolated production network.

```dotenv
BAMBU_PRINTER_HOST=192.0.2.10
BAMBU_PRINTER_SERIAL=YOUR_PRINTER_SERIAL
BAMBU_ACCESS_CODE=YOUR_LAN_ACCESS_CODE
```

Before `bambu_print` uploads or starts anything, Radian pauses and asks the operator to confirm the exact file, plate G-code, printer, and that the build plate is clear. The approval is consumed once. Do not use this connector for unattended printing. Keep the printer in view, preserve its physical stop controls, and test with a harmless small model first.

Firmware changes may break this connector. Pin known-good Bambu Studio and printer firmware versions in a production deployment and retest after every update.

## Mobile approval controller

Generate a random token with at least 24 characters, store it in `.env`, and restart Radian:

```dotenv
CONTROLLER_TOKEN=replace-with-a-long-random-value
```

Open `https://YOUR-RADIAN-HOST/controller` on the phone and enter the token. Pending approvals are refreshed every two seconds. The token is stored only in that browser tab's session storage.

Production requirements:

- Serve Radian over HTTPS.
- Keep it behind a private VPN or authenticated gateway.
- Use a separate controller token per device.
- Replace the shared-token MVP with QR pairing and passkeys before exposing high-risk equipment.
- Never port-forward the controller or printer interfaces to the public internet.

## Operator-owned systems

`CUSTOM_CONNECTORS_JSON` registers HTTP bridges without giving the model control over their URLs or credentials:

```dotenv
CUSTOM_CONNECTORS_JSON=[{"name":"asset_manager","url":"https://studio.internal/api/radian","token":"replace-me","mutating":false},{"name":"render_farm","url":"https://farm.internal/jobs","token":"replace-me","mutating":true}]
```

Radian sends a JSON `POST` containing `action`, `input`, and `jobId`, with the configured token in the `Authorization: Bearer` header. A mutating connector always pauses for approval. The bridge should validate its own action allowlist and input schema, apply rate limits, return JSON or short text, and never accept arbitrary shell commands.

## Verification checklist

1. Run `npm run check`.
2. Start with `MOCK_MODE=true` and call `connector_status` from a test task.
3. Test each connector against a disposable account or sample file.
4. Confirm denied approvals perform no external action.
5. Confirm approved Slack messages reproduce the preview exactly.
6. Render and export a disposable Blender scene.
7. Slice a known 3MF and inspect it manually in Bambu Studio.
8. Test upload/start with a small safe model while attending the printer.
9. Rotate all test credentials before moving to production.

## Current boundaries

- Credentials are configured for one local operator through environment variables; interactive multi-user OAuth is not included yet.
- The mobile controller uses a shared bearer token rather than device-bound passkeys.
- Google and Slack calls require real accounts for integration testing.
- Blender and Bambu commands require their desktop applications on the Radian host.
- Bambu LAN upload/start is unofficial and requires validation against the installed firmware.
