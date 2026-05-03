# 🌤 WeatherIQ — Full-Stack Weather Intelligence App

> **PM Accelerator — AI Engineer Intern Technical Assessment (Full Stack)**  
> Built by: JOSEPH ADEABAH 

---

## 🎯 Overview

WeatherIQ is a full-stack weather intelligence platform that combines real-time weather data, geographic insights, smart contextual analysis, and a complete CRUD data persistence layer — all wrapped in a sleek, responsive interface.

**Assessment completed: Tech Assessment #1 (Frontend) + Tech Assessment #2 (Backend/Full Stack)**

---

## ✅ Features Implemented

### Frontend (Tech Assessment #1)
| Feature | Status |
|---|---|
| Location search (city, ZIP, GPS coords, landmark) | ✅ |
| Current weather with detailed stats | ✅ |
| GPS auto-locate | ✅ |
| Weather icons & visual design | ✅ |
| 5-day forecast | ✅ |
| Error handling (city not found, API fail) | ✅ |
| Responsive design (mobile/tablet/desktop) | ✅ |
| Dynamic sky backgrounds per weather condition | ✅ |
| Smart contextual insights (UV, wind warnings, etc.) | ✅ |

### Backend (Tech Assessment #2)
| Feature | Status |
|---|---|
| FastAPI RESTful API | ✅ |
| MongoDB NoSQL database | ✅ |
| CREATE — save location + date range + weather | ✅ |
| READ — retrieve all/individual records | ✅ |
| UPDATE — edit records with re-validation | ✅ |
| DELETE — remove records | ✅ |
| Input validation (dates, location geocoding) | ✅ |
| YouTube API integration | ✅ |
| Google Maps / OpenStreetMap embed | ✅ |
| Export: JSON, CSV, XML, Markdown | ✅ |
| CORS, error handling, fuzzy location match | ✅ |

---

## 🛠 Tech Stack

```
Frontend:   Next.js 14 (React) + Tailwind CSS
Backend:    Python + FastAPI + Uvicorn
Database:   MongoDB (via pymongo)
APIs:       OpenWeatherMap, YouTube Data v3, Google Maps Embed
Deployment: Docker Compose
```

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended)

1. Clone the repo:
```bash
git clone https://github.com/yourusername/weatheriq.git
cd weatheriq
```

2. Create a `.env` file in the root:
```bash
WEATHER_API_KEY=your_openweathermap_key
YOUTUBE_API_KEY=your_youtube_key        # optional
MAPS_API_KEY=your_google_maps_key       # optional
```

3. Run everything:
```bash
docker-compose up --build
```

4. Open:
- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs

---

### Option B: Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in env vars
cp .env.example .env
# Edit .env with your API keys

# Make sure MongoDB is running locally
# Then start:
uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install
npm install

# Configure
cp .env.local.example .env.local
# Edit .env.local

# Run dev server
npm run dev
```

---

## 🔑 API Keys Needed

| Key | Required | Get it |
|---|---|---|
| `WEATHER_API_KEY` | ✅ Yes | [openweathermap.org/api](https://openweathermap.org/api) — free tier |
| `YOUTUBE_API_KEY` | Optional | [Google Cloud Console](https://console.cloud.google.com) → YouTube Data API v3 |
| `MAPS_API_KEY` | Optional | [Google Cloud Console](https://console.cloud.google.com) → Maps Embed API |

> **Note:** Without YouTube/Maps keys, the app gracefully falls back to OpenStreetMap links.

---

## 📡 API Reference

### Weather Endpoints
```
GET /api/weather/full?location={query}   — Full weather + forecast + videos
GET /api/weather/current?location={query} — Current weather only
GET /api/weather/forecast?location={query} — 5-day forecast
```

### CRUD Endpoints
```
POST   /api/records              — Create record
GET    /api/records              — List all records
GET    /api/records/{id}         — Get one record
PUT    /api/records/{id}         — Update record
DELETE /api/records/{id}         — Delete record
```

### Export Endpoints
```
GET /api/export/json
GET /api/export/csv
GET /api/export/xml
GET /api/export/markdown
```

Interactive docs: **http://localhost:8000/docs**

---

## 📁 Project Structure

```
weather-app/
├── backend/
│   ├── main.py              # FastAPI app — all routes
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx         # Main app (Weather + Records + Export)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.local.example
├── docker-compose.yml
└── README.md
```

---

## 🧠 Design Decisions

- **MongoDB** chosen for its flexible document model — weather data has variable structure across locations
- **FastAPI** for auto-generated OpenAPI docs and async performance
- **Geocoding fallback chain:** ZIP code → GPS coords → city/landmark name
- **Graceful degradation:** YouTube/Maps are optional; app fully works without them
- **Smart weather insights:** The app flags dangerous conditions (extreme heat, low visibility, high winds, low pressure) to surface non-obvious risks to the user

---

## 🎥 Demo Video

[Link to demo video — Google Drive / YouTube / Vimeo]

---

## 📝 About PM Accelerator

[Product Manager Accelerator](https://www.linkedin.com/school/pmaccelerator/posts/?feedView=all/) helps aspiring product managers break into the field through mentorship, real-world projects, and a community of PMs across the industry. Their programs bridge the gap between education and hands-on product management experience.

---

*Built with ❤️ for the PM Accelerator AI Engineer Intern Technical Assessment*
