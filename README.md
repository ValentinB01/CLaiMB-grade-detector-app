# 🧗‍♂️ CLaiMB

> An intelligent, AI-powered mobile application designed to help rock climbers analyze routes, estimate grades, and receive personalized coaching simply by taking a photo of the climbing wall.

## 📖 Overview

ClAImb is built for climbers who want to push their limits. By leveraging advanced Vision AI (Claude Sonnet Vision / Roboflow), the app analyzes user-uploaded photos of climbing walls to detect holds, suggest route grades, and act as a digital climbing coach. 

The system uses a modern **Service-Oriented Architecture (SOA)** with a React Native frontend and a scalable FastAPI backend running asynchronous background workers.

## ✨ Key Features

* **Intelligent Route Analysis:** Snap a photo of a wall, and the AI will analyze the hold types, wall angle, and route path.
* **Automated Grade Detection:** Get an estimated difficulty grade for unmarked or newly set gym routes.
* **AI Beta & Coaching:** Receive smart tips on how to approach the route based on the visual layout.
* **Climbing History:** Track your analyzed routes, past grades, and personal progression over time.

## 🛠 Tech Stack

**Frontend:**
* React Native (Expo)
* TypeScript

**Backend:**
* Python 3.x
* FastAPI (Service-Oriented Architecture)
* Celery & Redis (Asynchronous background task processing)
* AI/ML: Claude Vision / Roboflow integration

## 📂 Project Architecture

The repository is divided into two main environments:

```text
├── frontend/                 # React Native Expo application
│   ├── app/                  # Expo Router file-based navigation
│   ├── components/           # Reusable UI components
│   └── utils/                # State management and API fetching
│
└── backend/                  # FastAPI Python application
    ├── routes/               # API endpoint definitions
    ├── services/             # Core business logic (Vision, Grading)
    ├── models/               # Database schemas and Pydantic models
    ├── tasks.py & worker.py  # Asynchronous job processing (Celery)
    └── server.py             # FastAPI application entry point
