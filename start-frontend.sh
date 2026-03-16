#!/bin/bash
# Start Frontend Development Server

echo "🎨 Starting Frontend Development Server..."

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start Vite dev server
echo "🌐 Starting Vite on http://localhost:5173"
npm run dev
