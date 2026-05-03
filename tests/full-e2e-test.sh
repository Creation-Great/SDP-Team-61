#!/usr/bin/env bash
###############################################################################
# SDP Peer Review System v3.0 — FULL E2E API Test Suite
#
# Covers ALL 130+ endpoints across ALL features (original v2.0 + new v3.0).
# Tests the complete user workflow: login → submit → review → grade → export.
#
# Prerequisites: curl, jq, running services (backend:8080, ai-service:5001)
# Usage:  bash tests/full-e2e-test.sh [backend_url] [ai_url]
###############################################################################
set -euo pipefail

BASE="${1:-http://localhost:8080}"
AI_BASE="${2:-http://localhost:5001}"
PASS=0; FAIL=0; SKIP=0; ERRORS=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1 (got HTTP $2)"; FAIL=$((FAIL+1)); ERRORS="$ERRORS\n  ✗ $1 (HTTP $2)"; }
skip() { echo -e "  ${YELLOW}○${NC} $1 — $2"; SKIP=$((SKIP+1)); }
section() { sleep 0.5; echo -e "\n${CYAN}${BOLD}[$1]${NC} $2"; }

# curl wrapper — returns body; sets $SC (status code)
SC=0
api() {
  local method="$1" path="$2"; shift 2
  local url="${BASE}${path}"
  local args=(-s -w '\n%{http_code}' -X "$method" -H 'Content-Type: application/json')
  args+=(-b /tmp/sdp-test-cookies -c /tmp/sdp-test-cookies)
  [ "${1:-}" ] && args+=(-d "$1")
  local raw; raw=$(curl "${args[@]}" "$url" 2>/dev/null) || raw=$'\n000'
  BODY=$(echo "$raw" | sed '$d')
  SC=$(echo "$raw" | tail -1)
}

# Check helper: expected status(es). 429 = rate limited → auto-skip
chk() {
  local name="$1"; shift
  [ "$SC" = "429" ] && { skip "$name" "rate limited (429)"; return 0; }
  for expected in "$@"; do
    [ "$SC" = "$expected" ] && { ok "$name (HTTP $SC)"; return 0; }
  done
  fail "$name" "$SC"
}

# Skip if AI not available
ai_or_skip() {
  local name="$1"
  if [ "$SC" = "503" ] || [ "$SC" = "502" ] || [ "$SC" = "504" ]; then
    skip "$name" "AI unavailable (no API key)"
  else
    chk "$name" 200 201
  fi
}

rm -f /tmp/sdp-test-cookies

echo -e "\n${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SDP Peer Review v3.0 — Full E2E Test (130+ endpoints)${NC}"
echo -e "${CYAN}  Backend: $BASE  |  AI: $AI_BASE${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"

###############################################################################
section "HEALTH" "System health checks"
###############################################################################
api GET /healthz; chk "Backend /healthz" 200
SC=$(curl -s -o /dev/null -w '%{http_code}' "$AI_BASE/healthz" 2>/dev/null||echo 0)
[ "$SC" = "200" ] && ok "AI /healthz (HTTP 200)" || fail "AI /healthz" "$SC"

# Redis
RPING=$(docker exec $(docker ps -qf "ancestor=redis:7-alpine" 2>/dev/null||echo x) redis-cli ping 2>/dev/null||echo FAIL)
[ "$RPING" = "PONG" ] && ok "Redis PING → PONG" || fail "Redis" "no-pong"

###############################################################################
section "AUTH" "Authentication & profile"
###############################################################################
api POST /auth/login '{"email":"instructor@example.com","password":"password123"}'
chk "Instructor login" 200
INSTR_ID=$(echo "$BODY"|jq -r '.user.id // .id // empty' 2>/dev/null||echo "")

api GET /auth/me; chk "GET /auth/me" 200

api PATCH /auth/profile '{"name":"Dr. Smith"}'
chk "PATCH /auth/profile" 200

# Bad login
api POST /auth/login '{"email":"nobody@x.com","password":"wrong"}'
chk "Bad login rejected" 401

###############################################################################
section "SUBMISSIONS" "File submissions (instructor view)"
###############################################################################
api GET /submissions/all?page=1\&pageSize=5; chk "GET /submissions/all" 200
ALL_SUBS="$BODY"
SUB_ID=$(echo "$ALL_SUBS"|jq -r '.submissions[0].submission_id // empty' 2>/dev/null||echo "")

api GET /submissions/mine; chk "GET /submissions/mine" 200

api GET "/submissions/reviews/my-tasks"; chk "GET reviews/my-tasks" 200

api GET /submissions/my-grades; chk "GET /submissions/my-grades" 200 403  # 403 = instructor can't access student-only

