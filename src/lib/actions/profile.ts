"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_IMAGE_BUCKET } from "@/lib/profile-images";

type ProfileUpdate = {
  fullName: string;
  phone: string;
  bio: string;
  avatarPath: string | null;
};

function clean(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function updateMyProfile(input: ProfileUpdate) {
  const user = await currentUser();
  if (!user) return { error: "Please sign in again." };
  if (!input.fullName.trim()) return { error: "Display name is required." };
  if (input.avatarPath && !input.avatarPath.startsWith(`${user.id}/`)) {
    return { error: "Invalid profile image path." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Profile updates are not configured." };
  const { data, error } = await admin
    .from("profiles")
    .update({
      full_name: input.fullName.trim().slice(0, 120),
      phone: clean(input.phone, 40),
      bio: clean(input.bio, 500),
      avatar_path: input.avatarPath,
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Your profile was not updated." };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/org-chart");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeMyProfileImage() {
  const user = await currentUser();
  if (!user) return { error: "Please sign in again." };
  const admin = createAdminClient();
  if (!admin) return { error: "Profile updates are not configured." };

  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.avatar_path?.startsWith(`${user.id}/`)) {
    const { error: storageError } = await admin.storage
      .from(PROFILE_IMAGE_BUCKET)
      .remove([profile.avatar_path]);
    if (storageError) return { error: storageError.message };
  }

  const { error } = await admin.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  revalidatePath("/org-chart");
  revalidatePath("/", "layout");
  return { error: null };
}
