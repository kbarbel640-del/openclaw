---
summary: "Ejecute OpenClaw Gateway 24/7 en una VM de GCP Compute Engine (Docker) con estado duradero"
read_when:
  - Quiere OpenClaw ejecutándose 24/7 en GCP
  - Quiere un Gateway de nivel producción, siempre activo, en su propia VM
  - Quiere control total sobre la persistencia, los binarios y el comportamiento de reinicio
title: "GCP"
x-i18n:
  source_path: install/gcp.md
  source_hash: abb236dd421505d3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:20Z
---

# OpenClaw en GCP Compute Engine (Docker, Guia de VPS en Produccion)

## Objetivo

Ejecutar un OpenClaw Gateway persistente en una VM de GCP Compute Engine usando Docker, con estado duradero, binarios integrados y comportamiento de reinicio seguro.

Si quiere "OpenClaw 24/7 por ~$5-12/mes", esta es una configuracion confiable en Google Cloud.
El precio varía segun el tipo de maquina y la region; elija la VM mas pequeña que se ajuste a su carga de trabajo y escale si encuentra OOM.

## ¿Que estamos haciendo (en terminos simples)?

- Crear un proyecto de GCP y habilitar la facturacion
- Crear una VM de Compute Engine
- Instalar Docker (runtime de aplicaciones aislado)
- Iniciar el OpenClaw Gateway en Docker
- Persistir `~/.openclaw` + `~/.openclaw/workspace` en el host (sobrevive reinicios/reconstrucciones)
- Acceder a la UI de Control desde su laptop mediante un tunel SSH

El Gateway se puede acceder mediante:

- Reenvio de puertos SSH desde su laptop
- Exposicion directa de puertos si usted gestiona el firewall y los tokens por su cuenta

Esta guia usa Debian en GCP Compute Engine.
Ubuntu tambien funciona; mapee los paquetes en consecuencia.
Para el flujo generico de Docker, vea [Docker](/install/docker).

---

## Ruta rapida (operadores experimentados)

1. Crear proyecto de GCP + habilitar la API de Compute Engine
2. Crear VM de Compute Engine (e2-small, Debian 12, 20GB)
3. Conectarse por SSH a la VM
4. Instalar Docker
5. Clonar el repositorio de OpenClaw
6. Crear directorios persistentes en el host
7. Configurar `.env` y `docker-compose.yml`
8. Integrar los binarios requeridos, construir y lanzar

---

## Lo que necesita

- Cuenta de GCP (el nivel gratuito es elegible para e2-micro)
- gcloud CLI instalado (o usar Cloud Console)
- Acceso SSH desde su laptop
- Comodidad basica con SSH + copiar/pegar
- ~20-30 minutos
- Docker y Docker Compose
- Credenciales de autenticacion del modelo
- Credenciales opcionales de proveedores
  - QR de WhatsApp
  - Token de bot de Telegram
  - OAuth de Gmail

---

## 1) Instalar gcloud CLI (o usar Console)

**Opcion A: gcloud CLI** (recomendado para automatizacion)

Instale desde https://cloud.google.com/sdk/docs/install

Inicialice y autentique:

```bash
gcloud init
gcloud auth login
```

**Opcion B: Cloud Console**

Todos los pasos se pueden realizar mediante la UI web en https://console.cloud.google.com

---

## 2) Crear un proyecto de GCP

**CLI:**

```bash
gcloud projects create my-openclaw-project --name="OpenClaw Gateway"
gcloud config set project my-openclaw-project
```

Habilite la facturacion en https://console.cloud.google.com/billing (requerido para Compute Engine).

Habilite la API de Compute Engine:

```bash
gcloud services enable compute.googleapis.com
```

**Console:**

1. Vaya a IAM y Admin > Crear proyecto
2. Asigne un nombre y cree el proyecto
3. Habilite la facturacion para el proyecto
4. Navegue a APIs y Servicios > Habilitar APIs > busque "Compute Engine API" > Habilitar

---

## 3) Crear la VM

**Tipos de maquina:**

