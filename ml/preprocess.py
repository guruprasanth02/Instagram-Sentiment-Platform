"""
Text preprocessing module for Instagram Sentiment Analysis.
Provides clean_text() function used by both training and inference.
"""
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# Download required NLTK resources (safe to call multiple times)
def download_nltk_resources():
    for resource in ["stopwords", "wordnet", "omw-1.4"]:
        try:
            nltk.download(resource, quiet=True)
        except Exception:
            pass

download_nltk_resources()

_stop_words = set(stopwords.words("english"))
_lemmatizer = WordNetLemmatizer()


def clean_text(text: str) -> str:
    """
    Cleans and preprocesses a raw comment string.

    Steps:
      1. Lowercase
      2. Remove URLs
      3. Remove @mentions
      4. Remove #hashtags
      5. Remove punctuation and special characters
      6. Tokenize and remove stopwords
      7. Lemmatize tokens
      8. Rejoin into a clean string
    """
    if not isinstance(text, str):
        return ""

    # 1. Lowercase
    text = text.lower()

    # 2. Remove URLs
    text = re.sub(r"http\S+|www\S+|https\S+", "", text)

    # 3. Remove @mentions
    text = re.sub(r"@\w+", "", text)

    # 4. Remove #hashtags
    text = re.sub(r"#\w+", "", text)

    # 5. Remove punctuation and non-alphabetic characters
    text = re.sub(r"[^a-z\s]", "", text)

    # 6. Tokenize
    tokens = text.split()

    # 7. Remove stopwords and short tokens, then lemmatize
    tokens = [
        _lemmatizer.lemmatize(token)
        for token in tokens
        if token not in _stop_words and len(token) > 1
    ]

    return " ".join(tokens)


if __name__ == "__main__":
    samples = [
        "This product is absolutely AMAZING!! @brand #love https://example.com",
        "Worst purchase ever! Total waste of money. 😡",
        "It's okay, nothing special. Arrived on time though.",
    ]
    for s in samples:
        print(f"Original : {s}")
        print(f"Cleaned  : {clean_text(s)}")
        print()
