# 📊 Automated Sentiment Analysis Platform for Instagram Business Accounts

An end-to-end AI platform that analyzes Instagram-style comments and classifies them as **Positive**, **Neutral**, or **Negative** using NLP and Machine Learning.

---

## 🏗️ Project Structure

```
instagram-sentiment-platform/
├── frontend/
│   ├── index.html       # Main web UI
│   ├── style.css        # Dark glassmorphism styles
│   └── app.js           # Chart.js + Fetch API logic
├── backend/
│   ├── app.py           # FastAPI application
│   └── predict.py       # Model loading & prediction logic
├── ml/
│   ├── preprocess.py    # Text cleaning & lemmatization
│   └── train_model.py   # TF-IDF, SVM, Logistic Regression training
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
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Open the frontend
Open `frontend/index.html` in your browser, or navigate to `http://localhost:8000` if served from FastAPI.

---

## 🔌 API Endpoints

### `GET /health`
Returns model status.
```json
{"status": "model loaded successfully"}
```

### `POST /predict`
Classifies a comment's sentiment.

**Request:**
```json
{"comment": "This product is absolutely amazing!"}
```

**Response:**
```json
{"sentiment": "positive"}
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

- **Backend**: Python, FastAPI, Uvicorn
- **ML**: Scikit-learn, NLTK
- **Data**: Pandas, NumPy
- **Visualization**: Matplotlib, Seaborn, Chart.js (frontend)
- **Config**: python-dotenv

---

## 📄 License

MIT License
