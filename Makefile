# ============================================================================
# SDP Peer Review System — Cross-platform Makefile
# Replaces PowerShell-only start-dev.ps1 for Linux/macOS developers.
# ============================================================================

.PHONY: help install dev dev-ai stop docker docker-build test test-backend test-frontend test-ai migrate lint clean

# Colours (ANSI — ignored on Windows cmd, works in Git Bash / WSL / macOS)
CYAN  := \033[36m
GREEN := \033[32m
RESET := \033[0m

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-16s$(RESET) %s\n", $$1, $$2}'

# ── Dependencies ───────────────────────────────────────────────────────────

install: ## Install all dependencies (backend + frontend + ai-service)
	cd backend && npm install
	cd frontend && npm install
	cd ai-service && pip install -r requirements.txt

# ── Local Development ──────────────────────────────────────────────────────

dev: ## Start DB + backend + frontend (no AI service)
	docker compose up db redis -d
	@echo "$(GREEN)Waiting for PostgreSQL...$(RESET)"
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "$(GREEN)DB ready. Starting services...$(RESET)"
	cd backend && npx tsx watch src/server.ts &
	cd frontend && npx vite --host &
	@echo "$(GREEN)Backend: http://localhost:8080  Frontend: http://localhost:5173$(RESET)"
	@wait

dev-ai: ## Start DB + backend + frontend + AI service
	docker compose up db redis -d
	@echo "$(GREEN)Waiting for PostgreSQL...$(RESET)"
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "$(GREEN)DB ready. Starting services...$(RESET)"
	cd backend && npx tsx watch src/server.ts &
	cd frontend && npx vite --host &
	cd ai-service && python app.py &
	@echo "$(GREEN)Backend: :8080  Frontend: :5173  AI: :5001$(RESET)"
	@wait

stop: ## Stop all services (Docker + local processes)
	docker compose down
	-@pkill -f "tsx watch" 2>/dev/null || true
	-@pkill -f "vite" 2>/dev/null || true
	-@pkill -f "python app.py" 2>/dev/null || true
	@echo "$(GREEN)All services stopped.$(RESET)"

# ── Docker Full Stack ──────────────────────────────────────────────────────

docker: ## Start full stack via Docker Compose
	docker compose up -d
	@echo "$(GREEN)All services starting. Run 'docker compose logs -f' to follow.$(RESET)"

docker-build: ## Rebuild and start full stack
	docker compose up --build -d

# ── Testing ────────────────────────────────────────────────────────────────

test: test-backend test-ai ## Run all tests

test-backend: ## Run backend Jest tests
	cd backend && npm test

test-frontend: ## Run frontend Vitest + Playwright tests
	cd frontend && npx vitest run

test-ai: ## Run AI service pytest tests
	cd ai-service && python -m pytest tests/ -v

# ── Database ───────────────────────────────────────────────────────────────

migrate: ## Run pending database migrations
	cd backend && npm run migrate

# ── Code Quality ───────────────────────────────────────────────────────────

lint: ## Lint backend + frontend
	cd backend && npx eslint src/
	cd frontend && npx eslint src/

clean: ## Remove node_modules, dist, __pycache__
	rm -rf backend/node_modules backend/dist
	rm -rf frontend/node_modules frontend/dist
	rm -rf ai-service/__pycache__ ai-service/.pytest_cache
	@echo "$(GREEN)Cleaned build artifacts.$(RESET)"
