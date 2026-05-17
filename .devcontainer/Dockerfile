# Use an Apple Silicon optimized image (Arm64)
FROM mcr.microsoft.com/devcontainers/javascript-node:24

# Install system dependencies + build-essential (needed for Rust compilation)
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Bun
RUN npm i -g bun

# Add Bun's global bin directory to PATH (pi-agent and other global bun packages)
ENV PATH="/home/node/.bun/bin:${PATH}"

# App setup
RUN mkdir -p /home/node/.pi/agent/skills/ && \
    chown -R node:node /home/node/.pi
