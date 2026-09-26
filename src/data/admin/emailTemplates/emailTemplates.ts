export type EmailTemplateStatus = "active" | "draft" | "inactive";
export type EmailCategory = "authentication" | "notification" | "transactional" | "marketing";
export type EmailLanguage = "EN" | "FR";

export interface EmailTemplate {
  id: string;
  name: string;
  category: EmailCategory;
  language: EmailLanguage;
  lastUpdated: string;
  status: EmailTemplateStatus;
  subject: Record<EmailLanguage, string>;
  body: Record<EmailLanguage, string>;
  senderName: string;
  replyTo: string;
}

export const PLACEHOLDER_TOKENS = [
  { token: "{{job_title}}", description: "Job position title" },
  { token: "{{employer_name}}", description: "Company name" },
  { token: "{{candidate_name}}", description: "Applicant's full name" },
  { token: "{{salary_range}}", description: "Salary range" },
  { token: "{{application_date}}", description: "Date of application" },
  { token: "{{dashboard_url}}", description: "Link to dashboard" },
  { token: "{{company_logo}}", description: "Company logo URL" },
];

export const mockTemplates: EmailTemplate[] = [
  {
    id: "1",
    name: "Welcome Email",
    category: "authentication",
    language: "EN",
    lastUpdated: "2025-03-20",
    status: "active",
    subject: {
      EN: "Welcome to JobBoard.io, {{candidate_name}}!",
      FR: "Bienvenue sur JobBoard.io, {{candidate_name}} !",
    },
    body: {
      EN: "<p>Hi {{candidate_name}},</p><p>Welcome to JobBoard.io! Your account is now active. Start exploring thousands of job opportunities today.</p><p>Best regards,<br/>The JobBoard.io Team</p>",
      FR: "<p>Bonjour {{candidate_name}},</p><p>Bienvenue sur JobBoard.io ! Votre compte est maintenant actif. Commencez à explorer des milliers d'opportunités d'emploi dès aujourd'hui.</p><p>Cordialement,<br/>L'équipe JobBoard.io</p>",
    },
    senderName: "JobBoard.io",
    replyTo: "noreply@jobboard.io",
  },
  {
    id: "2",
    name: "Application Received",
    category: "transactional",
    language: "EN",
    lastUpdated: "2025-03-18",
    status: "active",
    subject: {
      EN: "Application received for {{job_title}}",
      FR: "Candidature reçue pour {{job_title}}",
    },
    body: {
      EN: "<p>Hi {{candidate_name}},</p><p>Your application for <strong>{{job_title}}</strong> at <strong>{{employer_name}}</strong> has been received on {{application_date}}.</p><p>We will review your profile and get back to you shortly.</p>",
      FR: "<p>Bonjour {{candidate_name}},</p><p>Votre candidature pour <strong>{{job_title}}</strong> chez <strong>{{employer_name}}</strong> a été reçue le {{application_date}}.</p><p>Nous examinerons votre profil et vous recontacterons prochainement.</p>",
    },
    senderName: "JobBoard.io",
    replyTo: "applications@jobboard.io",
  },
  {
    id: "3",
    name: "New Job Alert",
    category: "notification",
    language: "EN",
    lastUpdated: "2025-03-15",
    status: "active",
    subject: {
      EN: "New jobs matching your profile",
      FR: "Nouvelles offres correspondant à votre profil",
    },
    body: {
      EN: "<p>Hi {{candidate_name}},</p><p>We found new jobs that match your preferences:</p><p><strong>{{job_title}}</strong> at {{employer_name}} — {{salary_range}}</p><p><a href='{{dashboard_url}}'>View all matches</a></p>",
      FR: "<p>Bonjour {{candidate_name}},</p><p>Nous avons trouvé de nouvelles offres correspondant à vos préférences :</p><p><strong>{{job_title}}</strong> chez {{employer_name}} — {{salary_range}}</p><p><a href='{{dashboard_url}}'>Voir toutes les offres</a></p>",
    },
    senderName: "JobBoard.io Alerts",
    replyTo: "alerts@jobboard.io",
  },
  {
    id: "4",
    name: "Password Reset",
    category: "authentication",
    language: "EN",
    lastUpdated: "2025-03-10",
    status: "active",
    subject: {
      EN: "Reset your password",
      FR: "Réinitialisez votre mot de passe",
    },
    body: {
      EN: "<p>Hi {{candidate_name}},</p><p>We received a request to reset your password. Click the link below to set a new one:</p><p><a href='{{dashboard_url}}'>Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>",
      FR: "<p>Bonjour {{candidate_name}},</p><p>Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous :</p><p><a href='{{dashboard_url}}'>Réinitialiser le mot de passe</a></p><p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>",
    },
    senderName: "JobBoard.io Security",
    replyTo: "security@jobboard.io",
  },
  {
    id: "5",
    name: "Employer Invitation",
    category: "transactional",
    language: "EN",
    lastUpdated: "2025-02-28",
    status: "draft",
    subject: {
      EN: "You're invited to join {{employer_name}} on JobBoard.io",
      FR: "Vous êtes invité à rejoindre {{employer_name}} sur JobBoard.io",
    },
    body: {
      EN: "<p>Hello,</p><p><strong>{{employer_name}}</strong> has invited you to join their team on JobBoard.io.</p><p><a href='{{dashboard_url}}'>Accept Invitation</a></p>",
      FR: "<p>Bonjour,</p><p><strong>{{employer_name}}</strong> vous a invité à rejoindre son équipe sur JobBoard.io.</p><p><a href='{{dashboard_url}}'>Accepter l'invitation</a></p>",
    },
    senderName: "JobBoard.io",
    replyTo: "invitations@jobboard.io",
  },
  {
    id: "6",
    name: "Interview Scheduled",
    category: "notification",
    language: "EN",
    lastUpdated: "2025-02-20",
    status: "inactive",
    subject: {
      EN: "Interview scheduled for {{job_title}}",
      FR: "Entretien planifié pour {{job_title}}",
    },
    body: {
      EN: "<p>Hi {{candidate_name}},</p><p>Great news! An interview has been scheduled for the <strong>{{job_title}}</strong> position at <strong>{{employer_name}}</strong>.</p><p>Check your dashboard for details.</p>",
      FR: "<p>Bonjour {{candidate_name}},</p><p>Bonne nouvelle ! Un entretien a été planifié pour le poste de <strong>{{job_title}}</strong> chez <strong>{{employer_name}}</strong>.</p><p>Consultez votre tableau de bord pour plus de détails.</p>",
    },
    senderName: "JobBoard.io",
    replyTo: "interviews@jobboard.io",
  },
];
