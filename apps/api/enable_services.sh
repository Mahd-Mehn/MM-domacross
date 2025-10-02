#!/bin/bash

# Script to enable background services for production/testing

echo "Enabling background services..."

# Update .env file to enable services
sed -i.bak 's/ENABLE_BACKGROUND_POLLING=false/ENABLE_BACKGROUND_POLLING=true/' .env
sed -i.bak 's/ENABLE_ORDERBOOK_SNAPSHOTS=false/ENABLE_ORDERBOOK_SNAPSHOTS=true/' .env
sed -i.bak 's/ENABLE_NAV_CALCULATIONS=false/ENABLE_NAV_CALCULATIONS=true/' .env
sed -i.bak 's/ENABLE_RECONCILIATION=false/ENABLE_RECONCILIATION=true/' .env
sed -i.bak 's/ENABLE_BACKFILL_SERVICE=false/ENABLE_BACKFILL_SERVICE=true/' .env
sed -i.bak 's/ENABLE_MERKLE_SERVICE=false/ENABLE_MERKLE_SERVICE=true/' .env

echo "Background services enabled! Restart the server to apply changes."
echo "To disable again, run: ./disable_services.sh"
