import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const PROFILE_IMAGE_BUCKET = "profile-images";

export async function signedProfileImageUrls(
  supabase: SupabaseClient<Database>,
  paths: Array<string | null | undefined>,
) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (!uniquePaths.length) return urls;

  const { data } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60 * 6);

  data?.forEach((result, index) => {
    if (result.signedUrl) urls.set(uniquePaths[index], result.signedUrl);
  });
  return urls;
}
