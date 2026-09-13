// Shared chatbot type — single source of truth (was duplicated in dashboard/page.tsx,
// dashboard/chatbot-card.tsx and create/wizard.tsx).

export interface Chatbot {
  id: string;
  name: string;
  github_repo: string;
  n8n_webhook_url: string;
  status: string;
  widget_injected: boolean;
  created_at: string;
  updated_at?: string;
  vercel_project_id?: string;
  primary_color?: string;
  secondary_color?: string;
  widget_style?: string;
  icon_type?: string;
  system_prompt?: string;
  source_url?: string;
  greeting?: string;
  chatbot_language?: string;
  // Añadido en la migración 004
  avatar_url?: string | null;
  handoff_whatsapp?: string | null;
  handoff_email?: string | null;
  booking_url?: string | null;
  hide_branding?: boolean;
}
