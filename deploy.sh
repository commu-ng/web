#!/bin/bash
set -e

git pull
cd api && DATABASE_URL=postgresql:///commu_ng pnpm db:migrate
cd ..
docker-compose up -d --build
