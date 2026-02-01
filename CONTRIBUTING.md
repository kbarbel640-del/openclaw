# Contributing to SotyBot

Thank you for your interest in contributing to SotyBot! 🤖

## Ways to Contribute

### 1. Build Agents 🤖
The easiest way to contribute is to build agents for new domains:
- Security agents (malware analysis, threat detection)
- Crypto agents (trading, DeFi research)
- Creative agents (content generation, design)
- Sports agents (predictions, analysis)
- Any domain you can imagine!

See [Agent Development Guide](docs/AGENT_DEV.md) for details.

### 2. Improve Core Engine 🔧
- Add new action connectors
- Enhance permission system
- Improve performance
- Add tests

### 3. Documentation 📚
- Improve README and guides
- Add examples and tutorials
- Translate documentation
- Create video tutorials

### 4. Report Bugs 🐛
- Open issues with detailed descriptions
- Include reproduction steps
- Provide system information

## Development Setup

```bash
# Clone the repo
git clone https://github.com/sotyhub/sotybot.git
cd sotybot

# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/

# Run linters
black .
ruff check .
mypy .
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/your-feature`
3. **Make changes** and commit: `git commit -m "Add amazing feature"`
4. **Run tests**: `pytest tests/`
5. **Push**: `git push origin feature/your-feature`
6. **Open a Pull Request**

## Code Style

- Follow PEP 8
- Use type hints
- Write docstrings
- Add tests for new features
- Keep lines under 100 characters

## Agent Contribution Guidelines

When contributing an agent:

1. **Create proper structure**:
   ```
   agents/[domain]/[agent_name]/
   ├── manifest.json
   ├── agent.py
   └── README.md (optional)
   ```

2. **Include complete manifest**:
   - Name, version, author
   - Domain and capabilities
   - Required actions
   - Risk level
   - Configuration schema

3. **Implement BaseAgent**:
   - All required methods
   - Proper error handling
   - Execution tracking

4. **Add documentation**:
   - What the agent does
   - Example usage
   - Configuration options

5. **Test your agent**:
   - Load and unload
   - Execute various tasks
   - Handle errors gracefully

## Community Guidelines

- Be respectful and inclusive
- Help others learn
- Share knowledge
- Give credit where due
- Focus on building together

## Questions?

- Open a GitHub issue
- Join our [Discord](https://discord.gg/sotyhub)
- Email: hello@sotyhub.com

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

---

**Thank you for helping build the open agent ecosystem! 🚀**
