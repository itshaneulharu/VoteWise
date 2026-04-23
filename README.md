# 🗳️ VoteWise — AI Election Guide

A beautiful, AI-powered election guide chatbot that helps every citizen understand the democratic process with clarity and confidence.

## ✨ Features

- **AI-Powered Chat** — Powered by Google Gemini for intelligent, contextual election guidance
- **Election Process Explainer** — Step-by-step breakdowns of how elections work
- **Personalized Voter Guide** — Custom checklists based on your situation
- **FAQ Mode** — Quick answers to common voting questions
- **Beautiful Dark UI** — Glassmorphism design with smooth animations
- **Responsive** — Works on desktop, tablet, and mobile

## 🚀 Quick Start

1. **Open** `index.html` in your browser (or use a local server)
2. **Get API Key** — Visit [Google AI Studio](https://aistudio.google.com/apikey) to get a free Gemini API key
3. **Paste** your API key in the modal that appears
4. **Start chatting!** Ask about elections, voter registration, polling booths, and more

### Using a local server (optional)

```bash
npx serve
```

## 🛠 Tech Stack

- **HTML5** — Semantic structure
- **CSS3** — Custom properties, glassmorphism, animations
- **Vanilla JavaScript** — No frameworks needed
- **Google Gemini API** — AI responses via `gemini-2.0-flash`
- **Inter** — Google Fonts typography

## 📁 Project Structure

```
VoteWise/
├── index.html          # Main page
├── css/
│   └── style.css       # Design system + styles
├── js/
│   ├── app.js          # Chat controller
│   ├── gemini.js       # Gemini API integration
│   └── markdown.js     # Markdown renderer
├── assets/
│   └── favicon.svg     # App icon
└── README.md
```

## 🔒 Privacy

Your API key is stored only in your browser's `localStorage` and never sent anywhere except directly to Google's Gemini API. No data is collected or stored on any server.

## 📝 License

MIT
