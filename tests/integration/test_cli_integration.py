"""Integration tests for CLI commands."""

import pytest
from typer.testing import CliRunner

from openclaw_py.cli.app import create_app
from openclaw_py.cli.banner import format_cli_banner_line
from openclaw_py.cli.tagline import pick_tagline
from openclaw_py.cli.utils import print_json, print_table

runner = CliRunner()


class TestCLIApp:
    """Test CLI application integration."""

    def test_cli_app_creation(self):
        """Test CLI app can be created."""
        app = create_app()
        assert app is not None

    def test_cli_help_command(self):
        """Test CLI help command."""
        app = create_app()
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "OpenClaw" in result.stdout or "openclaw" in result.stdout.lower()

    def test_cli_version_command(self):
        """Test CLI version command."""
        app = create_app()
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0
        assert "openclaw" in result.stdout.lower()


class TestCLICommands:
    """Test individual CLI commands."""

    def test_health_command_help(self):
        """Test health command help."""
        app = create_app()
        result = runner.invoke(app, ["health", "--help"])
        assert result.exit_code == 0
        assert "health" in result.stdout.lower()

    def test_status_command_help(self):
        """Test status command help."""
        app = create_app()
        result = runner.invoke(app, ["status", "--help"])
        assert result.exit_code == 0
        assert "status" in result.stdout.lower()

    def test_config_show_help(self):
        """Test config show command help."""
        app = create_app()
        result = runner.invoke(app, ["config", "show", "--help"])
        assert result.exit_code == 0

    def test_agents_list_help(self):
        """Test agents list command help."""
        app = create_app()
        result = runner.invoke(app, ["agents", "list", "--help"])
        assert result.exit_code == 0

    def test_gateway_start_help(self):
        """Test gateway start command help."""
        app = create_app()
        result = runner.invoke(app, ["gateway", "start", "--help"])
        assert result.exit_code == 0

    def test_telegram_start_help(self):
        """Test telegram start command help."""
        app = create_app()
        result = runner.invoke(app, ["telegram", "start", "--help"])
        assert result.exit_code == 0


class TestCLIBanner:
    """Test CLI banner functionality."""

    def test_banner_line_formatting(self):
        """Test banner line formatting."""
        line = format_cli_banner_line(
            version="1.0.0",
            commit="abc123",
            tagline="Test tagline",
            columns=80,
            rich=False
        )
        assert "1.0.0" in line
        assert isinstance(line, str)

    def test_tagline_selection(self):
        """Test tagline selection."""
        import random
        rng = random.Random(42)
        tagline = pick_tagline(rng=rng)
        assert isinstance(tagline, str)
        assert len(tagline) > 0


class TestCLIUtils:
    """Test CLI utility functions."""

    def test_print_json_function(self, capsys):
        """Test print_json utility."""
        data = {"key": "value", "number": 123}
        print_json(data, pretty=False)
        captured = capsys.readouterr()
        assert "key" in captured.out
        assert "value" in captured.out

    def test_print_table_function(self, capsys):
        """Test print_table utility."""
        data = [
            ["Alice", "30", "Engineer"],
            ["Bob", "25", "Designer"],
        ]
        headers = ["Name", "Age", "Role"]
        print_table(data, headers, title="Team")
        captured = capsys.readouterr()
        # Rich table output should contain the data
        assert len(captured.out) > 0


class TestCLIIntegrationScenarios:
    """Test complete CLI integration scenarios."""

    def test_full_help_tree(self):
        """Test complete help command tree."""
        app = create_app()

        # Main help
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0

        # Subcommand help
        commands = ["health", "status", "config", "agents", "gateway", "telegram"]
        for cmd in commands:
            result = runner.invoke(app, [cmd, "--help"])
            assert result.exit_code == 0, f"Command {cmd} --help failed"

    def test_cli_command_chaining(self):
        """Test running multiple CLI commands."""
        app = create_app()

        # Run version
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0

        # Run help
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0

        # Run command help
        result = runner.invoke(app, ["health", "--help"])
        assert result.exit_code == 0

    def test_cli_json_output_flag(self):
        """Test --json flag support."""
        app = create_app()

        # Commands that support --json
        json_commands = [
            ["status", "--json"],
            ["agents", "list", "--json"],
        ]

        for cmd in json_commands:
            result = runner.invoke(app, cmd)
            # May fail without config, but should recognize the flag
            assert "--json" not in result.stdout or result.exit_code in [0, 1]
