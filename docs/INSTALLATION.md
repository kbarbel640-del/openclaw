# OpenClaw Installation Guide

## Prerequisites

- **Python 3.13+** (recommended: use Conda or pyenv)
- **Poetry** for dependency management
- **Git** for version control

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/openclaw.git
cd openclaw
```

### 2. Install Dependencies

Using Poetry (recommended):

```bash
# Install Poetry if you haven't
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install
```

Using pip (alternative):

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .
```

### 3. Configure OpenClaw

Run the interactive setup wizard:

```bash
poetry run openclaw setup
```

Or manually create a configuration file:

```bash
# Copy example config
cp examples/openclaw.example.yaml ~/.openclaw/config.yaml

# Edit with your API keys
nano ~/.openclaw/config.yaml
```

### 4. Set Environment Variables

```bash
# Add to ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
```

### 5. Verify Installation

```bash
# Check CLI
poetry run openclaw --version

# Run health check
poetry run openclaw health

# Check system status
poetry run openclaw status
```

## Configuration Locations

OpenClaw looks for configuration files in the following order:

1. `./openclaw.yaml` (current directory)
2. `~/.openclaw/config.yaml` (user home)
3. `/etc/openclaw/config.yaml` (system-wide)

## Optional: Shell Completion

### Bash

```bash
poetry run openclaw --install-completion bash
```

### Zsh

```bash
poetry run openclaw --install-completion zsh
```

### Fish

```bash
poetry run openclaw --install-completion fish
```

## Development Setup

For development, install with dev dependencies:

```bash
poetry install --with dev

# Run tests
poetry run pytest

# Run linter
poetry run ruff check openclaw_py/

# Format code
poetry run black openclaw_py/
```

## Docker (Optional)

Build Docker image:

```bash
docker build -t openclaw:latest .
docker run -v ~/.openclaw:/root/.openclaw openclaw:latest
```

## Troubleshooting

### Import Errors

If you encounter import errors, ensure you're in the right environment:

```bash
poetry shell
python -c "import openclaw_py; print('OK')"
```

### Permission Errors

On Linux/macOS, ensure config directory has correct permissions:

```bash
chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/config.yaml
```

### API Key Issues

Test your API keys:

```bash
# Test Anthropic
poetry run openclaw agents list

# Test Telegram
poetry run openclaw telegram test
```

## Next Steps

- Read [CONFIGURATION.md](./CONFIGURATION.md) for detailed config options
- Check [API.md](./API.md) for API documentation
- See [../README.md](../README.md) for usage examples
