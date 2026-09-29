"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { sanitizeMoodleHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

const COMMANDS = [
	{ command: "bold", label: "Bold", Icon: Bold },
	{ command: "italic", label: "Italic", Icon: Italic },
	{ command: "insertUnorderedList", label: "Bullet list", Icon: List },
	{ command: "insertOrderedList", label: "Numbered list", Icon: ListOrdered },
] as const;

interface RichTextEditorProps {
	/** Initial HTML only: the editor owns its content afterwards. Remount (key) to reset. */
	initialHtml: string;
	onChange: (html: string) => void;
	placeholder?: string;
	minRows?: number;
	onSubmitShortcut?: () => void;
	/** Accessible name of the text area. */
	label?: string;
}

// ponytail: contentEditable + execCommand (deprecated but universal); swap for Tiptap if tables/images are needed.
export function RichTextEditor({ initialHtml, onChange, placeholder, minRows = 6, onSubmitShortcut, label = "Submission text" }: RichTextEditorProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current) ref.current.innerHTML = sanitizeMoodleHtml(initialHtml);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- initial content only
	}, []);

	return (
		<div className="flex flex-col rounded-md border focus-within:ring-2 focus-within:ring-ring">
			<div className="flex gap-0.5 border-b p-1" role="toolbar" aria-label="Formatting">
				{COMMANDS.map(({ command, label, Icon }) => (
					<button
						key={command}
						type="button"
						aria-label={label}
						title={label}
						// keep the editor's selection when clicking the toolbar
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							document.execCommand(command);
							// Chromium drops the caret at the start of the text when a list is toggled; put it back at the end.
							const sel = getSelection();
							const item = command.includes("List") && sel?.isCollapsed ? sel.anchorNode?.parentElement?.closest("li") : null;
							if (sel && item) {
								sel.selectAllChildren(item);
								sel.collapseToEnd();
							}
							onChange(sanitizeMoodleHtml(ref.current?.innerHTML ?? ""));
						}}
						className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<Icon className="size-3.5" aria-hidden="true" />
					</button>
				))}
			</div>
			<div
				ref={ref}
				contentEditable
				role="textbox"
				aria-multiline="true"
				aria-label={label}
				data-placeholder={placeholder}
				onInput={(e) => onChange(sanitizeMoodleHtml(e.currentTarget.innerHTML))}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmitShortcut?.();
				}}
				style={{ minHeight: `${minRows * 1.5}rem` }}
				className={cn(
					"prose-sm overflow-y-auto px-3 py-2 text-sm outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
					"empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
				)}
			/>
		</div>
	);
}
