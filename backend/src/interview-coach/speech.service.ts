import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** A selectable interviewer voice, as offered to the candidate. */
export interface VoiceOption {
  id: string;
  label: string;
  description: string;
}

/**
 * ElevenLabs text-to-speech, proxied server-side so the API key never reaches
 * the browser. Unconfigured is a normal state — the client falls back to the
 * browser's built-in speech synthesis rather than failing the interview.
 */
@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  /** Flash v2.5 — ~75ms, built for conversational turn-taking. */
  private readonly model = 'eleven_flash_v2_5';
  /** "Rachel" — a neutral, professional default for Nova. */
  private readonly defaultVoice = '21m00Tcm4TlvDq8ikWAM';

  /**
   * Curated ElevenLabs premade voices. Deliberately small: the full catalogue
   * is thousands of voices with no interview-suitability signal, and fetching
   * it per setup page would add a network dependency for no gain.
   *
   * Labelled by delivery style, never by perceived gender or nationality —
   * candidates shouldn't be nudged into rehearsing against a demographic
   * stereotype of "their" interviewer. The preview button does the
   * disambiguating.
   */
  private readonly catalogue: VoiceOption[] = [
    { id: '21m00Tcm4TlvDq8ikWAM', label: 'Neutral', description: 'Even-paced and professional' },
    { id: 'XB0fDUnXU5powFXDhCwa', label: 'Warm', description: 'Friendly and conversational' },
    { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Formal', description: 'Crisp, news-anchor delivery' },
    { id: 'nPczCjzI2devNBz1zQrb', label: 'Measured', description: 'Slow and deliberate, panel-style' },
    { id: 'Xb7hH8MZjo56l8jOQZQ4', label: 'Brisk', description: 'Quick and businesslike' },
  ];

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ELEVENLABS_API_KEY');
  }

  /** The voice used when the candidate hasn't chosen one. */
  private resolveDefault(): string {
    return this.config.get<string>('ELEVENLABS_VOICE_ID') || this.defaultVoice;
  }

  /**
   * What the client needs to render the voice picker. Returns no voices when
   * unconfigured, so the UI falls back to the browser's own voice list.
   */
  status(): { configured: boolean; voices: VoiceOption[]; defaultVoiceId: string | null } {
    const configured = this.isConfigured();
    return {
      configured,
      voices: configured ? this.catalogue : [],
      defaultVoiceId: configured ? this.resolveDefault() : null,
    };
  }

  /** Synthesises speech and returns MP3 bytes. */
  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Voice synthesis is not configured');
    }

    // Allowlist: an unrestricted voiceId would let any signed-in user bill our
    // key against any voice in the account. Unknown ids degrade to the default
    // rather than failing the turn.
    let voice = this.resolveDefault();
    if (voiceId) {
      if (this.catalogue.some((v) => v.id === voiceId) || voiceId === this.resolveDefault()) {
        voice = voiceId;
      } else {
        this.logger.warn(`Ignoring unrecognised voice id: ${voiceId}`);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: text.slice(0, 2500),
            model_id: this.model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.warn(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
        throw new ServiceUnavailableException('Voice synthesis failed');
      }

      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('Voice synthesis timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
