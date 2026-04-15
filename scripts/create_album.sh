#!/usr/bin/env bash

set -eu

MEDIA_ROOT="${HOST_PHOTOVIEW_MEDIA_ROOT:-/var/www/web-srn/activity_gallery_media}"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <album-folder-name>" >&2
  exit 1
fi

ALBUM_NAME="$1"
ALBUM_PATH="${MEDIA_ROOT}/${ALBUM_NAME}"

mkdir -p "$ALBUM_PATH"
chmod o+rx "$MEDIA_ROOT" "$ALBUM_PATH"

echo "Created album folder:"
echo "$ALBUM_PATH"
echo
echo "Next steps:"
echo "1. Copy image files into the folder"
echo "2. Run 'Scan all users' in Photoview Settings"
