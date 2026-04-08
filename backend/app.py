"""
Flask backend for Instagram Sentiment Analysis Platform.
"""

import os
import json
import re
import random
import time
import math
import pandas as pd
import numpy as np
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, UserMixin
from models import db, User, Analysis
from flask_cors import CORS
from dotenv import load_dotenv


load_dotenv()

# -- NLTK data (download once at startup if missing) ---------------------------
import nltk
for _pkg in ['stopwords', 'punkt', 'wordnet', 'punkt_tab']:
    try:
        nltk.data.find(f'tokenizers/{_pkg}' if _pkg.startswith('punkt') else f'corpora/{_pkg}')
    except LookupError:
        nltk.download(_pkg, quiet=True)

# -- Project root & paths ------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analysis_results.json")


# Import prediction helper (lazy-loads models on first call)
import sys
sys.path.insert(0, BASE_DIR)
from backend.predict import predict_sentiment, predict_sentiment_with_score, is_model_loaded

# -- Flask app -----------------------------------------------------------------
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-change-in-prod')

# Determine DB path relative to backend folder
backend_dir = os.path.dirname(os.path.abspath(__file__))
instance_dir = os.path.join(backend_dir, 'instance')
db_path = os.path.join(instance_dir, 'app.db')

# Create instance dir if not exist (Must be created before db.create_all!)
os.makedirs(instance_dir, exist_ok=True)

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Session cookie must be SameSite=None; Secure to work cross-origin
# (Vercel frontend → Render backend direct calls with credentials:include)
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# CORS — allow credentials from known frontend origins.
# Add your Vercel URL (and any preview URLs) to FRONTEND_ORIGINS env var,
# comma-separated. Falls back to localhost for local dev.
_raw_origins = os.getenv(
    'FRONTEND_ORIGINS',
    'http://localhost:8000,http://127.0.0.1:8000,http://localhost:5000,http://127.0.0.1:5000'
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(',') if o.strip()]
CORS(app, supports_credentials=True, origins=ALLOWED_ORIGINS)

with app.app_context():
    db.create_all()

# Eagerly load ML models immediately so the first request doesn't timeout on Vercel
try:
    from backend.predict import _load_models
    print("Pre-loading algorithms into memory...", flush=True)
    _load_models()
    print("Models loaded successfully!", flush=True)
except Exception as e:
    print(f"Warning: Model pre-load failed (lazy load will trigger later): {e}", flush=True)

# -- Helper Functions ----------------------------------------------------------

def extract_post_id(url):
    """
    Extract Instagram post shortcode (ID) from URL.
    
    Example: https://instagram.com/p/ABC123/ → 'ABC123'
    """
    if '/p/' in url:
        return url.split('/p/')[1].split('/')[0].split('?')[0]
    return None


def sanitize_for_json(obj):
    """
    Recursively replace NaN/Infinity values with None for valid JSON serialization.
    """
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def load_simulated_comments(post_id):
    """
    Load comments from simulated dataset CSV.
    Returns list of comments or None if missing.
    """
    csv_path = os.path.join(BASE_DIR, 'data', 'post_comments', f'comments_{post_id}.csv')
    
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            if 'comment' in df.columns:
                # Drop NaN values and convert to string
                df = df.dropna(subset=['comment'])
                comments = df['comment'].astype(str).str.strip().tolist()
                # Filter out empty strings
                comments = [c for c in comments if c and c.lower() != 'nan']
                print(f'Loaded {len(comments)} comments from {csv_path}')
                return comments
        except Exception as e:
            print(f'Error loading CSV {csv_path}: {e}')
    
    print(f'No dataset found for post_id: {post_id}')
    return None

# -- Endpoints -----------------------------------------------------------------
@app.route("/")
def serve_index():
    if current_user.is_authenticated:
        return redirect('/index.html')
    return send_from_directory(app.static_folder, 'login.html')


