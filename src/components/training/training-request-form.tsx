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
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [certificationRequired, setCertificationRequired] = useState(false);
  const selectedCourse = useMemo(
    () => courses.find((course) => course.title.toLowerCase() === courseTitle.trim().toLowerCase()),
    [courseTitle, courses]
  );

  async function submit() {
    if (!courseTitle.trim()) {
      toast.error("Enter a training course.");
      return;
    }

    setPending(true);
    const formData = new FormData();
    formData.set("course_id", selectedCourse?.id ?? "");
    formData.set("course_title", courseTitle);
    formData.set("location", location);
    formData.set("budget_amount", budget);
    formData.set("budget_currency", currency);
    formData.set("start_date", startDate);
    formData.set("end_date", endDate);
    formData.set("duration_days", durationDays);
    formData.set("certification_required", String(certificationRequired));
    formData.set("reason", reason);
    const result = await submitTrainingRequest(formData);
    setPending(false);

    if (result?.error) toast.error(result.error);
    else {
      toast.success("Training request sent to your manager.");
      setCourseTitle("");
      setReason("");
      setLocation("");
      setBudget("");
      setCurrency("AED");
      setStartDate("");
      setEndDate("");
      setDurationDays("");
      setCertificationRequired(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Training</CardTitle>
        <CardDescription>Choose a catalog course or type a new training request.</CardDescription>
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
              placeholder="Type course name or custom training..."
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Dubai, online, onsite"
              />
            </div>
            <div className="grid grid-cols-[1fr_92px] gap-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option>AED</option>
                  <option>SAR</option>
                  <option>OMR</option>
                  <option>QAR</option>
                  <option>USD</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration-days">Number of days</Label>
              <Input
                id="duration-days"
                type="number"
                min="1"
                step="1"
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
                placeholder="e.g. 3"
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Certification required?</legend>
            <div className="flex gap-2">
              <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
                <input
                  type="radio"
                  checked={certificationRequired}
                  onChange={() => setCertificationRequired(true)}
                />
                Yes
              </label>
              <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
                <input
                  type="radio"
                  checked={!certificationRequired}
                  onChange={() => setCertificationRequired(false)}
                />
                No
              </label>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="reason">Business reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why do you need this training? Include expected outcome or skill gap."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={pending}>
            <Send className="mr-2 h-4 w-4" />
            {pending ? "Sending..." : "Send request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
