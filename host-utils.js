/**
 * Shared host normalization and allowlist helpers used across extension contexts.
 */
(function initHostUtils(globalScope) {
  function normalizeHost(raw) {
    if (!raw) return null;
    const value = String(raw).trim().toLowerCase().replace(/\*+/g, "");
    if (!value) return null;
    try {
      const parsed = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
      return parsed.hostname || null;
    } catch {
      return null;
    }
  }

  function normalizeHostList(list) {
    const seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      const host = normalizeHost(item);
      if (host) seen.add(host);
    }
    return [...seen];
  }

  function isHostAllowed(hostname, hosts, allowSubdomains) {
    if (!hostname) return false;
    const host = String(hostname).toLowerCase();
    for (const allowed of Array.isArray(hosts) ? hosts : []) {
      if (host === allowed) return true;
      if (allowSubdomains && host.endsWith(`.${allowed}`)) return true;
    }
    return false;
  }

  function parseHostAllowlistInput(text) {
    const entries = String(text || "")
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);

    const hosts = [];
    const invalid = [];
    const seen = new Set();

    for (const entry of entries) {
      const host = normalizeHost(entry);
      if (!host) {
        invalid.push(entry);
        continue;
      }
      if (seen.has(host)) continue;
      seen.add(host);
      hosts.push(host);
    }

    return { hosts, invalid };
  }

  globalScope.HostUtils = {
    normalizeHost,
    normalizeHostList,
    isHostAllowed,
    parseHostAllowlistInput,
  };
})(globalThis);
