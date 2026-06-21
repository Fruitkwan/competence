"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitTrainingRequest } from "@/lib/actions/training-requests";

type CourseOption = { id: string; title: string; develops: string | null };

export function TrainingRequestForm({ courses }: { courses: CourseOption[] }) {
  const [pending, setPending] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [reason, setReason] = useState("");
  const selectedCourse = useMemo(
    () => courses.find((course) => course.title.toLowerCase() === courseTitle.trim().toLowerCase()),
    [courseTitle, courses]
  );

  async function submit() {
    if (!selectedCourse) {
      toast.error("Choose a course from the list.");
      return;
    }

    setPending(true);
    const formData = new FormData();
    formData.set("course_id", selectedCourse.id);
    formData.set("reason", reason);
    const result = await submitTrainingRequest(formData);
    setPending(false);

    if (result?.error) toast.error(result.error);
    else {
      toast.success("Training request sent to your manager.");
      setCourseTitle("");
      setReason("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Training</CardTitle>
        <CardDescription>Select a course and send it to your manager for review.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Input
              id="course"
              list="training-request-courses"
              value={courseTitle}
              onChange={(event) => setCourseTitle(event.target.value)}
              placeholder="Type course name..."
              required
            />
            <datalist id="training-request-courses">
              {courses.map((course) => (
                <option key={course.id} value={course.title} />
              ))}
            </datalist>
            {selectedCourse?.develops && (
              <p className="text-xs text-muted-foreground">{selectedCourse.develops}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why do you need this training?"
              rows={4}
            />
          </div>

          <Button type="submit" disabled={pending || courses.length === 0}>
            <Send className="mr-2 h-4 w-4" />
            {pending ? "Sending..." : "Send request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
