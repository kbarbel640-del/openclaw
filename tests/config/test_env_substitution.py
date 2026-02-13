"""Tests for environment variable substitution."""

import pytest

from openclaw_py.config import MissingEnvVarError, substitute_env_vars


class TestSubstituteEnvVars:
    """Tests for substitute_env_vars function."""

    def test_no_substitution(self):
        """Test that strings without ${} pass through unchanged."""
        env = {"FOO": "bar"}
        assert substitute_env_vars("hello", env) == "hello"
        assert substitute_env_vars("hello world", env) == "hello world"

    def test_simple_substitution(self):
        """Test simple ${VAR} substitution."""
        env = {"FOO": "bar", "BAZ": "qux"}
        assert substitute_env_vars("${FOO}", env) == "bar"
        assert substitute_env_vars("prefix ${FOO} suffix", env) == "prefix bar suffix"
        assert substitute_env_vars("${FOO} ${BAZ}", env) == "bar qux"

    def test_escaped_substitution(self):
        """Test that $${VAR} escapes to ${VAR}."""
        env = {"FOO": "bar"}
        assert substitute_env_vars("$${FOO}", env) == "${FOO}"
        assert substitute_env_vars("prefix $${FOO} suffix", env) == "prefix ${FOO} suffix"

    def test_uppercase_only(self):
        """Test that only uppercase var names are matched."""
        env = {"FOO": "bar", "foo": "lowercase"}
        # FOO should be substituted
        assert substitute_env_vars("${FOO}", env) == "bar"
        # lowercase vars should not be matched
        assert substitute_env_vars("${foo}", env) == "${foo}"
        assert substitute_env_vars("${Foo}", env) == "${Foo}"

    def test_missing_env_var(self):
        """Test that missing env vars raise MissingEnvVarError."""
        env = {"FOO": "bar"}
        with pytest.raises(MissingEnvVarError) as exc_info:
            substitute_env_vars("${MISSING_VAR}", env)
        assert exc_info.value.var_name == "MISSING_VAR"
        assert exc_info.value.config_path == ""

    def test_missing_env_var_with_path(self):
        """Test that error includes config path."""
        env = {"FOO": "bar"}
        with pytest.raises(MissingEnvVarError) as exc_info:
            substitute_env_vars("${MISSING_VAR}", env, "telegram.bot_token")
        assert exc_info.value.var_name == "MISSING_VAR"
        assert exc_info.value.config_path == "telegram.bot_token"

    def test_dict_substitution(self):
        """Test substitution in dict values."""
        env = {"TOKEN": "secret123"}
        obj = {
            "name": "test",
            "token": "${TOKEN}",
            "nested": {"key": "${TOKEN}"},
        }
        result = substitute_env_vars(obj, env)
        assert result["token"] == "secret123"
        assert result["nested"]["key"] == "secret123"
        assert result["name"] == "test"

    def test_list_substitution(self):
        """Test substitution in list items."""
        env = {"VAR1": "value1", "VAR2": "value2"}
        obj = ["${VAR1}", "${VAR2}", "literal"]
        result = substitute_env_vars(obj, env)
        assert result == ["value1", "value2", "literal"]

    def test_nested_structures(self):
        """Test substitution in deeply nested structures."""
        env = {"SECRET": "xyz"}
        obj = {
            "level1": {
                "level2": {
                    "level3": ["${SECRET}", {"key": "${SECRET}"}],
                },
            },
        }
        result = substitute_env_vars(obj, env)
        assert result["level1"]["level2"]["level3"][0] == "xyz"
        assert result["level1"]["level2"]["level3"][1]["key"] == "xyz"

    def test_primitives_pass_through(self):
        """Test that primitives pass through unchanged."""
        env = {"FOO": "bar"}
        assert substitute_env_vars(123, env) == 123
        assert substitute_env_vars(45.67, env) == 45.67
        assert substitute_env_vars(True, env) is True
        assert substitute_env_vars(False, env) is False
        assert substitute_env_vars(None, env) is None

    def test_invalid_closing_brace(self):
        """Test that ${VAR without closing brace is treated as literal."""
        env = {"FOO": "bar"}
        assert substitute_env_vars("${FOO", env) == "${FOO"

    def test_dollar_not_followed_by_brace(self):
        """Test that $ not followed by { is treated as literal."""
        env = {"FOO": "bar"}
        assert substitute_env_vars("$FOO", env) == "$FOO"
        assert substitute_env_vars("$ {FOO}", env) == "$ {FOO}"

    def test_empty_var_name(self):
        """Test that ${} is treated as literal."""
        env = {"FOO": "bar"}
        assert substitute_env_vars("${}", env) == "${}"

    def test_underscore_in_var_name(self):
        """Test that underscores are allowed in var names."""
        env = {"FOO_BAR": "value", "A_B_C": "abc"}
        assert substitute_env_vars("${FOO_BAR}", env) == "value"
        assert substitute_env_vars("${A_B_C}", env) == "abc"

    def test_leading_underscore(self):
        """Test that leading underscore is allowed."""
        env = {"_FOO": "value"}
        assert substitute_env_vars("${_FOO}", env) == "value"

    def test_numbers_in_var_name(self):
        """Test that numbers are allowed in var names (but not at start)."""
        env = {"FOO123": "value", "FOO_123_BAR": "value2"}
        assert substitute_env_vars("${FOO123}", env) == "value"
        assert substitute_env_vars("${FOO_123_BAR}", env) == "value2"
        # Numbers at start should not match
        assert substitute_env_vars("${123FOO}", env) == "${123FOO}"
