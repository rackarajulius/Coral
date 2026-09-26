import { Injectable, Logger } from '@nestjs/common';
import { EmailSendResult, EmailService } from '../services/email/email.service';

@Injectable()
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);
  constructor(private readonly emailService: EmailService) {}

  async sendEmail(to: string, subject: string, body: string): Promise<EmailSendResult> {
    this.logger.log(`Sending queued email "${subject}" to ${to}`);
    const delivery = await this.emailService.sendPlainText({
      to,
      subject,
      message: body,
    });
    return delivery;
  }
}
