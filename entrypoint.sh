#!/bin/bash
set -euo pipefail

cd /app

git fetch
git checkout ${BRANCH:-master}
git reset --hard @{upstream}

chmod +x /app/auto_updating_entrypoint.sh
/app/auto_updating_entrypoint.sh