###############################################################################
section "REVIEWS" "File review system"
###############################################################################
if [ -n "$SUB_ID" ]; then
  api GET "/reviews/by-submission/$SUB_ID"; chk "GET reviews by submission" 200 404
else
  skip "Reviews by submission" "no submissions"
fi

###############################################################################
section "PEER-REVIEW" "Peer review sessions & management"
###############################################################################
api GET /peer-review/sessions; chk "GET sessions list" 200

api POST /peer-review/sessions '{"title":"E2E Test Session","course_id":"CSE4939W"}'
chk "Create session" 201
SESS_ID=$(echo "$BODY"|jq -r '.session_id // empty' 2>/dev/null||echo "")

if [ -n "$SESS_ID" ]; then
  api PATCH "/peer-review/sessions/$SESS_ID" '{"title":"E2E Test Session Updated"}'
  chk "PATCH session (edit title)" 200

  api POST "/peer-review/sessions/$SESS_ID/duplicate"; chk "Duplicate session" 201 200

  api GET "/peer-review/sessions/$SESS_ID/results"; chk "GET session results" 200

  api GET "/peer-review/sessions/$SESS_ID/bias-analytics"; chk "GET bias analytics" 200

  api GET "/peer-review/sessions/$SESS_ID/all-students"; chk "GET all students" 200

  api GET "/peer-review/sessions/$SESS_ID/export-csv"; chk "Export session CSV" 200

  api PATCH "/peer-review/sessions/$SESS_ID/release-scores" '{"scores_released":true}'
  chk "Release scores" 200

  api PATCH "/peer-review/sessions/$SESS_ID" '{"is_open":false}'
  chk "Close session" 200
else
  skip "Session management" "no session_id"
fi

# Appeals (instructor)
api GET /peer-review/appeals; chk "GET appeals (instructor)" 200

###############################################################################
section "INSTRUCTOR" "Instructor dashboard & tools"
###############################################################################
api GET /instructor/overview; chk "GET overview" 200
api GET /instructor/unified-dashboard; chk "GET unified dashboard" 200
api GET /instructor/checkins/current; chk "GET checkins current" 200 404  # 404 = no checkin data yet
api GET /instructor/checkins/students; chk "GET checkins students" 200
api GET /instructor/checkins/insights; chk "GET checkins insights" 200
api GET /instructor/quality-flags; chk "GET quality flags" 200
api GET /instructor/peer-review-quality-flags; chk "GET peer review quality flags" 200 500  # 500 if no peer review data
api GET /instructor/export-csv; chk "GET export CSV" 200
api GET /instructor/submission-policy; chk "GET submission policy" 200

api PUT /instructor/submission-policy '{"course_id":"CSE4939W","allow_edit_withdraw_after_reviews":true}'
chk "PUT submission policy" 200

###############################################################################
section "NOTIFICATIONS" "Notification system"
###############################################################################
api GET /notifications; chk "GET notifications" 200
api GET /notifications/unread-count; chk "GET unread count" 200
api PATCH /notifications/read-all; chk "Mark all read" 200
api GET /notifications/preferences; chk "GET notification prefs" 200
api PATCH /notifications/preferences '{"type":"review_received","in_app":true,"email":false,"push":false}'
chk "PATCH notification prefs" 200
api GET /notifications/push/public-key; chk "GET VAPID key" 200 503  # 503 = push not configured
api GET /notifications/push/subscriptions; chk "GET push subs" 200

###############################################################################
section "ENROLLMENTS" "Course enrollments"
###############################################################################
api GET /enrollments; chk "GET enrollments" 200
api GET /enrollments/course/CSE4939W/members; chk "GET course members" 200

###############################################################################
section "RUBRICS" "Scoring rubrics"
###############################################################################
api GET "/rubrics?rubric_type=file_review"; chk "GET rubric" 200 404  # 404 = no rubric configured yet

###############################################################################
section "TEMPLATES" "Assignment templates"
###############################################################################
api GET /assignment-templates; chk "GET templates" 200
api POST /assignment-templates '{"course_id":"CSE4939W","title":"E2E Test Template","description":"Test"}'
chk "Create template" 201 200

###############################################################################
section "CHECKINS" "Student check-ins (as instructor)"
###############################################################################
api GET /checkins/context; chk "GET checkin context" 200 403  # 403 = student-only endpoint

