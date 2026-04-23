# 📊 Automated Sentiment Analysis Platform for Instagram

An end-to-end AI platform that analyzes Instagram comments and classifies them as **Positive**, **Neutral**, or **Negative** using NLP and Machine Learning.

---

### ✨ Features

- **Instagram Post URL Analysis**: Paste post URL → extracts shortcode → loads simulated comments → sentiment analysis
- **Simulated Datasets**: `data/post_comments/comments_{POSTID}.csv` - production-ready simulation (easy Graph API upgrade)
- **File Upload**: CSV analysis fallback
- **Interactive Dashboard**: Pie chart, bar chart, comment history
- **Battle-tested ML**: TF-IDF + Linear SVM (90%+ accuracy)

---

## 🌐 Live Demo
Try the app here: https://instagram-sentiment-platform.vercel.app/

How to use:

- Paste an Instagram post URL in the input box
- Submit to run sentiment analysis on the (simulated) comments
- View results on the dashboard (Positive / Neutral / Negative + charts + history)

---

### 🖼️ Screenshot

*(placeholder for a screenshot of the new UI)*

---

## 🏗️ Project Structure

```
instagram-sentiment-platform/
├── frontend/
│   ├── index.html         # Main analyzer UI
│   ├── dashboard.html     # Dashboard for results
│   ├── style.css          # Modern and clean styles
│   ├── app.js             # Logic for the analyzer
│   └── dashboard.js       # Logic for the dashboard
├── backend/
│   ├── app.py             # Flask application
│   └── predict.py         # Model loading & prediction logic
├── ml/
│   ├── preprocess.py      # Text cleaning & lemmatization
│   └── train_model.py     # TF-IDF, SVM, Logistic Regression training
├── models/
│   ├── svm_model.pkl
│   ├── logreg_model.pkl
│   └── tfidf_vectorizer.pkl
├── data/
│   └── sentimentdataset.csv
├── .env
├── requirements.txt
└── README.md
```

---

## ⚙️ Setup & Installation

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Download NLTK data
```bash
python -c "import nltk; nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('omw-1.4')"
```

### 3. Train the models
```bash
python ml/train_model.py
```
This will create `.pkl` files inside the `models/` directory.

### 4. Start the backend server
```bash
python backend/app.py
```

### 5. Open the frontend
Open `frontend/index.html` in your browser.

---

## 🔌 API Endpoints

### `GET /health`
Returns model status.
```json
{"status": "model loaded successfully"}
```

### `POST /analyze_url`
Analyzes comments from a given URL.
**Request:**
```json
{"url": "https://www.instagram.com/p/Cg-jZ1_J1Z-/"}
```

### `POST /analyze_file`
Analyzes comments from an uploaded file.
**Request:**
```
Content-Type: multipart/form-data
Body: file
```

### `GET /results`
Returns the analysis results.
**Response:**
```json
{
  "total": 100,
  "positive_count": 60,
  "neutral_count": 20,
  "negative_count": 20,
  "history": [
    {
      "comment": "This is amazing!",
      "sentiment": "Positive",
      "timestamp": "2023-01-01T12:00:00Z"
    }
  ]
}
```
---

## 🧠 ML Pipeline

| Step | Details |
|------|---------|
| Preprocessing | Lowercase, remove URLs/mentions/hashtags/punctuation, remove stopwords, lemmatize |
| Feature Extraction | TF-IDF Vectorizer (max 5000 features) |
| Models | Logistic Regression (baseline), Linear SVM (primary) |
| Evaluation | Accuracy, Classification Report, Confusion Matrix |
| Serialization | joblib `.pkl` files |

---

## 🛠️ Tech Stack

- **Backend**: Python, Flask
- **ML**: Scikit-learn, NLTK
- **Data**: Pandas, NumPy
- **Frontend**: HTML, CSS, JavaScript, Chart.js
- **Config**: python-dotenv

---

## 📄 License

MIT License
