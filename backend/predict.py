"""
Prediction module for Instagram Sentiment Analysis Platform.
Loads saved models and provides predict_sentiment() function.
"""

import os
import joblib
from dotenv import load_dotenv

# Allow import from project root
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.preprocess import clean_text

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, os.getenv("MODEL_DIR", "models"))

# ── Lazy-load singleton models ────────────────────────────────────────────────
_vectorizer = None
_model = None


def _load_models():
    global _vectorizer, _model
    if _vectorizer is None or _model is None:
        vec_path = os.path.join(MODEL_DIR, "instagram_tfidf_vectorizer.pkl")
        svm_path = os.path.join(MODEL_DIR, "instagram_svm_model.pkl")

        if not os.path.exists(vec_path) or not os.path.exists(svm_path):
            raise FileNotFoundError(
                f"Model files not found in '{MODEL_DIR}'. "
                "Please run: python ml/train_model.py"
            )

        _vectorizer = joblib.load(vec_path)
        _model = joblib.load(svm_path)


def predict_sentiment(comment: str) -> str:
    """
    Clean, vectorize, and classify a comment using the Linear SVM model.

    Args:
        comment: Raw Instagram comment string.

    Returns:
        Sentiment label: 'positive', 'neutral', or 'negative'.
    """
    _load_models()

    cleaned = clean_text(comment)
    if not cleaned.strip():
        return "neutral"

    features = _vectorizer.transform([cleaned])
    label = _model.predict(features)[0]
    return label.lower()


def predict_sentiment_with_score(comment: str) -> tuple:
    """
    Predict sentiment and return a confidence score (0-1).

    Returns:
        (label, score) tuple.
    """
    _load_models()

    cleaned = clean_text(comment)
    if not cleaned.strip():
        return "neutral", 0.5

    features = _vectorizer.transform([cleaned])
    label = _model.predict(features)[0].lower()

    # Use decision_function for confidence
    try:
        scores = _model.decision_function(features)[0]
        # For multi-class, scores is array; take max absolute as confidence
        import numpy as np
        if hasattr(scores, '__len__'):
            confidence = float(np.max(np.abs(scores)))
        else:
            confidence = float(abs(scores))
        # Normalize to 0-1 using sigmoid-like mapping
        confidence = 1.0 / (1.0 + np.exp(-confidence))
        if confidence < 0.5:
            label = 'neutral'
            confidence = 0.5  # Low confidence defaults to neutral
    except Exception:
        confidence = 0.5

    return label, round(confidence, 3)


def is_model_loaded() -> bool:
    """Check whether models can be loaded without raising."""
    try:
        _load_models()
        return True
    except FileNotFoundError:
        return False


if __name__ == "__main__":
    tests = [
        "This product is absolutely amazing! I love it so much!",
        "It is okay, nothing special. Does what it says.",
        "Terrible quality! Broke after one day. Total waste of money.",
    ]
    for t in tests:
        print(f"Comment   : {t}")
        print(f"Sentiment : {predict_sentiment(t)}\n")
