// src/pages/admin/AdminAudit.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const ENTITY_TYPES = [
	{ value: "", label: "All entity types" },
	{ value: "client", label: "Client" },
	{ value: "task", label: "Task" },
	{ value: "document", label: "Document" },
	{ value: "recurring_task", label: "Recurring Task" },
	{ value: "onboarding_template", label: "Onboarding Template" },
	{ value: "app_setting", label: "App Setting" },
	{ value: "user", label: "User" },
];

function formatTs(ts) {
	if (!ts) return "";
	const d = new Date(ts);
	if (Number.isNaN(d.getTime())) return String(ts);
	return d.toLocaleString();
}

export default function AdminAudit() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [events, setEvents] = useState([]);

	const [usersLoading, setUsersLoading] = useState(true);
	const [users, setUsers] = useState([]);

	// Filters
	const [clientId, setClientId] = useState("");
	const [actorUserId, setActorUserId] = useState("");
	const [action, setAction] = useState("");
	const [entityType, setEntityType] = useState("");
	const [limit, setLimit] = useState(200);

	// UI
	const [expanded, setExpanded] = useState(() => new Set());

	const usersById = useMemo(() => {
		const m = {};
		(users || []).forEach((u) => (m[u.id] = u));
		return m;
	}, [users]);

	const buildQuery = () => {
		const params = new URLSearchParams();

		const cid = clientId.trim();
		if (cid) params.set("client_id", cid);

		if (actorUserId) params.set("actor_user_id", actorUserId);

		const a = action.trim();
		if (a) params.set("action", a);

		if (entityType) params.set("entity_type", entityType);

		const lim = Number(limit);
		if (!Number.isNaN(lim) && lim > 0) params.set("limit", String(lim));

		return params.toString();
	};

	const loadUsers = async () => {
		setUsersLoading(true);
		try {
			const res = await api.get("/users");
			setUsers(res.data || []);
		} catch (e) {
			// Don't hard fail the page if users can't load.
			console.error(e);
			setUsers([]);
		} finally {
			setUsersLoading(false);
		}
	};

	const loadEvents = async () => {
		setLoading(true);
		setError("");
		try {
			const qs = buildQuery();
			const res = await api.get(`/admin/audit${qs ? `?${qs}` : ""}`);
			setEvents(res.data || []);
		} catch (e) {
			console.error(e);
			setError(
				"Failed to load audit events. (Check /admin/audit backend route)"
			);
			setEvents([]);
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		// Initial load
		loadUsers();
		loadEvents();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onApply = (e) => {
		e?.preventDefault?.();
		loadEvents();
	};

	const onClear = () => {
		setClientId("");
		setActorUserId("");
		setAction("");
		setEntityType("");
		setLimit(200);
		setExpanded(new Set());
		// reload with defaults
		setTimeout(() => loadEvents(), 0);
	};

	const toggleExpanded = (id) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div className="space-y-4">
			<div className="space-y-1">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate">
					Audit Log
				</div>
				<div className="text-sm text-slate-700">
					Append-only log of key system actions (clients, tasks, docs, purge,
					settings, users).
				</div>
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}

			{/* Filters */}
			<form
				onSubmit={onApply}
				className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-3"
			>
				<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
					<div className="space-y-1">
						<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
							Client ID
						</div>
						<input
							value={clientId}
							onChange={(e) => setClientId(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							placeholder="e.g. 16"
						/>
					</div>

					<div className="space-y-1">
						<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
							Actor
						</div>
						<select
							value={actorUserId}
							onChange={(e) => setActorUserId(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							disabled={usersLoading}
						>
							<option value="">
								{usersLoading ? "Loading..." : "All actors"}
							</option>
							{(users || []).map((u) => (
								<option key={u.id} value={u.id}>
									{u.name} ({u.role})
								</option>
							))}
						</select>
					</div>
					<div className="space-y-1">
						<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
							Action
						</div>
						<input
							value={action}
							onChange={(e) => setAction(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							placeholder="e.g. client.update"
						/>
					</div>

					<div className="space-y-1">
						<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
							Entity type
						</div>
						<select
							value={entityType}
							onChange={(e) => setEntityType(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						>
							{ENTITY_TYPES.map((t) => (
								<option key={t.value} value={t.value}>
									{t.label}
								</option>
							))}
						</select>
					</div>

					<div className="space-y-1">
						<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
							Limit
						</div>
						<input
							type="number"
							min={1}
							max={1000}
							value={limit}
							onChange={(e) => setLimit(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						/>
					</div>
				</div>

				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClear}
						className="px-3 py-2 rounded-md border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
					>
						Clear
					</button>
					<button
						type="submit"
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
						disabled={loading}
					>
						{loading ? "Loading..." : "Apply"}
					</button>
				</div>
			</form>

			{/* Table */}
			<div className="rounded-xl border border-slate-200 bg-white/80 overflow-hidden">
				<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
					<div className="text-xs text-slate-600">
						{loading ? "Loading..." : `${events.length} event(s)`}
					</div>
					<button
						type="button"
						onClick={loadEvents}
						className="text-xs text-yecny-primary hover:underline"
						disabled={loading}
					>
						Refresh
					</button>
				</div>

				<div className="overflow-auto">
					<table className="w-full text-xs">
						<thead className="bg-slate-50 text-slate-600">
							<tr>
								<th className="text-left font-medium px-4 py-2">Time</th>
								<th className="text-left font-medium px-4 py-2">Actor</th>
								<th className="text-left font-medium px-4 py-2">Action</th>
								<th className="text-left font-medium px-4 py-2">Client</th>
								<th className="text-left font-medium px-4 py-2">Entity</th>
								<th className="text-right font-medium px-4 py-2">Details</th>
							</tr>
						</thead>
						<tbody>
							{!loading && events.length === 0 && (
								<tr>
									<td
										colSpan={6}
										className="px-4 py-6 text-center text-slate-500"
									>
										No audit events found.
									</td>
								</tr>
							)}
							{events.map((evt) => {
								const actor = usersById[evt.actor_user_id];
								const isOpen = expanded.has(evt.id);

								return (
									<>
										<tr key={evt.id} className="border-t border-slate-100">
											<td className="px-4 py-2 whitespace-nowrap text-slate-700">
												{formatTs(evt.created_at)}
											</td>
											<td className="px-4 py-2 text-slate-700">
												{actor ? (
													<div className="flex flex-col">
														<span>{actor.name}</span>
														<span className="text-[11px] text-slate-500">
															{actor.role}
														</span>
													</div>
												) : (
													<span className="text-slate-500">
														User #{evt.actor_user_id}
													</span>
												)}
											</td>
											<td className="px-4 py-2 text-slate-700">
												<code className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
													{evt.action}
												</code>
											</td>
											<td className="px-4 py-2 text-slate-700">
												{evt.client_id ?? (
													<span className="text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2 text-slate-700">
												<div className="flex flex-col">
													<span className="text-slate-700">
														{evt.entity_type}
													</span>
													<span className="text-[11px] text-slate-500">
														{evt.entity_id != null ? `#${evt.entity_id}` : "-"}
													</span>
												</div>
											</td>
											<td className="px-4 py-2 text-right">
												{evt.meta ? (
													<button
														type="button"
														onClick={() => toggleExpanded(evt.id)}
														className="text-xs text-yecny-primary hover:underline"
													>
														{isOpen ? "Hide" : "View"}
													</button>
												) : (
													<span className="text-slate-400">-</span>
												)}
											</td>
										</tr>

										{isOpen && evt.meta && (
											<tr className="border-t border-slate-100">
												<td colSpan={6} className="px-4 py-3 bg-slate-50">
													<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-2">
														Meta
													</div>
													<pre className="text-[11px] bg-white border border-slate-200 rounded-md p-2 overflow-auto">
														{JSON.stringify(evt.meta, null, 2)}
													</pre>
												</td>
											</tr>
										)}
									</>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			<div className="text-[11px] text-slate-500">
				Note: This is intended to be append-only. Later versions may add
				retention / export.
			</div>
		</div>
	);
}
