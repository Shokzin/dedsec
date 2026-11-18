# Security policy

## Reporting a vulnerability

If you find a security issue in DedSec — the web platform, the API, the VS Code extension or the scanner — please **do not open a public issue**.

Report it privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it and what an attacker could do with it.

You can expect an acknowledgement within a few days. Once the issue is fixed, you will be credited in the fix unless you prefer otherwise.

## Scope

In scope:

- the API and the background worker (`backend/`)
- the web interface (`frontend/`) and the live instance at https://dedsec-security.vercel.app
- the VS Code extension (`vscode-extension/`) and the pre-commit hook
- the database policies in `docs/`

Out of scope: findings that DedSec reports in *other* repositories (that is what the tool is for), denial of service by volume against the free hosting plan, and reports from automated scanners without a demonstrated impact.

## Supported versions

Only the latest version of the extension on the Visual Studio Marketplace and the current `main` branch receive fixes.
