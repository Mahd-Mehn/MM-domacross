#!/bin/bash

# Script to disable background services for fast development

echo "Disabling background services for fast development..."

# Update .env file to disable services
sed -i.bak 's/ENABLE_BACKGROUND_POLLING=true/ENABLE_BACKGROUND_POLLING=false/' .env
sed -i.bak 's/ENABLE_ORDERBOOK_SNAPSHOTS=true/ENABLE_ORDERBOOK_SNAPSHOTS=false/' .env
sed -i.bak 's/ENABLE_NAV_CALCULATIONS=true/ENABLE_NAV_CALCULATIONS=false/' .env
sed -i.bak 's/ENABLE_RECONCILIATION=true/ENABLE_RECONCILIATION=false/' .env
sed -i.bak 's/ENABLE_BACKFILL_SERVICE=true/ENABLE_BACKFILL_SERVICE=false/' .env
sed -i.bak 's/ENABLE_MERKLE_SERVICE=true/ENABLE_MERKLE_SERVICE=false/' .env

echo "Background services disabled! Restart the server to apply changes."
echo "To enable again, run: ./enable_services.sh"