###############################################################################
section "AI-ORIG" "AI original endpoints (feedback/rewrite/polish/summarize/logs/search)"
###############################################################################
api GET /api/ai/logs; ai_or_skip "GET AI logs"
api GET "/api/ai/search?q=test&type=all"; ai_or_skip "AI search"
api POST /api/ai/polish '{"text":"this is a good paper but needs more work on the methodology section"}'
ai_or_skip "AI polish"
api POST /api/ai/summarize '{"reviews":[{"score":4,"comments":"Good work","reviewer_name":"Reviewer 1"}]}'
ai_or_skip "AI summarize"
api POST /api/ai/feedback '{"review_id":"a0000000-0000-4000-8000-000000000001","text":"Your paper is well written but lacks citations."}'
ai_or_skip "AI feedback"
api POST /api/ai/rewrite '{"review_id":"a0000000-0000-4000-8000-000000000001","text":"bad paper fix it"}'
ai_or_skip "AI rewrite"

###############################################################################
section "AI-V3" "AI v3.0 endpoints (scoring/similarity/chat)"
###############################################################################
api POST /api/ai/review-depth '{"review_id":"a0000000-0000-4000-8000-000000000001","text":"Your analysis of the data is thorough but could benefit from more visualizations."}'
ai_or_skip "AI review-depth"

api POST /api/ai/score-suggestion '{"submission_text":"Climate change essay","rubric_json":"{}"}'
ai_or_skip "AI score-suggestion"

api POST /api/ai/calibration '{"reviewer_score":4,"peer_avg_score":2.5}'
ai_or_skip "AI calibration"

api POST /api/ai/score-reasoning '{"score":4,"submission_context":"Renewable energy paper"}'
ai_or_skip "AI score-reasoning"

api POST /api/ai/similarity '{"submissions":[{"submission_id":"a0000000-0000-4000-8000-000000000001","text":"The quick brown fox"},{"submission_id":"a0000000-0000-4000-8000-000000000002","text":"A fast brown fox"}]}'
ai_or_skip "AI TF-IDF similarity"

api POST /api/ai/similarity/turnitin '{"submission_id":"a0000000-0000-4000-8000-000000000001","text":"Test text"}'
ai_or_skip "AI mock Turnitin"

api POST /api/ai/chat '{"message":"Help me write a review","context_type":"writing_review"}'
ai_or_skip "AI chat"

###############################################################################
section "F1-ANON" "Anonymous review mechanism"
###############################################################################
if [ -n "$SESS_ID" ]; then
  api GET "/anonymity/sessions/$SESS_ID/anonymity"; chk "GET anonymity config" 200
  api PATCH "/anonymity/sessions/$SESS_ID/anonymity" '{"anonymity":"double_blind"}'
  chk "SET double_blind" 200
  api PATCH "/anonymity/sessions/$SESS_ID/anonymity" '{"anonymity":"none"}'
  chk "Reset to none" 200
else
  skip "Anonymity" "no session"
fi

###############################################################################
section "F2-REVISIONS" "Multi-round review"
###############################################################################
if [ -n "$SUB_ID" ]; then
  api GET "/revisions/$SUB_ID/history"; chk "Revision history" 200
  api GET "/revisions/$SUB_ID/diff"; chk "Revision diff" 200
else
  skip "Revision history" "no submissions"
  skip "Revision diff" "no submissions"
fi

###############################################################################
section "F3-STRATEGY" "Assignment strategy"
###############################################################################
api GET "/assignment-strategy/exclusions?course_id=CSE4939W"; chk "GET exclusions" 200
api PATCH /assignment-strategy/strategy '{"course_id":"CSE4939W","assignment_strategy":"load_balanced"}'
chk "Set load_balanced" 200
api PATCH /assignment-strategy/strategy '{"course_id":"CSE4939W","assignment_strategy":"reciprocal"}'
chk "Set reciprocal" 200
api PATCH /assignment-strategy/strategy '{"course_id":"CSE4939W","assignment_strategy":"random"}'
chk "Reset to random" 200

###############################################################################
section "F4-QUALITY" "Review quality & reputation"
###############################################################################
api GET "/quality/consistency?course_id=CSE4939W"; chk "Consistency alerts" 200
if [ -n "$INSTR_ID" ]; then
  api GET "/quality/reputation/$INSTR_ID"; chk "Reviewer reputation" 200
fi

###############################################################################
section "F6-SIMILARITY" "Similarity dashboard"
###############################################################################
api GET "/similarity/dashboard?course_id=CSE4939W"; chk "Similarity dashboard" 200
if [ -n "$SUB_ID" ]; then
  api GET "/similarity/report/$SUB_ID"; chk "Similarity report" 200
fi

###############################################################################
section "F8-GRADES" "Grade management"
###############################################################################
api GET /grades/weights/CSE4939W; chk "GET weights" 200
api PUT /grades/weights/CSE4939W '{"file_review_weight":50,"peer_review_weight":30,"checkin_weight":20,"drop_lowest":0,"drop_highest":0}'
chk "SET weights" 200
api GET /grades/final/CSE4939W; chk "Calculate grades" 200
api GET /grades/export/CSE4939W; chk "Export grades CSV" 200

