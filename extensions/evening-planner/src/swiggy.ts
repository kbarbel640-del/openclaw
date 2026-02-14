type CommandResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  killed: boolean;
};

export type RunCommandWithTimeout = (
  argv: string[],
  opts: number | { timeoutMs: number },
) => Promise<CommandResult>;

export type SwiggyMode = "live" | "fixture";

export type SwiggySearchParams = {
  query: string;
  location?: string;
};

export type SwiggySlotsParams = {
  restaurantId: string;
  date: string;
};

export type SwiggyBookParams = {
  restaurantId: string;
  date: string;
  time: string;
  guests: number;
  confirm: boolean;
};

export type SwiggyConfig = {
  fixtureMode: boolean;
  command: string;
  timeoutMs: number;
};

export type SwiggyRunResult = {
  ok: boolean;
  mode: SwiggyMode;
  command: string[];
  payload: unknown;
  error?: string;
};

function parseJsonMaybe(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { text: trimmed };
  }
}

function fixtureSearch(params: SwiggySearchParams) {
  return {
    source: "fixture",
    query: params.query,
    location: params.location ?? "Indiranagar",
    restaurants: [
      {
        id: "fixture-olive-roof",
        name: "Olive Roof",
        rating: 4.3,
        tags: ["rooftop", "veg-friendly"],
      },
      {
        id: "fixture-live-beats",
        name: "Live Beats Kitchen",
        rating: 4.2,
        tags: ["live-music", "dinner"],
      },
    ],
  };
}

function fixtureSlots(params: SwiggySlotsParams) {
  return {
    source: "fixture",
    restaurantId: params.restaurantId,
    date: params.date,
    slots: ["19:30", "20:00", "20:30", "21:00"],
  };
}

function fixtureBook(params: SwiggyBookParams) {
  return {
    source: "fixture",
    bookingId: `fixture-${params.restaurantId}-${params.time.replace(":", "")}`,
    restaurantId: params.restaurantId,
    date: params.date,
    time: params.time,
    guests: params.guests,
    gracePeriodMinutes: 15,
    status: "confirmed",
  };
}

async function runOrFallback(params: {
  cfg: SwiggyConfig;
  runner: RunCommandWithTimeout;
  command: string[];
  fixturePayload: unknown;
}): Promise<SwiggyRunResult> {
  const argv = [params.cfg.command, ...params.command];
  try {
    const result = await params.runner(argv, { timeoutMs: params.cfg.timeoutMs });
    if (result.code === 0) {
      return {
        ok: true,
        mode: "live",
        command: argv,
        payload: parseJsonMaybe(result.stdout),
      };
    }
    if (params.cfg.fixtureMode) {
      return {
        ok: true,
        mode: "fixture",
        command: argv,
        payload: params.fixturePayload,
        error: `live_failed(code=${result.code ?? "null"}): ${result.stderr.trim() || "unknown"}`,
      };
    }
    return {
      ok: false,
      mode: "live",
      command: argv,
      payload: {},
      error: `swiggy command failed (code=${result.code ?? "null"}): ${result.stderr.trim() || "unknown"}`,
    };
  } catch (err) {
    if (params.cfg.fixtureMode) {
      return {
        ok: true,
        mode: "fixture",
        command: argv,
        payload: params.fixturePayload,
        error: `live_exception: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return {
      ok: false,
      mode: "live",
      command: argv,
      payload: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function searchDineout(params: {
  cfg: SwiggyConfig;
  runner: RunCommandWithTimeout;
  input: SwiggySearchParams;
}): Promise<SwiggyRunResult> {
  const command = ["dineout", "search", params.input.query];
  if (params.input.location?.trim()) {
    command.push("--location", params.input.location.trim());
  }
  return runOrFallback({
    cfg: params.cfg,
    runner: params.runner,
    command,
    fixturePayload: fixtureSearch(params.input),
  });
}

export async function checkDineoutSlots(params: {
  cfg: SwiggyConfig;
  runner: RunCommandWithTimeout;
  input: SwiggySlotsParams;
}): Promise<SwiggyRunResult> {
  return runOrFallback({
    cfg: params.cfg,
    runner: params.runner,
    command: [
      "dineout",
      "slots",
      params.input.restaurantId,
      "--date",
      params.input.date,
    ],
    fixturePayload: fixtureSlots(params.input),
  });
}

export async function bookDineoutTable(params: {
  cfg: SwiggyConfig;
  runner: RunCommandWithTimeout;
  input: SwiggyBookParams;
}): Promise<SwiggyRunResult> {
  if (!params.input.confirm) {
    return {
      ok: false,
      mode: "live",
      command: [],
      payload: {},
      error: "booking_confirm_required",
    };
  }
  return runOrFallback({
    cfg: params.cfg,
    runner: params.runner,
    command: [
      "dineout",
      "book",
      params.input.restaurantId,
      "--date",
      params.input.date,
      "--time",
      params.input.time,
      "--guests",
      String(Math.max(1, Math.floor(params.input.guests))),
      "--confirm",
    ],
    fixturePayload: fixtureBook(params.input),
  });
}

