# Instagram Sentiment Platform - Deployment Fix TODO

## Plan: Fix Vercel v1→v2 Migration Render Error
**Status: ✅ APPROVED by user**

### Step 1: [PENDING] Update vercel.json to v2+ format
- Remove deprecated `builds` array  
- Simplify 50+ rewrites → 3 clean rules
- Static frontend + API proxy to Render

### Step 2: [PENDING] Add favicon.ico
- Create 16x16 placeholder PNG
- Fix `/favicon.ico 404` log

### Step 3: [PENDING] Redeploy with cache clear
```bash
vercel --prod
```

### Step 4: [PENDING] Verify
- ✅ No "Legacy build" warnings
- ✅ Dashboard renders (no 404)
- ✅ API proxy works (`/api/health`)
- ✅ Favicon loads

**Next:** Execute Step 1 after tool result → Update progress

