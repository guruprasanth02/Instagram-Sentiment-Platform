"""
SentiGram - Instagram Sentiment Analysis Platform
Quick launcher script.

Usage:
    python run.py
"""
import subprocess
import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    print("=" * 60)
    print("  SentiGram — Instagram Sentiment Analysis Platform")
    print("=" * 60)

    # Check if model exists
    model_path = os.path.join(BASE_DIR, "models", "instagram_svm_model.pkl")
    if not os.path.exists(model_path):
        print("\n[!] Model not found. Training model first...")
        print("    This may take 1-2 minutes on first run.\n")
        result = subprocess.run(
            [sys.executable, os.path.join(BASE_DIR, "ml", "train_model.py")],
            cwd=BASE_DIR
        )
        if result.returncode != 0:
            print("\n[ERROR] Model training failed. Check the output above.")
            sys.exit(1)
        print("\n[OK] Model trained successfully!\n")
    else:
        print("\n[OK] Model already trained.")

    print("\n[*] Starting Flask server on http://localhost:8000")
    print("[*] Press Ctrl+C to stop.\n")
    
    subprocess.run(
        [sys.executable, os.path.join(BASE_DIR, "backend", "app.py")],
        cwd=BASE_DIR
    )

if __name__ == "__main__":
    main()
