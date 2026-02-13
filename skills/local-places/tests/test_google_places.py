"""
Unit tests for Google Places API place_id validation.

These tests ensure that the _validate_place_id function correctly:
1. Accepts valid Google Place IDs (alphanumeric + = _ -)
2. Rejects any characters outside the allowlist
3. Handles edge cases properly

The validation uses an allowlist approach, which inherently blocks all
path traversal attempts without needing explicit pattern detection.
"""

import pytest
from fastapi import HTTPException

from local_places.google_places import _validate_place_id, get_place_details


class TestValidatePlaceId:
    """Test suite for place_id validation."""
    
    def test_valid_place_ids(self):
        """Test that valid Google Place IDs are accepted."""
        valid_ids = [
            "ChIJN1t_tDeuEmsRUsoyG83frY4",  # Common format starting with ChIJ
            "Ei1Tb21lIFBsYWNlIE5hbWU",      # Base64-like format
            "GhIJQWJjZGVmZ2hpamtsbW5vcA",   # Starting with GhIJ
            "valid-place_id+123",            # With underscores, hyphens, plus
            "place_id=value",                # With equals sign
            "A" * 100,                       # Long valid ID
            "1234567890",                    # Numeric only (minimum length)
            "ChIJ+abc-def_ghi=jkl",          # All allowed special chars
            "UPPERCASE123",                  # Uppercase
            "lowercase456",                  # Lowercase
            "MiXeDCaSe789",                  # Mixed case
        ]
        
        for place_id in valid_ids:
            try:
                _validate_place_id(place_id)
            except HTTPException as e:
                pytest.fail(f"Valid place_id '{place_id}' was incorrectly rejected: {e.detail}")
    
    def test_path_traversal_blocked_by_allowlist(self):
        """Test that path traversal attempts are blocked by the allowlist."""
        # All of these contain characters NOT in [A-Za-z0-9+=_-]
        # so they're automatically rejected (some fail length, some fail format)
        malicious_ids = [
            "../../../etc/passwd",           # Contains dots and slashes
            "place/../other",                # Contains dots and slashes
            "./local/file",                  # Contains dot and slashes
            "..\\..\\windows\\system32",     # Contains dots and backslashes
            "place/../../file",              # Contains slashes and dots
            "//network/share",               # Contains slashes
            "place\\\\share",                # Contains backslashes
            "..",                            # Dots only (also too short)
            "../",                           # Dots and slash (also too short)
            "/..",                           # Slash and dots (also too short)
            "place..id",                     # Contains dots
        ]
        
        for place_id in malicious_ids:
            with pytest.raises(HTTPException) as exc_info:
                _validate_place_id(place_id)
            # Only assert on status code - error detail may vary (length vs format)
            assert exc_info.value.status_code == 400
    
    def test_url_encoded_attacks_blocked(self):
        """Test that URL-encoded attacks are blocked (% not in allowlist)."""
        # The % character is not in the allowlist, so these are automatically rejected
        encoded_attacks = [
            "%2e%2e%2f%2e%2e%2ffile",  # URL-encoded ../../file
            "%2E%2E%2Ffile",           # URL-encoded ../file (uppercase)
            "%2e%2e/file",             # Mixed encoding
            "place%2f%2fshare",        # URL-encoded place//share
            "%5c%5c",                  # URL-encoded \\ (also too short)
            "%5C%5C",                  # URL-encoded \\ (uppercase, also too short)
            "place%20id",              # URL-encoded space
        ]
        
        for place_id in encoded_attacks:
            with pytest.raises(HTTPException) as exc_info:
                _validate_place_id(place_id)
            # Only assert on status code - error detail may vary
            assert exc_info.value.status_code == 400
    
    def test_special_characters_blocked(self):
        """Test that special characters are blocked by the allowlist."""
        invalid_ids = [
            "place@id",              # @ not in allowlist
            "place id",              # Space not in allowlist (also too short)
            "place/id",              # / not in allowlist (also too short)
            "place\\id",             # \ not in allowlist (also too short)
            "place?id=123",          # ? not in allowlist
            "place#anchor",          # # not in allowlist
            "place;drop",            # ; not in allowlist
            "place&param",           # & not in allowlist
            "place|command",         # | not in allowlist
            "place`whoami`",         # ` not in allowlist
            "place$variable",        # $ not in allowlist
            "place!important",       # ! not in allowlist
            "place*wildcard",        # * not in allowlist
            "place(parens)",         # ( not in allowlist
            "place[brackets]",       # [ not in allowlist
            "place{braces}",         # { not in allowlist
            "place<tag>",            # < not in allowlist (also too short)
            "place'quote",           # ' not in allowlist
            'place"quote',           # " not in allowlist
            "place.dot",             # . not in allowlist (also too short)
            "place:colon",           # : not in allowlist
            "place,comma",           # , not in allowlist
        ]
        
        for place_id in invalid_ids:
            with pytest.raises(HTTPException) as exc_info:
                _validate_place_id(place_id)
            # Only assert on status code - error detail may vary
            assert exc_info.value.status_code == 400
    
    def test_empty_or_none(self):
        """Test that empty or None place IDs are rejected."""
        with pytest.raises(HTTPException) as exc_info:
            _validate_place_id("")
        assert exc_info.value.status_code == 400
        assert "must be a non-empty string" in exc_info.value.detail
        
        with pytest.raises(HTTPException) as exc_info:
            _validate_place_id(None)
        assert exc_info.value.status_code == 400
        assert "must be a non-empty string" in exc_info.value.detail
    
    def test_length_validation(self):
        """Test that place IDs are validated for appropriate length."""
        # Too short
        with pytest.raises(HTTPException) as exc_info:
            _validate_place_id("short")
        assert exc_info.value.status_code == 400
        assert "Invalid place_id length" in exc_info.value.detail
        
        # Too long
        with pytest.raises(HTTPException) as exc_info:
            _validate_place_id("A" * 301)
        assert exc_info.value.status_code == 400
        assert "Invalid place_id length" in exc_info.value.detail
        
        # Boundary cases - should pass
        _validate_place_id("A" * 10)   # Minimum length
        _validate_place_id("A" * 300)  # Maximum length
    
    def test_allowed_special_characters_only(self):
        """Test that ONLY the allowed special characters (+ = _ -) are accepted."""
        valid_ids = [
            "place_with_underscores",
            "place-with-hyphens",
            "place+with+plus",
            "place=with=equals",
            "place_with-mixed+special=chars",
        ]
        
        for place_id in valid_ids:
            try:
                _validate_place_id(place_id)
            except HTTPException as e:
                pytest.fail(f"Valid place_id '{place_id}' was incorrectly rejected: {e.detail}")


