---
name: integrations
description: Generate integration nodes for external APIs (Salesforce, HubSpot, etc.). Creates typed function nodes with authentication and error handling.
---

# Integrations

This skill generates function nodes for querying external APIs. It creates properly typed nodes with authentication, error handling, and schema validation.

---

## Supported Integrations

| Integration | Auth Method | File |
|-------------|-------------|------|
| PostgreSQL | Connection String | `postgres.md` |
| Salesforce | OAuth2 Client Credentials | `salesforce.md` |

**To use a listed integration:** Fetch the skill resource by name (e.g., `integrations/salesforce`).

**For unlisted systems:** Fetch the skill resource `integrations/unlisted` for instructions on researching and setting up custom integrations.

---
