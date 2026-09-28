"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { removeMyProfileImage, updateMyProfile } from "@/lib/actions/profile";
import { PROFILE_IMAGE_BUCKET } from "@/lib/profile-images";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  email: string;
  fullName: string;
  phone: string;
  bio: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  employeeId: string | null;
};

type Employment = {
  jobTitle: string | null;
  department: string | null;
  country: string | null;
  manager: string | null;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

export function ProfileEditor({ userId, profile, employment }: { userId: string; profile: Profile; employment: Employment }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [bio, setBio] = useState(profile.bio);
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [busy, setBusy] = useState<"save" | "upload" | "remove" | null>(null);

  async function save() {
    setBusy("save");
    const result = await updateMyProfile({ fullName, phone, bio, avatarPath });
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success("Profile updated.");
    router.refresh();
  }

  async function upload(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return toast.error("Choose a JPG, PNG, or WebP image.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Profile images must be 5 MB or smaller.");
    setBusy("upload");
    const path = `${userId}/avatar`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(PROFILE_IMAGE_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "60",
    });
    if (error) {
      setBusy(null);
      return toast.error(error.message);
    }
    const result = await updateMyProfile({ fullName, phone, bio, avatarPath: path });
    setBusy(null);
    if (result.error) return toast.error(result.error);
    setAvatarPath(path);
    setAvatarUrl(URL.createObjectURL(file));
    toast.success("Profile image updated.");
    router.refresh();
  }

  async function removeImage() {
    setBusy("remove");
    const result = await removeMyProfileImage();
    setBusy(null);
    if (result.error) return toast.error(result.error);
    setAvatarPath(null);
    setAvatarUrl(null);
    toast.success("Profile image removed.");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>Your display name, contact number, and introduction are visible to colleagues.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-5 rounded-2xl border bg-muted/20 p-5 sm:flex-row sm:items-center">
            <Avatar className="size-24">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={`${fullName || "Employee"} profile`} />}
              <AvatarFallback className="text-xl">{initials(fullName)}</AvatarFallback>
            </Avatar>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Profile image</p>
                <p className="text-sm text-muted-foreground">JPG, PNG, or WebP. Maximum 5 MB.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy != null}>
                  {busy === "upload" ? <Loader2 className="animate-spin" /> : <Camera />}
                  {avatarPath ? "Replace image" : "Add image"}
                </Button>
                {avatarPath && <Button variant="ghost" onClick={() => void removeImage()} disabled={busy != null} className="text-destructive hover:text-destructive">
                  {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  Remove
                </Button>}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input id="profile-name" value={fullName} maxLength={120} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-phone">Phone number</Label>
            <Input id="profile-phone" type="tel" value={phone} maxLength={40} placeholder="Optional" onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3"><Label htmlFor="profile-bio">About me</Label><span className="text-xs text-muted-foreground">{bio.length}/500</span></div>
            <Textarea id="profile-bio" rows={5} value={bio} maxLength={500} placeholder="Share your role, interests, or what colleagues can contact you about." onChange={(event) => setBio(event.target.value)} />
          </div>
          <Button onClick={() => void save()} disabled={busy != null || !fullName.trim()}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRound className="size-5" /></div>
          <CardTitle>Employment information</CardTitle>
          <CardDescription>Contact HR if any of these official details need to change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ReadOnlyRow label="Employee ID" value={profile.employeeId} />
          <ReadOnlyRow label="Email" value={profile.email} />
          <ReadOnlyRow label="Job title" value={employment.jobTitle} />
          <ReadOnlyRow label="Department" value={employment.department} />
          <ReadOnlyRow label="Country" value={employment.country} />
          <ReadOnlyRow label="Manager" value={employment.manager} />
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string | null }) {
  return <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value || "—"}</span></div>;
}
