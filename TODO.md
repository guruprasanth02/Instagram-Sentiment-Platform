# Hybrid Deploy: Frontend Vercel (Static + Proxy) + Backend Render (Flask API)

Status: Files Ready (Step 2 ✅)

## Backend Render (Step 1-3)
- [ ] 1. Push entire repo to GitHub main branch
  Command: `git init & git add . & git commit -m \"Deploy\" & git remote add origin YOUR_GITHUB_REPO & git push -u origin main`
- [x] 2. Deploy backend to Render.com (Web Service, Python)
  - Build: `pip install -r requirements.txt & python -c \"import nltk; nltk.download('stopwords wordnet omw-1.4')\" & python ml/train_model.py`
  - Start: `python backend/app.py`
  - Env: `SECRET_KEY=sk-...`
  - Get Backend URL: https://YOUR_APP.onrender.com
- [ ] 3. Test backend: `curl https://YOUR_APP.onrender.com/health` → {\"status\":\"model loaded\"}

## Frontend Vercel (Step 4-6)
- [ ] 4. Update vercel.json with your Backend URL (created below)
- [ ] 5. Install Vercel CLI: `npm i -g vercel`
- [ ] 6. Login & deploy: `vercel login` then `vercel --prod`
  Gets Frontend URL: https://YOUR_VERCEL.vercel.app
  API calls auto-proxy to backend!

## Test (Step 7)
- [ ] 7. Visit Frontend → Analyze → Should hit backend ML

**Notes:**
- No code changes needed!
- Proxy /api/* → Backend
- Free tiers ok for demo (Render SQLite resets on sleep)