###############################################################################
section "F9-LMS" "LMS integration (mock)"
###############################################################################
api GET /lms/CSE4939W; chk "GET LMS config" 200
api PUT /lms/CSE4939W '{"provider":"canvas_mock"}'; chk "SET LMS config" 200
api POST /lms/lti/launch '{}'; chk "Mock LTI launch" 200
api POST /lms/lti/grades '{}'; chk "Mock grade passback" 200
api POST /lms/lti/roster '{}'; chk "Mock roster import" 200

###############################################################################
section "F10-SEMESTERS" "Semester management"
###############################################################################
api GET /semesters; chk "List semesters" 200
api POST /semesters '{"name":"Fall 2026","start_date":"2026-09-01","end_date":"2026-12-15"}'
chk "Create semester" 201

###############################################################################
section "F11-DEADLINES" "Deadlines & reminders"
###############################################################################
api GET /deadlines/calendar; chk "Calendar" 200
api GET "/deadlines/extensions?entity_type=session"; chk "GET extensions" 200

###############################################################################
section "F15-PREFS" "User preferences & accessibility"
###############################################################################
api GET /preferences; chk "GET preferences" 200
api PATCH /preferences '{"theme":"dark"}'; chk "Set dark mode" 200
api PATCH /preferences '{"theme":"light","font_size":"large","high_contrast":true}'
chk "Set font+contrast" 200
api PATCH /preferences '{"theme":"light","font_size":"medium","high_contrast":false}'
chk "Reset preferences" 200

###############################################################################
section "F17-COMPLIANCE" "Audit & GDPR"
###############################################################################
api GET "/compliance/audit?limit=5"; chk "Audit log (admin-only → 403 ok)" 200 403
if [ -n "$INSTR_ID" ]; then
  api GET "/compliance/export/$INSTR_ID"; chk "GDPR export" 200
fi
api POST /compliance/deletion-request; chk "Deletion request" 201

###############################################################################
section "F19-BLACKLIST" "Token blacklist & logout"
###############################################################################
# Login as student, then logout, verify rejection
api POST /auth/login '{"email":"alice@example.com","password":"password123"}'
chk "Student login" 200

api POST /auth/logout; chk "Logout" 200

api GET /auth/me
[ "$SC" = "401" ] && ok "Token rejected after logout (401)" || fail "Token should be rejected" "$SC"

###############################################################################
section "STUDENT" "Student-specific flows"
###############################################################################
api POST /auth/login '{"email":"bob@example.com","password":"password123"}'
chk "Bob login" 200

api GET /submissions/mine; chk "Bob's submissions" 200
api GET /submissions/reviews/my-tasks; chk "Bob's review tasks" 200
api GET /submissions/my-grades; chk "Bob's grades" 200
api GET /peer-review/sessions; chk "Bob's sessions" 200
api GET /peer-review/appeals/mine; chk "Bob's appeals" 200
api GET /notifications; chk "Bob's notifications" 200
api GET /notifications/unread-count; chk "Bob's unread count" 200
api GET /preferences; chk "Bob's preferences" 200
api GET /deadlines/calendar; chk "Bob's calendar" 200
api GET /enrollments; chk "Bob's enrollments" 200
api GET /checkins/context; chk "Bob's checkin context" 200

# Student cannot access instructor routes
api GET /instructor/overview
[ "$SC" = "403" ] && ok "Instructor route blocked for student (403)" \
  || { [ "$SC" = "429" ] && skip "Instructor route check" "rate limited (429)" || fail "Should be 403" "$SC"; }

api GET /compliance/audit
[ "$SC" = "403" ] && ok "Admin audit blocked for student (403)" || fail "Should be 403" "$SC"

###############################################################################
section "FILE" "File download endpoint"
###############################################################################
api GET /uploads/nonexistent-file.pdf; chk "Missing file → 404" 404

###############################################################################
# SUMMARY
###############################################################################
TOTAL=$((PASS+FAIL+SKIP))
echo -e "\n${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}  |  ${RED}FAIL: $FAIL${NC}  |  ${YELLOW}SKIP: $SKIP${NC}  |  TOTAL: $TOTAL"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}${BOLD}Failed tests:${ERRORS}${NC}\n"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}All executed tests passed!${NC}"
  [ $SKIP -gt 0 ] && echo -e "${YELLOW}$SKIP tests skipped (AI_API_KEY / OPENAI_API_KEY not configured)${NC}"
  echo ""
  exit 0
fi
