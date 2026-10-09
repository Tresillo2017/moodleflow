import {
	ClipboardList,
	FileQuestion,
	FileText,
	Folder,
	AlignLeft,
	Link as LinkIcon,
	MessageSquare,
	Notebook,
	Star,
	File,
	BookOpen,
	Package,
	MessagesSquare,
	Video,
	Users,
	Vote,
	ClipboardCheck,
	BookText,
	PlayCircle,
	Boxes,
	ExternalLink,
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
	label: AlignLeft,
	book: BookOpen,
	imscp: Package,
	chat: MessagesSquare,
	bigbluebuttonbn: Video,
	workshop: Users,
	choice: Vote,
	survey: ClipboardCheck,
	wiki: BookText,
	h5pactivity: PlayCircle,
	scorm: Boxes,
	lti: ExternalLink,
	unknown: File,
};

export function ActivityIcon({ type, className }: { type: ActivityType; className?: string }) {
	const Icon = ICONS[type];
	return <Icon className={className} aria-hidden="true" />;
}
