🛡️ LeakLock: Stop Secrets Before They Leak
Hardcoded secrets are a leading cause of massive data breaches. LeakLock is a developer-first security tool that detects exposed API keys, database credentials, and tokens in your local repositories before they are accidentally committed to version control.

[Screenshot Placeholder] ![LeakLock Dashboard](./demo-assets/dashboard-screenshot.png)

⚡ Core Features & Tech Stack
LeakLock transforms raw security data into actionable, developer-friendly insights:

Instant Local Scanning: Scans repositories in seconds without uploading your code to the cloud.

Smart Risk Scoring: A custom algorithm that analyzes findings in context (e.g., lowering the threat level for dummy keys in test files).

Pre-Commit Protection: A Git hook that actively blocks developers from committing critical secrets.

The Stack: React / Vite / Tailwind (Frontend) powered by a lean FastAPI / SQLite (Backend).

🚀 Quick Start Guide
Prerequisites: You must have Python 3.9+, Node.js, and the Gitleaks CLI installed on your system.

1. Fire up the Backend:

Bash
cd backend
python -m venv venv
venv\Scripts\activate   # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
2. Launch the Frontend:

Bash
cd frontend
npm install
npm run dev
🎯 Demo Flow & Attribution
To present this to the judges:

Point the scanner at the included demo-vulnerable-project folder and click Scan.

Show off the real-time compliance dashboard and the data table of masked findings.

Run git commit on a fake AWS key to prove the pre-commit hook actually stops the leak in its tracks.
