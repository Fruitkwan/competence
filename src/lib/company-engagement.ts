export type CompanyPostKind = "health_challenge" | "promotion" | "prize";

export type CompanyPost = {
  id: string;
  kind: CompanyPostKind;
  title: string;
  summary: string;
  details: string | null;
  recipient_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  cta_label: string | null;
  cta_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export const COMPANY_POST_KIND_LABELS: Record<CompanyPostKind, string> = {
  health_challenge: "Health challenge",
  promotion: "Promotion",
  prize: "Prize & recognition",
};
