
    __               __   __               __    
   / /   ___  ____ _/ /__/ /   ____  _____/ /__  
  / /   / _ \/ __ `/ //_/ /   / __ \/ ___/ //_/  
 / /___/  __/ /_/ / ,< / /___/ /_/ / /__  ,<     
/_____/\___/\__,_/_/|_/_____/\____/\___/_/|_|    
                                                 
***>> [ 𝗦𝗧𝗢𝗣 𝗦𝗘𝗖𝗥𝗘𝗧𝗦 𝗕𝗘𝗙𝗢𝗥𝗘 𝗧𝗛𝗘𝗬 𝗟𝗘𝗔𝗞 ] <<***

Hardcoded secrets are a leading cause of massive data breaches. LeakLock is a developer-first security tool that detects exposed API keys, database credentials, and tokens in your local repositories before they are accidentally committed to version control.

**⚡ 𝗖𝗢𝗥𝗘 𝗙𝗘𝗔𝗧𝗨𝗥𝗘𝗦 & 𝗦𝗧𝗔𝗖𝗞**
LeakLock transforms raw security data into actionable, developer-friendly insights:

🔎 Instant Local Scanning: Scans repositories in seconds without uploading your code to the cloud.

🧠 Smart Risk Scoring: A custom algorithm that analyzes findings in context (e.g., lowering the threat level for dummy keys in test files).

🛡️ Pre-Commit Protection: A Git hook that actively blocks developers from committing critical secrets.

💻 The Stack: React / Vite / Tailwind (Frontend) powered by a lean FastAPI / SQLite (Backend).

**🚀 𝗤𝗨𝗜𝗖𝗞 𝗦𝗧𝗔𝗥𝗧 𝗚𝗨𝗜𝗗𝗘**
Prerequisites: You must have Python 3.9+, Node.js, and the Gitleaks CLI installed on your system.

>_ INITIALIZE BACKEND
Bash
cd backend
python -m venv venv
venv\Scripts\activate   # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
>_ INITIALIZE FRONTEND
Bash
cd frontend
npm install
npm run dev
🎯 𝗗𝗘𝗠𝗢 𝗙𝗟𝗢𝗪 (𝗙𝗼𝗿 𝗧𝗵𝗲 𝗝𝘂𝗱𝗴𝗲𝘀)
Point the LeakLock scanner at the included demo-vulnerable-project folder and click Scan.

Show off the real-time compliance dashboard and the data table of masked findings.

Run git commit on a fake AWS key to prove the pre-commit hook actually stops the leak in its tracks.
