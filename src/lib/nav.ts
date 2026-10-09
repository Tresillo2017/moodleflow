import {
	Bell,
	Calendar,
	ClipboardList,
	GraduationCap,
	NotebookPen,
	LayoutDashboard,
	MessagesSquare,
	NotebookText,
	Settings,
	StickyNote,
	User,
} from "lucide-react";

export const NAV_ITEMS = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/courses", label: "My Courses", icon: NotebookText },
	{ href: "/calendar", label: "Calendar", icon: Calendar },
	{ href: "/assignments", label: "Assignments", icon: ClipboardList },
	{ href: "/grades", label: "Grades", icon: GraduationCap },
	{ href: "/messages", label: "Messages", icon: MessagesSquare },
] as const;

export const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: Settings } as const;

export const NOTIFICATIONS_ITEM = { href: "/notifications", label: "Notifications", icon: Bell } as const;

export const PROFILE_ITEM = { href: "/profile", label: "Profile", icon: User } as const;

/** Pages without a tab of their own: reachable from the command palette and the profile page. */
export const EXTRA_ITEMS = [
	{ href: "/blog", label: "Blog", icon: NotebookPen },
	{ href: "/notes", label: "Notes", icon: StickyNote },
] as const;
