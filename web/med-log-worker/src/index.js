const VALID_PERIODS = {
  evan: new Set(["am", "midday", "bedtime"]),
  karen: new Set(["am", "midday", "dinner", "bedtime"]),
};

function todayDayOfMonth(timeZone) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(new Date())
  );
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/log") {
      return new Response("not found", { status: 404 });
    }

    const person = url.searchParams.get("person");
    const period = url.searchParams.get("period");
    const day = url.searchParams.get("day");
    const code = url.searchParams.get("code");

    if (!code || !timingSafeEqual(code, env.SHARED_SECRET)) {
      return new Response("forbidden", { status: 403 });
    }

    if (!person || !VALID_PERIODS[person]) {
      return new Response("unknown person", { status: 400 });
    }
    if (!period || !VALID_PERIODS[person].has(period)) {
      return new Response("unknown period", { status: 400 });
    }

    const today = todayDayOfMonth(env.TIMEZONE || "America/Chicago");
    if (!day || Number(day) !== today) {
      return new Response("stale or replayed scan rejected", { status: 409 });
    }

    const dispatchResp = await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "med-log-worker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "med_taken",
          client_payload: { person, period, day: Number(day) },
        }),
      }
    );

    if (!dispatchResp.ok) {
      const text = await dispatchResp.text();
      return new Response(`upstream error: ${dispatchResp.status} ${text}`, { status: 502 });
    }

    return new Response("logged", { status: 200 });
  },
};
