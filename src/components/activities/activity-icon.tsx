import {
	ClipboardList,
	FileQuestion,
	FileText,
	Folder,
	Link as LinkIcon,
	MessageSquare,
	Notebook,
	Star,
	File,
} from "lucide-react";
import type { ActivityType } from "@/types/moodle";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
	assignment: ClipboardList,
	quiz: FileQuestion,
	resource: FileText,
	page: FileText,
	forum: MessageSquare,
	url: LinkIcon,
	lesson: Notebook,
	feedback: Star,
	folder: Folder,
	unknown: File,
};

export function ActivityIcon({ type, className }: { type: ActivityType; className?: string }) {
	const Icon = ICONS[type];
	return <Icon className={className} aria-hidden="true" />;
}
