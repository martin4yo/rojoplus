# Runbook · Deploy a producción (clubix)

> Secuencia **ensayada el 2026-08-19** sobre una copia restaurada de la base de
> producción (`clubix_migtest`, 598.468 filas). Resultado: 0 tablas perdieron
> filas. Ver "Resultado del ensayo" al final.

## Estado de partida

| | |
|---|---|
| Host | `clubix` → 179.43.123.248:2222, usuario `axiomacloud` (sudo sin password) |
| Código | `/var/www/clubix`, owner `clubixapp` |
| Backend | PM2 `clubix-backend` :5400 · `PM2_HOME=/var/www/clubix/.pm2` · systemd `pm2-clubixapp` |
| nginx | app en `/var/www/clubix/client/dist` · landing en `/var/www/clubix/web` |
| DB | VPS :5432 (túnel SSH `localhost:5436`) · pgBackRest stanza `clubix` |
| HEAD actual | `4ad7415` (6-jun-2026) — **21 commits atrás** de `origin/main` |

Atajo para todos los comandos como el usuario de la app:

```bash
CX() { sudo -n -u clubixapp env PM2_HOME=/var/www/clubix/.pm2 "$@"; }
```

---

## 1. Punto de retorno (ANTES de tocar nada)

```bash
# 1.1 marcar el commit actual
CX git -C /var/www/clubix tag prod-$(date +%Y%m%d) HEAD

# 1.2 guardar el build actual (13 MB) — evita rebuildear en un rollback
sudo cp -a /var/www/clubix/client/dist /var/www/clubix/client/dist.bak-$(date +%Y%m%d)

# 1.3 backup full dedicado + marca de tiempo para PITR
sudo -u postgres pgbackrest backup --stanza=clubix --type=full
date -Is   # ← ANOTAR: es el target de un eventual restore
```

## 2. Destrabar el árbol de git (si no, `git pull` aborta)

Producción tiene cambios locales que chocan con los commits entrantes:

```bash
# 2.1 web/ tiene archivos modificados y staged que los commits nuevos tocan
CX git -C /var/www/clubix stash push --include-untracked -- web/ web_old/

# 2.2 untracked que un commit entrante quiere crear
sudo mv /var/www/clubix/server/uploads/tenants/tenant-7-logo.jpg \
        /var/www/clubix/server/uploads/tenants/tenant-7-logo.jpg.bak

CX git -C /var/www/clubix status --porcelain   # debe quedar limpio
```

## 3. Dependencia fuera del repo

`client/package.json` incorpora `"@axio/chat": "file:../../axio-chat"`, que resuelve
a `/var/www/axio-chat` y **no existe en producción** (sí en dev-1, 48 KB).

```bash
# desde la máquina local, o rsync dev-1 → prod
scp -r -P 2222 ../axio-chat axiomacloud@179.43.123.248:/tmp/axio-chat
sudo mv /tmp/axio-chat /var/www/axio-chat
```

## 4. Traer el código

```bash
CX git -C /var/www/clubix fetch origin
CX git -C /var/www/clubix pull --ff-only origin main
CX git -C /var/www/clubix log --oneline -1     # verificar el sha esperado
```

## 5. Migración de base — el único paso sin rollback por git

> ⚠️ **NUNCA `TRUNCATE ... CASCADE`.** El CASCADE es transitivo: sigue toda la
> cadena de foreign keys. El 2026-07-22 vació `cargos`, `notificaciones_log`,
> cobranzas y débito, y hubo que recuperar con PITR. `DELETE` plano es seguro:
> la única FK que apunta a `configuracion_debito` es
> `archivos_debito.configuracion_id`, y es **ON DELETE RESTRICT** (falla, no propaga).

