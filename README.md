# 🧅 Onion Chat — Anonymous Dark Web Chat

A real anonymous chat application hosted as a **Tor Hidden Service** (`.onion`). No accounts. No logs. Messages vanish in 24 hours.

---

## 🌐 Live on the Dark Web

```
http://lhqyjiwkqfq7s2jtp2visp5vpdendkv2ynhjt7qtpuoognyc7r4q2bid.onion
```

> Requires [Tor Browser](https://www.torproject.org/download/) to access.

---

## ⚙️ Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express |
| Web Server | Nginx (localhost-only) |
| Anonymity | Tor Hidden Service (ED25519) |
| Frontend | Vanilla HTML / CSS / JS |
| Storage | JSON flat-file (auto-expiry) |

---

## ✨ Features

- 💬 Real-time anonymous chat (polling every 3s)
- 👤 Custom emoji avatars (stored locally)
- 📎 File, image & video uploads (up to 10MB)
- 🎥 Videos play directly in-browser
- 🗑️ Delete your own messages
- ⏱️ 24-hour auto-expiry on all messages & files
- 📱 Mobile-first responsive UI with safe-area insets
- 🔒 Rate limiting, CSP headers, randomized filenames

---

## 🚀 Self-Host

### Prerequisites
- Linux (Debian/Ubuntu)
- Node.js v18+
- Nginx
- Tor

### Setup

```bash
git clone https://github.com/CHANDU32455/onion-chat.git
cd onion-chat

# Install dependencies
npm install

# Run the automated setup (installs & configures nginx + tor + systemd)
chmod +x setup.sh
sudo ./setup.sh
```

After setup completes, your `.onion` address will be printed in the terminal.

### Manual start

```bash
# Start all services
sudo systemctl start tor nginx void-onion-backend

# Restart after changes
sudo systemctl restart void-onion-backend
sudo systemctl reload nginx
```

---

## 🔒 Security Notes

- The backend **only binds to `127.0.0.1`** — never exposed to the clearnet
- Nginx proxies everything; Tor handles the onion routing
- Server location is cryptographically concealed
- No IP addresses are logged
- Built for **learning and curiosity** — not illegal activity

---

## 📁 Structure

```
onion-chat/
├── index.html          # Landing page
├── chat.html           # Chat UI (self-contained)
├── style.css           # Landing page styles
├── script.js           # Landing page logic
├── server.js           # Express backend API
├── nginx-darkweb.conf  # Nginx server block config
├── setup.sh            # Automated setup script
└── package.json
```

---

Built with 🧅 and curiosity.
