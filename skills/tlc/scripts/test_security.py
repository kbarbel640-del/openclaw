#!/usr/bin/env python3
"""
Security Tests for TLC/TLA+ Task Runner

Tests for:
- Path traversal attack prevention
- Language parameter validation
- JAR checksum verification
- Input sanitization
"""

import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from tasks import (
    ALLOWED_LANGUAGES,
    TLC_JAR_EXPECTED_SHA256,
    TLC_JAR_URL,
    SecurityError,
    compile_tla,
    run_tlc_check,
    validate_language,
    validate_target,
    verify_jar_checksum,
)


class TestLanguageValidation(unittest.TestCase):
    """Tests for language parameter validation."""

    def test_valid_languages(self):
        """Test that all allowed languages are accepted."""
        for lang in ALLOWED_LANGUAGES:
            result = validate_language(lang)
            self.assertEqual(result, lang)

    def test_valid_languages_case_insensitive(self):
        """Test that language validation is case insensitive."""
        test_cases = ["TLC", "Tla", "TLA+", "Tlc"]
        for lang in test_cases:
            result = validate_language(lang)
            self.assertIn(result, ALLOWED_LANGUAGES)

    def test_empty_language_rejected(self):
        """Test that empty language is rejected."""
        with self.assertRaises(SecurityError) as cm:
            validate_language("")
        self.assertIn("cannot be empty", str(cm.exception))

    def test_whitespace_only_language_rejected(self):
        """Test that whitespace-only language is rejected."""
        with self.assertRaises(SecurityError) as cm:
            validate_language("   ")
        self.assertIn("cannot be empty", str(cm.exception))

    def test_invalid_language_rejected(self):
        """Test that invalid languages are rejected."""
        invalid_languages = ["python", "javascript", "bash", ";rm -rf /", "$(whoami)"]
        for lang in invalid_languages:
            with self.subTest(lang=lang):
                with self.assertRaises(SecurityError) as cm:
                    validate_language(lang)
                self.assertIn("Invalid language", str(cm.exception))


class TestPathTraversalProtection(unittest.TestCase):
    """Tests for path traversal attack prevention."""

    def setUp(self):
        """Set up test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up test environment."""
        os.chdir(self.original_cwd)
        import shutil

        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_valid_relative_path(self):
        """Test that valid relative paths are accepted."""
        # Create test file
        test_file = Path(self.test_dir) / "spec.tla"
        test_file.touch()

        result = validate_target("spec.tla")
        self.assertTrue(result.is_absolute())
        self.assertTrue(result.exists())

    def test_valid_nested_path(self):
        """Test that valid nested paths are accepted."""
        nested_dir = Path(self.test_dir) / "models" / "clock"
        nested_dir.mkdir(parents=True)
        test_file = nested_dir / "Clock.tla"
        test_file.touch()

        result = validate_target("models/clock/Clock.tla")
        self.assertEqual(result.name, "Clock.tla")

    def test_path_traversal_double_dot_rejected(self):
        """Test that '..' path traversal is blocked."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("../etc/passwd")
        self.assertIn("forbidden component", str(cm.exception))

    def test_path_traversal_double_dot_in_middle_rejected(self):
        """Test that '..' in middle of path is blocked."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("models/../etc/passwd")
        self.assertIn("forbidden component", str(cm.exception))

    def test_absolute_path_traversal_rejected(self):
        """Test that absolute paths escaping cwd are blocked."""
        # This would resolve outside the test directory
        with self.assertRaises(SecurityError) as cm:
            validate_target("/etc/passwd")

    def test_tilde_expansion_rejected(self):
        """Test that '~' home directory expansion is blocked."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("~/.bashrc")
        self.assertIn("forbidden component", str(cm.exception))

    def test_environment_variable_rejected(self):
        """Test that environment variables in paths are blocked."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("$HOME/.bashrc")
        self.assertIn("forbidden component", str(cm.exception))

    def test_shell_metacharacters_rejected(self):
        """Test that shell metacharacters are blocked."""
        malicious_paths = [
            "spec.tla;rm -rf /",
            "spec.tla|cat /etc/passwd",
            "spec.tla&&whoami",
            "spec.tla`id`",
            "spec.tla$(whoami)",
        ]
        for path in malicious_paths:
            with self.subTest(path=path):
                with self.assertRaises(SecurityError):
                    validate_target(path)

    def test_null_byte_rejected(self):
        """Test that null bytes in paths are blocked."""
        with self.assertRaises((SecurityError, ValueError)):
            validate_target("spec.tla\x00/etc/passwd")

    def test_unicode_normalization_attack_rejected(self):
        """Test that unicode normalization attacks are blocked."""
        # Using unicode dots that might normalize to regular dots
        with self.assertRaises(SecurityError):
            validate_target("spec\u2024tla")  # One dot leader

    def test_very_long_path_rejected(self):
        """Test that excessively long paths are blocked."""
        long_path = "a" * 5000
        with self.assertRaises(SecurityError) as cm:
            validate_target(long_path)
        self.assertIn("exceeds maximum length", str(cm.exception))

    def test_empty_path_rejected(self):
        """Test that empty paths are rejected."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("")
        self.assertIn("cannot be empty", str(cm.exception))

    def test_backslash_rejected(self):
        """Test that backslashes (Windows paths) are blocked."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("models\\clock\\spec.tla")
        self.assertIn("forbidden component", str(cm.exception))

    def test_double_slash_rejected(self):
        """Test that double slashes are blocked."""
        with self.assertRaises(SecurityError) as cm:
            validate_target("models//etc/passwd")
        self.assertIn("forbidden component", str(cm.exception))


