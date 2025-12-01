# StockReplay - Backend

FastAPI backend for the StockReplay application.

## Setup

### Prerequisites

- Python 3.11 or higher
- UV package manager

### Installation

1. Install dependencies using UV:

```bash
uv sync
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Edit `.env` and configure your settings (API keys, database, etc.)

### Development

Run the development server:

```bash
uv run uvicorn app.main:app --reload
```

The API will be available at http://localhost:8888

API documentation (Swagger UI): http://localhost:8888/docs

### Project Structure

```
backend/
├── app/
│   ├── api/              # API endpoints
│   ├── models/           # Pydantic models
│   ├── services/         # Business logic
│   ├── database/         # Database models and connection
│   └── utils/            # Utility functions
├── tests/                # Test files
├── pyproject.toml        # Project configuration
├── .env.example          # Environment variables template
└── README.md             # This file
```

### Testing

Run tests:

```bash
uv run pytest
```

With coverage:

```bash
uv run pytest --cov=app --cov-report=html
```

### Code Quality

Format code:

```bash
uv run black .
```

Lint code:

```bash
uv run ruff check .
```

Type checking:

```bash
uv run mypy app/
```
