#!/bin/bash

# EmberGrid Auto-Starter Script
echo "========================================"
echo "    Starting EmberGrid Dashboard...     "
echo "========================================"
echo "Starting local Python web server on port 8081..."

# Automatically open the default web browser to the login page
if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:8081/login.html" &
elif command -v open > /dev/null; then
    open "http://localhost:8081/login.html" &
else
    echo "Please open your browser and navigate to: http://localhost:8081/login.html"
fi

# Run the python server
python3 -m http.server 8081
