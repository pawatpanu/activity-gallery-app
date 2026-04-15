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
HOST_PHOTOVIEW_MEDIA_ROOT=/var/www/web-srn/public
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
```

## 4. Allow media reads

```bash
chmod o+rx /var/www/web-srn/public
find /var/www/web-srn/public -type d -exec chmod o+rx {} \;
find /var/www/web-srn/public -type f -exec chmod o+r {} \;
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

Complete the normal initial setup with a local admin account, then go to `Settings` and click `Scan All`.

## 7. Later, when the domain is ready

Switch to:

- [deploy/provider-prd.env.example](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/provider-prd.env.example)
- [deploy/docker-compose.provider.example.yml](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/docker-compose.provider.example.yml)

Then set:

- `PHOTOVIEW_UI_ENDPOINTS=https://your-domain`
- `PHOTOVIEW_PROVIDER_AUTH_ENABLED=1`
- `PHOTOVIEW_PROVIDER_AUTO_PROVISION=1`
- `PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_URI=https://your-domain/api/auth/provider/callback`
