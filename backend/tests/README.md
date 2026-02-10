# Reminisce Backend - Test Suite

This directory contains comprehensive pytest tests for the Reminisce backend API.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Fixtures](#fixtures)
- [Coverage](#coverage)
- [Continuous Integration](#continuous-integration)

---

## Overview

The test suite provides comprehensive coverage of:

- **Authentication & Authorization**: User registration, login, JWT validation, role-based access control
- **API Endpoints**: All 8 routers (auth, patients, media, therapy, invitations, voice, health, logs)
- **Services**: AI service, storage service, email service, invitations service
- **Validation**: Pydantic schemas, field validators, data sanitization
- **Business Logic**: Patient access control, media approval workflows, therapy sessions

**Testing Approach**:
- Integration tests for API endpoints (using FastAPI TestClient)
- Unit tests for services and utilities
- Mocked external dependencies (Supabase, Gemini AI, Resend)
- Pytest fixtures for reusable test data

**Coverage Goal**: 80%+ overall, 100% for critical paths (auth, patient data access)

---

## Test Structure

```
tests/
├── conftest.py                  # Shared fixtures (app, client, mocks)
├── test_auth.py                 # Authentication router tests
├── test_patients.py             # Patients router tests
├── test_media.py                # Media router tests
├── test_therapy.py              # Therapy router tests
├── test_invitations.py          # Invitations router tests
├── test_voice.py                # Voice router tests
├── test_health.py               # Health check tests
├── services/
│   ├── conftest.py              # Service-specific fixtures
│   ├── test_ai_service.py       # AI service unit tests
│   ├── test_storage_service.py  # Storage service unit tests
│   ├── test_invitations_service.py
│   └── test_email_service.py
└── utils/
    ├── test_dependencies.py     # Auth/authz unit tests
    └── test_validators.py       # Schema validation tests
```

---

## Running Tests

### Prerequisites

Install test dependencies:

```bash
pip install -r requirements-test.txt
```

Required packages:
- `pytest` - Test framework
- `pytest-asyncio` - Async test support
- `pytest-cov` - Coverage reporting
- `pytest-mock` - Mocking utilities
- `httpx` - TestClient async support
- `faker` - Test data generation

### Run All Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Stop on first failure
pytest -x

# Run in parallel (faster)
pytest -n auto
```

### Run Specific Tests

```bash
# Run specific test file
pytest tests/test_auth.py

# Run specific test class
pytest tests/test_auth.py::TestRegistration

# Run specific test function
pytest tests/test_auth.py::TestRegistration::test_register_caregiver_success

# Run tests with specific marker
pytest -m auth          # Authentication tests
pytest -m media         # Media tests
pytest -m integration   # Integration tests
pytest -m unit          # Unit tests
```

### Run with Coverage

```bash
# Generate coverage report
pytest --cov=app --cov-report=html --cov-report=term

# View HTML coverage report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

**Coverage Report Includes**:
- Line coverage percentage per file
- Missing lines highlighted
- Branch coverage (if/else paths)
- HTML report with source code visualization

---

## Writing Tests

### Test Naming Convention

**Pattern**: `test_<action>_<scenario>_<expected_result>`

Examples:
- `test_register_caregiver_success`
- `test_login_wrong_password`
- `test_upload_photo_invalid_patient`
- `test_create_invitation_supporter_forbidden`

### Integration Test Pattern (API Endpoints)

```python
import pytest
from unittest.mock import MagicMock

class TestEndpoint:
    """Test description."""

    def test_endpoint_success(
        self,
        client,                      # FastAPI TestClient
        override_get_current_user,   # Auth override
        mock_supabase,               # Mocked Supabase client
        mock_supabase_response,      # Response factory
        mock_patient,                # Test data
    ):
        """Test successful request."""
        # 1. Setup: Configure mock responses
        mock_supabase.table.return_value.select.return_value.execute.return_value = (
            mock_supabase_response([mock_patient])
        )

        # 2. Execute: Make HTTP request
        response = client.post(
            "/api/endpoint",
            json={"data": "value"},
            headers={"Authorization": "Bearer fake-token"},
        )

        # 3. Assert: Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["field"] == "expected_value"
```

### Unit Test Pattern (Services)

```python
import pytest
from unittest.mock import patch

@pytest.mark.unit
class TestService:
    """Test service description."""

    @patch("app.services.service_name.external_api")
    def test_service_function_success(self, mock_api):
        """Test service function with mocked dependency."""
        from app.services.service_name import function_name

        # 1. Setup: Configure mocks
        mock_api.call.return_value = {"result": "success"}

        # 2. Execute: Call service function
        result = function_name(arg1, arg2)

        # 3. Assert: Verify result and mock calls
        assert result == "expected"
        mock_api.call.assert_called_once_with(arg1, arg2)
```

### Parametrized Tests

Use `@pytest.mark.parametrize` to test multiple scenarios:

```python
@pytest.mark.parametrize("role,expected_status", [
    ("caregiver", 200),
    ("supporter", 403),
])
def test_endpoint_authorization(client, role, expected_status):
    """Test different roles."""
    # Test implementation
```

### Async Tests

Mark async tests with `@pytest.mark.asyncio`:

```python
@pytest.mark.asyncio
async def test_async_function():
    """Test async function."""
    result = await some_async_function()
    assert result is not None
```

---

## Fixtures

### Global Fixtures (tests/conftest.py)

**Application Fixtures**:
- `test_app` - FastAPI application instance
- `client` - TestClient for HTTP requests

**Mock User Fixtures**:
- `mock_caregiver_user` - Caregiver user data
- `mock_supporter_user` - Supporter user data
- `mock_auth_user` - Supabase auth user object

**Mock Database Fixtures**:
- `mock_patient` - Patient record
- `mock_patient_settings` - Patient settings
- `mock_media` - Media record
- `mock_media_tag` - Media tag
- `mock_therapy_session` - Therapy session
- `mock_invitation` - Invitation record

**Mock Services**:
- `mock_supabase` - Mocked Supabase client (database, auth, storage)
- `mock_gemini_client` - Mocked Gemini AI client
- `mock_storage_service` - Mocked storage functions
- `mock_email_service` - Mocked Resend email service

**Authentication Overrides**:
- `override_get_current_user` - Mock caregiver authentication
- `override_get_current_user_supporter` - Mock supporter authentication

**Utility Fixtures**:
- `fake_image_file` - Fake image for upload testing
- `fake_large_image_file` - Large image for compression testing
- `valid_uuid` - Valid UUID string
- `invalid_uuid` - Invalid UUID string

### Using Fixtures in Tests

```python
def test_example(client, mock_supabase, mock_patient):
    """Fixtures are automatically injected by pytest."""
    # Use fixtures in test
    response = client.get(f"/api/patients/{mock_patient['id']}")
    assert response.status_code == 200
```

### Creating Custom Fixtures

```python
@pytest.fixture
def my_custom_fixture():
    """Custom fixture description."""
    # Setup
    data = {"key": "value"}

    # Return fixture value
    yield data

    # Teardown (optional)
    # cleanup code
```

---

## Coverage

### Current Coverage Status

Run to generate latest report:

```bash
pytest --cov=app --cov-report=term-missing
```

**Coverage Goals**:
- **Critical paths** (auth, patient access): 100%
- **High priority** (media, therapy): 90%+
- **Medium priority** (AI services, invitations): 80%+
- **Low priority** (health checks, logging): 60%+
- **Overall**: 80%+

### Coverage Report Interpretation

```
Name                      Stmts   Miss  Cover   Missing
-------------------------------------------------------
app/main.py                  45      2    96%   78-79
app/routers/auth.py         120      5    96%   45, 67, 89, 102, 115
app/services/ai_service.py   80     15    81%   23-25, 45-50, 78-82
-------------------------------------------------------
TOTAL                       500     40    92%
```

**Metrics**:
- **Stmts**: Total statements in file
- **Miss**: Uncovered statements
- **Cover**: Coverage percentage
- **Missing**: Line numbers not covered

### Improving Coverage

1. **Identify gaps**: Run `pytest --cov=app --cov-report=html`
2. **Review HTML report**: Open `htmlcov/index.html`
3. **Add tests for missing lines**: Focus on uncovered branches
4. **Prioritize**: Critical paths > High traffic > Edge cases

---

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-test.txt

      - name: Run tests with coverage
        run: |
          pytest --cov=app --cov-report=xml --cov-report=term

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          fail_ci_if_error: true
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Run tests before allowing commit

echo "Running tests..."
pytest -x

if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi

echo "All tests passed!"
```

Make executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## Test Markers

Tests are organized with pytest markers for selective running:

- `@pytest.mark.auth` - Authentication/authorization tests
- `@pytest.mark.media` - Media-related tests
- `@pytest.mark.ai` - AI service tests
- `@pytest.mark.integration` - Integration tests (API endpoints)
- `@pytest.mark.unit` - Unit tests (services, utilities)
- `@pytest.mark.slow` - Slow-running tests (optional skip)

**Run specific marker**:

```bash
pytest -m auth           # Only auth tests
pytest -m "not slow"     # Skip slow tests
pytest -m "unit and ai"  # Unit tests for AI service
```

---

## Troubleshooting

### Common Issues

**Issue**: `ModuleNotFoundError: No module named 'app'`

**Solution**: Run pytest from backend root directory:

```bash
cd /path/to/backend
pytest
```

**Issue**: `RuntimeError: Event loop is closed` (async tests)

**Solution**: Ensure `pytest.ini` has:

```ini
[pytest]
asyncio_mode = auto
```

**Issue**: Tests pass locally but fail in CI

**Solution**: Check environment variables, use `.env.test` for CI-specific config

**Issue**: `fixture 'mock_supabase' not found`

**Solution**: Ensure `conftest.py` is in `tests/` directory and contains fixture

### Debugging Tests

```bash
# Run with pdb debugger
pytest --pdb

# Drop into debugger on failure
pytest --pdb -x

# Print stdout/stderr
pytest -s

# Show local variables on failure
pytest -l
```

---

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (APIs, databases)
3. **Clarity**: Use descriptive test names and docstrings
4. **Coverage**: Aim for high coverage, but prioritize critical paths
5. **Speed**: Keep tests fast (mock, don't hit real APIs)
6. **Maintainability**: Use fixtures to avoid duplication
7. **Documentation**: Add docstrings explaining what's being tested

---

## Future Enhancements

- **Integration tests with real test database** (Supabase test project)
- **End-to-end tests** with Playwright/Selenium
- **Load testing** with Locust
- **Mutation testing** with `mutmut`
- **Contract testing** for API versioning
- **Security testing** (SQL injection, XSS, CSRF)
- **Performance benchmarking**

---

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [Coverage.py](https://coverage.readthedocs.io/)

---

**Last Updated**: January 2025
**Test Suite Version**: 1.0.0
**Backend Version**: 1.0.0
