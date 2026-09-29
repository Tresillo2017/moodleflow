import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/moodle";

const LABELS: Record<SubmissionStatus, string> = {
	not_started: "Not started",
	draft: "Draft",
	submitted: "Submitted",
	graded: "Graded",
	late: "Submitted late",
	unknown: "",
	overdue: "Overdue",
};

const STYLES: Record<SubmissionStatus, string> = {
	not_started: "bg-muted text-muted-foreground border-transparent",
	draft: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
	submitted: "border-primary/30 bg-primary/10 text-primary",
	graded: "border-success/30 bg-success/10 text-success",
	late: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
	unknown: "",
	overdue: "border-danger/30 bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
	if (status === "unknown") return null;
	return <Badge variant="outline" className={cn("font-normal", STYLES[status])}>{LABELS[status]}</Badge>;
}
