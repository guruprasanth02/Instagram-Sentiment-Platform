"""
Flask backend for Instagram Sentiment Analysis Platform.

Endpoints:
  GET  /health  -> {"status": "model loaded successfully"}
  POST /predict -> {"sentiment": "positive"|"neutral"|"negative"}
"""

import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# -- Project root & paths ------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Import prediction helper (lazy-loads models on first call)
import sys
sys.path.insert(0, BASE_DIR)
from backend.predict import predict_sentiment, is_model_loaded

# -- Flask app -----------------------------------------------------------------
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

# CORS -- allow all origins
CORS(app)

# -- Endpoints -----------------------------------------------------------------
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route("/health")
def health_check():
    """Returns model status."""
    if is_model_loaded():
        return jsonify({"status": "model loaded successfully"})
    return jsonify({"status": "model not found -- please run ml/train_model.py first"}), 503


@app.route("/predict", methods=["POST"])
def predict():
    """Predicts sentiment for a given comment."""
    data = request.get_json()
    if not data or "comment" not in data:
        return jsonify({"error": "Comment not provided"}), 400

    comment = data["comment"].strip()
    if not comment:
        return jsonify({"error": "Comment cannot be empty"}), 400

    try:
        sentiment = predict_sentiment(comment)
        return jsonify({"sentiment": sentiment})
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": f"Prediction error: {str(e)}"}), 500

# -- Run directly --------------------------------------------------------------
if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    app.run(host=host, port=port, debug=True)
