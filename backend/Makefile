# Only for development
dev:
	uv run uvicorn app.main:app --reload

sync:
	uv sync

format:
	uv run ruff format -v .

lint:
	uv run ruff check --select I --fix .

reset-news:
	uv run python scripts/reset_news_database.py

clean:
	find . -type d -name "__pycache__" -exec rm -r {} +
	rm
