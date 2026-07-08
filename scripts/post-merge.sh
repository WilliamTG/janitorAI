#!/bin/bash
# Post-merge setup: reinstall workspace dependencies after a task merge.
# The backend DB lives on Render (no local migrations to run here).
set -e

npm install
