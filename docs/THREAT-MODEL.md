# Prototype threat model

## Assets

- OpenAI API key
- Connected business accounts
- Browser session data
- User speech and transcripts
- Generated files and screenshots

## Trust boundaries

1. The wall browser is untrusted and never receives the OpenAI API key.
2. The orchestration server is trusted and holds the API key.
3. Pages opened by Playwright are hostile input, including prompt-injection attempts.
4. Tool output is data, not authority to expand permissions.
5. The operator is the only entity allowed to approve external changes.

## Controls in v0

- Public HTTP(S)-only navigation
- Local and private IPv4 targets blocked
- No host-shell access
- No password or payment tools
- Explicit approval tool
- Fixed task-turn limit
- Bounded request body sizes
- API key remains server-side

## Required before production

- Container or VM isolation with outbound domain allowlisting
- DNS/IP validation after every redirect
- Authentication for the wall and controller
- Durable, append-only audit logging
- Encrypted credential vault
- Per-tool roles and account scopes
- Confirmation on a second trusted device
- Content and action policy evaluation
- Automated security tests and dependency scanning
