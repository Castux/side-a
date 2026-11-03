/**
 * MusicBrainz lookups used to bridge Tidal → AcousticBrainz and to read curated genres.
 * Rules (MusicBrainz API docs): ≤ 1 request per second, identifying User-Agent required.
 * Endpoint shapes are from memory of the ws/2 JSON API and NOT yet verified live.
 */
const BASE = 'https://musicbrainz.org/ws/2';

export interface MbOptions { userAgent: string; fetch?: typeof fetch; minIntervalMs?: number }

export class MusicBrainz {
  private last = 0;
  constructor(private opts: MbOptions) {}

  private async get<T>(path: string): Promise<T | null> {
    const gap = (this.opts.minIntervalMs ?? 1100) - (Date.now() - this.last);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    this.last = Date.now();
    const res = await (this.opts.fetch ?? fetch)(BASE + path, { headers: { 'User-Agent': this.opts.userAgent, Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`MusicBrainz ${res.status} on ${path}`);
    return (await res.json()) as T;
  }

  /** Release + release group for a UPC/EAN barcode (Tidal's albums.barcodeId). */
  async releaseByBarcode(barcode: string): Promise<{ releaseId: string; releaseGroupId: string } | null> {
    const j = await this.get<{ releases?: { id: string; 'release-group'?: { id: string } }[] }>(
      `/release/?query=barcode:${encodeURIComponent(barcode)}&fmt=json&limit=1`,
    );
    const r = j?.releases?.[0];
    return r && r['release-group'] ? { releaseId: r.id, releaseGroupId: r['release-group'].id } : null;
  }

  /** Recording MBIDs for an ISRC (fallback when the barcode isn't in MusicBrainz). */
  async recordingsByIsrc(isrc: string): Promise<string[]> {
    const j = await this.get<{ recordings?: { id: string }[] }>(`/isrc/${encodeURIComponent(isrc)}?fmt=json`);
    return j?.recordings?.map((r) => r.id) ?? [];
  }

  async releaseRecordings(releaseId: string): Promise<string[]> {
    const j = await this.get<{ media?: { tracks?: { recording?: { id: string } }[] }[] }>(
      `/release/${releaseId}?inc=recordings&fmt=json`,
    );
    return (j?.media ?? []).flatMap((m) => (m.tracks ?? []).map((t) => t.recording?.id)).filter((x): x is string => !!x);
  }

  async releaseGroupTags(releaseGroupId: string): Promise<{ genres: { name: string; count: number }[]; tags: { name: string; count: number }[] }> {
    const j = await this.get<{ genres?: { name: string; count: number }[]; tags?: { name: string; count: number }[] }>(
      `/release-group/${releaseGroupId}?inc=genres+tags&fmt=json`,
    );
    return { genres: j?.genres ?? [], tags: j?.tags ?? [] };
  }
}
