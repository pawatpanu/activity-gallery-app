# LAN Setup Before Domain

Use this path when you want to bring the system up first on an internal IP before a real public domain and Provider callback URL are ready.

## 1. Prepare files

```bash
cd /var/www/web-srn/photo_gallery
cp deploy/provider-lan.env.example .env
cp deploy/docker-compose.provider.lan.example.yml docker-compose.yml
```

## 2. Edit `.env`

At minimum, set:

```env
HOST_PHOTOVIEW_MEDIA_ROOT=/var/www/web-srn/activity_gallery_media
PHOTOVIEW_UI_ENDPOINTS=http://192.168.111.23:8000
MARIADB_PASSWORD=change_me
MARIADB_ROOT_PASSWORD=change_root_me
```

Keep Provider login disabled until you have a stable public HTTPS URL:

```env
PHOTOVIEW_PROVIDER_AUTH_ENABLED=0
PHOTOVIEW_PROVIDER_AUTO_PROVISION=0
```

## 3. Prepare folders

```bash
mkdir -p /opt/photoview/storage
mkdir -p /opt/photoview/database/mariadb
mkdir -p /var/www/web-srn/activity_gallery_media
mkdir -p /var/www/web-srn/activity_gallery_media/album-demo
```

## 4. Allow media reads

```bash
chmod o+rx /var/www/web-srn/activity_gallery_media
find /var/www/web-srn/activity_gallery_media -type d -exec chmod o+rx {} \;
find /var/www/web-srn/activity_gallery_media -type f -exec chmod o+r {} \;
```

## 5. Start

```bash
docker compose --env-file .env config
docker compose --env-file .env up -d
docker compose ps
docker compose logs -f photoview
```

## 6. Open the site

Open:

```text
http://192.168.111.23:8000
```

Complete the normal initial setup with a local admin account. For the photo path, enter:

```text
/photos
```

Then copy some test photos into:

```text
/var/www/web-srn/activity_gallery_media/album-demo
```

And go to `Settings` and click `Scan All`.

If you want to use the web-based album creation and file upload features, make sure the media mount in `docker-compose.yml` is writable:

```yaml
- "${HOST_PHOTOVIEW_MEDIA_ROOT}:/photos"
```

## 7. Later, when the domain is ready

Switch to:

- [deploy/provider-prd.env.example](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/provider-prd.env.example)
- [deploy/docker-compose.provider.example.yml](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/docker-compose.provider.example.yml)

Then set:

- `PHOTOVIEW_UI_ENDPOINTS=https://your-domain`
- `PHOTOVIEW_PROVIDER_AUTH_ENABLED=1`
- `PHOTOVIEW_PROVIDER_AUTO_PROVISION=1`
- `PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_URI=https://your-domain/api/auth/provider/callback`

For day-to-day album operations, see [ACTIVITY_GALLERY_OPERATIONS.md](./ACTIVITY_GALLERY_OPERATIONS.md).