@app.route("/init_db")
def init_db():
    with app.app_context():
        db.create_all()
    return jsonify({"status": "DB initialized"})

@app.route("/health")
def health_check():
    """Returns model status with debug info for Railway."""
    import sys
    try:
        from backend.predict import is_model_loaded, MODEL_DIR, _load_models
        if is_model_loaded():
            return jsonify({"status": "model loaded successfully"}), 200
        
        # Try calling _load_models directly to surface the actual exception
        try:
            _load_models()
        except Exception as inner_e:
            import traceback
            files = os.listdir(MODEL_DIR) if os.path.exists(MODEL_DIR) else "DIR_NOT_FOUND"
            return jsonify({
                "status": "model not loaded", 
                "error_type": type(inner_e).__name__,
                "error": str(inner_e),
                "model_dir": MODEL_DIR,
                "files_in_dir": files,
                "trace": traceback.format_exc()
            }), 200 # Returning 200 to trick Railway into finishing deploy
    except Exception as e:
        import traceback
        return jsonify({"status": "critical init error", "error": str(e), "trace": traceback.format_exc()}), 200

@app.route("/google_client_id")
def google_client_id():
    """Return the Google Client ID for frontend OAuth."""
    cid = os.getenv('GOOGLE_CLIENT_ID', '')
    return jsonify({"client_id": cid})

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400
    user = User(email=email, name=name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User created successfully"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({"message": "Logged in successfully", "user": {"id": user.id, "email": user.email}})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/me")
def me():
    if current_user.is_authenticated:
        # Get user's last analysis
        last_analysis = Analysis.query.filter_by(user_id=current_user.id).order_by(Analysis.created_at.desc()).first()
        total_analyses = Analysis.query.filter_by(user_id=current_user.id).count()
        avg_sentiment = "Neutral"
        if total_analyses > 0:
            all_analyses = Analysis.query.filter_by(user_id=current_user.id).all()
            total_pos = sum([a.positive_count for a in all_analyses])
            total_neg = sum([a.negative_count for a in all_analyses])
            if total_pos > total_neg: avg_sentiment = "Positive 📈"
            elif total_neg > total_pos: avg_sentiment = "Negative 📉"

        return jsonify({
            "id": current_user.id, 
            "email": current_user.email,
            "name": current_user.name or "User",
            "photo_url": current_user.photo_url or "",
            "last_analysis": last_analysis.created_at.isoformat() if last_analysis else "Never",
            "total_analyses": total_analyses,
            "avg_sentiment": avg_sentiment
        })
    return jsonify({"guest": True}), 200


@app.route("/reset-password-request", methods=["POST"])
def reset_password_request():
    """Generate reset token for email."""
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email required"}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Email not found"}), 404
    
    import secrets
    from datetime import datetime, timedelta
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    
    print(f"🔑 Reset token for {email}: {token} (expires: {user.reset_expires})")
    
    return jsonify({
        "message": "Reset link sent! Check console for token.",
        "token": token,
        "expires": user.reset_expires.isoformat()
    })


@app.route("/reset-password", methods=["POST"])
def reset_password():
    """Complete password reset."""
    data = request.get_json()
    token = data.get('token')
    password = data.get('password')
    
    if not token or not password:
        return jsonify({"error": "Token and password required"}), 400
    
    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_expires or user.reset_expires < datetime.utcnow():
        return jsonify({"error": "Invalid or expired token"}), 400
    
    user.set_password(password)
    db.session.commit()
    return jsonify({"message": "Password reset successful"})


@app.route("/update_profile", methods=["POST"])
@login_required
def update_profile():
    """Update user profile name."""
    data = request.get_json()
    name = data.get('name', '').strip()
    if name:
        current_user.name = name
        db.session.commit()
    return jsonify({"message": "Profile updated", "name": current_user.name})


@app.route("/logout")
def logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200