class TestJarVerification(unittest.TestCase):
    """Tests for JAR checksum verification (supply chain security)."""

    def setUp(self):
        """Set up test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.test_jar = Path(self.test_dir) / "test.jar"

    def tearDown(self):
        """Clean up test environment."""
        import shutil

        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_valid_checksum_verification(self):
        """Test that valid checksum passes verification."""
        # Create a test file
        test_content = b"test jar content"
        self.test_jar.write_bytes(test_content)

        # Calculate expected hash
        expected_hash = hashlib.sha256(test_content).hexdigest()

        # Verify it passes
        result = verify_jar_checksum(self.test_jar, expected_hash)
        self.assertTrue(result)

    def test_invalid_checksum_fails(self):
        """Test that invalid checksum fails verification."""
        # Create a test file
        test_content = b"test jar content"
        self.test_jar.write_bytes(test_content)

        # Wrong hash
        wrong_hash = "a" * 64

        # Verify it fails
        result = verify_jar_checksum(self.test_jar, wrong_hash)
        self.assertFalse(result)

    def test_missing_jar_fails(self):
        """Test that missing JAR fails verification."""
        nonexistent_jar = Path(self.test_dir) / "nonexistent.jar"
        result = verify_jar_checksum(nonexistent_jar, "a" * 64)
        self.assertFalse(result)

    def test_checksum_case_insensitive(self):
        """Test that checksum comparison is case insensitive."""
        test_content = b"test jar content"
        self.test_jar.write_bytes(test_content)

        # Calculate hash in uppercase
        expected_hash = hashlib.sha256(test_content).hexdigest().upper()

        # Verify it passes (comparison should be case insensitive)
        result = verify_jar_checksum(self.test_jar, expected_hash)
        self.assertTrue(result)


class TestIntegrationSecurity(unittest.TestCase):
    """Integration tests for security features."""

    def setUp(self):
        """Set up test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        os.chdir(self.test_dir)

        # Create a dummy JAR file
        self.jar_path = Path(self.test_dir) / "tla2tools.jar"
        jar_content = b"dummy jar for testing"
        self.jar_path.write_bytes(jar_content)
        self.jar_hash = hashlib.sha256(jar_content).hexdigest()

    def tearDown(self):
        """Clean up test environment."""
        os.chdir(self.original_cwd)
        import shutil

        shutil.rmtree(self.test_dir, ignore_errors=True)

    @patch("tasks.TLC_JAR_EXPECTED_SHA256", new="dummy_hash")
    def test_compile_with_invalid_jar_checksum(self):
        """Test that compile fails with invalid JAR checksum."""
        # Create test TLA file
        test_file = Path(self.test_dir) / "test.tla"
        test_file.write_text("---- MODULE test ----\n====")

        with self.assertRaises(SecurityError) as cm:
            compile_tla(test_file, Path(self.test_dir), self.jar_path)

        self.assertIn("checksum verification failed", str(cm.exception))

    @patch("tasks.TLC_JAR_EXPECTED_SHA256")
    def test_run_tlc_with_unverified_jar(self, mock_hash):
        """Test that TLC execution fails without verified JAR."""
        mock_hash.__get__ = MagicMock(return_value="wrong_hash")

        test_file = Path(self.test_dir) / "test.tla"
        test_file.write_text("---- MODULE test ----\n====")

        with self.assertRaises(SecurityError) as cm:
            run_tlc_check(test_file, Path(self.test_dir), self.jar_path)

        self.assertIn("checksum verification failed", str(cm.exception))


class TestLanguageAndTargetParameterInjection(unittest.TestCase):
    """Tests specifically for language and target parameter injection attacks."""

    def test_language_parameter_injection_attempt(self):
        """Test that malicious language parameters are rejected."""
        # These could be attempts to inject commands
        malicious_languages = [
            "tlc; rm -rf /",
            "tlc|cat /etc/passwd",
            "tlc'\'';whoami",
            'tlc"";id',
            "tlc$(whoami)",
            "tlc`id`",
        ]
        for lang in malicious_languages:
            with self.subTest(lang=lang):
                with self.assertRaises(SecurityError):
                    validate_language(lang)

    def test_target_with_encoded_traversal(self):
        """Test that URL/path encoded traversal is blocked."""
        encoded_paths = [
            "spec.tla%2f..%2fetc%2fpasswd",  # URL encoded
            "spec.tla%252f..%252fetc%252fpasswd",  # Double encoded
        ]
        for path in encoded_paths:
            with self.subTest(path=path):
                # These should be rejected due to invalid characters
                with self.assertRaises(SecurityError):
                    validate_target(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
