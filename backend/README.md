# Reminisce Backend

A FastAPI-based backend for the Reminisce application, designed to facilitate reminiscence therapy for patients with dementia and Alzheimer's. This backend handles user authentication, media management, AI-enhanced photo analysis, and therapy session coordination.

## Features

- **User Management**: Authentication and role-based access for Caregivers, Supporters, and Patients via Supabase Auth.
- **Media Management**: Secure upload and storage of photos with support for captions and tagging.
- **AI Integration**:
  - Image analysis using Google Gemini and LangChain to automatically tag and describe photos.
  - Voice therapy support (planned/in-progress) using AI to prompt memories.
- **Therapy Sessions**: Scheduling and management of personalized photo slideshow sessions.
- **Secure Data**: Row Level Security (RLS) ensures patients' data is private and only accessible by unauthorized family members.

## Technology Stack

- **Language**: Python 3.11+
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **AI/LLM**: [LangChain](https://www.langchain.com/) & [Google Gemini](https://deepmind.google/technologies/gemini/)
- **Validation**: [Pydantic](https://docs.pydantic.dev/)
- **Container**: [Chainguard](https://www.chainguard.dev/) hardened Python images

## Prerequisites

- **Python**: 3.11 or higher
- **Supabase Account**: For database, authentication, and storage services.
- **Google Cloud Account**: For accessing the Gemini API (image analysis and voice therapy).

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and configure the following variables:
   ```ini
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   SUPABASE_SECRET_KEY=your_service_role_key
   GEMINI_API_KEY=your_gemini_api_key
   SECRET_KEY=your_secure_random_secret_key
   ```

## Running the Application

To start the development server with live reloading:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## Recent Accomplishments

- **Dependency Optimization**: Removed redundant Flask and Jinja2 dependencies to focus exclusively on FastAPI.
- **Storage Consolidation**: Standardized all media operations to use a single `patient-photos` bucket, resolving path inconsistencies.
- **Schema Refinement**: Added `revoked_at` to `patient_supporters` and `email` to `profiles` to support full supporter management features.
- **Voice Therapy Protocol**: Implemented a WebSocket-based voice therapy service leveraging Gemini 2.5 Flash for real-time conversation.
- **Schema & RLS Guardrails**: Hardened the database layer with Row Level Security (RLS) to ensure caregivers and supporters have strictly partitioned access.
- **Cleanup & Standardized Logging**: Replaced debug print statements with structured logging and removed redundant health check routes.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch.
5. Open a Pull Request.
