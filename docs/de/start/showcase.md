---
title: "Showcase"
description: "Real-world OpenClaw projects from the community"
summary: "Von der Community entwickelte Projekte und Integrationen mit OpenClaw"
x-i18n:
  source_path: start/showcase.md
  source_hash: b3460f6a7b994879
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:03Z
---

# Showcase

Reale Projekte aus der Community. Sehen Sie, was Menschen mit OpenClaw bauen.

<Info>
**Möchten Sie vorgestellt werden?** Teilen Sie Ihr Projekt in [#showcase auf Discord](https://discord.gg/clawd) oder [taggen Sie @openclaw auf X](https://x.com/openclaw).
</Info>

## 🎥 OpenClaw in Aktion

Vollständige Einrichtungsanleitung (28 Min.) von VelvetShark.

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/SaWSPZoPX34"
    title="OpenClaw: The self-hosted AI that Siri should have been (Full setup)"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[Auf YouTube ansehen](https://www.youtube.com/watch?v=SaWSPZoPX34)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/mMSKQvlmFuQ"
    title="OpenClaw showcase video"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[Auf YouTube ansehen](https://www.youtube.com/watch?v=mMSKQvlmFuQ)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/5kkIJNUGFho"
    title="OpenClaw community showcase"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[Auf YouTube ansehen](https://www.youtube.com/watch?v=5kkIJNUGFho)

## 🆕 Frisch aus Discord

<CardGroup cols={2}>

<Card title="PR-Review → Telegram-Feedback" icon="code-pull-request" href="https://x.com/i/status/2010878524543131691">
  **@bangnokia** • `review` `github` `telegram`

OpenCode schließt die Änderung ab → öffnet einen PR → OpenClaw prüft den Diff und antwortet in Telegram mit „kleinen Vorschlägen“ plus einer klaren Merge-Entscheidung (einschließlich kritischer Fixes, die zuerst anzuwenden sind).

  <img src="/assets/showcase/pr-review-telegram.jpg" alt="OpenClaw PR-Review-Feedback in Telegram" />
</Card>

<Card title="Weinkeller-Skill in Minuten" icon="wine-glass" href="https://x.com/i/status/2010916352454791216">
  **@prades_maxime** • `skills` `local` `csv`

„Robby“ (@openclaw) nach einem lokalen Weinkeller-Skill gefragt. Er fordert einen Beispiel-CSV-Export + den Speicherort an und baut/testet den Skill dann schnell (962 Flaschen im Beispiel).

  <img src="/assets/showcase/wine-cellar-skill.jpg" alt="OpenClaw erstellt einen lokalen Weinkeller-Skill aus CSV" />
</Card>

<Card title="Tesco-Shop-Autopilot" icon="cart-shopping" href="https://x.com/i/status/2009724862470689131">
  **@marchattonhere** • `automation` `browser` `shopping`

Wöchentlicher Speiseplan → Stammartikel → Lieferfenster buchen → Bestellung bestätigen. Keine APIs, nur Browser-Steuerung.

  <img src="/assets/showcase/tesco-shop.jpg" alt="Tesco-Shop-Automatisierung per Chat" />
</Card>

<Card title="SNAG Screenshot-zu-Markdown" icon="scissors" href="https://github.com/am-will/snag">
  **@am-will** • `devtools` `screenshots` `markdown`

Tastenkürzel für einen Bildschirmbereich → Gemini Vision → sofortiges Markdown in Ihrer Zwischenablage.

  <img src="/assets/showcase/snag.png" alt="SNAG Screenshot-zu-Markdown-Werkzeug" />
</Card>

<Card title="Agents UI" icon="window-maximize" href="https://releaseflow.net/kitze/agents-ui">
  **@kitze** • `ui` `skills` `sync`

Desktop-App zur Verwaltung von Skills/Befehlen über Agents, Claude, Codex und OpenClaw hinweg.

  <img src="/assets/showcase/agents-ui.jpg" alt="Agents UI App" />
</Card>

<Card title="Telegram-Sprachnotizen (papla.media)" icon="microphone" href="https://papla.media/docs">
  **Community** • `voice` `tts` `telegram`

Kapselt papla.media TTS und sendet Ergebnisse als Telegram-Sprachnotizen (kein nerviges Autoplay).

  <img src="/assets/showcase/papla-tts.jpg" alt="Telegram-Sprachnotiz-Ausgabe aus TTS" />
</Card>

<Card title="CodexMonitor" icon="eye" href="https://clawhub.com/odrobnik/codexmonitor">
  **@odrobnik** • `devtools` `codex` `brew`

Per Homebrew installiertes Hilfswerkzeug zum Auflisten/Untersuchen/Beobachten lokaler OpenAI-Codex-Sitzungen (CLI + VS Code).

  <img src="/assets/showcase/codexmonitor.png" alt="CodexMonitor auf ClawHub" />
</Card>

<Card title="Bambu-3D-Druckersteuerung" icon="print" href="https://clawhub.com/tobiasbischoff/bambu-cli">
  **@tobiasbischoff** • `hardware` `3d-printing` `skill`

Steuern und Fehlerbehebung für BambuLab-Drucker: Status, Jobs, Kamera, AMS, Kalibrierung und mehr.

  <img src="/assets/showcase/bambu-cli.png" alt="Bambu-CLI-Skill auf ClawHub" />
</Card>

<Card title="Wiener Verkehrsbetriebe (Wiener Linien)" icon="train" href="https://clawhub.com/hjanuschka/wienerlinien">
  **@hjanuschka** • `travel` `transport` `skill`

Echtzeit-Abfahrten, Störungen, Aufzugsstatus und Routen für den öffentlichen Verkehr in Wien.

  <img src="/assets/showcase/wienerlinien.png" alt="Wiener-Linien-Skill auf ClawHub" />
</Card>

<Card title="ParentPay Schulmahlzeiten" icon="utensils" href="#">
  **@George5562** • `automation` `browser` `parenting`

Automatisierte Buchung von Schulmahlzeiten in Großbritannien über ParentPay. Verwendet Mauskoordinaten für zuverlässiges Klicken von Tabellenzellen.
</Card>

<Card title="R2-Upload (Send Me My Files)" icon="cloud-arrow-up" href="https://clawhub.com/skills/r2-upload">
  **@julianengel** • `files` `r2` `presigned-urls`

Upload zu Cloudflare R2/S3 und Erzeugung sicherer vorab signierter Download-Links. Perfekt für entfernte OpenClaw-Instanzen.
</Card>

<Card title="iOS-App via Telegram" icon="mobile" href="#">
  **@coard** • `ios` `xcode` `testflight`

Komplette iOS-App mit Karten und Sprachaufnahme erstellt und vollständig per Telegram-Chat zu TestFlight bereitgestellt.

  <img src="/assets/showcase/ios-testflight.jpg" alt="iOS-App auf TestFlight" />
</Card>

<Card title="Oura-Ring-Gesundheitsassistent" icon="heart-pulse" href="#">
  **@AS** • `health` `oura` `calendar`

Persönlicher KI-Gesundheitsassistent, der Oura-Ring-Daten mit Kalender, Terminen und Trainingsplan integriert.

  <img src="/assets/showcase/oura-health.png" alt="Oura-Ring-Gesundheitsassistent" />
</Card>
<Card title="Kevs Dream Team (14+ Agents)" icon="robot" href="https://github.com/adam91holt/orchestrated-ai-articles">
  **@adam91holt** • `multi-agent` `orchestration` `architecture` `manifesto`

14+ Agents unter einem Gateway mit Opus-4.5-Orchestrator, der an Codex-Worker delegiert. Umfassende [technische Ausarbeitung](https://github.com/adam91holt/orchestrated-ai-articles) mit Dream-Team-Roster, Modellauswahl, Sandboxing, Webhooks, Heartbeats und Delegationsflüssen. [Clawdspace](https://github.com/adam91holt/clawdspace) für Agent-Sandboxing. [Blogbeitrag](https://adams-ai-journey.ghost.io/2026-the-year-of-the-orchestrator/).
</Card>

<Card title="Linear CLI" icon="terminal" href="https://github.com/Finesssee/linear-cli">
  **@NessZerra** • `devtools` `linear` `cli` `issues`

CLI für Linear mit Integration in agentische Workflows (Claude Code, OpenClaw). Verwalten Sie Issues, Projekte und Workflows vom Terminal aus. Erster externer PR gemerged!
</Card>

<Card title="Beeper CLI" icon="message" href="https://github.com/blqke/beepcli">
  **@jules** • `messaging` `beeper` `cli` `automation`

Nachrichten über Beeper Desktop lesen, senden und archivieren. Verwendet die lokale Beeper-MCP-API, sodass Agents all Ihre Chats (iMessage, WhatsApp usw.) an einem Ort verwalten können.
</Card>

</CardGroup>

## 🤖 Automatisierung & Workflows

<CardGroup cols={2}>

<Card title="Winix-Luftreiniger-Steuerung" icon="wind" href="https://x.com/antonplex/status/2010518442471006253">
  **@antonplex** • `automation` `hardware` `air-quality`

Claude Code hat die Steuerungen des Luftreinigers entdeckt und bestätigt; anschließend übernimmt OpenClaw das Management der Raumluftqualität.

  <img src="/assets/showcase/winix-air-purifier.jpg" alt="Winix-Luftreiniger-Steuerung via OpenClaw" />
</Card>

<Card title="Schöne Himmelaufnahmen" icon="camera" href="https://x.com/signalgaining/status/2010523120604746151">
  **@signalgaining** • `automation` `camera` `skill` `images`

Ausgelöst durch eine Dachkamera: OpenClaw macht ein Himmelsfoto, sobald es schön aussieht — der Skill wurde entworfen und das Foto aufgenommen.

  <img src="/assets/showcase/roof-camera-sky.jpg" alt="Himmelsschnappschuss der Dachkamera durch OpenClaw" />
</Card>

<Card title="Visuelle Morgenübersicht-Szene" icon="robot" href="https://x.com/buddyhadry/status/2010005331925954739">
  **@buddyhadry** • `automation` `briefing` `images` `telegram`

Ein geplanter Prompt erzeugt jeden Morgen ein einzelnes „Szenen“-Bild (Wetter, Aufgaben, Datum, Lieblingspost/-zitat) über eine OpenClaw-Persona.
</Card>

<Card title="Padel-Platzbuchung" icon="calendar-check" href="https://github.com/joshp123/padel-cli">
  **@joshp123** • `automation` `booking` `cli`
  
  Playtomic-Verfügbarkeitsprüfung + Buchungs-CLI. Verpassen Sie nie wieder einen freien Platz.
  
  <img src="/assets/showcase/padel-screenshot.jpg" alt="padel-cli Screenshot" />
</Card>

<Card title="Buchhaltungs-Eingang" icon="file-invoice-dollar">
  **Community** • `automation` `email` `pdf`
  
  Sammelt PDFs aus E-Mails und bereitet Dokumente für den Steuerberater vor. Monatliche Buchhaltung auf Autopilot.
</Card>

<Card title="Couch-Potato-Dev-Modus" icon="couch" href="https://davekiss.com">
  **@davekiss** • `telegram` `website` `migration` `astro`

Komplette persönliche Website per Telegram neu aufgebaut, während Netflix lief — Notion → Astro, 18 Beiträge migriert, DNS zu Cloudflare. Nie einen Laptop geöffnet.
</Card>

<Card title="Jobsuche-Agent" icon="briefcase">
  **@attol8** • `automation` `api` `skill`

Durchsucht Stellenangebote, gleicht sie mit Lebenslauf-Schlüsselwörtern ab und liefert relevante Möglichkeiten mit Links. In 30 Minuten mit der JSearch API gebaut.
</Card>

<Card title="Jira-Skill-Builder" icon="diagram-project" href="https://x.com/jdrhyne/status/2008336434827002232">
  **@jdrhyne** • `automation` `jira` `skill` `devtools`

OpenClaw mit Jira verbunden und anschließend einen neuen Skill „on the fly“ erzeugt (bevor er auf ClawHub existierte).
</Card>

<Card title="Todoist-Skill via Telegram" icon="list-check" href="https://x.com/iamsubhrajyoti/status/2009949389884920153">
  **@iamsubhrajyoti** • `automation` `todoist` `skill` `telegram`

Todoist-Aufgaben automatisiert und OpenClaw den Skill direkt im Telegram-Chat erzeugen lassen.
</Card>

<Card title="TradingView-Analyse" icon="chart-line">
  **@bheem1798** • `finance` `browser` `automation`

Meldet sich per Browser-Automatisierung bei TradingView an, erstellt Chart-Screenshots und führt bei Bedarf technische Analysen durch. Keine API nötig — nur Browser-Steuerung.
</Card>

<Card title="Slack Auto-Support" icon="slack">
  **@henrymascot** • `slack` `automation` `support`

Überwacht den Slack-Kanal des Unternehmens, antwortet hilfreich und leitet Benachrichtigungen an Telegram weiter. Hat autonom einen Produktionsfehler in einer bereitgestellten App behoben, ohne dazu aufgefordert zu werden.
</Card>

</CardGroup>

## 🧠 Wissen & Gedächtnis

<CardGroup cols={2}>

<Card title="xuezh Chinesischlernen" icon="language" href="https://github.com/joshp123/xuezh">
  **@joshp123** • `learning` `voice` `skill`
  
  Chinesische Lern-Engine mit Aussprache-Feedback und Lernabläufen über OpenClaw.
  
  <img src="/assets/showcase/xuezh-pronunciation.jpeg" alt="xuezh Aussprache-Feedback" />
</Card>

<Card title="WhatsApp Memory Vault" icon="vault">
  **Community** • `memory` `transcription` `indexing`
  
  Importiert vollständige WhatsApp-Exporte, transkribiert 1.000+ Sprachnotizen, gleicht sie mit Git-Logs ab und gibt verlinkte Markdown-Berichte aus.
</Card>

<Card title="Karakeep Semantische Suche" icon="magnifying-glass" href="https://github.com/jamesbrooksco/karakeep-semantic-search">
  **@jamesbrooksco** • `search` `vector` `bookmarks`
  
  Fügt Karakeep-Lesezeichen eine Vektorsuche hinzu, mit Qdrant + OpenAI/Ollama-Embeddings.
</Card>

<Card title="Inside-Out-2-Gedächtnis" icon="brain">
  **Community** • `memory` `beliefs` `self-model`
  
  Separater Memory-Manager, der Sitzungsdateien in Erinnerungen → Überzeugungen → ein sich entwickelndes Selbstmodell umwandelt.
</Card>

</CardGroup>

## 🎙️ Stimme & Telefon

<CardGroup cols={2}>

<Card title="Clawdia Phone Bridge" icon="phone" href="https://github.com/alejandroOPI/clawdia-bridge">
  **@alejandroOPI** • `voice` `vapi` `bridge`
  
  Vapi-Sprachassistent ↔ OpenClaw-HTTP-Bridge. Nahezu Echtzeit-Telefonate mit Ihrem Agent.
</Card>

<Card title="OpenRouter Transkription" icon="microphone" href="https://clawhub.com/obviyus/openrouter-transcribe">
  **@obviyus** • `transcription` `multilingual` `skill`

Mehrsprachige Audio-Transkription über OpenRouter (Gemini usw.). Verfügbar auf ClawHub.
</Card>

</CardGroup>

## 🏗️ Infrastruktur & Bereitstellung

<CardGroup cols={2}>

<Card title="Home-Assistant-Add-on" icon="home" href="https://github.com/ngutman/openclaw-ha-addon">
  **@ngutman** • `homeassistant` `docker` `raspberry-pi`
  
  OpenClaw-Gateway auf Home Assistant OS mit SSH-Tunnel-Unterstützung und persistentem Zustand.
</Card>

<Card title="Home-Assistant-Skill" icon="toggle-on" href="https://clawhub.com/skills/homeassistant">
  **ClawHub** • `homeassistant` `skill` `automation`
  
  Steuern und automatisieren Sie Home-Assistant-Geräte per natürlicher Sprache.
</Card>

<Card title="Nix-Packaging" icon="snowflake" href="https://github.com/openclaw/nix-openclaw">
  **@openclaw** • `nix` `packaging` `deployment`
  
  „Batteries included“ nixifizierte OpenClaw-Konfiguration für reproduzierbare Deployments.
</Card>

<Card title="CalDAV-Kalender" icon="calendar" href="https://clawhub.com/skills/caldav-calendar">
  **ClawHub** • `calendar` `caldav` `skill`
  
  Kalender-Skill mit khal/vdirsyncer. Selbst gehostete Kalenderintegration.
</Card>

</CardGroup>

## 🏠 Zuhause & Hardware

<CardGroup cols={2}>

<Card title="GoHome-Automatisierung" icon="house-signal" href="https://github.com/joshp123/gohome">
  **@joshp123** • `home` `nix` `grafana`
  
  Nix-native Heimautomatisierung mit OpenClaw als Oberfläche sowie schönen Grafana-Dashboards.
  
  <img src="/assets/showcase/gohome-grafana.png" alt="GoHome Grafana-Dashboard" />
</Card>

<Card title="Roborock-Staubsauger" icon="robot" href="https://github.com/joshp123/gohome/tree/main/plugins/roborock">
  **@joshp123** • `vacuum` `iot` `plugin`
  
  Steuern Sie Ihren Roborock-Saugroboter durch natürliche Konversation.
  
  <img src="/assets/showcase/roborock-screenshot.jpg" alt="Roborock-Status" />
</Card>

</CardGroup>

## 🌟 Community-Projekte

<CardGroup cols={2}>

<Card title="StarSwap Marketplace" icon="star" href="https://star-swap.com/">
  **Community** • `marketplace` `astronomy` `webapp`
  
  Vollständiger Marktplatz für Astronomie-Ausrüstung. Mit/um das OpenClaw-Ökosystem gebaut.
</Card>

</CardGroup>

---

## Reichen Sie Ihr Projekt ein

Haben Sie etwas zu teilen? Wir würden es gerne vorstellen!

<Steps>
  <Step title="Teilen">
    Posten Sie in [#showcase auf Discord](https://discord.gg/clawd) oder [tweeten Sie @openclaw](https://x.com/openclaw)
  </Step>
  <Step title="Details angeben">
    Sagen Sie uns, was es macht, verlinken Sie Repo/Demo und teilen Sie einen Screenshot, falls vorhanden
  </Step>
  <Step title="Vorgestellt werden">
    Wir fügen herausragende Projekte dieser Seite hinzu
  </Step>
</Steps>
