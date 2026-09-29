"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { NAV_ITEMS, PROFILE_ITEM, SETTINGS_ITEM } from "@/lib/nav";
import { ClipboardList, LogOut, Moon, PanelLeft, Palette, RotateCw, Search, Sun } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useSidebar } from "@/components/ui/sidebar";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { ACCENTS, type Accent } from "@/lib/preferences";
import { courseHue, formatRelativeDue } from "@/lib/format";

function isTyping(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();
	const { client, disconnect, refresh } = useMoodleConnection();
	const { prefs, setPref } = usePreferences();
	const { toggleSidebar } = useSidebar();

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const assignments = useMoodleQuery(client ? () => client.getAssignments() : null, [client]);
	const currentCourses = courses.data?.filter(isCurrentCourse) ?? [];
	const currentIds = new Set(currentCourses.map((c) => c.id));
	const openAssignments =
		assignments.data?.filter((a) => a.status !== "graded" && a.status !== "submitted" && currentIds.has(a.courseId)) ?? [];

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((o) => !o);
			} else if (e.key === "/" && !isTyping(e.target)) {
				e.preventDefault();
				setOpen(true);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	function run(action: () => void) {
		setOpen(false);
		action();
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label="Search"
				className="flex size-8 items-center justify-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-8 sm:w-56 sm:justify-start sm:border sm:bg-muted/40 sm:px-2.5 lg:w-64"
			>
				<Search className="size-4" aria-hidden="true" />
				<span className="hidden flex-1 text-left sm:inline">Search…</span>
				<kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline">
					⌘K
				</kbd>
			</button>
			<CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search courses, assignments and actions">
				<CommandInput placeholder="Search courses, assignments, actions…" />
				<CommandList className="max-h-[min(26rem,60vh)]">
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Navigate">
						{[...NAV_ITEMS, SETTINGS_ITEM, PROFILE_ITEM].map((item) => (
							<CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
								<item.icon aria-hidden="true" />
								{item.label}
							</CommandItem>
						))}
					</CommandGroup>
					{currentCourses.length > 0 && (
						<CommandGroup heading="Courses">
							{currentCourses.map((c) => (
								<CommandItem
									key={c.id}
									value={`course ${c.id} ${c.fullName}`}
									keywords={[c.shortName]}
									onSelect={() => run(() => router.push(`/courses/${c.id}`))}
								>
									<span
										className="ml-1 mr-0.5 size-2 shrink-0 rounded-full"
										style={{ background: `oklch(0.68 0.15 ${courseHue(c.id)})` }}
										aria-hidden="true"
									/>
									<span className="truncate">{c.fullName}</span>
									<CommandShortcut className="tracking-normal">{c.shortName}</CommandShortcut>
								</CommandItem>
							))}
						</CommandGroup>
					)}
					{openAssignments.length > 0 && (
						<CommandGroup heading="Assignments">
							{openAssignments.map((a) => (
								<CommandItem
									key={a.id}
									value={`assignment ${a.id} ${a.name}`}
									keywords={[a.courseName]}
									onSelect={() => run(() => router.push(`/courses/${a.courseId}`))}
								>
									<ClipboardList aria-hidden="true" />
									<span className="truncate">{a.name}</span>
									{a.dueDate && (
										<CommandShortcut className="tracking-normal">{formatRelativeDue(a.dueDate).label}</CommandShortcut>
									)}
								</CommandItem>
							))}
						</CommandGroup>
					)}
					<CommandSeparator />
					<CommandGroup heading="Actions">
						<CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
							{resolvedTheme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
							Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
						</CommandItem>
						<CommandItem onSelect={() => run(toggleSidebar)}>
							<PanelLeft aria-hidden="true" />
							Toggle sidebar
							<CommandShortcut>⌘B</CommandShortcut>
						</CommandItem>
						<CommandItem onSelect={() => run(refresh)}>
							<RotateCw aria-hidden="true" />
							Refresh data
						</CommandItem>
						<CommandItem onSelect={() => run(disconnect)}>
							<LogOut aria-hidden="true" />
							Sign out
						</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Accent color">
						{(Object.keys(ACCENTS) as Accent[]).map((accent) => (
							<CommandItem
								key={accent}
								value={`accent ${accent}`}
								keywords={["color", "theme"]}
								data-checked={prefs.accent === accent}
								onSelect={() => setPref("accent", accent)}
							>
								<Palette className="text-(--swatch)!" style={{ "--swatch": `oklch(0.65 0.16 ${ACCENTS[accent].hue})` } as React.CSSProperties} aria-hidden="true" />
								{ACCENTS[accent].label}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}
