"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, Link2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";

interface LinkContextMenuProps {
	href: string;
	children: React.ReactNode;
	/** Element the right-click area renders as, so it can carry the row's own classes. */
	render?: React.ReactElement;
	/** Extra items shown above the shared ones. */
	extra?: React.ReactNode;
}

/** Right-click menu for any in-app link: open, open in a new tab, copy link. */
export function LinkContextMenu({ href, children, render, extra }: LinkContextMenuProps) {
	const router = useRouter();

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(`${window.location.origin}${href}`);
			toast.success("Link copied");
		} catch {
			toast.error("Couldn't copy the link");
		}
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onClick={() => router.push(href)}>
					<FolderOpen /> Open
				</ContextMenuItem>
				<ContextMenuItem onClick={() => window.open(href, "_blank", "noopener")}>
					<ExternalLink /> Open in new tab
				</ContextMenuItem>
				{extra}
				<ContextMenuSeparator />
				<ContextMenuItem onClick={copyLink}>
					<Link2 /> Copy link
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
