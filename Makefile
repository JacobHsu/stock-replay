# StockReplay - Makefile
# Manage backend and frontend services

.PHONY: run stop backend frontend install format lint help

# Run the entire application (backend + frontend)
run:
	@echo "🚀 Starting StockReplay..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "▶ Starting backend server..."
	@cd backend && uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888 &
		@sleep 3
	@echo "▶ Starting frontend server..."
	@export PATH="/opt/homebrew/bin:$$PATH" && cd frontend && npm run dev &
	@sleep 2
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ Services started successfully!"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🌐 Backend API:    http://localhost:8888"
	@echo "🌐 Frontend App:   http://localhost:5173"
	@echo "📚 API Docs:       http://localhost:8888/docs"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "Press Ctrl+C to stop all services"
	@wait

# Run backend only
backend:
	@echo "🔧 Starting backend server only..."
	@cd backend && uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888

# Run frontend only  
frontend:
	@echo "🎨 Starting frontend server only..."
	@cd frontend && export PATH="/opt/homebrew/bin:$$PATH" && npm run dev

# Stop all services
stop:
	@echo "🛑 Stopping StockReplay services..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "Killing backend (port 8888)..."
	@-lsof -ti:8888 | xargs kill -9 2>/dev/null || echo "✓ No backend process found"
	@echo "Killing frontend (port 5173)..."
	@-lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "✓ No frontend process found"
	@echo "Cleaning up background processes..."
	@-pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@-pkill -f "vite" 2>/dev/null || true
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ All services stopped"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "▶ Installing backend dependencies..."
	@cd backend && uv sync
	@echo "▶ Installing frontend dependencies..."
	@cd frontend && export PATH="/opt/homebrew/bin:$$PATH" && npm install
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ All dependencies installed!"

# Format code
format:
	@echo "🎨 Formatting code..."
	@cd backend && uv run ruff format -v .
	@echo "✅ Code formatted!"

# Lint code
lint:
	@echo "🔍 Linting code..."
	@cd backend && uv run ruff check --select I --fix .
	@echo "✅ Code linted!"

# Show help
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🎯 StockReplay - Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "make run       - Start both backend and frontend"
	@echo "make backend   - Start backend only"
	@echo "make frontend  - Start frontend only"
	@echo "make stop      - Stop all services"
	@echo "make install   - Install all dependencies"
	@echo "make format    - Format code with ruff"
	@echo "make lint      - Lint code with ruff"
	@echo "make help      - Show this help message"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"