#!/bin/bash
# ============================================================
#   🧅 DARKWEB SETUP SCRIPT — void.onion
#   Run this after installing tor and nginx
#   Usage: chmod +x setup.sh && sudo ./setup.sh
# ============================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${GREEN}  🧅  VOID.ONION SETUP SCRIPT${NC}"
echo -e "${GREEN}  ==============================${NC}"
echo ""

# NVM Node bin paths (since sudo has restricted PATH)
NODE_BIN="/home/chantigadu/.nvm/versions/node/v20.20.2/bin/node"
NPM_BIN="/home/chantigadu/.nvm/versions/node/v20.20.2/bin/npm"

# --- 1. Check dependencies ---
echo -e "${CYAN}[1/5] Checking dependencies...${NC}"
for pkg in tor nginx; do
  if ! command -v $pkg &> /dev/null; then
    echo -e "${RED}[ERROR] $pkg is not installed. Run: sudo apt install -y tor nginx${NC}"
    exit 1
  fi
done

if [ ! -f "$NODE_BIN" ]; then
  echo -e "${RED}[ERROR] Node.js binary not found at $NODE_BIN${NC}"
  exit 1
fi
if [ ! -f "$NPM_BIN" ]; then
  echo -e "${RED}[ERROR] npm binary not found at $NPM_BIN${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓ tor, nginx, node, and npm found${NC}"

# --- 2. Copy site files and Nginx config ---
echo -e "${CYAN}[2/5] Setting up Nginx and website directories...${NC}"
mkdir -p /var/www/darkwebstuff/uploads

# Copy front-end assets
cp "$(dirname "$0")/index.html" /var/www/darkwebstuff/
cp "$(dirname "$0")/chat.html" /var/www/darkwebstuff/
cp "$(dirname "$0")/style.css" /var/www/darkwebstuff/
cp "$(dirname "$0")/script.js" /var/www/darkwebstuff/

# Copy backend server files
cp "$(dirname "$0")/package.json" /var/www/darkwebstuff/
cp "$(dirname "$0")/server.js" /var/www/darkwebstuff/

# Set ownership and permissions: www-data for Nginx, chantigadu for Node.js backend
chown -R www-data:chantigadu /var/www/darkwebstuff
find /var/www/darkwebstuff -type d -exec chmod 775 {} \;
find /var/www/darkwebstuff -type f -exec chmod 664 {} \;

# Install npm dependencies
echo -e "${CYAN}      Installing Node.js dependencies...${NC}"
cd /var/www/darkwebstuff
# Run npm install as the chantigadu user so permissions remain intact
sudo -u chantigadu "$NPM_BIN" install --omit=dev

# Deploy Nginx config
cp "$(dirname "$0")/nginx-darkweb.conf" /etc/nginx/sites-available/darkweb
ln -sf /etc/nginx/sites-available/darkweb /etc/nginx/sites-enabled/darkweb
# Test nginx config
nginx -t
echo -e "${GREEN}  ✓ Nginx and files configured on 127.0.0.1:8080${NC}"

# --- 3. Configure Systemd Service for Node backend ---
echo -e "${CYAN}[3/5] Configuring Node.js backend service...${NC}"
SERVICE_FILE="/etc/systemd/system/void-onion-backend.service"

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Void Onion Chat Backend
After=network.target

[Service]
Type=simple
User=chantigadu
Group=chantigadu
WorkingDirectory=/var/www/darkwebstuff
ExecStart=$NODE_BIN server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable void-onion-backend
systemctl restart void-onion-backend
echo -e "${GREEN}  ✓ Systemd service for backend is running${NC}"

# --- 4. Configure Tor ---
echo -e "${CYAN}[4/5] Configuring Tor hidden service...${NC}"
TORRC="/etc/tor/torrc"
HIDDEN_SVC_DIR="/var/lib/tor/darkweb_hidden_service"

# Add hidden service config if not already there
if ! grep -q "darkweb_hidden_service" "$TORRC"; then
  echo "" >> "$TORRC"
  echo "# === VOID.ONION Hidden Service ===" >> "$TORRC"
  echo "HiddenServiceDir $HIDDEN_SVC_DIR" >> "$TORRC"
  echo "HiddenServicePort 80 127.0.0.1:8080" >> "$TORRC"
  echo -e "${GREEN}  ✓ Tor config updated${NC}"
else
  echo -e "${YELLOW}  ⚠ Tor config already set — skipping${NC}"
fi

# Set permissions
mkdir -p "$HIDDEN_SVC_DIR"
chown -R debian-tor:debian-tor "$HIDDEN_SVC_DIR" 2>/dev/null || chown -R tor:tor "$HIDDEN_SVC_DIR" 2>/dev/null || true
chmod 700 "$HIDDEN_SVC_DIR"

# Start / restart services
echo -e "${CYAN}      Starting Tor and Nginx...${NC}"
systemctl enable nginx tor
systemctl restart nginx
systemctl restart tor

# Give tor a moment to generate the onion address
echo -e "${YELLOW}  ⏳ Waiting for Tor to generate .onion address...${NC}"
sleep 5

# --- 5. Show .onion address ---
echo -e "${CYAN}[5/5] Getting your .onion address...${NC}"
HOSTNAME_FILE="$HIDDEN_SVC_DIR/hostname"
if [ -f "$HOSTNAME_FILE" ]; then
  ONION=$(cat "$HOSTNAME_FILE")
  echo ""
  echo -e "${GREEN}  ╔══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}  ║  🧅 YOUR .ONION ADDRESS:             ║${NC}"
  echo -e "${GREEN}  ║                                      ║${NC}"
  echo -e "${CYAN}  ║  http://${ONION}  ║${NC}"
  echo -e "${GREEN}  ║                                      ║${NC}"
  echo -e "${GREEN}  ╚══════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}  Open this in Tor Browser to see your site! 🎉${NC}"
else
  echo -e "${YELLOW}  ⏳ Tor is still starting up. Wait 30s and check:${NC}"
  echo -e "     sudo cat $HOSTNAME_FILE"
fi

echo ""
echo -e "${GREEN}  ✅ Setup complete!${NC}"
echo ""
echo -e "  Backend:       ${CYAN}systemctl status void-onion-backend${NC}"
echo -e "  Nginx status:  ${CYAN}systemctl status nginx${NC}"
echo -e "  Tor status:    ${CYAN}systemctl status tor${NC}"
echo -e "  Backend logs:  ${CYAN}journalctl -u void-onion-backend -f${NC}"
echo ""
