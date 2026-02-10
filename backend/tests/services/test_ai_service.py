# tests/services/test_ai_service.py
"""
Unit tests for AI service (app/services/ai_service.py).

Coverage:
- Image analysis via LangChain + Gemini
- JSON response parsing
- Error handling (API failures)
- Code fence stripping
"""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


@pytest.mark.unit
@pytest.mark.ai
class TestImageAnalysis:
    """Test AI image analysis functionality."""

    @patch("app.services.ai_service.llm")
    async def test_analyze_image_success(self, mock_llm):
        """Test successful image analysis with structured response."""
        from app.services.ai_service import analyze_image

        mock_response = MagicMock()
        mock_response.content = json.dumps({
            "people": ["elderly woman, ~80"],
            "setting": "Park",
            "mood": "happy",
            "objects": ["bench", "tree"],
            "exact_date_estimate": None,
        })
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        result = await analyze_image(b"fake_image_data")

        assert "people" in result
        assert isinstance(result["people"], list)
        assert "setting" in result
        assert "mood" in result
        assert "objects" in result
        mock_llm.ainvoke.assert_called_once()

    @patch("app.services.ai_service.llm")
    async def test_analyze_image_parse_tags(self, mock_llm):
        """Test parsing structured JSON response from AI."""
        from app.services.ai_service import analyze_image

        mock_response = MagicMock()
        mock_response.content = json.dumps({
            "people": ["John Doe, male, ~45"],
            "setting": "Central Park",
            "mood": "joyful",
            "objects": ["bicycle", "flowers"],
            "exact_date_estimate": "Summer 2020",
        })
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        result = await analyze_image(b"fake_image_data")

        assert result["people"] == ["John Doe, male, ~45"]
        assert result["setting"] == "Central Park"
        assert result["exact_date_estimate"] == "Summer 2020"

    @patch("app.services.ai_service.llm")
    async def test_analyze_image_api_error(self, mock_llm):
        """Test error handling when AI API fails."""
        from app.services.ai_service import analyze_image

        mock_llm.ainvoke = AsyncMock(side_effect=Exception("API rate limit exceeded"))

        with pytest.raises(Exception) as exc_info:
            await analyze_image(b"fake_image_data")

        assert "rate limit" in str(exc_info.value).lower()

    @patch("app.services.ai_service.llm")
    async def test_analyze_image_empty_response(self, mock_llm):
        """Test handling of empty AI response -- falls back to raw_analysis."""
        from app.services.ai_service import analyze_image

        mock_response = MagicMock()
        mock_response.content = ""
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        result = await analyze_image(b"fake_image_data")

        # Empty response triggers JSONDecodeError -> returns raw_analysis fallback
        assert "raw_analysis" in result

    @patch("app.services.ai_service.llm")
    async def test_analyze_image_code_fence_stripping(self, mock_llm):
        """Test handling of JSON response wrapped in code fences."""
        from app.services.ai_service import analyze_image

        mock_response = MagicMock()
        mock_response.content = '```json\n{"people": ["woman, ~70"], "setting": "Beach", "mood": "relaxed", "objects": ["umbrella"], "exact_date_estimate": null}\n```'
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)

        result = await analyze_image(b"fake_image_data")

        # Should strip code fences and parse JSON correctly
        assert result["setting"] == "Beach"
        assert result["mood"] == "relaxed"
        assert result["people"] == ["woman, ~70"]


