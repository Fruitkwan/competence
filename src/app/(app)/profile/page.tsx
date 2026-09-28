import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { signedProfileImageUrls } from "@/lib/profile-images";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/profile");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, employee_id, phone, bio, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return (
      <>
        <PageHeader title="My Profile" description="Update how colleagues see you across the Performance Hub." />
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Your profile could not be loaded. Please try again, or contact HR if the problem continues.
        </div>
      </>
    );
  }
  if (!profile) redirect("/dashboard");

  const { data: employee } = profile.employee_id
    ? await supabase
        .from("employees")
        .select("job_title, department, country_code, manager_name")
        .eq("employee_id", profile.employee_id)
        .maybeSingle()
    : { data: null };
  const avatarUrls = await signedProfileImageUrls(supabase, [profile.avatar_path]);

  return (
    <>
      <PageHeader title="My Profile" description="Update how colleagues see you across the Performance Hub." />
      <ProfileEditor
        userId={user.id}
        profile={{
          email: profile.email,
          fullName: profile.full_name ?? "",
          phone: profile.phone ?? "",
          bio: profile.bio ?? "",
          avatarPath: profile.avatar_path,
          avatarUrl: profile.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null,
          employeeId: profile.employee_id,
        }}
        employment={{
          jobTitle: employee?.job_title ?? null,
          department: employee?.department ?? null,
          country: employee?.country_code ?? null,
          manager: employee?.manager_name ?? null,
        }}
      />
    </>
  );
}
