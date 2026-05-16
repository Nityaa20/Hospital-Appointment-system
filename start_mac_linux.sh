#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "============================================"
echo "   MediFlow - Smart Hospital System"
echo "============================================"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python3 not found. Please install Python 3.9+"
    exit 1
fi

cd "$BACKEND_DIR"

# Install deps
echo "[1/3] Installing Python dependencies..."
pip3 install flask flask-cors flask-jwt-extended bcrypt --quiet --break-system-packages 2>/dev/null || \
pip3 install flask flask-cors flask-jwt-extended bcrypt --quiet

# Init DB
echo "[2/3] Initializing database..."
python3 database.py

# Open browser after short delay
(sleep 2 && python3 -c "import webbrowser; webbrowser.open('http://localhost:5000')") &

# Start server
echo "[3/3] Starting MediFlow server..."
echo ""
echo "============================================"
echo " Server running at: http://localhost:5000"
echo "============================================"
echo ""
echo "Demo Credentials:"
echo "  Patient   : patient1 / 1234"
echo "  Doctor    : sharma / 1234  (Cardiology)"
echo "  Reception : reception / 1234"
echo ""
echo "Doctor usernames: sharma, verma, iyer, reddy, gupta (Cardiology)"
echo "  khan, singh, mehta, joshi, das (Neurology)"
echo "  gill, kapoor, malhotra, bansal, sethi (Orthopedics)"
echo "  alice, bob, charlie, diana, eve (Pediatrics)"
echo "  white, black, grey, brown, green (Dermatology)"
echo ""
echo "Press Ctrl+C to stop."
echo ""

python3 app.py
