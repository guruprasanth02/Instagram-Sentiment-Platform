"""
Model training script for Instagram Sentiment Analysis Platform.
"""

import os
import sys
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.preprocess import clean_text


# ---------------- Paths ----------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "sentimentdataset.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)


# ---------------- Sentiment Mapping ----------------
POSITIVE_LABELS = {
    "positive", "happiness", "happy", "joy", "joyful", "love",
    "excitement", "excited", "pride", "proud", "gratitude",
    "hope", "hopeful", "confidence", "confident", "kindness",
    "kind", "surprise", "acceptance", "determined"
}

NEGATIVE_LABELS = {
    "negative", "sadness", "sad", "anger", "angry", "fear",
    "disgust", "disappointed", "lonely", "jealous",
    "frustrated", "bored", "anxious", "regret",
    "despair", "grief", "betrayal", "painful"
}

NEUTRAL_LABELS = {
    "neutral", "indifferent", "confused", "numb",
    "curious", "reflection", "pensive"
}


def map_sentiment(label: str) -> str:
    label_clean = str(label).strip().lower()

    if label_clean in POSITIVE_LABELS:
        return "Positive"
    if label_clean in NEGATIVE_LABELS:
        return "Negative"
    if label_clean in NEUTRAL_LABELS:
        return "Neutral"

    # fallback rules
    if any(p in label_clean for p in ["happy", "joy", "love", "great"]):
        return "Positive"
    if any(n in label_clean for n in ["sad", "anger", "fear", "hate"]):
        return "Negative"

    return "Neutral"


# ---------------- Load Dataset ----------------
print("=" * 60)
print("Instagram Sentiment Analysis - Training")
print("=" * 60)

df = pd.read_csv(DATA_PATH)

text_col = "Text"
sentiment_col = "Sentiment"

df["sentiment_mapped"] = df[sentiment_col].apply(map_sentiment)

df = df.dropna(subset=[text_col])
df = df[df[text_col].str.strip() != ""]


# ---------------- Preprocessing ----------------
print("[PREPROCESS] Cleaning text...")
df["clean_text"] = df[text_col].apply(clean_text)
df = df[df["clean_text"].str.strip() != ""]

X = df["clean_text"]
y = df["sentiment_mapped"]


# ---------------- TF-IDF ----------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

vectorizer = TfidfVectorizer(max_features=10000, ngram_range=(1, 2))

X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)


# ---------------- Logistic Regression ----------------
logreg = LogisticRegression(max_iter=1000, class_weight='balanced')
logreg.fit(X_train_tfidf, y_train)

logreg_preds = logreg.predict(X_test_tfidf)
print("\n[LOGISTIC REGRESSION]")
print("Accuracy:", accuracy_score(y_test, logreg_preds))
print(classification_report(y_test, logreg_preds))


# ---------------- Linear SVM ----------------
svm = LinearSVC(max_iter=2000, class_weight='balanced')
svm.fit(X_train_tfidf, y_train)

svm_preds = svm.predict(X_test_tfidf)
print("\n[LINEAR SVM]")
print("Accuracy:", accuracy_score(y_test, svm_preds))
print(classification_report(y_test, svm_preds))


# ---------------- Confusion Matrix ----------------
labels = ["Positive", "Neutral", "Negative"]

cm = confusion_matrix(y_test, svm_preds, labels=labels)

plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt="d", xticklabels=labels, yticklabels=labels)
plt.title("Confusion Matrix - SVM")

plt.savefig(os.path.join(MODEL_DIR, "confusion_matrix.png"))
plt.close()


# ---------------- Save Models ----------------
joblib.dump(vectorizer, os.path.join(MODEL_DIR, "instagram_tfidf_vectorizer.pkl"))
joblib.dump(svm, os.path.join(MODEL_DIR, "instagram_svm_model.pkl"))
joblib.dump(logreg, os.path.join(MODEL_DIR, "logreg.pkl"))

print("\nTraining Complete!")