import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ResendEmailResponse {
  id?: string;
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailAttachment {
  filename: string;
  /** base64-encoded file content */
  content: string;
  contentType?: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: EmailTag[];
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  provider: 'resend';
  id: string | null;
  to: string[];
  from: string;
  subject: string;
}

@Injectable()
export class EmailService {
  private readonly defaultResendUrl = 'https://api.resend.com';
  private readonly defaultTimeoutMs = 20000;

  constructor(private readonly configService: ConfigService) {}

  async send(input: SendEmailInput): Promise<EmailSendResult> {
    const to = this.normalizeRecipients(input.to);
    const subject = input.subject.trim();
    const html = input.html?.trim();
    const text = input.text?.trim();

    if (!subject) {
      throw new BadRequestException('Email subject is required');
    }

    if (!html && !text) {
      throw new BadRequestException('Either html or text email body is required');
    }

    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const resendUrl = this.configService
      .get<string>('RESEND_URL', this.defaultResendUrl)
      .replace(/\/+$/, '');
    const from = (input.from ?? this.configService.get<string>('EMAIL_FROM', '')).trim();
    const replyTo = (input.replyTo ?? this.configService.get<string>('EMAIL_REPLY_TO', '')).trim();
    const timeoutMs = this.resolveTimeout();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Email service is not configured. Set RESEND_API_KEY in backend/.env',
      );
    }

    if (!from) {
      throw new ServiceUnavailableException(
        'Email service is not configured. Set EMAIL_FROM in backend/.env',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${resendUrl}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
          text,
          reply_to: replyTo || undefined,
          tags: this.normalizeTags(input.tags),
          attachments: input.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            content_type: a.contentType,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new BadGatewayException(
          `Resend request failed (${response.status}): ${errorBody.slice(0, 300)}`,
        );
      }

      const payload = (await response.json()) as ResendEmailResponse;
      return {
        provider: 'resend',
        id: payload.id ?? null,
        to,
        from,
        subject,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadGatewayException('Email provider request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendPlainText(input: {
    to: string;
    subject: string;
    message: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailSendResult> {
    const text = input.message.trim();
    if (!text) {
      throw new BadRequestException('Email message cannot be empty');
    }

    const safeHtml = this.escapeHtml(text).replace(/\n/g, '<br />');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px 0;">Coral</h2>
        <p style="margin: 0 0 12px 0;">${safeHtml}</p>
      </div>
    `.trim();

    return this.send({
      to: input.to,
      subject: input.subject,
      text,
      html,
      attachments: input.attachments,
    });
  }

  private normalizeRecipients(input: string | string[]): string[] {
    const values = Array.isArray(input) ? input : [input];
    const normalized = values
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (normalized.length === 0) {
      throw new BadRequestException('At least one recipient email is required');
    }

    return normalized;
  }

  private normalizeTags(tags: EmailTag[] | undefined): EmailTag[] | undefined {
    if (!tags || tags.length === 0) {
      return undefined;
    }

    return tags
      .map((tag) => ({
        name: tag.name.trim(),
        value: tag.value.trim(),
      }))
      .filter((tag) => tag.name.length > 0 && tag.value.length > 0)
      .slice(0, 10);
  }

  private resolveTimeout(): number {
    const raw = this.configService.get<string>('RESEND_TIMEOUT_MS', `${this.defaultTimeoutMs}`);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this.defaultTimeoutMs;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
