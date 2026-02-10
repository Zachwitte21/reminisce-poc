# Pytest Quick Start Guide

Quick reference for running and writing tests in the Reminisce backend.

---

## Setup (First Time)

```bash
# Install test dependencies
pip install -r requirements-test.txt
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific file
pytest tests/test_auth.py

# Run specific test
pytest tests/test_auth.py::TestRegistration::test_register_caregiver_success

# Stop on first failure
pytest -x

# Show print statements
pytest -s
```

### By Category

```bash
# Run only authentication tests
pytest -m auth

# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Skip slow tests
pytest -m "not slow"
```

### With Coverage

```bash
# Generate coverage report
pytest --cov=app --cov-report=html --cov-report=term

# View HTML report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

### Parallel Execution (Faster)

```bash
# Run tests in parallel
pytest -n auto
```

---

## Writing Tests

### Integration Test Template

```python
# tests/test_example.py
import pytest

class TestEndpoint:
    """Test endpoint description."""

    def test_success_case(
        self,
        client,                      # HTTP client
        override_get_current_user,   # Mock auth
        mock_supabase,               # Mock database
        mock_supabase_response,      # Response factory
        mock_patient,                # Test data
    ):
        """Test successful request."""
        # Setup mock response
        mock_supabase.table.return_value.select.return_value.execute.return_value = (
            mock_supabase_response([mock_patient])
        )

        # Make request
        response = client.get(
            "/api/endpoint",
            headers={"Authorization": "Bearer fake-token"},
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["id"] == mock_patient["id"]
```

### Unit Test Template

```python
# tests/services/test_service.py
import pytest
from unittest.mock import patch

@pytest.mark.unit
class TestService:
    """Test service description."""

    @patch("app.services.service.external_api")
    def test_function_success(self, mock_api):
        """Test service function."""
        from app.services.service import function

        # Setup
        mock_api.call.return_value = {"result": "success"}

        # Execute
        result = function("arg1")

        # Assert
        assert result == "expected"
        mock_api.call.assert_called_once_with("arg1")
```

### Parametrized Test Template

```python
@pytest.mark.parametrize("input,expected", [
    ("valid@email.com", 200),
    ("invalid-email", 422),
    ("", 422),
])
def test_validation(client, input, expected):
    """Test with multiple inputs."""
    response = client.post("/api/validate", json={"email": input})
    assert response.status_code == expected
```

---

## Available Fixtures

### Application
- `test_app` - FastAPI app
- `client` - HTTP test client

### Authentication
- `override_get_current_user` - Mock caregiver auth
- `override_get_current_user_supporter` - Mock supporter auth

### Mock Users
- `mock_caregiver_user` - Caregiver data
- `mock_supporter_user` - Supporter data

### Mock Data
- `mock_patient` - Patient record
- `mock_patient_settings` - Settings
- `mock_media` - Media record
- `mock_media_tag` - Tag record
- `mock_therapy_session` - Session record
- `mock_invitation` - Invitation record

### Mock Services
- `mock_supabase` - Database client
- `mock_gemini_client` - AI client
- `mock_storage_service` - Storage functions
- `mock_email_service` - Email service

### Utilities
- `fake_image_file` - Fake image data
- `valid_uuid` - Valid UUID string
- `fake_jwt_token` - Fake JWT token

---

## Common Patterns

### Test API Endpoint

```python
def test_endpoint(client, override_get_current_user, mock_supabase):
    response = client.post(
        "/api/endpoint",
        json={"key": "value"},
        headers={"Authorization": "Bearer token"},
    )
    assert response.status_code == 200
```

### Test Authorization

```python
def test_unauthorized(client):
    # No auth header
    response = client.get("/api/protected")
    assert response.status_code == 401
```

### Test Validation Error

```python
def test_validation(client, override_get_current_user):
    response = client.post(
        "/api/endpoint",
        json={"invalid": "data"},
        headers={"Authorization": "Bearer token"},
    )
    assert response.status_code == 422
```

### Test File Upload

```python
def test_upload(client, override_get_current_user):
    response = client.post(
        "/api/upload",
        files={"file": ("test.jpg", b"data", "image/jpeg")},
        data={"patient_id": "uuid"},
        headers={"Authorization": "Bearer token"},
    )
    assert response.status_code == 201
```

---

## Debugging Tests

### Run with Debugger

```bash
# Drop into pdb on failure
pytest --pdb

# Drop into pdb on first failure
pytest --pdb -x
```

### Show More Information

```bash
# Show local variables on failure
pytest -l

# Show full traceback
pytest --tb=long

# Show short traceback
pytest --tb=short
```

### Capture Output

```bash
# Show print statements
pytest -s

# Show logging output
pytest --log-cli-level=DEBUG
```

---

## Markers

Mark tests with decorators:

```python
@pytest.mark.auth       # Authentication test
@pytest.mark.media      # Media test
@pytest.mark.unit       # Unit test
@pytest.mark.integration  # Integration test
@pytest.mark.slow       # Slow test (may be skipped)
```

Run specific markers:

```bash
pytest -m auth
pytest -m "unit and media"
pytest -m "not slow"
```

---

## Tips

1. **Run tests before committing**
   ```bash
   pytest -x  # Stop on first failure
   ```

2. **Check coverage regularly**
   ```bash
   pytest --cov=app --cov-report=term-missing
   ```

3. **Use fixtures for common setup**
   - Don't repeat yourself
   - Reuse mock data from conftest.py

4. **Write descriptive test names**
   - `test_<action>_<scenario>_<expected_result>`
   - Example: `test_login_wrong_password_returns_401`

5. **Test edge cases**
   - Empty inputs
   - Invalid data types
   - Missing required fields
   - Boundary conditions

6. **Mock external dependencies**
   - Never hit real APIs in tests
   - Use fixtures for consistent mocks

---

## Common Issues

### Issue: `ModuleNotFoundError`

**Solution**: Run pytest from backend root directory

```bash
cd /path/to/backend
pytest
```

### Issue: Tests pass locally but fail in CI

**Solution**: Check environment variables, use `.env.test`

### Issue: `fixture 'X' not found`

**Solution**: Ensure `conftest.py` exists in `tests/` directory

### Issue: Async test hangs

**Solution**: Ensure `pytest.ini` has `asyncio_mode = auto`

---

## Need Help?

- **Full guide**: See `tests/README.md`
- **Pytest docs**: https://docs.pytest.org/
- **FastAPI testing**: https://fastapi.tiangolo.com/tutorial/testing/
- **Implementation summary**: See `TESTING_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated**: February 4, 2026
