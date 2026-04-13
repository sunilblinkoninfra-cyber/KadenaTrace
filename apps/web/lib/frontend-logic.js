// frontend-logic.js -- Formats Time-to-Exit velocity metrics into urgency badges, audit URLs, and timeline entries.
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function buildPublicAuditUrl(baseUrl, slug) {
  if (!slug) {
    return null;
  }

  const normalizedBase = `${baseUrl ?? ""}`.replace(/\/$/, "");
  return `${normalizedBase}/case/${slug}`;
}

export function formatMeanTimeToExit(minutes) {
  if (minutes == null) {
    return "Awaiting terminal endpoint";
  }

  if (minutes < MINUTES_PER_HOUR) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < MINUTES_PER_DAY) {
    const hours = minutes / MINUTES_PER_HOUR;
    return `${hours < 2 ? hours.toFixed(1) : hours.toFixed(0)} hr`;
  }

  return `${(minutes / MINUTES_PER_DAY).toFixed(1)} d`;
}

export function getUrgencyGauge(velocityMetrics) {
  const minutes = velocityMetrics?.meanTimeToExitMinutes ?? null;

  if (minutes == null) {
    return {
      label: "Mean Time to Exit",
      value: "Open",
      descriptor: "No qualifying terminal endpoint has been reached yet.",
      toneClass: "urgency-gauge urgency-gauge--open",
      warning: velocityMetrics?.recoveryPotential ?? "Continue monitoring outbound branches."
    };
  }

  if (minutes < MINUTES_PER_HOUR) {
    return {
      label: "Mean Time to Exit",
      value: formatMeanTimeToExit(minutes),
      descriptor: "Professional/Automated",
      toneClass: "urgency-gauge urgency-gauge--critical",
      warning:
        velocityMetrics?.recoveryPotential ??
        "High-speed exit detected. Immediate exchange contact required."
    };
  }

  if (minutes > MINUTES_PER_DAY) {
    return {
      label: "Mean Time to Exit",
      value: formatMeanTimeToExit(minutes),
      descriptor: "Manual/Staged",
      toneClass: "urgency-gauge urgency-gauge--manual",
      warning:
        velocityMetrics?.recoveryPotential ??
        "Exit speed suggests manual staging rather than fully automated laundering."
    };
  }

  return {
    label: "Mean Time to Exit",
    value: formatMeanTimeToExit(minutes),
    descriptor: velocityMetrics?.urgencyLabel ?? "Active Laundering Window",
    toneClass: "urgency-gauge urgency-gauge--active",
    warning:
      velocityMetrics?.recoveryPotential ??
      "Funds are still moving quickly enough that exchange or bridge outreach should stay time-sensitive."
  };
}

export function buildTimelineSidebar(velocityMetrics) {
  const entries = velocityMetrics?.timeline ?? [];

  return entries.map((entry) => ({
    id: entry.id,
    title: `${entry.fromLabel} -> ${entry.toLabel}`,
    subtitle: `${entry.amount} ${entry.asset} on ${entry.chain}`,
    timestampLabel: formatTimestamp(entry.timestamp),
    gapLabel: entry.gapMinutesFromPrevious == null ? "Incident" : `+${formatGap(entry.gapMinutesFromPrevious)}`,
    terminalLabel: entry.terminalType ? `Terminal: ${entry.terminalType.toUpperCase()}` : null,
    txHash: entry.txHash
  }));
}

function formatGap(minutes) {
  if (minutes < MINUTES_PER_HOUR) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < MINUTES_PER_DAY) {
    return `${(minutes / MINUTES_PER_HOUR).toFixed(minutes < 120 ? 1 : 0)} hr`;
  }

  return `${(minutes / MINUTES_PER_DAY).toFixed(1)} d`;
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}