```bash
cd /var/www/clubix/server

# 5.1 snapshot de conteos de TODAS las tablas (para verificar al final)
psql "$DATABASE_URL" -tAF',' -c "
select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I','public',table_name), false,true,'')))[1]::text::bigint
from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
order by table_name;" > /tmp/counts-ANTES.csv

# 5.2 exportar la config de débito
psql "$DATABASE_URL" -tAc "select coalesce(json_agg(t),'[]') from configuracion_debito t;" \
  > /tmp/configdebito-premig.json

# 5.3 DELETE plano (NO truncate)
psql "$DATABASE_URL" -c "DELETE FROM configuracion_debito;"

# 5.4 db push — falla la 1ª vez, es esperado (ver 5.5)
npx prisma db push --skip-generate --accept-data-loss

# 5.5 workaround conocido: Prisma no puede dropear el índice porque lo sostiene
#     la constraint. Dropearla a mano y reintentar.
psql "$DATABASE_URL" -c "ALTER TABLE configuracion_debito DROP CONSTRAINT configuracion_debito_tenant_id_codigo_key;"
npx prisma db push --skip-generate --accept-data-loss

# 5.6 regenerar el client y migrar los datos (idempotente; probar con --dry-run)
npx prisma generate
node src/scripts/migrarConfiguracionDebitoAProcesador.js --json /tmp/configdebito-premig.json --dry-run
node src/scripts/migrarConfiguracionDebitoAProcesador.js --json /tmp/configdebito-premig.json
```

## 6. Build y arranque

```bash
cd /var/www/clubix/client && CX npm install && CX npm run build
CX pm2 restart clubix-backend --update-env
CX pm2 logs clubix-backend --lines 50 --nostream
```

> **Usar siempre `--update-env`.** PM2 cachea el environment del arranque
> original: sin ese flag, los cambios en `.env` no se aplican y el proceso sigue
> con la configuración vieja. Se detectó en el deploy a dev-1 del 2026-08-19,
> donde el cron de la cola de notificaciones seguía corriendo pese a tener
> `DISABLE_ALL_CRONS=true` en el `.env` desde hacía días.

> El backend tarda ~9 s en bindear el puerto. Un `curl` inmediato después del
> restart da `000`; reintentar antes de dar el deploy por fallido.

Si el commit no toca `client/` ni ningún `package.json`, el `npm install` y el
build son innecesarios — verificarlo con:
`git diff --name-only <tag>..HEAD -- client/ '*/package.json'`

## 7. Verificación

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5400/api/health   # 200

# ningún conteo debe BAJAR; lo único esperado es procesadores_debito de 0 → N
psql "$DATABASE_URL" -tAF',' -c "…mismo query que 5.1…" > /tmp/counts-DESPUES.csv
diff <(sort /tmp/counts-ANTES.csv) <(sort /tmp/counts-DESPUES.csv)
```

Chequeos funcionales mínimos: login admin, listado de socios, cuenta corriente de
un socio, alta de un cobro, y la solapa de Débito Automático (es lo que cambió).

## 8. Rollback

**Código** (si la app falla pero la base está sana):

```bash
CX git -C /var/www/clubix reset --hard prod-YYYYMMDD
sudo rm -rf /var/www/clubix/client/dist
sudo mv /var/www/clubix/client/dist.bak-YYYYMMDD /var/www/clubix/client/dist
CX pm2 restart clubix-backend
```

**Base**: no hay rollback por git — `prisma db push` no tiene down-migration.
Única vía: PITR con pgBackRest al timestamp anotado en 1.3. Implica parar el
backend, restaurar y perder lo escrito desde ese punto. Por eso: ventana de baja
actividad.

---

## Resultado del ensayo (2026-08-19)

Copia de producción restaurada en `clubix_migtest` y secuencia completa ejecutada:

| Control | Resultado |
|---|---|
| Restore del dump de prod | sin errores · 178 tablas · 598.468 filas |
| `DELETE FROM configuracion_debito` | 4 filas · cargos/pagos/notificaciones intactos |
| `prisma db push` (1er intento) | ❌ falla por la constraint — **esperado**, ver 5.5 |
| `prisma db push` (tras dropear constraint) | ✅ 2,9 s |
| Script de migración | ✅ 2 procesadores (PRISMA, PAYWAY) + 4 configs (t1, t4) |
| Fidelidad de datos | ✅ 4/4 configs, todos los campos coinciden con el export |
| **Tablas que perdieron filas** | **✅ ninguna** (0 de 178) |
| Delta total de filas | +2 (los 2 procesadores nuevos) |
| Boot del backend contra la base migrada | ✅ `/api/health` → 200 |

Comparación clave: `cargos` 227.229 → 227.229 · `pagos` 140.044 → 140.044 ·
`socios` 9.354 → 9.354.
