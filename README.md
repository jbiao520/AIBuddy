# AI Reading Buddy Chrome Extension

A Chrome extension that enhances reading efficiency by providing AI-powered insights for selected text using a local LLM.

## Features

- Select text on any webpage to get AI-powered insights
- Quick and easy-to-use floating button interface
- Clean and modern popup design
- Local LLM integration for privacy and speed

## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Local LLM Setup

This extension requires a local LLM server running on port 3000. The server should expose two endpoints:

- `POST /analyze` - Accepts JSON with a `text` field and returns analysis
- `GET /status` - Returns the server status

Make sure your local LLM server is running before using the extension.

## Usage

1. Select any text on a webpage
2. Click the robot icon (🤖) that appears near your selection
3. Wait for the AI analysis to appear in a popup
4. Click the × to close the popup when done

## Development

The extension consists of the following files:

- `manifest.json` - Extension configuration
- `content.js` - Handles text selection and popup display
- `popup.html/js` - Extension popup interface
- `background.js` - Background processes
- `styles.css` - Styling for the UI elements

## Contributing

Feel free to submit issues and enhancement requests! 