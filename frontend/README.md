# Reminisce Frontend

Reminisce is a specialized reminiscence therapy application designed for dementia and Alzheimer's patients, caregivers, and family members. It facilitates photo-based therapy sessions with AI voice assistance to help preserve and celebrate memories.

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *Required:* `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

3. **Run for Web**
   ```bash
   npx expo start --web -c
   ```

4. **Run for Mobile** (Native Development)
   - Scan the QR code with [Expo Go](https://expo.dev/go)
   - Press `i` for iOS Simulator or `a` for Android Emulator

## 📱 Key Features

- **Caregiver Tools:** Patient profile management, therapy scheduling, and photo organization.
- **Therapy Sessions:** Immersive full-screen slideshows with AI-curated photo queues.
- **Family Contribution:** Secure invitation system for family members to upload and tag personal photos.
- **AI Voice Therapy:** (Future/In-Progress) Real-time conversation assistance using Gemini 2.5 Flash.
- **Modern Design:** High-contrast, accessibility-first UI tailored for cognitive impairment and senior users.

## 🛠 Tech Stack

- **Framework:** Expo SDK 54 / React Native
- **Runtime:** Expo Router (File-based routing)
- **State:** Zustand with persistence
- **Backend:** Supabase (Auth, DB, Storage)
- **AI Integration:** Google Gemini Multimodal Live API
- **Theming:** Custom theme system with accessibility focus

## 📂 Project Structure

- `app/`: Expo Router screens and navigation layouts.
- `src/components/`: Reusable UI elements (Buttons, Cards) and feature-specific components.
- `src/hooks/`: Custom React hooks, including `useTheme`.
- `src/services/`: API client and Supabase configuration.
- `src/stores/`: Zustand state management for auth, patients, and therapy.
- `src/theme/`: Comprehensive design system (Colors, Typography, Layout, Spacing).

## 📄 Documentation

For detailed technical documentation, architectural patterns, and development guides, see:
- [gemini.md](./gemini.md) - Deep dive for developers and AI assistants.
- [!planning/](./!planning/) - Project requirements, technical specs, and build guides.

---

Built with ❤️ for better memory care.
