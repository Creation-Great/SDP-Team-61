# Documentation Index

Documentation for the **SDP Peer Review System v3.0.0**. Start with the [project README](../README.md) if you have not seen it.

## Map

| Document | Audience | What's inside |
|----------|----------|---------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Developers, reviewers | Three-service architecture, request lifecycle, authentication flow, Redis/PostgreSQL roles, startup sequence, module maturity matrix. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Developers | Coding conventions per layer, directory map, how to add an API / page / migration, commit and PR workflow, command cheatsheet. |
| [API.md](API.md) | Developers, integrators | Human-readable reference for every backend route prefix and AI service endpoint. Cross-links to source. |
| [openapi.yaml](openapi.yaml) | Integrators, tooling | Machine-readable OpenAPI 3.0 specification. Open with [Swagger Editor](https://editor.swagger.io/) or the dev server's `/api-docs` UI. |
| [DATABASE.md](DATABASE.md) | Developers, DBAs | Schema overview (41 tables), 37 sequential migrations, RLS policies, ERD, common query patterns. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Operators | Production deployment, environment variables, JWT rotation, database backup and recovery, monitoring, troubleshooting. |
| [USER_GUIDE.md](USER_GUIDE.md) | End users | Walkthroughs for students, instructors, teaching assistants, and admins. Login, submission, peer review, AI features, accessibility. |
| [ROADMAP.md](ROADMAP.md) | Devs, stakeholders | Forward-looking work: AI-service migration to FastAPI, scalability targets, deferred features. |

## Conventions

- All documentation is in **English**, regardless of the working language used in chat.
- Numbers in this documentation set are produced by reading current source — not by referencing prior documentation. If you spot a number that disagrees with the code, file an issue or update the document with a code reference.
- Source citations use the form `path/to/file.ext:LINE` so you can jump straight to the evidence.
- The root [`README.md`](../README.md) is the front door. It deliberately stays under 200 lines so it remains scannable.

## Out of scope for this directory

- `CHANGELOG.md` — not maintained; consult `git log --oneline` for history.
- `LICENSE` — not yet declared.
- `CONTRIBUTING.md` — see the *Git workflow* section in [DEVELOPMENT.md](DEVELOPMENT.md).

---

*Last full rewrite: see top-level commit history on `main`.*
