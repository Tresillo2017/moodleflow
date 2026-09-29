import {
	Bell,
	Calendar,
	ClipboardList,
	GraduationCap,
	LayoutDashboard,
	NotebookText,
	Settings,
	User,
} from "lucide-react";

export const NAV_ITEMS = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/courses", label: "My Courses", icon: NotebookText },
	{ href: "/calendar", label: "Calendar", icon: Calendar },
	{ href: "/assignments", label: "Assignments", icon: ClipboardList },
	{ href: "/grades", label: "Grades", icon: GraduationCap },
	{ href: "/notifications", label: "Notifications", icon: Bell },
] as const;

export const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: Settings } as const;

export const PROFILE_ITEM = { href: "/profile", label: "Profile", icon: User } as const;
