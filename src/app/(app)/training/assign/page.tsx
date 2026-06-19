import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AssignCourseForm } from "@/components/training/assign-course-form";

export default async function AssignCoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/dashboard");

  // Fetch employees, courses, and existing assignments
  const [empRes, courseRes, assignRes] = await Promise.all([
    supabase.from("employees").select("employee_id, full_name, job_title").eq("active", true).order("full_name"),
    supabase.from("courses").select("id, title, develops").eq("active", true).order("title"),
    supabase
      .from("employee_courses")
      .select("id, employee_id, course_id, status, enrolled_at, started_at, completed_at, score, courses(title), employees(full_name)")
      .order("enrolled_at", { ascending: false }),
  ]);

  const employees = (empRes.data ?? []) as { employee_id: string; full_name: string; job_title: string }[];
  const courses = (courseRes.data ?? []) as { id: string; title: string; develops: string | null }[];

  type RawAssignment = {
    id: string;
    employee_id: string;
    course_id: string;
    status: string;
    enrolled_at: string;
    started_at: string | null;
    completed_at: string | null;
    score: number | null;
    courses: { title: string } | null;
    employees: { full_name: string } | null;
  };
  const rawAssignments = (assignRes.data ?? []) as unknown as RawAssignment[];
  const assignments = rawAssignments.map((a) => ({
    id: a.id,
    employee_id: a.employee_id,
    course_id: a.course_id,
    status: a.status,
    enrolled_at: a.enrolled_at,
    started_at: a.started_at,
    completed_at: a.completed_at,
    score: a.score,
    employee_name: a.employees?.full_name ?? a.employee_id,
    course_title: a.courses?.title ?? "",
  }));

  return (
    <>
      <PageHeader
        title="Assign Training Courses"
        description="Enroll employees in courses and track their progress."
      />
      <AssignCourseForm employees={employees} courses={courses} initialAssignments={assignments} />
    </>
  );
}