class TestGetPlaceDetailsValidation:
    """Integration tests for place_id validation in get_place_details."""
    
    def test_rejects_path_traversal(self):
        """Test that get_place_details rejects path traversal attempts."""
        attacks = [
            "../../../etc/passwd",
            "place/../other",
            "..\\..\\windows",
        ]
        
        for attack in attacks:
            with pytest.raises(HTTPException) as exc_info:
                get_place_details(attack)
            assert exc_info.value.status_code == 400
    
    def test_rejects_url_encoded_attacks(self):
        """Test that get_place_details rejects URL-encoded attacks."""
        attacks = [
            "%2e%2e%2ffile",
            "%2E%2E%2Ffile",
            "%5c%5c",
            "%5C%5C",
        ]
        
        for attack in attacks:
            with pytest.raises(HTTPException) as exc_info:
                get_place_details(attack)
            assert exc_info.value.status_code == 400
    
    def test_rejects_special_characters(self):
        """Test that get_place_details rejects special characters."""
        invalids = [
            "place@invalid",
            "place/slash",
            "place\\backslash",
            "place.dot",
            "place id",  # space
        ]
        
        for invalid in invalids:
            with pytest.raises(HTTPException) as exc_info:
                get_place_details(invalid)
            assert exc_info.value.status_code == 400
    
    def test_accepts_valid_place_id(self, monkeypatch):
        """Test that get_place_details accepts valid place IDs."""
        # Mock the _request function to avoid actual API calls
        def mock_request(*args, **kwargs):
            class MockResponse:
                status_code = 200
                def json(self):
                    return {
                        "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
                        "displayName": {"text": "Test Place"},
                        "formattedAddress": "123 Test St",
                    }
                @property
                def text(self):
                    return "{}"
            return MockResponse()
        
        # Patch the _request function
        import local_places.google_places
        monkeypatch.setattr(local_places.google_places, "_request", mock_request)
        
        # Should not raise exception during validation
        result = get_place_details("ChIJN1t_tDeuEmsRUsoyG83frY4")
        assert result.place_id == "ChIJN1t_tDeuEmsRUsoyG83frY4"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
