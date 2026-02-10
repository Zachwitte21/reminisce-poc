# tests/services/conftest.py
"""
Service-specific fixtures for unit testing services.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def mock_image_bytes():
    """Generate fake image bytes for testing."""
    return b"fake_image_data" * 1000  # ~15KB


@pytest.fixture
def mock_gemini_response():
    """Factory for creating mock Gemini API responses."""
    def _create_response(text: str):
        response = MagicMock()
        response.text = text
        return response
    return _create_response
