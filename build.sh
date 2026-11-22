#!/usr/bin/env bash
set -euo pipefail

# Build Scramjet 2.x assets from the separate ubg-site-sj repository.
rm -rf .scramjet-source .scramjet-build
git clone --depth 1 https://github.com/beans-jusfine/ubg-site-sj.git .scramjet-source
npm install --prefix .scramjet-source
(
  cd .scramjet-source
  OUT_DIR=../.scramjet-build npm run setup
)

# Serve all runtime files from Fernlight's origin for the root-scoped service worker.
for dir in scram controller utils epoxy; do
  rm -rf "./$dir"
  cp -R ".scramjet-build/$dir" "./$dir"
done
cp .scramjet-build/sw.js ./sw.js

rm -rf .scramjet-source .scramjet-build
echo "Fernlight + Scramjet 2.x assets are ready for deployment."
