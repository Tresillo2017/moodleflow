"use client";

import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/layout/logo";
import { LiquidMetal } from "@/components/effects/liquid-metal";

export default function ConnectPage() {
	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<div className="flex items-center gap-2 font-medium">
						<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
							<Logo className="size-4" />
						</div>
						MoodleFlow
					</div>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<LoginForm />
					</div>
				</div>
				<p className="text-center text-xs text-muted-foreground md:text-left">
					Your credentials stay in this browser. MoodleFlow talks directly to your Moodle site — nothing
					passes through any MoodleFlow server.
				</p>
			</div>
			<div className="relative hidden lg:block">
				<LiquidMetal variant="chromatic" className="absolute inset-0" />
				<div className="absolute inset-0 grid place-items-center">
					<div className="grid size-24 place-items-center rounded-3xl bg-black/70 backdrop-blur-sm">
						<Logo className="size-12 text-white" />
					</div>
				</div>
			</div>
		</div>
	);
}