| Tipo     | Especificaciones             | Costo                   | Notas                      |
| -------- | ---------------------------- | ----------------------- | -------------------------- |
| e2-small | 2 vCPU, 2GB RAM              | ~$12/mes                | Recomendado                |
| e2-micro | 2 vCPU (compartido), 1GB RAM | Elegible nivel gratuito | Puede tener OOM bajo carga |

**CLI:**

```bash
gcloud compute instances create openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small \
  --boot-disk-size=20GB \
  --image-family=debian-12 \
  --image-project=debian-cloud
```

**Console:**

1. Vaya a Compute Engine > Instancias de VM > Crear instancia
2. Nombre: `openclaw-gateway`
3. Region: `us-central1`, Zona: `us-central1-a`
4. Tipo de maquina: `e2-small`
5. Disco de arranque: Debian 12, 20GB
6. Crear

---

## 4) Conectarse por SSH a la VM

**CLI:**

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

**Console:**

Haga clic en el boton "SSH" junto a su VM en el panel de Compute Engine.

Nota: La propagacion de claves SSH puede tardar 1-2 minutos despues de crear la VM. Si la conexion es rechazada, espere y vuelva a intentar.

---

## 5) Instalar Docker (en la VM)

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Cierre sesion y vuelva a iniciar para que el cambio de grupo tenga efecto:

```bash
exit
```

Luego vuelva a conectarse por SSH:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

Verifique:

```bash
docker --version
docker compose version
```

---

## 6) Clonar el repositorio de OpenClaw

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

Esta guia asume que usted construira una imagen personalizada para garantizar la persistencia de los binarios.

---

## 7) Crear directorios persistentes en el host

Los contenedores Docker son efimeros.
Todo el estado de larga duracion debe vivir en el host.

```bash
mkdir -p ~/.openclaw
mkdir -p ~/.openclaw/workspace
```

---

## 8) Configurar variables de entorno

Cree `.env` en la raiz del repositorio.

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/home/$USER/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/$USER/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

Genere secretos fuertes:

```bash
openssl rand -hex 32
```

**No confirme este archivo en el repositorio.**

---

## 9) Configuracion de Docker Compose

Cree o actualice `docker-compose.yml`.

```yaml
services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    build: .
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - HOME=/home/node
      - NODE_ENV=production
      - TERM=xterm-256color
      - OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
      - OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
      - XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
      - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    ports:
      # Recommended: keep the Gateway loopback-only on the VM; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VM and need Canvas host.
      # If you expose this publicly, read /gateway/security and firewall accordingly.
      # - "18793:18793"
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "${OPENCLAW_GATEWAY_BIND}",
        "--port",
        "${OPENCLAW_GATEWAY_PORT}",
      ]
```

---

## 10) Integrar los binarios requeridos en la imagen (critico)

Instalar binarios dentro de un contenedor en ejecucion es una trampa.
Cualquier cosa instalada en tiempo de ejecucion se perdera al reiniciar.

Todos los binarios externos requeridos por Skills deben instalarse en el momento de construir la imagen.

Los ejemplos a continuacion muestran solo tres binarios comunes:

- `gog` para acceso a Gmail
- `goplaces` para Google Places
- `wacli` para WhatsApp

Estos son ejemplos, no una lista completa.
Puede instalar tantos binarios como sea necesario usando el mismo patron.

Si mas adelante agrega nuevas Skills que dependan de binarios adicionales, debe:

1. Actualizar el Dockerfile
2. Reconstruir la imagen
3. Reiniciar los contenedores

**Ejemplo de Dockerfile**

```dockerfile
FROM node:22-bookworm

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# Example binary 1: Gmail CLI
RUN curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Example binary 2: Google Places CLI
RUN curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces

# Example binary 3: WhatsApp CLI
RUN curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli

# Add more binaries below using the same pattern

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

---

## 11) Construir y lanzar

```bash
docker compose build
docker compose up -d openclaw-gateway
```

Verificar binarios:

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

Salida esperada:

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 12) Verificar el Gateway

```bash
docker compose logs -f openclaw-gateway
```

Exito:

```
[gateway] listening on ws://0.0.0.0:18789
```

---

## 13) Acceso desde su laptop

Cree un tunel SSH para reenviar el puerto del Gateway:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a -- -L 18789:127.0.0.1:18789
```

