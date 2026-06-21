# Security Policy

## Supported Versions
Only the latest version on the master branch is supported.

## Reporting a Vulnerability
As this is a fully client-side application using localStorage, there is no backend server or database to exploit. All calculations and data storage happen locally on the user's device. 
If you find a security issue (e.g., Cross-Site Scripting (XSS) vulnerability), please open an issue in the GitHub repository.

## Safe and Responsible Implementation
- **Data Sovereignty**: 100% of user data remains on the local device.
- **No Trackers**: Zero third-party tracking scripts.
- **Sanitisation**: All inputs are strictly validated and clamped in src/scripts/validation.js to prevent malicious injection or mathematical overflow attacks.
