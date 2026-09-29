import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
	return (
		<div className={cn("relative", className)}>
			<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
			<Input type="search" className="pl-8" {...props} />
		</div>
	);
}
