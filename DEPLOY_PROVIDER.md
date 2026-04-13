# Deploy With Provider Login

This guide deploys Photoview as a standalone production service with:

- Docker Compose
- MariaDB
- Provider-based login
- first-run auto provisioning

## Assumptions

- Project path on server: `/var/www/web-srn/photo_gallery`
- Persistent app data path: `/opt/photoview`
- Media path on host: `/srv/photos`
- Public URL: `https://photos.example.com`

Adjust these values for your environment.

## 1. Prepare files

```bash
cd /var/www/web-srn/photo_gallery
cp "docker-compose example/example.env" .env
cp "docker-compose example/docker-compose.example.yml" docker-compose.yml
```

Alternative:

- use [deploy/provider-uat.env.example](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/provider-uat.env.example) as your UAT starting point
- use [deploy/provider-prd.env.example](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/provider-prd.env.example) as your PRD starting point

## 2. Edit `.env`

Use values like this:

```env
HOST_PHOTOVIEW_LOCATION=/opt/photoview
HOST_PHOTOVIEW_MEDIA_ROOT=/srv/photos

PHOTOVIEW_DATABASE_DRIVER=mysql
MARIADB_DATABASE=photoview
MARIADB_USER=photoview
MARIADB_PASSWORD=change_me
MARIADB_ROOT_PASSWORD=change_root_me

PHOTOVIEW_PROVIDER_AUTH_ENABLED=1
PHOTOVIEW_PROVIDER_AUTO_PROVISION=1
PHOTOVIEW_PROVIDER_HEALTH_ID_BASE_URL=https://moph.id.th
PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_ID=replace_me
PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_SECRET=replace_me
PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_URI=https://photos.example.com/api/auth/provider/callback
PHOTOVIEW_PROVIDER_HEALTH_ID_SCOPE=openid profile
PHOTOVIEW_PROVIDER_BASE_URL=https://provider.id.th
PHOTOVIEW_PROVIDER_CLIENT_ID=replace_me
PHOTOVIEW_PROVIDER_SECRET_KEY=replace_me
PHOTOVIEW_INITIAL_ROOT_PATH=/photos
```

## 3. Enable Provider env passthrough in `docker-compose.yml`

Uncomment these lines under `photoview.environment`:

```yaml
# PHOTOVIEW_PROVIDER_AUTH_ENABLED: ${PHOTOVIEW_PROVIDER_AUTH_ENABLED}
# PHOTOVIEW_PROVIDER_AUTO_PROVISION: ${PHOTOVIEW_PROVIDER_AUTO_PROVISION}
# PHOTOVIEW_PROVIDER_HEALTH_ID_BASE_URL: ${PHOTOVIEW_PROVIDER_HEALTH_ID_BASE_URL}
# PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_ID: ${PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_ID}
# PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_SECRET: ${PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_SECRET}
# PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_URI: ${PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_URI}
# PHOTOVIEW_PROVIDER_HEALTH_ID_SCOPE: ${PHOTOVIEW_PROVIDER_HEALTH_ID_SCOPE}
# PHOTOVIEW_PROVIDER_BASE_URL: ${PHOTOVIEW_PROVIDER_BASE_URL}
# PHOTOVIEW_PROVIDER_CLIENT_ID: ${PHOTOVIEW_PROVIDER_CLIENT_ID}
# PHOTOVIEW_PROVIDER_SECRET_KEY: ${PHOTOVIEW_PROVIDER_SECRET_KEY}
# PHOTOVIEW_INITIAL_ROOT_PATH: ${PHOTOVIEW_INITIAL_ROOT_PATH}
```

If you want a direct public port, keep:

```yaml
ports:
  - "8000:80"
```

## 4. Make media readable

```bash
chmod o+rx /srv/photos
find /srv/photos -type d -exec chmod o+rx {} \;
find /srv/photos -type f -exec chmod o+r {} \;
```

Adjust these commands if you use a stricter group-based permission model.

## 5. Start services

```bash
docker compose --env-file .env up -d
docker compose logs -f photoview
```

## 6. Reverse proxy

If you use Nginx Proxy Manager, Traefik, Caddy, or Nginx, point the public hostname to:

```text
http://127.0.0.1:8000
```

If TLS terminates at the proxy, keep the public callback URL as:

```text
https://photos.example.com/api/auth/provider/callback
```

An Nginx example is available at [deploy/nginx.photos.example.com.conf.example](/abs/path/c:/xampp/htdocs/photo_gallery/deploy/nginx.photos.example.com.conf.example).

## 7. First login

- Open `https://photos.example.com`
- Click `Sign in with Provider ID`
- Complete login at the Provider
- On a brand-new install, the first successful Provider login becomes the initial admin
- The root album path is created automatically from `PHOTOVIEW_INITIAL_ROOT_PATH`

## 8. First scan

After login:

- go to `Settings`
- click `Scan All`

## Notes

- Photoview still needs its own database even with external login enabled.
- The callback URL must match the exact public URL configured at the Provider.
- If first login fails on a new install, check:
  - Provider credentials
  - callback URL
  - media path exists inside container as `/photos`
  - DB container is healthy
