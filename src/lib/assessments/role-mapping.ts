/**
 * Default employees.job_title values covered by each Skill Assessment role
 * family. HR can edit the list per template; these are only the defaults
 * applied when a template is first uploaded.
 */
export const DEFAULT_JOB_TITLES: Record<string, string[]> = {
  "Sales Executive": [
    "Sales Executive",
    "Sales Executive - Technical",
    "Business Development Executive",
    "Client Relations Executive",
    "Van Salesman",
    "Senior Van Salesman",
    "Sr. Van Salesman",
    "Van Sales Service Crew",
    "Sales Order Processing Executive",
  ],
  "Senior Sales Executive / Key Account Manager": [
    "Senior Business Development Executive",
    "Senor Business Development Executive",
    "Sr. Business Development Executive",
    "Key Account Manager",
  ],
  "Sales Manager": [
    "Sales Manager",
    "Area Sales Manager",
    "Area Sales Manager - Chemical",
    "Van Sales Manager",
    "Van Sales Supervisor",
    "CRM Team Leader",
  ],
  "Country General Manager": [
    "Country General Manager",
    "Regional Sales Director - Corporate",
    "Regional Sales Director - HORECA",
    "Regional Sales Director - Chemical",
    "Vice President - Sales",
  ],
  "Category Manager / Category Regional Director": ["Category Manager", "Category Regional Director"],
  "Marketing Manager": ["Marketing Manager", "Senior Marketing Manager"],
  "Operations Manager": ["Operations Manager", "Assistant Operations Manager", "Operations Supervisor", "Supply Chain Director"],
  "Finance Manager": ["Finance Manager", "Chief Finance Officer", "Treasury Manager", "Senior Accountant"],
  "Human Resources Manager": ["Human Resources Manager", "Compensation and Benefits Manager", "People & Culture Executive"],
  "Compliance Officer": ["Compliance Officer"],
  "Information Technology Manager": ["IT Manager", "IT System Administrator", "IT Network Administrator"],
  "Customer Support Manager": ["Customer Support Manager", "Customer Support"],
  "Execution and Projects Manager": ["Execution & Projects Manager", "Execution and Projects Manager"],
};

export function defaultJobTitlesFor(roleFamily: string | null): string[] {
  if (!roleFamily) return [];
  return DEFAULT_JOB_TITLES[roleFamily] ?? [roleFamily];
}
