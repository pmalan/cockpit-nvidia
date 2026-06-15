#!/usr/bin/env bash
# Install the cockpit-nvidia plugin on Fedora
set -euo pipefail

# Stop cockpit.socket first to prevent terminal from being killed (SSH shares the same socket)
# Install runs with cockpit offline, then we bring it back up
echo "Stopping cockpit temporarily..."
sudo systemctl stop cockpit.socket

echo "Installing cockpit-nvidia..."

sudo mkdir -p /usr/share/cockpit/cockpit-nvidia
sudo cp manifest.json index.html index.js index.css /usr/share/cockpit/cockpit-nvidia/
sudo cp org.cockpit_project.nvidia_read.policy /usr/share/polkit-1/actions/

# Restart cockpit and wait for it to come up
sudo systemctl start cockpit.socket
sleep 2

echo "Done. Open https://$(hostname):9090 and click 'NVIDIA GPU'."
