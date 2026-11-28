#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
trap 'echo "Deployment Coup gagal pada baris $LINENO." >&2' ERR

# Accept the previous explicit proxy invocation as well.
if [[ ${1:-} == proxy ]]; then shift; fi
export COUP_RELEASE=${1:-}
if [[ $# != 1 || ! $COUP_RELEASE =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,119}$ || $COUP_RELEASE == local ]]; then
  echo "Pemakaian: bash redeploy.sh TAG_RILIS_UNIK" >&2
  exit 2
fi

if [[ ! -f .env.production ]]; then
  echo "File .env.production belum ditemukan. Salin dari .env.production.example lalu isi kredensial produksi." >&2
  exit 1
fi

# Pastikan direktori data persisten tersedia dan dapat ditulis oleh user node (uid 1000) di container.
mkdir -p ./data ./data/backups
if [[ -f ./data/coup.db ]]; then
  backup_file="./data/backups/coup-before-${COUP_RELEASE}.db"
  cp -p ./data/coup.db "$backup_file"
  [[ -f ./data/coup.db-wal ]] && cp -p ./data/coup.db-wal "${backup_file}-wal" || true
  [[ -f ./data/coup.db-shm ]] && cp -p ./data/coup.db-shm "${backup_file}-shm" || true
  echo "Backup database dibuat: $backup_file"
fi

compose=(docker compose -p coup-tabletop --env-file .env.production -f compose.yaml)
"${compose[@]}" config --quiet
if docker image inspect "coup-tabletop:$COUP_RELEASE" >/dev/null 2>&1; then
  echo "Tag rilis sudah ada. Pilih tag baru atau ikuti prosedur rollback." >&2
  exit 1
fi
previous=$("${compose[@]}" ps -aq tabletop)
if [[ -n $previous ]]; then
  previous_image=$(docker inspect --format '{{.Image}}' "$previous")
  docker image tag "$previous_image" "coup-tabletop:before-$COUP_RELEASE"
  echo "Image sebelumnya: $previous_image (tag before-$COUP_RELEASE)"
fi
"${compose[@]}" build tabletop
"${compose[@]}" up -d --no-build --pull never --no-deps --wait --wait-timeout 90 tabletop
"${compose[@]}" exec -T tabletop node -e "
Promise.all([
  fetch('http://127.0.0.1:3000/healthz').then(r => { if (!r.ok) throw Error('healthz'); }),
  fetch('http://127.0.0.1:3000/api/auth/me').then(r => { if (!r.ok) throw Error('auth'); }),
  fetch('http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling').then(async r => {
    if (!r.ok || !(await r.text()).startsWith('0{')) throw Error('socket.io');
  }),
]).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
"
echo "Rilis $COUP_RELEASE sehat secara internal (healthz, auth API, Socket.IO). Periksa HTTPS dan koneksi dua pemain."
