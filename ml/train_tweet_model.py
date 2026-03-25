"""
Model training script for Instagram Sentiment Analysis Platform.

Primary dataset : data/Tweets.csv   (US Airline Sentiment — 14,640 rows)
  - Column 'text'              : raw tweet / comment text
  - Column 'airline_sentiment' : positive / negative / neutral labels

Testing dataset : data/sentimentdataset.csv  (Emotion-labeled posts)
  - Column 'Text'      : raw comment text
  - Column 'Sentiment' : granular emotion labels

Pipeline (Tweets dataset as PRIMARY training data):
  1. Load Tweets dataset
  2. Map labels -> Positive / Neutral / Negative
  3. Preprocess text (clean_text)
  4. TF-IDF feature extraction (max 5000 features, unigrams + bigrams)
  5. Train Logistic Regression (baseline) + Linear SVM (primary)
  6. Evaluate on held-out test split
  7. Cross-validate on sentimentdataset.csv (secondary / benchmark)
  8. Save models + vectorizer as .pkl files
  9. Save visualisation plots
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

# -- Paths ---------------------------------------------------------------------
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PRIMARY   = os.path.join(BASE_DIR, "data", "Tweets.csv")
DATA_SECONDARY = os.path.join(BASE_DIR, "data", "sentimentdataset.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# -- Sentiment mapping ---------------------------------------------------------
def map_tweet_sentiment(label: str) -> str:
    """Map Tweets.csv label -> Positive / Neutral / Negative."""
    label_clean = str(label).strip().lower()
    if label_clean == "positive":  return "Positive"
    if label_clean == "negative":  return "Negative"
    return "Neutral"

# Secondary dataset (sentimentdataset.csv) uses granular emotion labels
POSITIVE_LABELS = {"positive","happiness","happy","joy","joyful","love","excitement","excited",
                   "pride","proud","gratitude","hope","hopeful","confidence","confident","kindness",
                   "kind","surprise","acceptance","determined"}
NEGATIVE_LABELS = {"negative","sadness","sad","anger","angry","fear","disgust","disappointed",
                   "lonely","jealous","frustrated","bored","anxious","regret","despair","grief",
                   "betrayal","painful"}

def map_secondary_sentiment(label: str) -> str:
    lc = str(label).strip().lower()
    if lc in POSITIVE_LABELS: return "Positive"
    if lc in NEGATIVE_LABELS: return "Negative"
    return "Neutral"

# ── 1. Load Primary Dataset (Tweets) ──────────────────────────────────────────
print("=" * 65)
print("  Instagram Sentiment Analysis -- Model Training (Tweets Dataset)")
print("=" * 65)

df = pd.read_csv(DATA_PRIMARY)
print(f"\n[DATA] Primary dataset loaded: {len(df)} rows from Tweets.csv")
print(f"[DATA] Text column     : 'text'")
print(f"[DATA] Sentiment column: 'airline_sentiment'")

df["sentiment_mapped"] = df["airline_sentiment"].apply(map_tweet_sentiment)
print(f"\n[MAP] Sentiment distribution (primary):\n{df['sentiment_mapped'].value_counts()}\n")

df = df.dropna(subset=["text"])
df = df[df["text"].astype(str).str.strip() != ""]

# ── 2. Preprocess ─────────────────────────────────────────────────────────────
print("[PREPROCESS] Cleaning text ...")
df["clean_text"] = df["text"].apply(clean_text)
df = df[df["clean_text"].str.strip() != ""]
print(f"[PREPROCESS] {len(df)} rows after cleaning.\n")

X = df["clean_text"]
y = df["sentiment_mapped"]

# ── 3. TF-IDF Vectorisation ───────────────────────────────────────────────────
print("[FEATURE] Fitting TF-IDF Vectorizer (max_features=5000, ngram 1-2) ...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf  = vectorizer.transform(X_test)
print(f"[FEATURE] TF-IDF matrix shape: {X_train_tfidf.shape}\n")

# ── 4a. Logistic Regression ───────────────────────────────────────────────────
print("[MODEL] Training Logistic Regression ...")
logreg = LogisticRegression(max_iter=1000, random_state=42, C=1.0)
logreg.fit(X_train_tfidf, y_train)
logreg_preds = logreg.predict(X_test_tfidf)
logreg_acc = accuracy_score(y_test, logreg_preds)
print(f"[LOGREG] Accuracy : {logreg_acc:.4f}")
print(classification_report(y_test, logreg_preds))

# ── 4b. Linear SVM (Primary Model) ───────────────────────────────────────────
print("[MODEL] Training Linear SVM ...")
svm = LinearSVC(max_iter=2000, random_state=42, C=1.0)
svm.fit(X_train_tfidf, y_train)
svm_preds = svm.predict(X_test_tfidf)
svm_acc = accuracy_score(y_test, svm_preds)
print(f"[SVM]    Accuracy : {svm_acc:.4f}")
print(classification_report(y_test, svm_preds))

# ── 5. Secondary Dataset Evaluation (sentimentdataset.csv) ────────────────────
print("\n[EVAL] Evaluating on secondary dataset (sentimentdataset.csv) ...")
try:
    df2 = pd.read_csv(DATA_SECONDARY)
    df2["sentiment_mapped"] = df2["Sentiment"].apply(map_secondary_sentiment)
    df2 = df2.dropna(subset=["Text"])
    df2 = df2[df2["Text"].astype(str).str.strip() != ""]
    df2["clean_text"] = df2["Text"].apply(clean_text)
    df2 = df2[df2["clean_text"].str.strip() != ""]
    X2 = vectorizer.transform(df2["clean_text"])
    y2 = df2["sentiment_mapped"]
    sec_preds = svm.predict(X2)
    sec_acc = accuracy_score(y2, sec_preds)
    print(f"[SECONDARY] SVM Accuracy on sentimentdataset.csv: {sec_acc:.4f}")
    print(classification_report(y2, sec_preds))
except Exception as e:
    print(f"[SECONDARY] Could not evaluate secondary dataset: {e}")

# ── 6. Confusion Matrix Plot ──────────────────────────────────────────────────
labels = ["Positive", "Neutral", "Negative"]
cm = confusion_matrix(y_test, svm_preds, labels=labels)

plt.figure(figsize=(7, 5))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=labels, yticklabels=labels, linewidths=0.5)
plt.title("Confusion Matrix -- Linear SVM (Tweets)", fontsize=14, fontweight="bold")
plt.ylabel("Actual"); plt.xlabel("Predicted")
plt.tight_layout()
cm_path = os.path.join(MODEL_DIR, "confusion_matrix_Tweet_svm.png")
plt.savefig(cm_path, dpi=150); plt.close()
print(f"\n[PLOT] Confusion matrix -> {cm_path}")

# ── 7. Sentiment Distribution Chart ──────────────────────────────────────────
counts = df["sentiment_mapped"].value_counts().reindex(labels, fill_value=0)
colors = ["#4CAF50", "#FFC107", "#F44336"]
plt.figure(figsize=(7, 4))
bars = plt.bar(counts.index, counts.values, color=colors, edgecolor="white", width=0.5)
for bar, val in zip(bars, counts.values):
    plt.text(bar.get_x() + bar.get_width() / 2,
             bar.get_height() + 2, str(val), ha="center", fontsize=11)
plt.title("Sentiment Distribution -- Training Data (Tweets)", fontsize=13, fontweight="bold")
plt.ylabel("Count"); plt.tight_layout()
dist_path = os.path.join(MODEL_DIR, "sentiment_distribution_Tweet.png")
plt.savefig(dist_path, dpi=150); plt.close()
print(f"[PLOT] Sentiment distribution -> {dist_path}")

# ── 8. Save Models ────────────────────────────────────────────────────────────
vec_path    = os.path.join(MODEL_DIR, "tfidf_Tweet_vectorizer.pkl")
svm_path    = os.path.join(MODEL_DIR, "svm_Tweet_model.pkl")
logreg_path = os.path.join(MODEL_DIR, "logreg_Tweet_model.pkl")

joblib.dump(vectorizer, vec_path)
joblib.dump(svm,        svm_path)
joblib.dump(logreg,     logreg_path)

print(f"\n[SAVE] tfidf_Tweet_vectorizer.pkl -> {vec_path}")
print(f"[SAVE] svm_Tweet_model.pkl        -> {svm_path}")
print(f"[SAVE] logreg_Tweet_model.pkl     -> {logreg_path}")

print("\n" + "=" * 65)
print("  TRAINING COMPLETE!")
print(f"  Primary Dataset     : Tweets.csv (US Airline Sentiment, ~14.6k rows)")
print(f"  Secondary Dataset   : sentimentdataset.csv (benchmark / testing only)")
print(f"  Logistic Regression : {logreg_acc:.2%}")
print(f"  Linear SVM          : {svm_acc:.2%}  <-- PRIMARY MODEL (saved as svm_Tweet_model.pkl)")
print("=" * 65)
