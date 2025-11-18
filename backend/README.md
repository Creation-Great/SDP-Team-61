````markdown
# Peer Review Backend (v1.4)

- Postgres schema + RLS + views/MV + AI Integration
- REST: submissions / assign / reviews / me/* / instructor/overview / ai/*
- /assign supports revive (canceled -> pending)
- MV concurrent refresh (unique index + SECURITY DEFINER)
- RLS write policies integrated
- **NEW in v1.4**: AI-powered bias detection, comprehensive audit logging, enhanced RBAC

## Quickstart
```bash
docker compose up -d
npm i && cp .env.sample .env

# Configure environment (edit .env with your settings)
# At minimum, set strong random values for AUDIT_SALT and PRIVACY_SALT

export DATABASE_URL=postgres://postgres:postgres@localhost:5432/peerreview

# Run base migration + v1.4 upgrade
npm run migrate
psql $DATABASE_URL -f sql/upgrade-v1.4-yanxiao-db-security.sql

# Seed test data
npm run seed

# Start development server
npm run dev
```

## Database & Security Module (v1.4 - Yanxiao Zheng)

### New Features
- **risk_flags** table for AI-detected bias/toxicity
- Enhanced **audit** logging with correlation IDs, IP/UA hashing, tamper detection
- Comprehensive **RLS policies** for all sensitive tables
- Fine-grained **RBAC** middleware (course-level, resource ownership)
- Multi-strategy **authentication** (dev/SSO/CAS)
- Course-level **AI metrics** and analytics APIs

### Migration to v1.4
```bash
# Backup existing data (recommended)
pg_dump $DATABASE_URL > backup-before-v1.4.sql

# Run upgrade script
psql $DATABASE_URL -f sql/upgrade-v1.4-yanxiao-db-security.sql

# Refresh materialized views
psql $DATABASE_URL -c "SELECT refresh_mv_course_ai_metrics();"

# Verify migration
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE tablename = 'risk_flags';"
```

See **[YANXIAO-MODULE-DOCS.md](./YANXIAO-MODULE-DOCS.md)** for complete documentation.

## AI Integration Module (v1.4 - Yanxiao Zheng)

### Features
- Automatic **bias detection** on review submission
- **Toxicity, politeness, sentiment** analysis
- **Identity mention** detection (gender, race, religion, etc.)
- AI-generated **rewrite suggestions** for problematic comments
- Instructor **risk flag review** workflow
- Course-level **metrics and trends** dashboards

### Configuration
```bash
# In .env file:
AI_PROVIDER=mock  # or openai, anthropic, azure, perspective
AI_BIAS_DETECTION_ENABLED=true
AI_TOXICITY_THRESHOLD=0.7
AI_POLITENESS_THRESHOLD=0.3
AI_REWRITE_SUGGESTIONS_ENABLED=true

# For production AI (example with OpenAI):
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4
```

### API Endpoints

#### Review with AI Analysis
```bash
POST /reviews
{
  "submission_id": "uuid",
  "score": 85,
  "comment_text": "Your argument needs improvement..."
}

# Response includes:
{
  "review_id": "uuid",
  "ai_analysis": {
    "toxicity_score": 0.3,
    "politeness_score": 0.8,
    "overall_severity": "low",
    "improvement_tips": [...]
  },
  "rewrite_suggestion": {
    "rewritten_text": "...",
    "explanation": "..."
  }
}
```

#### AI Metrics (Instructor/Admin)
```bash
GET /ai/metrics/course/:courseId
GET /ai/metrics/reviewer/:reviewerId
GET /ai/metrics/trends/:courseId?weeks=12
GET /ai/risk-flags/unresolved/:courseId
```

#### Risk Flag Management
```bash
GET /reviews/:id/risk-flags
PATCH /reviews/:id/risk-flags/:flagId
{
  "resolution": "acknowledged"  # or dismissed, rewritten, escalated
}
```

## API endpoints (RBAC + RLS aligned)

### Public
- GET /healthz

### Submissions
- POST /submissions
	- body: { title?, raw_uri?, masked_uri?, hash_raw?, hash_masked? }
	- writes audit: CREATE/submission
- GET /submissions/:id/assignments
	- student/admin: returns aggregate counts { assigned_count, completed_count }
	- instructor/admin: returns list of assignments

### Assignments
- POST /assign (instructor only)
	- body: { submission_id, reviewer_id }
	- unique on (submission_id, reviewer_id); revive if canceled
	- writes audit: ASSIGN/assignment

### Reviews (Enhanced in v1.4)
- POST /reviews
	- body: { submission_id, score?, raw_uri?, masked_uri?, comment_text? }
	- **NEW**: Runs AI bias detection if comment_text provided
	- **NEW**: Returns AI analysis and rewrite suggestions
	- sets assignment.status = completed
	- writes audit: REVIEW/review
- GET /reviews/:id/risk-flags (v1.4)
	- Returns AI-detected bias/toxicity flags
- PATCH /reviews/:id/risk-flags/:flagId (instructor only, v1.4)
	- Mark flag as reviewed/resolved

### Student Endpoints
- GET /me/submissions
	- returns my submissions with { submission_id, assigned_count, completed_count }
- GET /me/assignments
	- returns my pending review todo list

### Instructor Endpoints
- GET /instructor/overview?course=...&group=...
	- cohort-level aggregates from mv_instructor_cohort

### AI Analytics (v1.4 - Instructor/Admin only)
- GET /ai/metrics/course/:courseId
	- Overview, toxicity/politeness stats, risk flags, rewrite adoption
- GET /ai/metrics/reviewer/:reviewerId
	- Individual reviewer bias metrics
- GET /ai/metrics/trends/:courseId
	- Weekly time series data
- GET /ai/risk-flags/unresolved/:courseId
	- All pending risk flags requiring review

### Assignment Visibility (v1.3+)
- GET /assign/v1/by-submission/:id
	- List all reviewers assigned to a submission
- GET /assign/v1/by-reviewer/:id
	- List all assignments for a reviewer
- GET /assign/v1/explain/:assignment_id
	- Explain why this assignment was made (algorithm transparency)

## Materialized view maintenance

Refresh on demand:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/peerreview
npm run refresh:mv

# Refresh AI metrics MV (v1.4)
psql $DATABASE_URL -c "SELECT refresh_mv_course_ai_metrics();"
```

## Tests

```bash
npm test
```

The test suite migrates and seeds the DB and verifies:

- /me/submissions aggregates
- /me/assignments todo list
- /instructor/overview cohort aggregates (with MV refresh)
- **v1.4 tests pending**: AI analysis integration, RLS policies, audit logging

## Security & Privacy (v1.4)

### Authentication Modes
```bash
# Development (default)
AUTH_MODE=dev
# Use headers: x-user-id, x-user-role, x-user-course, x-user-group

# Production SSO
AUTH_MODE=sso  # or cas
# Requires CAS/SAML configuration (see .env.sample)
```

### Audit Logging
All sensitive operations are logged with:
- Actor, action, entity, timestamp
- SHA256 payload hash for tamper detection
- Correlation IDs for request tracing
- Privacy-safe IP/User-Agent hashing

Query audit logs:
```typescript
import { queryAuditByActor, queryAuditByEntity } from './utils/audit';

// User activity
const logs = await queryAuditByActor(userId, { limit: 100 });

// Resource history
const history = await queryAuditByEntity('submission', submissionId);
```

### Row-Level Security
All database queries automatically filtered by:
- User role (student/instructor/admin)
- Course membership
- Resource ownership

Cannot be bypassed even if application code has bugs.

## Environment Variables

See `.env.sample` for all available configuration options.

**Critical for production:**
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_MODE` - Must be 'sso' or 'cas' in production!
- `AUDIT_SALT` - 32+ char random string for audit integrity
- `PRIVACY_SALT` - 32+ char random string for IP/UA hashing
- `SESSION_SECRET` - 64+ char random string for sessions
- `AI_PROVIDER` - AI service (openai/anthropic/azure/perspective)
- Provider-specific API keys (OPENAI_API_KEY, etc.)

**Generate secure salts:**
```bash
openssl rand -hex 32  # For AUDIT_SALT
openssl rand -hex 32  # For PRIVACY_SALT
openssl rand -hex 64  # For SESSION_SECRET
```

## Module Ownership

**Yanxiao Zheng** - Database & Security, AI Integration
- PostgreSQL schema, migrations, RLS, RBAC
- Audit logging, authentication framework
- Bias detection, NLP pipeline, risk flags
- AI metrics and analytics APIs

See [YANXIAO-MODULE-DOCS.md](./YANXIAO-MODULE-DOCS.md) for detailed documentation.

## Production Deployment Checklist

- [ ] Run database migration: `sql/upgrade-v1.4-yanxiao-db-security.sql`
- [ ] Set `AUTH_MODE=sso` or `cas`
- [ ] Configure CAS/SAML integration
- [ ] Generate and set secure salts (AUDIT_SALT, PRIVACY_SALT, SESSION_SECRET)
- [ ] Set up AI provider (OpenAI/Anthropic/Azure) with API keys
- [ ] Enable HTTPS/TLS
- [ ] Configure database connection pooling
- [ ] Set up monitoring and alerting
- [ ] Test RLS policies with real user scenarios
- [ ] Train instructors on risk flag review workflow
- [ ] Schedule materialized view refresh (cron job)

## License

ISC
````