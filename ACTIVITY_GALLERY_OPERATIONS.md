# Activity Gallery Operations

This guide describes the recommended operating model for using Photoview in this repository as an activity gallery for `web-srn`.

## Operating model

- One folder under the media root equals one album.
- Adding image files to a folder adds photos to that album.
- Removing image files from a folder removes photos after the next scan.
- Removing the folder removes the album after the next scan.
- Public album links from Photoview can then be copied into `siratwsv-main`.
- The media root must be mounted read-write inside the Photoview container for album creation and file upload to work.

## Media root

Use a dedicated media root for this project:

```text
/var/www/web-srn/activity_gallery_media
```

Example structure:

```text
/var/www/web-srn/activity_gallery_media/
  2026-04-activity-demo/
  2026-04-board-meeting/
  2026-04-public-relations/
```

## Naming convention

Recommended album folder naming:

```text
YYYY-MM-short-title
```

Examples:

```text
2026-04-songkran-event
2026-04-board-meeting
2026-04-public-relations
2026-05-health-campaign
```

Use lowercase letters, numbers, and hyphens to keep URLs and maintenance simple.

## Common tasks

Create a new album:

```bash
cd /var/www/web-srn/photo_gallery
./scripts/create_album.sh "2026-04-songkran-event"
```

Add photos to an album:

```bash
cp /path/to/source/*.jpg /var/www/web-srn/activity_gallery_media/2026-04-songkran-event/
chmod o+r /var/www/web-srn/activity_gallery_media/2026-04-songkran-event/*
```

Remove a photo:

```bash
rm /var/www/web-srn/activity_gallery_media/2026-04-songkran-event/photo-01.jpg
```

Remove an album:

```bash
rm -rf /var/www/web-srn/activity_gallery_media/2026-04-songkran-event
```

Then run a new scan from the Photoview UI:

- Open `Settings`
- Click `Scan all users`

## First-run checklist

1. Start the containers with Docker Compose.
2. Make sure the media root is mounted as `/photos` without the `:ro` suffix in `docker-compose.yml`.
3. Complete the Photoview initial setup.
4. Set `HOST_PHOTOVIEW_MEDIA_ROOT=/var/www/web-srn/activity_gallery_media`.
5. Create the first album folder.
6. Copy photos into that folder or upload them from the Settings page.
7. Run `Scan all users`.
8. Open the album in Photoview and copy the album link to `siratwsv-main`.

## Notes

- This deployment currently treats the filesystem as the source of truth for albums and photos.
- Photoview is being used as the gallery and sharing layer, not as a full CMS-style uploader.
- If you later need album creation and file upload directly in the UI, that should be implemented as a separate feature pass.
