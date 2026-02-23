import type { TranslationMap } from "../lib/types.ts";

export const sv: TranslationMap = {
  "common": {
    "health": "Hälsa",
    "ok": "OK",
    "offline": "Frånkopplad",
    "connect": "Anslut",
    "refresh": "Uppdatera",
    "enabled": "Aktiverad",
    "disabled": "Inaktiverad",
    "na": "inte tillgänglig",
    "docs": "Dokumentation",
    "resources": "Resurser"
  },
  "nav": {
    "chat": "Chatta",
    "control": "Kontroll",
    "agent": "Agent",
    "settings": "Inställningar",
    "expand": "Expandera sidofältet",
    "collapse": "Dölj sidofältet"
  },
  "tabs": {
    "chat": "Chatta",
    "agents": "Agenter",
    "overview": "Översikt",
    "channels": "Kanaler",
    "instances": "Instanser",
    "sessions": "Sessioner",
    "usage": "Användning",
    "cron": "Cron-jobb",
    "skills": "Färdigheter",
    "nodes": "Noder",
    "config": "Konfiguration",
    "debug": "Felsökning",
    "logs": "Loggar"
  },
  "overview": {
    "stats": {
      "instances": "Instanser",
      "sessions": "Sessioner",
      "instancesHint": "Närvarosignaler under de senaste fem minuterna.",
      "sessionsHint": "Senaste sessionsnycklar som spåras av gatewayen.",
      "cron": "Cron",
      "cronNext": "Nästa uppvakning {time}"
    },
    "access": {
      "title": "Gateway-åtkomst",
      "subtitle": "Var instrumentpanelen ansluts och hur den autentiserar sig.",
      "wsUrl": "WebSocket-URL",
      "token": "Gateway-token",
      "password": "Lösenord (sparas inte)",
      "sessionKey": "Sessionsnyckel som standard",
      "language": "Språk",
      "connectHint": "Klicka på Anslut för att tillämpa anslutningsändringar.",
      "trustedProxy": "Autentiserad via betrodd proxy."
    },
    "snapshot": {
      "title": "Ögonblicksbild",
      "subtitle": "Senaste information om gateway-handskakning.",
      "status": "Status",
      "uptime": "Driftstid",
      "tickInterval": "Tick-intervall",
      "lastChannelsRefresh": "Uppdatera senaste kanaler",
      "channelsHint": "Använd Kanaler för att länka WhatsApp, Telegram, Discord, Signal eller iMessage."
    },
    "notes": {
      "title": "Anteckningar",
      "subtitle": "Korta påminnelser för fjärrkontrollinställningar.",
      "tailscaleTitle": "Tailscale-tjänst",
      "tailscaleText": "Föredra serveringsläge för att hålla gatewayen på loopback med tailnet-autentisering.",
      "sessionTitle": "Sessionshygien",
      "sessionText": "Använd /new eller sessions.patch för att återställa kontexten.",
      "cronTitle": "Cron-påminnelser",
      "cronText": "Använd isolerade sessioner för återkommande körningar."
    },
    "auth": {
      "required": "Denna gateway kräver autentisering. Lägg till en token eller ett lösenord och klicka sedan på Anslut.",
      "failed": "Autentisering misslyckades. Kopiera om en tokeniserad URL med {command} eller uppdatera token och klicka sedan på Anslut."
    },
    "pairing": {
      "hint": "Denna enhet måste godkännas för parkoppling av gateway-värden.",
      "mobileHint": "Använder du mobil? Kopiera hela URL-adressen (inklusive #token=...) från openclaw-kontrollpanelen --no-open på din stationära dator."
    },
    "insecure": {
      "hint": "Denna sida är HTTP, så webbläsaren blockerar enhetsidentiteten. Använd HTTPS (Tailscale Serve) eller öppna {url} på gateway-värden.",
      "stayHttp": "Om du måste stanna kvar på HTTP, ställ in {config} (endast token)."
    }
  },
  "subtitles": {
    "agents": "Hantera agenters arbetsytor, verktyg och identiteter.",
    "overview": "Gateway-status, ingångspunkter och snabb hälsoavläsning.",
    "channels": "Hantera kanaler och inställningar.",
    "instances": "Närvarosignaler från anslutna klienter och noder.",
    "sessions": "Inspektera aktiva sessioner och justera standardinställningarna per session.",
    "usage": "Övervaka API-användning och kostnader.",
    "cron": "Schemalägg väckningar och återkommande agentkörningar.",
    "skills": "Hantera tillgänglighet av färdigheter och API-nyckelinjektion.",
    "nodes": "Parkopplade enheter, funktioner och kommandotillgänglighet.",
    "chat": "Direkt gateway chatt-session för snabba ingripanden.",
    "config": "Redigera ~/.openclaw/openclaw.json på ett säkert sätt.",
    "debug": "Gateway-ögonblicksbilder, händelser och manuella RPC-anrop.",
    "logs": "Direkt tail för gateway-filens loggar."
  },
  "chat": {
    "disconnected": "Frånkopplad från gateway.",
    "refreshTitle": "Uppdatera chattdata",
    "thinkingToggle": "Växla mellan assistentens tänkande/arbetsresultat",
    "focusToggle": "Växla fokusläge (dölj sidofält + sidhuvud)",
    "onboardingDisabled": "Inaktiverad under onboarding"
  },
  "languages": {
    "en": "Engelska",
    "zhCN": "简体中文 (Förenklad kinesiska)",
    "zhTW": "繁體中文 (Traditionell kinesiska)",
    "ptBR": "Português (brasiliansk portugisiska)",
    "sv": "Svenska"
  }
};
