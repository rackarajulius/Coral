import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Employer logos/banners (image only). */
export const COMPANY_BUCKET = 'company-assets';
/** Job-seeker profile media — banner images and intro videos. */
export const PROFILE_BUCKET = 'profile-media';
/**
 * Sensitive verification documents (government IDs, selfies). PRIVATE — never
 * publicly readable; access is only ever granted via short-lived signed URLs.
 */
export const VERIFICATION_BUCKET = 'verification-documents';
/**
 * Candidate async video-screening answers. PRIVATE — only the employer who
 * invited the screen sees them, via short-lived signed URLs.
 */
export const SCREEN_VIDEO_BUCKET = 'screen-videos';
/** In-app message attachments. PRIVATE — read via short-lived signed URLs. */
export const MESSAGE_ATTACHMENT_BUCKET = 'message-attachments';

/**
 * Images attached to community posts.
 *
 * Public, unlike resumes or attachments: these hang off pages meant to be
 * readable and linkable without an account, and signed URLs that expire would
 * break every share and every crawl.
 */
export const COMMUNITY_BUCKET = 'community-media';
/**
 * Job-seeker resumes. PRIVATE — a resume is sensitive personal data, so it is
 * never publicly readable; the owner and employers they applied to get access
 * through short-lived signed URLs only.
 */
export const RESUME_BUCKET = 'resumes';

interface BucketConfig {
  name: string;
  public: boolean;
  fileSizeLimit: string;
  allowedMimeTypes: string[];
}

const BUCKETS: BucketConfig[] = [
  {
    name: COMPANY_BUCKET,
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  {
    name: PROFILE_BUCKET,
    public: true,
    fileSizeLimit: '50MB',
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
  {
    name: VERIFICATION_BUCKET,
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  },
  {
    name: SCREEN_VIDEO_BUCKET,
    public: false,
    fileSizeLimit: '50MB',
    allowedMimeTypes: ['video/webm', 'video/mp4', 'video/quicktime'],
  },
  {
    name: RESUME_BUCKET,
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
  {
    name: COMMUNITY_BUCKET,
    public: true,
    /** Enough for roughly a minute of 720p H.264, which is the cap we enforce. */
    fileSizeLimit: '30MB',
    /**
     * MP4 and WebM only, deliberately.
     *
     * QuickTime is missing on purpose: an iPhone .mov is usually HEVC, which
     * Chrome on Android and Firefox will not decode. Accepting it means the
     * person who uploaded it sees their video play back perfectly while every
     * other viewer gets a black rectangle — and the uploader is the last
     * person who would notice. Nothing here transcodes, so the only honest
     * option is to refuse the format and say why.
     */
    allowedMimeTypes: [
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
    ],
  },
  {
    name: MESSAGE_ATTACHMENT_BUCKET,
    public: false,
    fileSizeLimit: '25MB',
    allowedMimeTypes: [
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
];

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (!supabaseUrl || !serviceRoleKey) {
      this.logger.warn('SUPABASE_SERVICE_ROLE_KEY not set — file uploads will be unavailable.');
      return;
    }

    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    for (const bucket of BUCKETS) {
      await this.ensureBucketExists(bucket);
    }
  }

  /**
   * Lightweight liveness probe for the storage backend: times a listBuckets()
   * round-trip. Returns ok=false if the client is unconfigured or the call fails.
   */
  async healthCheck(): Promise<{ ok: boolean; latencyMs: number | null; buckets: number }> {
    if (!this.client) return { ok: false, latencyMs: null, buckets: 0 };
    const started = Date.now();
    try {
      const { data, error } = await this.client.storage.listBuckets();
      if (error) return { ok: false, latencyMs: Date.now() - started, buckets: 0 };
      return { ok: true, latencyMs: Date.now() - started, buckets: data?.length ?? 0 };
    } catch {
      return { ok: false, latencyMs: Date.now() - started, buckets: 0 };
    }
  }

  private async ensureBucketExists(config: BucketConfig) {
    if (!this.client) return;

    const { data: buckets, error } = await this.client.storage.listBuckets();
    if (error) {
      this.logger.error(`Failed to list storage buckets: ${error.message}`);
      return;
    }

    if (buckets?.some((bucket) => bucket.name === config.name)) {
      /**
       * Bucket configuration is declarative, so widening a size limit or
       * adding a MIME type here has to reach a bucket that already exists.
       * Creating-only meant the config drifted from reality the first time it
       * changed, and Supabase then rejected uploads for a reason nothing in
       * this file explained.
       */
      const { error: updateError } = await this.client.storage.updateBucket(config.name, {
        public: config.public,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes,
      });
      if (updateError) {
        this.logger.warn(
          `Could not update bucket "${config.name}": ${updateError.message}`,
        );
      }
      return;
    }

    const { error: createError } = await this.client.storage.createBucket(config.name, {
      public: config.public,
      fileSizeLimit: config.fileSizeLimit,
      allowedMimeTypes: config.allowedMimeTypes,
    });

    if (createError) {
      this.logger.error(`Failed to create storage bucket "${config.name}": ${createError.message}`);
    }
  }

  /** Uploads a file and returns its public URL. */
  async uploadPublicFile(
    path: string,
    buffer: Buffer,
    contentType: string,
    bucket: string = COMPANY_BUCKET,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Storage is not configured (missing SUPABASE_SERVICE_ROLE_KEY)');
    }

    const { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return this.client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  /**
   * Files directly under a prefix. Folders come back as entries with no id,
   * so callers that want files must filter them out.
   *
   * Capped rather than paged: every caller here is a cleanup sweep, and a
   * sweep that runs again in an hour does not need to see everything at once.
   */
  async listFiles(
    prefix: string,
    bucket: string,
    limit = 1000,
  ): Promise<Array<{ name: string; id: string | null; createdAt: string | null }>> {
    if (!this.client) return [];
    const { data, error } = await this.client.storage.from(bucket).list(prefix, { limit });
    if (error || !data) return [];
    return data.map((entry) => ({
      name: entry.name,
      id: entry.id ?? null,
      createdAt: entry.created_at ?? null,
    }));
  }

  /** Best-effort delete — failures are logged, not thrown. */
  async deletePublicFile(path: string, bucket: string = COMPANY_BUCKET): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      this.logger.warn(`Failed to delete file "${path}": ${error.message}`);
    }
  }

  /**
   * Uploads a file to a private bucket and returns its storage *path* (not a
   * URL — private files have no public URL). Read access is granted later via
   * {@link createSignedUrl}.
   */
  async uploadPrivateFile(
    path: string,
    buffer: Buffer,
    contentType: string,
    bucket: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Storage is not configured (missing SUPABASE_SERVICE_ROLE_KEY)');
    }

    const { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return path;
  }

  /** Mints a short-lived signed URL for a private file. Default TTL: 60 seconds. */
  /** Downloads a private file's bytes (e.g. to re-read a stored resume). */
  async downloadFile(path: string, bucket: string): Promise<Buffer | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error || !data) {
      this.logger.warn(`Failed to download "${path}": ${error?.message ?? 'no data'}`);
      return null;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUrl(path: string, bucket: string, expiresInSeconds = 60): Promise<string> {
    if (!this.client) {
      throw new Error('Storage is not configured (missing SUPABASE_SERVICE_ROLE_KEY)');
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown error'}`);
    }

    return data.signedUrl;
  }

  /** Extracts the storage path from one of our public URLs, or null if `url` isn't one. */
  pathFromPublicUrl(url: string | null | undefined, bucket: string = COMPANY_BUCKET): string | null {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return url.slice(index + marker.length);
  }
}
