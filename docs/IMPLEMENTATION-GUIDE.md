# Integration and hardware guide

This guide describes a practical path from the Radian prototype to a deployable wall workspace. Product availability and pricing change, so confirm both before purchasing.

## Permission model

Keep three permission levels separate:

1. **Read tools** may execute immediately within the connected user's existing access.
2. **Draft tools** may create a local preview but cannot publish or send it.
3. **Write tools** require explicit approval from the paired phone controller.

Record the initiating user, tool name, validated arguments, approval decision, result, and timestamp for every operation. An approval must cover an immutable hash of the exact proposed action; changing its destination, content, or parameters invalidates the approval.

## Google Drive read-only search

1. Create a Google Cloud project and enable the Drive API.
2. Configure the OAuth consent screen and create a Web Application OAuth client.
3. Register Radian's exact HTTPS callback URL.
4. Request the narrowest usable scope:
   - `drive.metadata.readonly` for names, types, dates, and metadata only.
   - `drive.readonly` only when Radian must read or summarize file contents.
5. Encrypt refresh tokens at rest and never return them to the browser.
6. Implement `drive_search` with `files.list`, the `q` expression, an explicit `fields` mask, pagination, and Shared Drive support.
7. Return the file name, web link, modified date, and matched context with every result.

`drive.metadata.readonly` cannot download file contents. Google recommends choosing the narrowest scope possible. See the [Drive authorization guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [file search guide](https://developers.google.com/workspace/drive/api/guides/search-files).

## Analytics and advertising reports

Use separate, read-only connectors for each source:

- Google Analytics 4 through the Google Analytics Data API and `analytics.readonly`.
- Google Ads through the Google Ads API, a developer token, and OAuth.
- Add Meta Ads, LinkedIn Ads, and other networks later as distinct adapters.

Implementation sequence:

1. Let an administrator choose the permitted GA4 properties and advertising accounts.
2. Define an allowlist of supported dimensions, metrics, and date ranges.
3. Add `analytics_run_report`, `ads_campaign_report`, and `compare_periods` tools.
4. Validate dimension/metric compatibility before sending requests.
5. Normalize responses into `source`, `account`, `period`, `timeZone`, `currency`, `dimensions`, `metrics`, and `totals`.
6. Cache report results and expose source metadata on every result card.
7. Do not grant campaign-management permissions to reporting credentials.

GA4's `runReport` supports dimensions, metrics, date ranges, and filters. See the [GA4 Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart). Google Ads reporting is available through `Search` and `SearchStream`; see the [Google Ads reporting fields](https://developers.google.com/google-ads/api/fields/v22/overview).

## Slack search and drafting

1. Create and install a Slack app.
2. Use user OAuth with `search:read` so results follow the user's existing access.
3. Implement `slack_search`, `slack_open_context`, and `slack_draft_message`.
4. Keep drafts inside Radian until a user approves them.
5. On the approval controller, show the exact workspace, channel or recipient, and message.
6. Add `chat:write` only when sending is ready for production.
7. Put sending in a separate `slack_send_message` tool that accepts an approved action ID.
8. Reject the send if the message or destination differs from the approved payload.

Slack's message search requires a user token with `search:read`. See [`search.messages`](https://api.slack.com/methods/search.messages).

## Presentation and document creation

Google Slides and Docs are the recommended first targets because they integrate naturally with Drive.

1. Request `drive.file`, limiting the app to files it created or the user explicitly shared with it.
2. Create documents with `documents.create` and populate them with `documents.batchUpdate`.
3. Create presentations with `presentations.create` and build slides with `presentations.batchUpdate`.
4. Prefer copying an approved organizational template over generating layouts from scratch.
5. Render and validate a preview before asking for approval.
6. Require separate approval before changing sharing permissions, emailing, or publishing.

See the [Docs API document model](https://developers.google.com/workspace/docs/api/concepts/document), [Slides creation method](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/create), and [presentation operations](https://developers.google.com/workspace/slides/api/samples/presentation).

## Phone approval controller

Start with an installable Progressive Web App instead of separate native iOS and Android applications.

1. Add a mobile-first `/controller` route.
2. Pair a phone by scanning a one-use QR code displayed on the wall.
3. Create a short-lived, device-bound session after pairing.
4. Deliver requests through WebSocket or server-sent events.
5. Display the proposed action, account and destination, exact payload, risk class, and expiration.
6. Require a passkey/WebAuthn check for high-risk approvals.
7. Sign approval against a hash of the complete proposed action.
8. Expire unattended approvals after 60–120 seconds.
9. Provide an immediate **Stop all tasks** control.
10. Keep the controller behind a private VPN or authenticated access gateway; do not expose Radian directly to the public internet.

An existing iPhone or Android phone is sufficient; a dedicated phone is optional.

## Hardware bill of materials

### Recommended balanced installation

- Apple Mac mini M4, 16 GB unified memory, preferably 512 GB storage.
- Samsung 85-inch QMC commercial 4K display.
- Logitech Rally Bar Mini for its camera, beamforming microphone array, speakers, echo cancellation, and noise suppression.
- Existing iPhone or Android phone as the approval controller.
- 1000–1500 VA pure-sine UPS.
- Wired Gigabit Ethernet.
- Commercial VESA wall mount, certified HDMI cable, and concealed power/network cabling installed to local code.

The M4 Mac mini supports HDMI, Gigabit Ethernet, Wi-Fi 6E, and multiple high-resolution displays; see [Apple's specifications](https://support.apple.com/en-ie/121555). The Samsung QMC family includes an 85-inch 4K model rated for 24/7 operation; see the [QMC specification sheet](https://image-us.samsung.com/SamsungUS/samsungbusiness/pdf/spec-sheets/QMC_Crystal_UHD_Series_Leaflet.pdf). The Rally Bar Mini includes a 4K camera, six beamforming microphones, speakers, and up to 23-foot microphone pickup; see [Logitech's specifications](https://hub.sync.logitech.com/rallybarmini/post/specifications---rally-bar-mini-K3ptSACa3kgpz8h).

### Screen options

| Use case | Product | Key reason |
| --- | --- | --- |
| Recommended | Samsung 85-inch QMC commercial 4K | Sharp text, 24/7 rating, and straightforward HDMI deployment |
| Touch interaction | LG 86-inch CreateBoard | 4K, up to 40-point touch, USB-C, HDMI, Wi-Fi 6, and integrated speakers |
| Premium large wall | Samsung The Wall All-in-One 110-inch | Large direct-view LED installation without projector shadows |

See the [LG CreateBoard specifications](https://www.lg.com/us/business/collaboration-displays/lg-86tr3dk-b-createboard) and [Samsung The Wall](https://www.samsung.com/us/led-signage/the-wall/the-wall-all-in-one-110-p1-2-sku-lh012iabmhs-go/). The Wall requires professional quoting, mounting, and commissioning.

### Projector options

| Use case | Product | Key specifications |
| --- | --- | --- |
| Bright room | Epson Pro EX11000 | 4,600 lumens, laser source, 1080p, up to 300-inch image, 1.6x optical zoom |
| Long-life conference room | BenQ LH730 | 4,000 ANSI lumens, 1080p, 4LED source, up to 30,000-hour Eco life |

See the [Epson Pro EX11000](https://epson.com/projectors-for-small-and-medium-business) and [BenQ LH730 specifications](https://www.benq.com/en-us/business/projector/lh730/specifications.html). Add a 100–120-inch fixed-frame ambient-light-rejecting screen only after measuring the room and calculating throw distance.

For an always-on wall workspace, prefer the commercial display: it provides sharper text, better daylight performance, quieter operation, and simpler alignment. Use a projector when an image larger than roughly 100 inches matters more than those advantages.

## OpenAI models and rollout

The configured `gpt-6-astra` and `gpt-realtime-2.1` model IDs are documented OpenAI API models. GPT-6 Astra supports Responses API function calling, and GPT-Realtime-2.1 supports audio and tool use. Astra access is rolling out, so confirm that the target API project has model access before live testing.

See the official [GPT-6 Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra) and [GPT-Realtime-2.1 documentation](https://developers.openai.com/api/docs/models/gpt-realtime-2.1).

## Recommended delivery order

1. Fix production packaging and add persistent encrypted credential storage.
2. Build the phone approval controller and audit log.
3. Add Google Drive metadata search.
4. Add GA4 and advertising read-only reporting.
5. Add Slack search and local drafting.
6. Add document and presentation creation.
7. Enable Slack sending and sharing changes only after approval integrity tests pass.
8. Run the browser worker in a hardened VM or container before connecting production accounts.