Abra en su navegador:

`http://127.0.0.1:18789/`

Pegue su token del Gateway.

---

## Que persiste y donde (fuente de verdad)

OpenClaw se ejecuta en Docker, pero Docker no es la fuente de verdad.
Todo el estado de larga duracion debe sobrevivir reinicios, reconstrucciones y reinicios del sistema.

| Componente                    | Ubicacion                          | Mecanismo de persistencia     | Notas                               |
| ----------------------------- | ---------------------------------- | ----------------------------- | ----------------------------------- |
| Configuracion del Gateway     | `/home/node/.openclaw/`            | Montaje de volumen del host   | Incluye `openclaw.json`, tokens     |
| Perfiles de auth del modelo   | `/home/node/.openclaw/`            | Montaje de volumen del host   | Tokens OAuth, claves API            |
| Configuraciones de Skills     | `/home/node/.openclaw/skills/`     | Montaje de volumen del host   | Estado a nivel de Skill             |
| Espacio de trabajo del agente | `/home/node/.openclaw/workspace/`  | Montaje de volumen del host   | Codigo y artefactos del agente      |
| Sesion de WhatsApp            | `/home/node/.openclaw/`            | Montaje de volumen del host   | Preserva el inicio de sesion por QR |
| Llavero de Gmail              | `/home/node/.openclaw/`            | Volumen del host + contraseña | Requiere `GOG_KEYRING_PASSWORD`     |
| Binarios externos             | `/usr/local/bin/`                  | Imagen Docker                 | Deben integrarse en el build        |
| Runtime de Node               | Sistema de archivos del contenedor | Imagen Docker                 | Reconstruido en cada build          |
| Paquetes del SO               | Sistema de archivos del contenedor | Imagen Docker                 | No instalar en runtime              |
| Contenedor Docker             | Efimero                            | Reiniciable                   | Seguro de destruir                  |

---

## Actualizaciones

Para actualizar OpenClaw en la VM:

```bash
cd ~/openclaw
git pull
docker compose build
docker compose up -d
```

---

## Solucion de problemas

**Conexion SSH rechazada**

La propagacion de claves SSH puede tardar 1-2 minutos despues de crear la VM. Espere y vuelva a intentar.

**Problemas con OS Login**

Revise su perfil de OS Login:

```bash
gcloud compute os-login describe-profile
```

Asegurese de que su cuenta tenga los permisos IAM requeridos (Compute OS Login o Compute OS Admin Login).

**Falta de memoria (OOM)**

Si usa e2-micro y encuentra OOM, actualice a e2-small o e2-medium:

```bash
# Stop the VM first
gcloud compute instances stop openclaw-gateway --zone=us-central1-a

# Change machine type
gcloud compute instances set-machine-type openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small

# Start the VM
gcloud compute instances start openclaw-gateway --zone=us-central1-a
```

---

## Cuentas de servicio (mejor practica de seguridad)

Para uso personal, su cuenta de usuario predeterminada funciona bien.

Para automatizacion o pipelines de CI/CD, cree una cuenta de servicio dedicada con permisos minimos:

1. Crear una cuenta de servicio:

   ```bash
   gcloud iam service-accounts create openclaw-deploy \
     --display-name="OpenClaw Deployment"
   ```

2. Conceder el rol Compute Instance Admin (o un rol personalizado mas restringido):
   ```bash
   gcloud projects add-iam-policy-binding my-openclaw-project \
     --member="serviceAccount:openclaw-deploy@my-openclaw-project.iam.gserviceaccount.com" \
     --role="roles/compute.instanceAdmin.v1"
   ```

Evite usar el rol Owner para automatizacion. Use el principio de privilegio minimo.

Vea https://cloud.google.com/iam/docs/understanding-roles para detalles sobre roles de IAM.

---

## Siguientes pasos

- Configurar canales de mensajeria: [Channels](/channels)
- Emparejar dispositivos locales como nodos: [Nodes](/nodes)
- Configurar el Gateway: [Gateway configuration](/gateway/configuration)
