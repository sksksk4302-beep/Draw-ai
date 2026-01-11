# Magic Sketchbook

Magic Sketchbook is a PWA that turns children's drawings into 3D rendered images using Google Cloud Vertex AI.

## Project Structure

- `frontend/`: React + Vite + Tailwind CSS + PWA
- `backend/`: FastAPI + Vertex AI (Python)

## Prerequisites

- Node.js & npm
- Python 3.9+
- Google Cloud Project with Vertex AI API enabled
- `gcloud` CLI authenticated

## Setup & Run

### Backend

1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set environment variables (Linux/Mac):
   ```bash
   export GOOGLE_CLOUD_PROJECT=your-project-id
   export GOOGLE_CLOUD_LOCATION=us-central1
   ```
   (Windows PowerShell):
   ```powershell
   $env:GOOGLE_CLOUD_PROJECT="your-project-id"
   $env:GOOGLE_CLOUD_LOCATION="us-central1"
   ```
4. Run the server:
   ```bash
   uvicorn main:app --reload --port 8080
   ```

### Frontend

1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` on your tablet or browser.

## Deployment

### Backend (Cloud Run)

```bash
cd backend
gcloud run deploy magic-sketchbook-backend --source . --region us-central1 --allow-unauthenticated
```

### Frontend (Firebase Hosting)

1. Build the app:
   ```bash
   npm run build
   ```
2. Initialize Firebase:
   ```bash
   firebase init hosting
   ```
3. Deploy:
   ```bash
   firebase deploy
   ```

## Features

- **Draw Mode**: Draw directly on the screen with touch support.
- **Camera Mode**: Take a picture of a drawing on paper.
- **Magic**: Converts the drawing to a 3D Pixar-style character.
- **PWA**: Installable on home screen, works offline (UI only).
