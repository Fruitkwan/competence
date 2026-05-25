"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createJobProfile,
  deleteRoleKpi,
  removeRoleCompetency,
  updateJobProfile,
  upsertRoleCompetency,
  upsertRoleKpi,
  type JobProfileInput,
} from "@/lib/actions/roles";
import type { RoleCompetencyView, RoleKpiView, RoleProfileView } from "./role-detail-view";

type CatalogCompetency = {
  id: string;
  name: string;
  category: string;
};

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

export function CreateRoleDialog({
  departments,
  trigger,
}: {
  departments: string[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    department: departments[0] ?? "",
    reports_to: "",
    role_purpose: "",
    geographic_scope: "",
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.department.trim()) {
      toast.error("Title and department are required.");
      return;
    }

    startTransition(async () => {
      const result = await createJobProfile({
        title: form.title,
        department: form.department,
        reports_to: form.reports_to || null,
        role_purpose: form.role_purpose || null,
        geographic_scope: form.geographic_scope || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Role created");
      setOpen(false);
      router.push(`/roles/${encodeURIComponent(result.title!)}?tab=profile`);
      router.refresh();
    });
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add role
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Add role profile</DialogTitle>
              <DialogDescription>
                Create a new job profile. You can add competencies and KPIs after saving.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Field label="Job title *" id="new-title">
                <Input
                  id="new-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Country General Manager"
                />
              </Field>
              <Field label="Department *" id="new-dept">
                <Select
                  value={form.department}
                  onValueChange={(value) => setForm({ ...form, department: String(value ?? "") })}
                >
                  <SelectTrigger id="new-dept" className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reports to" id="new-reports">
                <Input
                  id="new-reports"
                  value={form.reports_to}
                  onChange={(e) => setForm({ ...form, reports_to: e.target.value })}
                />
              </Field>
              <Field label="Geographic scope" id="new-scope">
                <Input
                  id="new-scope"
                  value={form.geographic_scope}
                  onChange={(e) => setForm({ ...form, geographic_scope: e.target.value })}
                />
              </Field>
              <Field label="Role purpose" id="new-purpose">
                <Textarea
                  id="new-purpose"
                  rows={3}
                  value={form.role_purpose}
                  onChange={(e) => setForm({ ...form, role_purpose: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProfileEditDialog({
  profile,
  departments,
  trigger,
}: {
  profile: RoleProfileView;
  departments: string[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const experience =
    typeof profile.qualifications.experience === "string" ? profile.qualifications.experience : "";

  const [form, setForm] = useState({
    department: profile.department,
    reports_to: profile.reports_to ?? "",
    role_purpose: profile.role_purpose ?? "",
    geographic_scope: profile.geographic_scope ?? "",
    responsibilities: listToLines(profile.responsibilities),
    authority: listToLines(profile.authority),
    experience,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const payload: Omit<JobProfileInput, "title"> = {
        department: form.department,
        reports_to: form.reports_to || null,
        role_purpose: form.role_purpose || null,
        geographic_scope: form.geographic_scope || null,
        responsibilities: linesToList(form.responsibilities),
        authority: linesToList(form.authority),
        qualifications: { experience: form.experience.trim() },
      };

      const result = await updateJobProfile(profile.title, payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Profile updated");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Edit job profile</DialogTitle>
              <DialogDescription>{profile.title}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <Field label="Department *" id="dept" className="sm:col-span-1">
                <Select
                  value={form.department}
                  onValueChange={(value) => setForm({ ...form, department: String(value ?? "") })}
                >
                  <SelectTrigger id="dept" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reports to" id="reports">
                <Input
                  id="reports"
                  value={form.reports_to}
                  onChange={(e) => setForm({ ...form, reports_to: e.target.value })}
                />
              </Field>
              <Field label="Geographic scope" id="scope">
                <Input
                  id="scope"
                  value={form.geographic_scope}
                  onChange={(e) => setForm({ ...form, geographic_scope: e.target.value })}
                />
              </Field>
              <Field label="Role purpose" id="purpose" className="sm:col-span-2">
                <Textarea
                  id="purpose"
                  rows={3}
                  value={form.role_purpose}
                  onChange={(e) => setForm({ ...form, role_purpose: e.target.value })}
                />
              </Field>
              <Field
                label="Responsibilities"
                hint="One item per line"
                id="responsibilities"
                className="sm:col-span-2"
              >
                <Textarea
                  id="responsibilities"
                  rows={5}
                  value={form.responsibilities}
                  onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
                />
              </Field>
              <Field label="Authority" hint="One item per line" id="authority" className="sm:col-span-2">
                <Textarea
                  id="authority"
                  rows={4}
                  value={form.authority}
                  onChange={(e) => setForm({ ...form, authority: e.target.value })}
                />
              </Field>
              <Field label="Qualifications" id="experience" className="sm:col-span-2">
                <Textarea
                  id="experience"
                  rows={4}
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CompetencyDialog({
  roleTitle,
  levels,
  catalog,
  linkedIds,
  initial,
  trigger,
}: {
  roleTitle: string;
  levels: string[];
  catalog: CatalogCompetency[];
  linkedIds: string[];
  initial?: RoleCompetencyView;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">(initial ? "existing" : "existing");

  const availableCatalog = useMemo(
    () => catalog.filter((item) => isEdit || !linkedIds.includes(item.id)),
    [catalog, isEdit, linkedIds],
  );

  const [form, setForm] = useState({
    competency_id: initial?.competency_id ?? "",
    name: initial?.name ?? "",
    category: initial?.category ?? "Core",
    description: initial?.description ?? "",
    behavioral_indicators: initial?.behavioral_indicators ?? "",
    required_level: initial?.required_level ?? "Competent",
    weight: String(initial?.weight ?? 0),
  });

  const resetForm = () => {
    setForm({
      competency_id: initial?.competency_id ?? "",
      name: initial?.name ?? "",
      category: initial?.category ?? "Core",
      description: initial?.description ?? "",
      behavioral_indicators: initial?.behavioral_indicators ?? "",
      required_level: initial?.required_level ?? "Competent",
      weight: String(initial?.weight ?? 0),
    });
    setMode(initial ? "existing" : "existing");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      if (!isEdit && mode === "existing" && !form.competency_id) {
        toast.error("Select a competency from the library.");
        return;
      }

      const result = await upsertRoleCompetency({
        role_title: roleTitle,
        competency_id: isEdit
          ? initial!.competency_id
          : mode === "existing"
            ? form.competency_id
            : undefined,
        name: isEdit || mode === "new" ? form.name || undefined : undefined,
        category: form.category,
        description: isEdit || mode === "new" ? form.description || null : undefined,
        behavioral_indicators:
          isEdit || mode === "new" ? form.behavioral_indicators || null : undefined,
        required_level: form.required_level,
        weight: Number(form.weight) || 0,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Competency updated" : "Competency added");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <span
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        {trigger ??
          (isEdit ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add competency
            </Button>
          ))}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit competency" : "Add competency"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update the required level or competency details for this role."
                  : "Link an existing competency or create a new one."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!isEdit && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "existing" ? "default" : "outline"}
                    onClick={() => setMode("existing")}
                  >
                    From library
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "new" ? "default" : "outline"}
                    onClick={() => setMode("new")}
                  >
                    Create new
                  </Button>
                </div>
              )}

              {!isEdit && mode === "existing" && (
                <Field label="Competency *" id="comp-pick">
                  <Select
                    value={form.competency_id}
                    onValueChange={(value) => {
                      const picked = catalog.find((item) => item.id === value);
                      setForm({
                        ...form,
                        competency_id: String(value ?? ""),
                        name: picked?.name ?? "",
                        category: picked?.category ?? "Core",
                      });
                    }}
                  >
                    <SelectTrigger id="comp-pick" className="w-full">
                      <SelectValue placeholder="Select competency" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCatalog.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {(isEdit || mode === "new") && (
                <>
                  <Field label="Name *" id="comp-name">
                    <Input
                      id="comp-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Category" id="comp-category">
                    <Input
                      id="comp-category"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                  </Field>
                  <Field label="Description" id="comp-desc">
                    <Textarea
                      id="comp-desc"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </Field>
                  <Field label="Behavioral indicators" id="comp-indicators">
                    <Textarea
                      id="comp-indicators"
                      rows={3}
                      value={form.behavioral_indicators}
                      onChange={(e) => setForm({ ...form, behavioral_indicators: e.target.value })}
                    />
                  </Field>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Required level" id="comp-level">
                  <Select
                    value={form.required_level}
                    onValueChange={(value) =>
                      setForm({ ...form, required_level: String(value ?? "Competent") })
                    }
                  >
                    <SelectTrigger id="comp-level" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Weight" id="comp-weight">
                  <Input
                    id="comp-weight"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveCompetencyButton({
  roleTitle,
  competencyId,
  name,
}: {
  roleTitle: string;
  competencyId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await removeRoleCompetency(roleTitle, competencyId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Competency removed from role");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove competency?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{name}&rdquo; from this role. The competency stays in the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function KpiDialog({
  roleTitle,
  department,
  initial,
  trigger,
}: {
  roleTitle: string;
  department: string;
  initial?: RoleKpiView;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    measure: initial?.measure ?? "",
    target: initial?.target ?? "",
    review_frequency: initial?.review_frequency ?? "",
    default_weight: String(initial?.default_weight ?? 0),
  });

  const resetForm = () => {
    setForm({
      title: initial?.title ?? "",
      measure: initial?.measure ?? "",
      target: initial?.target ?? "",
      review_frequency: initial?.review_frequency ?? "",
      default_weight: String(initial?.default_weight ?? 0),
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("KPI title is required.");
      return;
    }

    startTransition(async () => {
      const result = await upsertRoleKpi({
        id: initial?.id,
        role_title: roleTitle,
        department,
        title: form.title,
        measure: form.measure || null,
        target: form.target || null,
        review_frequency: form.review_frequency || null,
        default_weight: Number(form.default_weight) || 0,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "KPI updated" : "KPI added");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <span
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        {trigger ??
          (isEdit ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add KPI
            </Button>
          ))}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit KPI template" : "Add KPI template"}</DialogTitle>
              <DialogDescription>Define measurable outcomes for this role.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Field label="KPI title *" id="kpi-title">
                <Input
                  id="kpi-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Measure / description" id="kpi-measure">
                <Textarea
                  id="kpi-measure"
                  rows={3}
                  value={form.measure}
                  onChange={(e) => setForm({ ...form, measure: e.target.value })}
                />
              </Field>
              <Field label="Target" id="kpi-target">
                <Textarea
                  id="kpi-target"
                  rows={3}
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Review frequency" id="kpi-frequency">
                  <Input
                    id="kpi-frequency"
                    value={form.review_frequency}
                    onChange={(e) => setForm({ ...form, review_frequency: e.target.value })}
                    placeholder="e.g. Monthly"
                  />
                </Field>
                <Field label="Weight" id="kpi-weight">
                  <Input
                    id="kpi-weight"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.default_weight}
                    onChange={(e) => setForm({ ...form, default_weight: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveKpiButton({
  id,
  roleTitle,
  title,
}: {
  id: string;
  roleTitle: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await deleteRoleKpi(id, roleTitle);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("KPI removed");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI template?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove &ldquo;{title}&rdquo; from this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  hint,
  id,
  className,
  children,
}: {
  label: string;
  hint?: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? "" : "mt-1.5"}>{children}</div>
    </div>
  );
}
