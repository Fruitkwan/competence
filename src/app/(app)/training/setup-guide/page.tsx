"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Info, Zap, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   CONSTANTS — all questions / steps lifted verbatim from the HTML
   ===================================================================== */

type QuestionBlock = {
  num: number;
  text: string;
  type: string;
  detail: string;
  options?: string[];
};

/* =====================================================================
   COMPONENT
   ===================================================================== */

export default function FormsSetupGuidePage() {
  return (
    <>
      <PageHeader
        title="Forms Setup Guide"
        description="Use this guide to recreate the cross-functional training survey in Google Forms or Microsoft Forms. Each question is listed with its type and answer options."
      />

      <Tabs defaultValue="google">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="google">Google Forms</TabsTrigger>
          <TabsTrigger value="ms">Microsoft Forms</TabsTrigger>
          <TabsTrigger value="custom">Custom departments</TabsTrigger>
        </TabsList>

        {/* ===== GOOGLE FORMS ===== */}
        <TabsContent value="google">
          <PlatformBadge label="Google Forms" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" />

          <StepBlock num={1} title="Create the form">
            <p>
              Go to <strong>forms.google.com</strong> → click <em>+ Blank</em>.
            </p>
            <p className="mt-1">
              Set the title to: <strong>Cross-Functional Training Survey — [Q2 2025]</strong>
            </p>
            <p className="mt-1">
              Add a description: <em>&quot;Help us plan smarter training across teams. Takes 3–5 minutes.&quot;</em>
            </p>
            <Tip>
              Enable &quot;Collect email addresses&quot; in Settings → Responses so you know who submitted.
            </Tip>
          </StepBlock>

          <StepBlock num={2} title="Add section 1 — About you">
            <p>
              Click <em>Add section</em> and title it <strong>About you</strong>.
            </p>
            <QBlock num={1} text="Full name" type="Short answer" detail="Mark as Required." />
            <QBlock num={2} text="Job title" type="Short answer" detail="Mark as Required." />
            <QBlock
              num={3}
              text="Your department"
              type="Dropdown"
              detail="Options:"
              options={[
                "IT", "Product", "Sales", "Marketing", "Finance",
                "HR", "Operations", "Customer Success", "Legal", "Design",
                "Data & Analytics", "Supply Chain", "IT", "Strategy", "Other",
              ]}
            />
            <QBlock
              num={4}
              text="Your role level"
              type="Multiple choice"
              detail="Options:"
              options={[
                "Employee / Individual Contributor",
                "Team Lead",
                "Manager",
                "Senior Manager / Director",
                "VP / Executive",
              ]}
            />
            <QBlock num={5} text="Manager's name (for reporting)" type="Short answer" detail="Optional." />
          </StepBlock>

          <StepBlock num={3} title="Add section 2 — Training you want to receive">
            <p>
              Click <em>Add section</em> → title it <strong>Training you want to receive</strong>.
            </p>
            <QBlock
              num={6}
              text="Which departments would you like to learn from?"
              type="Checkboxes (multi-select)"
              detail="Options: IT, Product, Sales, Marketing, Finance, HR, Operations, Customer Success, Legal, Design, Data & Analytics, Supply Chain, IT, Strategy"
            />
            <QBlock
              num={7}
              text="What specific skills or topics do you want to learn?"
              type="Paragraph (long text)"
              detail='Optional. Add helper text: "e.g. data analytics basics, budgeting process, agile methodology..."'
            />
            <QBlock
              num={8}
              text="How urgent is this training for you?"
              type="Multiple choice"
              detail="Options:"
              options={[
                "Low — nice to have",
                "Medium — this quarter",
                "High — this month",
                "Critical — ASAP",
              ]}
            />
            <QBlock
              num={9}
              text="Preferred training format"
              type="Multiple choice"
              detail="Options:"
              options={[
                "Workshop / group session",
                "1-on-1 coaching",
                "Job shadowing",
                "Online / self-paced",
                "Lunch & learn",
              ]}
            />
            <QBlock
              num={10}
              text="How many hours per month can you dedicate to learning?"
              type="Multiple choice"
              detail="Options: 1–2 hrs | 3–5 hrs | 6–10 hrs | 10+ hrs"
            />
          </StepBlock>

          <StepBlock num={4} title="Add section 3 — Training you can provide">
            <p>
              Click <em>Add section</em> → title it <strong>Training you can provide</strong>.
            </p>
            <QBlock
              num={11}
              text="Which departments are you willing to train?"
              type="Checkboxes (multi-select)"
              detail='Same options as Question 6. Include "None — I prefer not to train others" as a last option.'
            />
            <QBlock
              num={12}
              text="What topics or skills can you train others on?"
              type="Paragraph"
              detail='Required if Q11 ≠ "None". Add helper text: "e.g. SQL basics, campaign planning, financial modeling..."'
            />
            <QBlock
              num={13}
              text="Your confidence level as a trainer"
              type="Multiple choice"
              detail="Options:"
              options={[
                "Beginner — I can share the basics",
                "Intermediate — comfortable teaching",
                "Expert — deep subject matter knowledge",
              ]}
            />
            <QBlock
              num={14}
              text="Hours per month you can dedicate to training others"
              type="Multiple choice"
              detail="Options: 1–2 hrs | 3–5 hrs | 6–10 hrs | 10+ hrs"
            />
            <QBlock
              num={15}
              text="Who else in your department would you recommend as a trainer?"
              type="Short answer"
              detail="Optional."
            />
            <QBlock
              num={16}
              text="Any additional comments, suggestions, or scheduling preferences?"
              type="Paragraph"
              detail="Optional."
            />
          </StepBlock>

          <StepBlock num={5} title="Share & collect responses">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Click <strong>Send</strong> → copy the link → shorten it using the &quot;Shorten URL&quot; checkbox.</li>
              <li>Paste the link in a company-wide email or Slack message.</li>
              <li>To view results: go to the <strong>Responses</strong> tab → click the Google Sheets icon to export all responses to a spreadsheet.</li>
            </ul>
            <Tip>
              Go to Settings → Presentation → add a confirmation message: &quot;Thank you! Your manager will follow up within 5 business days.&quot;
            </Tip>
          </StepBlock>
        </TabsContent>

        {/* ===== MICROSOFT FORMS ===== */}
        <TabsContent value="ms">
          <PlatformBadge label="Microsoft Forms" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400" />

          <StepBlock num={1} title="Create the form">
            <p>
              Go to <strong>forms.office.com</strong> → click <em>New Form</em>.
            </p>
            <p className="mt-1">
              Title it: <strong>Cross-Functional Training Survey — [Q2 2025]</strong>
            </p>
            <p className="mt-1">Click the paint palette to choose your company&apos;s theme color.</p>
            <Tip>
              Click the &quot;...&quot; menu → Settings → enable &quot;Record name&quot; to capture the respondent&apos;s Microsoft 365 identity automatically (saves asking for name/email).
            </Tip>
          </StepBlock>

          <StepBlock num={2} title="Add questions — same as Google Forms">
            <p className="text-sm text-muted-foreground">
              Use the same 16 questions listed in the Google Forms tab. In Microsoft Forms the equivalent question types are:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>Short answer</strong> → <em>Text</em> (toggle &quot;Long answer&quot; off)</li>
              <li><strong>Paragraph</strong> → <em>Text</em> (toggle &quot;Long answer&quot; on)</li>
              <li><strong>Multiple choice</strong> → <em>Choice</em> (set to single select)</li>
              <li><strong>Checkboxes</strong> → <em>Choice</em> (enable &quot;Multiple answers&quot;)</li>
              <li><strong>Dropdown</strong> → <em>Choice</em> → enable &quot;Drop-down list&quot;</li>
            </ul>
            <Tip icon={<GitBranch className="h-4 w-4" />}>
              In Microsoft Forms you can add branching: if Q11 = &quot;None — I prefer not to train others&quot;, skip to the final comments question. Click the &quot;...&quot; on a question → Add branching.
            </Tip>
          </StepBlock>

          <StepBlock num={3} title="Group into sections">
            <p className="text-sm text-muted-foreground">
              Click <em>Add new</em> → <em>Section</em> to break the form into three parts matching the HTML survey: <em>About you</em>, <em>Training needs</em>, <em>Training you can offer</em>. This creates a paginated experience like the HTML version.
            </p>
          </StepBlock>

          <StepBlock num={4} title="Share & analyze">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Click <strong>Share</strong> → copy link → send via Outlook or Teams.</li>
              <li>To restrict to your organization only: under Share settings choose <em>&quot;Only people in my organization can respond.&quot;</em></li>
              <li>To export: go to <strong>Responses</strong> → click <em>Open in Excel</em> for a live-synced spreadsheet.</li>
              <li>You can also connect responses to a Power Automate flow to notify managers automatically.</li>
            </ul>
            <Tip icon={<Zap className="h-4 w-4" />}>
              Create a flow: trigger = &quot;When a new response is submitted to Microsoft Forms&quot; → action = send an email to the respondent&apos;s manager with a summary of their answers.
            </Tip>
          </StepBlock>
        </TabsContent>

        {/* ===== CUSTOM DEPARTMENTS ===== */}
        <TabsContent value="custom">
          <PlatformBadge label="Customization guide" className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400" />

          <StepBlock num={1} title="Change company name and branding">
            <p className="text-sm text-muted-foreground">
              In <code className="rounded bg-muted px-1.5 py-0.5 text-xs">cross_functional_training_survey.html</code>, find the line:
            </p>
            <CodeBox>{`<div class="logo">Your Company</div>`}</CodeBox>
            <p className="mt-2 text-sm text-muted-foreground">
              Replace <strong>Your Company</strong> with your actual company name. Change the color <code className="rounded bg-muted px-1.5 py-0.5 text-xs">#534AB7</code> to your brand primary color throughout the file.
            </p>
          </StepBlock>

          <StepBlock num={2} title="Add or remove departments">
            <p className="text-sm text-muted-foreground">
              Find the two <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;div class=&quot;dept-grid&quot;&gt;</code> sections (one for &quot;learn from&quot;, one for &quot;train&quot;). Add items like:
            </p>
            <CodeBox>{`<div class="dept-item" onclick="toggleDept(this)"><input type="checkbox">Your Department</div>`}</CodeBox>
            <p className="mt-2 text-sm text-muted-foreground">
              To remove a department, simply delete its <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;div class=&quot;dept-item&quot;&gt;</code> line. Also update the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;select id=&quot;dept&quot;&gt;</code> dropdown in Step 1 to match.
            </p>
          </StepBlock>

          <StepBlock num={3} title="Add a custom question">
            <p className="text-sm text-muted-foreground">
              Inside any <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;div class=&quot;card&quot;&gt;</code> block, add a new field:
            </p>
            <CodeBox>{`<div class="field">
  <label>Your question here</label>
  <input type="text" id="custom1" placeholder="Respondent types here">
</div>`}</CodeBox>
            <p className="mt-2 text-sm text-muted-foreground">
              For a dropdown, replace the input with a <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;select&gt;</code> containing <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;option&gt;</code> tags.
            </p>
          </StepBlock>

          <StepBlock num={4} title="Collect responses (no backend needed)">
            <p className="text-sm text-muted-foreground">
              The HTML file is static — it doesn&apos;t save responses by default. To collect them, choose one of these approaches:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Formspree (free):</strong> Add <code className="rounded bg-muted px-1.5 py-0.5 text-xs">action=&quot;https://formspree.io/f/YOUR_ID&quot;</code> to the form tag and wrap fields in a real <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;form&gt;</code>. Responses arrive by email.
              </li>
              <li>
                <strong>Google Apps Script:</strong> POST the form data to a Google Sheets webhook on submit.
              </li>
              <li>
                <strong>SharePoint / intranet embed:</strong> Host the HTML file in SharePoint and embed it as a web part — or simply send the file as an email attachment.
              </li>
              <li>
                <strong>Easiest option:</strong> Use the Google Forms or Microsoft Forms version for data collection, and the HTML file purely for embedding on your intranet as a visual reference.
              </li>
            </ul>
          </StepBlock>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* =====================================================================
   SUB-COMPONENTS
   ===================================================================== */

function PlatformBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        className
      )}
    >
      ● {label}
    </span>
  );
}

function StepBlock({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-3">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {num}
          </span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="pl-8 text-sm text-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

function QBlock({
  num,
  text,
  type,
  detail,
  options,
}: QuestionBlock) {
  return (
    <div className="my-2 rounded-lg border border-border bg-accent/30 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Question {num}
      </div>
      <div className="mt-0.5 text-[13px] font-medium">{text}</div>
      <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        {type}
      </span>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      {options && (
        <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
          {options.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tip({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex gap-2 rounded-lg border-l-[3px] border-primary bg-primary/5 p-3 text-[13px] text-primary">
      <span className="shrink-0">{icon ?? <Info className="h-4 w-4" />}</span>
      <div>{children}</div>
    </div>
  );
}

function CodeBox({ children }: { children: string }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-primary">
      {children}
    </div>
  );
}