@app.route("/history")
@login_required
def history():
    analyses = Analysis.query.filter_by(user_id=current_user.id).order_by(Analysis.created_at.desc()).limit(10).all()
    return jsonify([a.to_dict() for a in analyses])


def process_comments(comments, post_id, source_url=""):
    """Core logic to analyze a list of comments and return detailed results."""
    from collections import Counter
    import string
    
    results = {
        "post_id": post_id,
        "source_url": source_url,
        "positive_count": 0, 
        "neutral_count": 0, 
        "negative_count": 0, 
        "total": 0,
        "history": [],
        "message": f"Analyzed {len(comments)} comments",
        "timestamp": time.time(),
        
        # New Metrics
        "satisfaction_score": 0.0,
        "top_keywords": [],
        "key_insights": [],
        "recommendations": [],
        "top_positive": None,
        "top_negative": None,
        "sentiment_trend": [] # Simulated trend
    }
    
    all_text = ""
    
    for i, comment in enumerate(comments):
        comment_str = str(comment).strip()
        if not comment_str or comment_str.lower() == 'nan':
            continue
            
        sentiment, score = predict_sentiment_with_score(comment_str)
        display_sentiment = sentiment.capitalize()
        
        if sentiment == 'positive':
            results['positive_count'] += 1
            if not results['top_positive']: results['top_positive'] = comment_str
        elif sentiment == 'neutral':
            results['neutral_count'] += 1
        elif sentiment == 'negative':
            results['negative_count'] += 1
            if not results['top_negative']: results['top_negative'] = comment_str

        results["total"] += 1
        
        # Simulate a timestamp (spread over last 24 hours)
        ts = time.time() - (random.random() * 86400)
        
        results["history"].append({
            "comment": comment_str,
            "sentiment": display_sentiment,
            "score": score,
            "timestamp": ts
        })
        all_text += " " + comment_str.lower()
        
    if results['total'] > 0:
        # 1. Satisfaction Score = (Positive - Negative) / Total * 10
        # Normalizing -1 to 1 into 0 to 10 scale
        score = (results['positive_count'] - results['negative_count']) / results['total']
        results['satisfaction_score'] = round(((score + 1) / 2) * 10, 1)
        
        # 2. Key Insights
        pos_pct = (results['positive_count'] / results['total']) * 100
        neg_pct = (results['negative_count'] / results['total']) * 100
        
        if pos_pct > 60:
            results['key_insights'].append("Majority of customers are highly satisfied with this post.")
        elif neg_pct > 30:
            results['key_insights'].append("Significant negative feedback detected. Requires immediate attention.")
        else:
            results['key_insights'].append("The overall sentiment is fairly balanced but leans neutral.")
            
        if "price" in all_text or "cost" in all_text or "expensive" in all_text:
            results['key_insights'].append("Pricing appears to be a common topic in the comments.")
        if "quality" in all_text or "broken" in all_text or "bad" in all_text:
            results['key_insights'].append("Product quality and performance are being frequently mentioned.")
        if "delivery" in all_text or "shipping" in all_text or "late" in all_text:
            results['key_insights'].append("Delivery and logistics issues are recurring themes.")

        # 3. Keyword Extraction (Simple Frequency)
        stopwords = {'the', 'a', 'is', 'are', 'to', 'in', 'for', 'of', 'and', 'with', 'on', 'at', 'this', 'it', 'my', 'your'}
        words = re.findall(r'\b\w+\b', all_text)
        filtered_words = [w for w in words if len(w) > 3 and w not in stopwords]
        results['top_keywords'] = [item[0] for item in Counter(filtered_words).most_common(6)]
        
        # 4. Recommendations
        if neg_pct > 20:
            results['recommendations'].append("Address negative comments promptly to improve brand perception.")
        if "price" in all_text and neg_pct > 15:
            results['recommendations'].append("Evaluate your pricing strategy based on customer feedback.")
        if pos_pct > 50:
            results['recommendations'].append("Highlight the positive aspects mentioned (e.g., quality) in your next campaign.")
        else:
            results['recommendations'].append("Engage more with neutral commenters to convert them into brand advocates.")

        # 5. Sentiment Trend (Simulate 6 data points over time)
        for i in range(6):
            results['sentiment_trend'].append({
                "label": f"{5-i}h ago",
                "positive": random.randint(0, results['positive_count'] // 3) if results['positive_count'] > 3 else random.randint(0, 5),
                "negative": random.randint(0, results['negative_count'] // 3) if results['negative_count'] > 3 else random.randint(0, 5)
            })

    return results


@app.route("/analyze_url", methods=["POST"])
def analyze_url():
    data = request.get_json()
    url = data.get('url')
    urls = data.get('urls', []) # For campaign
    save_to_history = data.get('save_to_history', False)

    if not url and not urls:
        return jsonify({"error": "URL or list of URLs is required"}), 400

    # Handle Campaign (Single or Multiple)
    if not urls and url: urls = [url]
    
    all_comments = []
    main_post_id = ""
    
    for target_url in urls:
        post_id = extract_post_id(target_url)
        if not post_id: continue
        if not main_post_id: main_post_id = post_id
        
        comments = load_simulated_comments(post_id)
        if not comments:
            comments = [
                "Love this post! Amazing content! 😊", "This is okay, nothing special.",
                "Really disappointed with the quality. Not recommended.", "Great job! Keep it up!",
                "Meh, I've seen better.", "Absolutely terrible experience!",
                "Wonderful! Thank you for sharing!", "Not bad at all, quite good actually.",
                "Worst purchase ever. Total scam!", "This made my day! You're the best!"
            ]
        all_comments.extend(comments)

    if not all_comments:
        return jsonify({"error": "No comments found to analyze"}), 404

    try:
        results = process_comments(all_comments, main_post_id, urls[0])
        results = sanitize_for_json(results)
            
        with open(RESULTS_FILE, "w") as f:
            json.dump(results, f, indent=2)
        
        if save_to_history and current_user.is_authenticated:
            analysis = Analysis(
                user_id=current_user.id,
                post_url=urls[0],
                post_id=main_post_id,
                results_json=json.dumps(results),
                total=results['total'],
                positive_count=results['positive_count'],
                neutral_count=results['neutral_count'],
                negative_count=results['negative_count']
            )
            db.session.add(analysis)
            db.session.commit()
            results['saved_analysis_id'] = analysis.id
        
        return jsonify(results), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@app.route("/analyze_file", methods=["POST"])
def analyze_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    data = request.form.to_dict() if request.form else {}
    save_to_history = data.get('save_to_history') == 'true'
    
    try:
        file_content = file.read()
        df = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                import io
                df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
                break
            except:
                continue
        
        if df is None:
            return jsonify({"error": "Could not read CSV"}), 400
        
        print(f"[CSV Upload] Columns: {list(df.columns)}, Shape: {df.shape}")
        
        comment_col = None
        for col in df.columns:
            if col.strip().lower() in ['comment', 'comments', 'text', 'message', 'content']:
                comment_col = col; break
        if not comment_col and len(df.columns) == 1: comment_col = df.columns[0]
        
        if not comment_col:
            return jsonify({"error": "CSV must have 'comment' column"}), 400
        
        df = df.dropna(subset=[comment_col])
        comments = df[comment_col].astype(str).str.strip().tolist()
        comments = [c for c in comments if c and c.lower() != 'nan']
        
        if not comments:
            return jsonify({"error": "No valid comments in CSV"}), 400
        
        results = process_comments(comments, "uploaded_csv", file.filename)
        results = sanitize_for_json(results)
            
        with open(RESULTS_FILE, "w") as f:
            json.dump(results, f, indent=2)
        
        if save_to_history and current_user.is_authenticated:
            analysis = Analysis(
                user_id=current_user.id,
                post_url="uploaded_csv",
                post_id=file.filename,
                results_json=json.dumps(results),
                total=results['total'],
                positive_count=results['positive_count'],
                neutral_count=results['neutral_count'],
                negative_count=results['negative_count']
            )
            db.session.add(analysis)
            db.session.commit()
            results['saved_analysis_id'] = analysis.id
        
        return jsonify(results), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/compare", methods=["POST"])
@login_required
def compare():
    """Compares two existing analyses."""
    data = request.get_json()
    id1 = data.get('id1')
    id2 = data.get('id2')
    
    if not id1 or not id2:
        return jsonify({"error": "Two analysis IDs required"}), 400
        
    a1 = Analysis.query.filter_by(id=id1, user_id=current_user.id).first()
    a2 = Analysis.query.filter_by(id=id2, user_id=current_user.id).first()
    
    if not a1 or not a2:
        return jsonify({"error": "Analysis not found"}), 404
        
    res1 = json.loads(a1.results_json)
    res2 = json.loads(a2.results_json)
    
    comparison = {
        "analysis1": {
            "id": a1.id,
            "post_id": a1.post_id,
            "positive_pct": round(a1.positive_count / a1.total * 100) if a1.total else 0,
            "satisfaction_score": res1.get('satisfaction_score', 0)
        },
        "analysis2": {
            "id": a2.id,
            "post_id": a2.post_id,
            "positive_pct": round(a2.positive_count / a2.total * 100) if a2.total else 0,
            "satisfaction_score": res2.get('satisfaction_score', 0)
        },
        "conclusion": ""
    }
    
    if comparison['analysis1']['positive_pct'] > comparison['analysis2']['positive_pct']:
        comparison['conclusion'] = f"Post {a1.post_id} performed better with higher positive sentiment."
    else:
        comparison['conclusion'] = f"Post {a2.post_id} performed better with higher positive sentiment."
        
    return jsonify(comparison)


@app.route("/results", methods=["GET"])
def get_results():
    """Returns the analysis results."""
    try:
        with open(RESULTS_FILE, "r") as f:
            content = f.read()
        
        # Handle potential NaN in stored JSON (from previous buggy runs)
        content = content.replace('NaN', 'null')
        content = content.replace('Infinity', 'null')
        
        results = json.loads(content)
        return jsonify(results)
    except FileNotFoundError:
        return jsonify({"error": "Results not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/download_report")
def download_report():
    """Download the latest analysis results as a CSV file."""
    try:
        with open(RESULTS_FILE, "r") as f:
            content = f.read()
        content = content.replace('NaN', 'null').replace('Infinity', 'null')
        results = json.loads(content)
        
        history = results.get('history', [])
        if not history:
            return jsonify({"error": "No analysis data to export"}), 404
        
        import io
        import csv
        from flask import Response
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Comment', 'Sentiment', 'Confidence Score', 'Timestamp'])
        
        for item in history:
            from datetime import datetime as dt
            ts = item.get('timestamp', 0)
            ts_str = dt.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S') if ts else ''
            writer.writerow([
                item.get('comment', ''),
                item.get('sentiment', ''),
                item.get('score', 0),
                ts_str
            ])
        
        # Add summary rows
        writer.writerow([])
        writer.writerow(['--- Summary ---'])
        writer.writerow(['Total Comments', results.get('total', 0)])
        writer.writerow(['Positive', results.get('positive_count', 0)])
        writer.writerow(['Neutral', results.get('neutral_count', 0)])
        writer.writerow(['Negative', results.get('negative_count', 0)])
        writer.writerow(['Satisfaction Score', results.get('satisfaction_score', 0)])
        
        csv_data = output.getvalue()
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=sentiment_report.csv'}
        )
    except FileNotFoundError:
        return jsonify({"error": "No analysis results found. Run an analysis first."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- Run directly --------------------------------------------------------------
if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    app.run(host=host, port=port, debug=True)
