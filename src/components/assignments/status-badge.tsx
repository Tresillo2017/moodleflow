import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/moodle";

const LABELS: Record<SubmissionStatus, string> = {
	not_started: "Not started",
	draft: "Draft",
	submitted: "Submitted",
	graded: "Graded",
	late: "Late",
	overdue: "Overdue",
};

const STYLES: Record<SubmissionStatus, string> = {
	not_started: "bg-muted text-muted-foreground border-transparent",
	draft: "border-warning/30 bg-warning/10 text-warning-foreground",
	submitted: "border-primary/30 bg-primary/10 text-primary",
	graded: "border-success/30 bg-success/10 text-success",
	late: "border-warning/30 bg-warning/10 text-warning-foreground",
	overdue: "border-danger/30 bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
	return <Badge variant="outline" className={cn("font-normal", STYLES[status])}>{LABELS[status]}</Badge>;
}
