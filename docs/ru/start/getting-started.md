---
summary: "Установите OpenClaw и запустите Gateway за 5 минут"
read_when:
  - Первая установка OpenClaw
  - Настройка Gateway
title: "Начало работы"
---

# Начало работы

Установите OpenClaw и запустите Gateway за 5 минут.

## Требования

- **Node.js 22+** (рекомендуется 22.11 или новее)
- **API-ключ** от провайдера AI (рекомендуется Anthropic Claude)
- **Операционная система**: macOS, Linux или Windows

## Быстрая установка

<Steps>
  <Step title="Установите OpenClaw">
    ```bash
    npm install -g openclaw@latest
    ```
  </Step>

  <Step title="Запустите мастер настройки">
    ```bash
    openclaw onboard
    ```
    
    Мастер настройки поможет вам:
    - Настроить API-ключи провайдеров
    - Выбрать модель по умолчанию
    - Настроить каналы (WhatsApp, Telegram и т.д.)
    - Установить Gateway как системный сервис (опционально)
  </Step>

  <Step title="Подключите канал">
    ```bash
    openclaw channels login
    ```
    
    Выберите канал для подключения:
    - **WhatsApp**: сканируйте QR-код
    - **Telegram**: введите номер телефона и код подтверждения
    - **Discord**: введите токен бота
  </Step>

  <Step title="Запустите Gateway">
    ```bash
    openclaw gateway --port 18789
    ```
    
    Gateway запустится и будет доступен по адресу `http://127.0.0.1:18789`
  </Step>
</Steps>

## Проверка установки

После запуска Gateway:

1. Откройте веб-панель: [http://127.0.0.1:18789](http://127.0.0.1:18789)
2. Отправьте тестовое сообщение в подключенный канал
3. Получите ответ от AI-агента

## Что дальше?

<Columns>
  <Card title="Настройка каналов" href="/channels" icon="message-square">
    Подключите дополнительные мессенджеры
  </Card>
  <Card title="Конфигурация" href="/gateway/configuration" icon="settings">
    Настройте Gateway под свои нужды
  </Card>
  <Card title="Мастер настройки" href="/start/wizard" icon="sparkles">
    Подробнее о процессе onboard
  </Card>
  <Card title="Устранение неполадок" href="/help/troubleshooting" icon="wrench">
    Решение распространенных проблем
  </Card>
</Columns>

## Альтернативные методы установки

<Columns>
  <Card title="Docker" href="/install/docker" icon="container">
    Запуск в контейнере
  </Card>
  <Card title="Установщик" href="/install/installer" icon="download">
    Автоматический установщик для Linux/macOS
  </Card>
  <Card title="Nix" href="/install/nix" icon="package">
    Установка через Nix package manager
  </Card>
</Columns>

## Помощь

Если у вас возникли проблемы:

- Проверьте [FAQ](/help/faq)
- Посмотрите [руководство по устранению неполадок](/help/troubleshooting)
- Запустите диагностику: `openclaw doctor`
- Проверьте логи: `openclaw logs`

## Системные требования

### Минимальные

- **CPU**: 1 ядро
- **RAM**: 512 MB
- **Диск**: 500 MB свободного места

### Рекомендуемые

- **CPU**: 2+ ядра
- **RAM**: 2 GB
- **Диск**: 2 GB свободного места
- **Сеть**: стабильное интернет-соединение

## Безопасность

По умолчанию Gateway:

- Слушает только на `127.0.0.1` (localhost)
- Требует токен аутентификации для удаленного доступа
- Использует HTTPS для внешних подключений

Для настройки безопасности см. [документацию по безопасности](/gateway/security).
