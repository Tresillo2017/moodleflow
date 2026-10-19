"use client";

import { Dialog } from "radix-ui";
import React, { useEffect, useRef, useState } from "react";
import styles from "./wizard.module.css";
import { Button, ButtonRow } from "../button/button";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { browserKey, BrowserListHelper, ExtensionList } from "../browser/browser";
import { Image, ImageRow } from "../image/image";

interface InstallWizardProps {
	children: React.ReactNode
}

export function InstallWizard({
	children
}: InstallWizardProps) {
	const [step, setStep] = useState(0);
	const [selectedBrowser, setSelectedBrowser] = useState<browserKey>("chrome");
	const [selectedExtension, setSelectedExtension] = useState("");

	const [open, setOpen] = useState(false);

	const steps = [
		{
			title: 'Pick your browser',
			body:
				<>
					<p>If you aren’t sure, go with Chrome - it’s a safe bet.</p>
					<BrowserListHelper selectedBrowser={selectedBrowser} setSelectedBrowser={setSelectedBrowser} setStep={setStep} />
				</>,
			next: true
		},
		{
			title: 'Choose an extension manager',
			body:
				<>
					<p>Pick a userscript manager that will handle loading moodleflow for you.</p>
					<ExtensionList browser={selectedBrowser} selectedExtension={selectedExtension} setSelectedExtension={setSelectedExtension} setStep={setStep} />
				</>,
			next: true
		},
		{
			title: 'Almost there',
			body:
				<>
					{selectedBrowser == "chrome" ? (
						<>
							<p>Due to restrictions from Chrome-like browsers, you must first go into your extension settings and enable userscripts.</p>
							<br /><br /><br /><br />
							<ImageRow>
								<Image src="/manage-ext.jpg" alt="Manage extension" round />
								<Image src="/allow-scripts.jpg" alt="Allow userscripts" round />
							</ImageRow>
							<br /><br /><br /><br />
							<p>Once you have done so, you can continue to install moodleflow.</p>
						</>
					) : (
						<p>Once you are ready, hit next to install moodleflow.</p>
					)}
				</>
		},
		{
			title: 'Ready to go',
			body:
				<>
					<p>moodleflow should now be installed! Hit next to open the setup guide, which covers the sites it runs on.</p>
					<br /><br /><br /><br />
					<p>If you run into any issues, don’t hesitate to <a href="https://github.com/Tresillo2017/moodleflow/issues/new/choose" target="_blank">open an issue on GitHub</a>.</p>
				</>
		},
		{
			title: '',
			body: <></>
		}
	]

	const has_opened = useRef(false);
	const has_opened_setup = useRef(false);

	useEffect(() => {
		if (step == 3) {
			has_opened_setup.current = false;
			if (!has_opened.current) {
				window.open(
					`/moodleflow.user.js`,
					"_blank"
				);
				has_opened.current = true;
			}
		} else if (step == 4) {
			has_opened.current = false;
			if (!has_opened_setup.current) {
				window.open(
					`https://github.com/Tresillo2017/moodleflow/blob/master/userscript/README.md`,
					"_blank"
				);
				has_opened_setup.current = true;
				setOpen(false);
				setStep(0);
				return;
			}
		} else {
			has_opened.current = false;
			has_opened_setup.current = false;
		}
	}, [step]);

	return (
		<Dialog.Root open={open} onOpenChange={(open) => {
			setOpen(open);
			if (!open) setStep(0);
		}}>
			<Dialog.Trigger asChild>{children}</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay}>
					<Dialog.Content className={styles.wizard}>
						<WizardStep step={step} />
					</Dialog.Content>
				</Dialog.Overlay>
			</Dialog.Portal>
		</Dialog.Root>
	)

	interface WizardStepProps {
		step: number
	}

	function WizardStep({
		step
	}: WizardStepProps) {
		if (!steps[step]) return (
			<>
				<p>step {step}</p>
			</>
		);

		let prev = step - 1;
		let next = step + 1;

		if (prev < 0) prev = 0;
		if (next > steps.length - 1) next = steps.length - 1;

		const content = steps[step];
		const nextDisabled = content.next || false;

		return (
			<>
				<Dialog.Title className={styles.title}>
					{content.title}
				</Dialog.Title>
				<div className={styles.content}>
					{content.body}
				</div>
				<WizardStepFooter step={step} prev={prev} next={next} nextDisabled={nextDisabled} />
			</>
		)
	}

	interface WizardStepFooterProps {
		step: number,
		prev: number,
		next: number,
		nextDisabled: boolean
	}

	function WizardStepFooter({
		step,
		prev,
		next,
		nextDisabled = false
	}: WizardStepFooterProps) {
		return (
			<div className={styles.footer}>
				{step == 0 ? (
					<Dialog.Close asChild>
						<Button onClick={() => setStep(prev)}>
							<IconChevronLeft size={14} />
							Back
						</Button>
					</Dialog.Close>
				) : (
					<Button onClick={() => setStep(prev)}>
						<IconChevronLeft size={14} />
						Back
					</Button>
				)}
				<Button primary onClick={() => setStep(next)} disabled={nextDisabled}>
					Next
					<IconChevronRight size={14} />
				</Button>
			</div>
		)
	}
}
