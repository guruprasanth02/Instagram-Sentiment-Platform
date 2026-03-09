"""
Model training script for Instagram Sentiment Analysis Platform.

Real dataset: data/sentimentdataset.csv
  - Column 'Text'      : raw comment text
  - Column 'Sentiment' : granular emotion labels (Positive, Negative, Neutral,
                         Happiness, Sadness, Anger, Fear, Joy, Love, etc.)

Pipeline:
  1. Load dataset
  2. Map granular sentiments → Positive / Neutral / Negative
  3. Preprocess text
  4. TF-IDF feature extraction (max 5000 features, unigrams + bigrams)
  5. Train Logistic Regression (baseline) + Linear SVM (primary)
  6. Evaluate with accuracy, classification report, confusion matrix
  7. Save models + vectorizer as .pkl files
  8. Save visualisation plots
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

from sklearn.metrics import (

    accuracy_score,

    classification_report,

    confusion_matrix,

)



sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.preprocess import clean_text



# -- Paths ---------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(BASE_DIR, "data", "sentimentdataset.csv")

MODEL_DIR = os.path.join(BASE_DIR, "models")

os.makedirs(MODEL_DIR, exist_ok=True)



# -- Sentiment mapping ---------------------------------------------------------

# Map diverse emotion labels -> three canonical classes

POSITIVE_LABELS = {

    "positive", "happiness", "happy", "joy", "joyful", "love", "amusement",

    "admiration", "affection", "awe", "excitement", "excited", "elation",

    "euphoria", "contentment", "content", "serenity", "gratitude", "grateful",

    "hope", "hopeful", "empowerment", "empowered", "compassion", "tenderness",

    "arousal", "enthusiasm", "enthusiastic", "fulfillment", "reverence",

    "pride", "proud", "zest", "playful", "playfulness", "free-spirited",

    "inspired", "inspiration", "confidence", "confident", "kindness", "kind",

    "surprise", "acceptance", "determination", "determined", "harmony",

    "creativity", "creative", "radiance", "wonder", "wonderment",

    "rejuvenation", "coziness", "overjoyed", "blessed", "contemplation",

    "captivation", "thrill", "thrilling", "melodic", "festive", "festivity",

    "mindfulness", "freedom", "elegant", "elegance", "whimsy", "enchantment",

    "adrenaline", "artistic", "radiant", "winter magic", "nostalgia",

}



NEGATIVE_LABELS = {

    "negative", "sadness", "sad", "anger", "angry", "fear", "fearful",

    "disgust", "disgusted", "disappointment", "disappointed", "bitterness",

    "bitter", "loneliness", "lonely", "jealousy", "jealous", "resentment",

    "frustrated", "frustration", "boredom", "bored", "anxiety", "anxious",

    "intimidation", "helplessness", "helpless", "envy", "envious", "regret",

    "despair", "desperate", "grief", "sorrow", "shame", "shame", "betrayal",

    "heartbreak", "isolation", "isolated", "desolation", "devastated",

    "suffering", "darkness", "desperation", "apprehension", "apprehensive",

    "overwhelmed", "dismissive", "ruins", "melancholy", "yearning",

    "obstacle", "sympathy", "pressure", "miscalculation", "challenge",

    "heartache", "painful", "loss", "bittersweet",

}



NEUTRAL_LABELS = {

    "neutral", "indifference", "indifferent", "confusion", "confused",

    "numbness", "numb", "ambivalence", "ambivalent", "curiosity", "curious",

    "reflection", "reflective", "nostalgia", "pensive", "serenity",

    "exploration", "acceptance", "anticipation", "contemplation",

    "renewal", "renewed effort",

}





def map_sentiment(label: str) -> str:

    """Map a raw sentiment label to Positive / Neutral / Negative."""

    label_clean = str(label).strip().lower()

    if label_clean in POSITIVE_LABELS:

        return "Positive"

    if label_clean in NEGATIVE_LABELS:

        return "Negative"

    if label_clean in NEUTRAL_LABELS:

        return "Neutral"

    # Heuristic fallback

    if any(p in label_clean for p in ("happi", "joy", "love", "excit", "proud",

                                       "great", "amaz", "super", "elat", "won")):

        return "Positive"

    if any(n in label_clean for n in ("sad", "anger", "fear", "disgust", "hate",

                                       "bitter", "anxi", "depress", "despair")):

        return "Negative"

    return "Neutral"





# -- 1. Load Dataset -----------------------------------------------------------

print("=" * 65)

print("  Instagram Sentiment Analysis -- Model Training")

print("=" * 65)



df = pd.read_csv(DATA_PATH)

print(f"\n[DATA] Loaded {len(df)} rows from: {DATA_PATH}")



# Identify text and sentiment columns

text_col = "Text"

sentiment_col = "Sentiment"

if text_col not in df.columns or sentiment_col not in df.columns:

    # Try case-insensitive match

    col_map = {c.strip().lower(): c for c in df.columns}

    text_col = col_map.get("text", df.columns[2])

    sentiment_col = col_map.get("sentiment", df.columns[3])



print(f"[DATA] Text column     : '{text_col}'")

print(f"[DATA] Sentiment column: '{sentiment_col}'")



# -- 2. Map Sentiments ---------------------------------------------------------

df["sentiment_mapped"] = df[sentiment_col].apply(map_sentiment)

print(f"\n[MAP]  Original unique labels : {df[sentiment_col].nunique()}")

print(f"[MAP]  Mapped distribution:\n{df['sentiment_mapped'].value_counts()}\n")



# Drop rows with very short text

df = df.dropna(subset=[text_col])

df = df[df[text_col].astype(str).str.strip() != ""]



# -- 3. Preprocess -------------------------------------------------------------

print("[PREPROCESS] Cleaning text ...")

df["clean_text"] = df[text_col].apply(clean_text)

df = df[df["clean_text"].str.strip() != ""]

print(f"[PREPROCESS] {len(df)} rows after cleaning.\n")



X = df["clean_text"]

y = df["sentiment_mapped"]



# -- 4. TF-IDF Vectorisation ---------------------------------------------------

print("[FEATURE] Fitting TF-IDF Vectorizer (max_features=5000, ngram 1-2) ...")

X_train, X_test, y_train, y_test = train_test_split(

    X, y, test_size=0.2, random_state=42, stratify=y

)



vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))

X_train_tfidf = vectorizer.fit_transform(X_train)

X_test_tfidf = vectorizer.transform(X_test)

print(f"[FEATURE] TF-IDF matrix shape: {X_train_tfidf.shape}\n")



# -- 5a. Logistic Regression ---------------------------------------------------

print("[MODEL] Training Logistic Regression ...")

logreg = LogisticRegression(max_iter=1000, random_state=42, C=1.0)

logreg.fit(X_train_tfidf, y_train)

logreg_preds = logreg.predict(X_test_tfidf)

logreg_acc = accuracy_score(y_test, logreg_preds)

print(f"[LOGREG] Accuracy : {logreg_acc:.4f}")

print(classification_report(y_test, logreg_preds))



# -- 5b. Linear SVM ------------------------------------------------------------

print("[MODEL] Training Linear SVM ...")

svm = LinearSVC(max_iter=2000, random_state=42, C=1.0)

svm.fit(X_train_tfidf, y_train)

svm_preds = svm.predict(X_test_tfidf)

svm_acc = accuracy_score(y_test, svm_preds)

print(f"[SVM]    Accuracy : {svm_acc:.4f}")

print(classification_report(y_test, svm_preds))



# -- 6. Confusion Matrix Plot --------------------------------------------------

labels = ["Positive", "Neutral", "Negative"]

cm = confusion_matrix(y_test, svm_preds, labels=labels)

plt.figure(figsize=(7, 5))

sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",

            xticklabels=labels, yticklabels=labels, linewidths=0.5)

plt.title("Confusion Matrix -- Linear SVM", fontsize=14, fontweight="bold")

plt.ylabel("Actual"); plt.xlabel("Predicted")

plt.tight_layout()

cm_path = os.path.join(MODEL_DIR, "confusion_matrix_svm.png")

plt.savefig(cm_path, dpi=150); plt.close()

print(f"\n[PLOT] Confusion matrix -> {cm_path}")



# -- 7. Sentiment Distribution Chart ------------------------------------------

counts = df["sentiment_mapped"].value_counts().reindex(labels, fill_value=0)

colors = ["#4CAF50", "#FFC107", "#F44336"]

plt.figure(figsize=(7, 4))

bars = plt.bar(counts.index, counts.values, color=colors, edgecolor="white", width=0.5)

for bar, val in zip(bars, counts.values):

    plt.text(bar.get_x() + bar.get_width() / 2,

             bar.get_height() + 2, str(val), ha="center", fontsize=11)

plt.title("Sentiment Distribution -- Training Data", fontsize=13, fontweight="bold")

plt.ylabel("Count"); plt.tight_layout()

dist_path = os.path.join(MODEL_DIR, "sentiment_distribution.png")

plt.savefig(dist_path, dpi=150); plt.close()

print(f"[PLOT] Sentiment distribution -> {dist_path}")



# -- 8. Save Models ------------------------------------------------------------

vec_path    = os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl")

svm_path    = os.path.join(MODEL_DIR, "svm_model.pkl")

logreg_path = os.path.join(MODEL_DIR, "logreg_model.pkl")



joblib.dump(vectorizer, vec_path)

joblib.dump(svm, svm_path)

joblib.dump(logreg, logreg_path)



print(f"\n[SAVE] tfidf_vectorizer.pkl -> {vec_path}")

print(f"[SAVE] svm_model.pkl       -> {svm_path}")

print(f"[SAVE] logreg_model.pkl    -> {logreg_path}")



print("\n" + "=" * 65)

print(f"  DONE Training complete!")

print(f"     Logistic Regression Accuracy : {logreg_acc:.2%}")

print(f"     Linear SVM Accuracy          : {svm_acc:.2%}")

print("=" * 65)
