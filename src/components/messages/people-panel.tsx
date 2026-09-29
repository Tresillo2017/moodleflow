"use client";

import { useEffect, useState } from "react";
import { Ban, Check, MessageSquare, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/people/person-avatar";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { toast } from "@/lib/toast";
import type { MoodleContact } from "@/types/moodle";

const SEARCH_DELAY_MS = 300;

type Action = { label: string; icon: React.ReactNode; run: () => Promise<void>; variant?: "outline" | "ghost" | "destructive" };

function PersonRow({ person, actions }: { person: MoodleContact; actions: Action[] }) {
	const [busy, setBusy] = useState(false);
	return (
		<li className="flex items-center gap-3 px-3 py-2 text-sm">
			<PersonAvatar name={person.fullName} imageUrl={person.imageUrl} size="sm" />
			<span className="min-w-0 flex-1 truncate">{person.fullName}</span>
			<span className="flex shrink-0">
				{actions.map((a) => (
					<Button
						key={a.label}
						variant="ghost"
						size="icon-sm"
						disabled={busy}
						aria-label={`${a.label} ${person.fullName}`}
						title={a.label}
						onClick={async () => {
							setBusy(true);
							try {
								await a.run();
							} catch {
								toast.error("That didn't work. Try again.");
							} finally {
								setBusy(false);
							}
						}}
					>
						{a.icon}
					</Button>
				))}
			</span>
		</li>
	);
}

function Group({ title, people, actionsFor }: { title: string; people: MoodleContact[]; actionsFor: (p: MoodleContact) => Action[] }) {
	if (people.length === 0) return null;
	return (
		<section>
			<h2 className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
				{title} <span className="tabular-nums">({people.length})</span>
			</h2>
			<ul>
				{people.map((p) => (
					<PersonRow key={p.id} person={p} actions={actionsFor(p)} />
				))}
			</ul>
		</section>
	);
}

/** Search for people, message them, and manage contacts, requests and blocks. */
export function PeoplePanel({ onMessage }: { onMessage: (person: MoodleContact) => void }) {
	const { client } = useMoodleConnection();
	const [version, setVersion] = useState(0);
	const [search, setSearch] = useState("");
	const [term, setTerm] = useState("");
	const bump = () => setVersion((v) => v + 1);

	useEffect(() => {
		const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DELAY_MS);
		return () => clearTimeout(timer);
	}, [search]);

	const results = useMoodleQuery(client && term.length >= 2 ? () => client.searchPeople(term) : null, [client, term, version]);
	const contacts = useMoodleQuery(client ? () => client.getContacts() : null, [client, version]);
	const requests = useMoodleQuery(client ? () => client.getContactRequests().catch(() => []) : null, [client, version]);
	const blocked = useMoodleQuery(client ? () => client.getBlockedUsers().catch(() => []) : null, [client, version]);

	if (!client) return null;
	const done = (fn: () => Promise<void>) => async () => {
		await fn();
		bump();
	};
	const message: Action = { label: "Message", icon: <MessageSquare />, run: async () => {} };
	const actionsFor = (p: MoodleContact): Action[] => [
		{ ...message, run: async () => onMessage(p) },
		p.isContact
			? { label: "Remove contact", icon: <UserMinus />, run: done(() => client.removeContact(p.id)) }
			: { label: "Add contact", icon: <UserPlus />, run: done(async () => { await client.requestContact(p.id); toast.success("Contact request sent."); }) },
		p.isBlocked
			? { label: "Unblock", icon: <Ban className="text-danger" />, run: done(() => client.unblockUser(p.id)) }
			: { label: "Block", icon: <Ban />, run: done(() => client.blockUser(p.id)) },
	];

	const searching = term.length >= 2;
	return (
		<div className="flex flex-col">
			<div className="p-3">
				<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search people" />
			</div>
			{searching ? (
				<>
					{results.loading && <div className="px-3"><ListSkeleton rows={3} /></div>}
					{results.error && <ErrorState error={results.error} />}
					{results.data && results.data.contacts.length + results.data.others.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No one found for “{term}”.</p>}
					<Group title="Contacts" people={results.data?.contacts ?? []} actionsFor={actionsFor} />
					<Group title="Other people" people={results.data?.others ?? []} actionsFor={actionsFor} />
				</>
			) : (
				<>
					<Group
						title="Requests"
						people={requests.data ?? []}
						actionsFor={(p) => [
							{ label: "Accept request from", icon: <Check className="text-success" />, run: done(() => client.confirmContactRequest(p.id)) },
							{ label: "Decline request from", icon: <X />, run: done(() => client.declineContactRequest(p.id)) },
						]}
					/>
					<Group title="Contacts" people={contacts.data ?? []} actionsFor={actionsFor} />
					<Group title="Blocked" people={blocked.data ?? []} actionsFor={(p) => [{ label: "Unblock", icon: <Ban className="text-danger" />, run: done(() => client.unblockUser(p.id)) }]} />
					{contacts.data?.length === 0 && !requests.data?.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts yet. Search to find classmates and teachers.</p>}
				</>
			)}
		</div>
	);
}
