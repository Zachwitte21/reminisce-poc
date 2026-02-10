# tests/test_health.py
"""
Tests for health check router (app/routers/health.py).

Coverage:
- Health check endpoint (no authentication required)
"""

import pytest


class TestHealthCheck:
    """Test health check endpoint."""

    def test_health_check_success(self, client):
        """Test health check returns 200 OK."""
        response = client.get("/api/health/")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    def test_health_check_no_auth_required(self, client):
        """Test health check is accessible without authentication."""
        # No Authorization header
        response = client.get("/api/health/")

        assert response.status_code == 200
