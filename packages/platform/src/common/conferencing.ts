export interface ConferenceLink {
  configured: boolean;
  joinUrl: string | null;
  provider: string;
  message: string | null;
}

/**
 * Honest conferencing adapter. A stored join link is returned as-is.
 * Otherwise CONFERENCE_PROVIDER_URL is used. With neither, the caller must
 * show "not configured" — this never invents a working room.
 */
export function describeConference(joinUrl: string | null | undefined): ConferenceLink {
  const stored = joinUrl?.trim() || '';
  const envUrl = process.env.CONFERENCE_PROVIDER_URL?.trim() || '';
  const provider = process.env.CONFERENCE_PROVIDER?.trim() || '';
  if (stored) {
    return { configured: true, joinUrl: stored, provider: provider || 'link', message: null };
  }
  if (envUrl) {
    return { configured: true, joinUrl: envUrl, provider: provider || 'custom', message: null };
  }
  return {
    configured: false,
    joinUrl: null,
    provider: 'unconfigured',
    message:
      'Online conferencing is not configured. Set CONFERENCE_PROVIDER_URL or save a join link.',
  };
}
