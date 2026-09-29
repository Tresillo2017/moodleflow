import type { ChatMessage, ChatPoll, ChatSession, MeetingInfo, MeetingRecording } from "@/types/moodle";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

function normalizeChatMessage(raw: unknown): ChatMessage {
	const r = asRecord(raw);
	return {
		id: Number(r.id),
		userId: Number(r.userid ?? 0),
		system: Boolean(r.system),
		text: String(r.message ?? ""),
		time: new Date(Number(r.timestamp ?? 0) * 1000).toISOString(),
	};
}

export const normalizeChatMessages = (raw: unknown): ChatMessage[] => asArray(asRecord(raw).messages).map(normalizeChatMessage);

// mod_chat_get_chat_latest_messages
export function normalizeChatPoll(raw: unknown): ChatPoll {
	return { messages: normalizeChatMessages(raw), lastTime: Number(asRecord(raw).chatnewlasttime ?? 0) };
}

// mod_chat_get_sessions
export function normalizeChatSessions(raw: unknown): ChatSession[] {
	return asArray(asRecord(raw).sessions)
		.map((s) => {
			const r = asRecord(s);
			return {
				start: Number(r.sessionstart),
				end: Number(r.sessionend),
				complete: Boolean(r.iscomplete),
				users: asArray(r.sessionusers).map((u) => ({ userId: Number(asRecord(u).sessionuserid ?? asRecord(u).userid), messageCount: Number(asRecord(u).sessionusermessages ?? asRecord(u).messagecount ?? 0) })),
			};
		})
		.sort((a, b) => b.start - a.start);
}

/** Chat system messages arrive as "enter"/"exit" tokens; beeps as "beep <userid>". */
export function chatMessageText(m: ChatMessage, nameOf: (userId: number) => string): string {
	if (m.system && m.text === "enter") return `${nameOf(m.userId)} joined`;
	if (m.system && m.text === "exit") return `${nameOf(m.userId)} left`;
	if (m.text.startsWith("beep ")) return `${nameOf(m.userId)} sent a beep`;
	return m.text;
}

// mod_bigbluebuttonbn_meeting_info + can_join
export function normalizeMeetingInfo(info: unknown, canJoin: unknown): MeetingInfo {
	const i = asRecord(info);
	const j = canJoin && typeof canJoin === "object" ? (canJoin as Record<string, unknown>) : {};
	const seconds = (v: unknown) => (Number(v) > 0 ? new Date(Number(v) * 1000).toISOString() : undefined);
	return {
		running: Boolean(i.statusrunning),
		participantCount: Number(i.participantcount ?? 0),
		canJoin: Boolean(j.can_join),
		message: str(j.message),
		openingTime: seconds(i.openingtime),
		closingTime: seconds(i.closingtime),
	};
}

// mod_bigbluebuttonbn_get_recordings: `recordings` is a JSON string on older releases, an array on newer ones
export function normalizeRecordings(raw: unknown): MeetingRecording[] {
	const r = asRecord(raw);
	let list: unknown = r.recordings;
	if (typeof list === "string") {
		try {
			list = JSON.parse(list);
		} catch {
			list = [];
		}
	}
	const entries = Array.isArray(list) ? list : list && typeof list === "object" ? Object.values(list) : [];
	return entries.map((e) => {
		const rec = asRecord(e);
		const meta = (rec.meta && typeof rec.meta === "object" ? rec.meta : {}) as Record<string, unknown>;
		const playbacks = Array.isArray(rec.playbacks)
			? rec.playbacks.map(asRecord).map((p) => ({ type: String(p.type ?? "playback"), url: String(p.url ?? "") }))
			: Object.entries((rec.playbacks && typeof rec.playbacks === "object" ? rec.playbacks : {}) as Record<string, unknown>).map(([type, p]) => ({
					type,
					url: String(asRecord(p).url ?? ""),
				}));
		const start = Number(rec.startTime ?? rec.starttime ?? 0);
		return {
			id: String(rec.recordID ?? rec.recordid ?? rec.id ?? ""),
			name: String(meta.name ?? rec.name ?? rec.meetingName ?? "Recording"),
			date: start > 0 ? new Date(start).toISOString() : undefined,
			playbacks: playbacks.filter((p) => /^https?:\/\//.test(p.url)),
		};
	});
}
