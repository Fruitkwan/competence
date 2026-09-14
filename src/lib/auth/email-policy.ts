export const COMPANY_EMAIL_DOMAIN = "dhofarglobal.com";

export const COMPANY_EMAIL_ERROR = `Only @${COMPANY_EMAIL_DOMAIN} work email addresses can be used.`;

export function isCompanyEmail(email: string | null | undefined): boolean {
  const normalised = (email ?? "").trim().toLowerCase();
  const at = normalised.lastIndexOf("@");
  return at > 0 && normalised.slice(at + 1) === COMPANY_EMAIL_DOMAIN;
}
