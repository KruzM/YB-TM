import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const CATS = [
	{ key: "daily", label: "Daily" },
	{ key: "weekly", label: "Weekly" },
	{ key: "monthly", label: "Monthly" },
	{ key: "quarterly", label: "Quarterly" },
	{ key: "yearly", label: "Yearly" },
	{ key: "projects", label: "Projects" },
	{ key: "general", label: "General" },
];

export default function ClientManualTab({ clientId }) {
	const [entries, setEntries] = useState([]);
	const [activeCat, setActiveCat] = useState("daily");
	const [selectedId, setSelectedId] = useState(null);

	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const load = async () => {
		setError("");
		try {
			const res = await api.get(`/clients/${clientId}/manual`);
			setEntries(res.data || []);
		} catch (e) {
			console.error(e);
			setError("Failed to load manual entries.");
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const byCat = useMemo(() => {
		const map = {};
		for (const c of CATS) map[c.key] = [];
		for (const e of entries) {
			const k = (e.category || "general").toLowerCase();
			if (!map[k]) map[k] = [];
			map[k].push(e);
		}
		return map;
	}, [entries]);
	const selected = useMemo(
		() => entries.find((e) => e.id === selectedId) || null,
		[entries, selectedId]
	);

	useEffect(() => {
		if (selected) {
			setTitle(selected.title || "");
			setBody(selected.body || "");
		} else {
			setTitle("");
			setBody("");
		}
	}, [selected]);

	const createNew = async () => {
		setSaving(true);
		setError("");
		try {
			const res = await api.post(`/clients/${clientId}/manual`, {
				category: activeCat,
				title: "New SOP",
				body: "",
			});
			await load();
			setSelectedId(res.data.id);
		} catch (e) {
			console.error(e);
			setError("Failed to create entry.");
		} finally {
			setSaving(false);
		}
	};

	const save = async () => {
		if (!selected) return;
		setSaving(true);
		setError("");
		try {
			await api.put(`/clients/${clientId}/manual/${selected.id}`, {
				title,
				body,
				category: activeCat,
			});
			await load();
		} catch (e) {
			console.error(e);
			setError("Failed to save entry.");
		} finally {
			setSaving(false);
		}
	};
	const del = async () => {
		if (!selected) return;
		setSaving(true);
		setError("");
		try {
			await api.delete(`/clients/${clientId}/manual/${selected.id}`);
			setSelectedId(null);
			await load();
		} catch (e) {
			console.error(e);
			setError("Failed to delete entry.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-4">
			<div className="rounded-xl border border-slate-200 bg-white/80 p-3">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-2">
					Manual Sections
				</div>

				<div className="space-y-1">
					{CATS.map((c) => (
						<button
							key={c.key}
							type="button"
							onClick={() => {
								setActiveCat(c.key);
								setSelectedId(null);
							}}
							className={[
								"w-full text-left px-3 py-2 rounded-lg text-sm border",
								activeCat === c.key
									? "bg-yecny-primary text-white border-yecny-primary"
									: "bg-white border-slate-200 text-yecny-slate hover:bg-slate-50",
							].join(" ")}
						>
							<div className="flex items-center justify-between">
								<span>{c.label}</span>
								<span className="text-xs opacity-80">
									{(byCat[c.key] || []).length}
								</span>
							</div>
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={createNew}
					disabled={saving}
					className="mt-3 w-full px-3 py-2 rounded-lg bg-yecny-primary text-white text-sm disabled:opacity-50"
				>
					+ New SOP
				</button>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white/80 p-4">
				{error && (
					<div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 mb-3">
						{error}
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
					<div className="border border-slate-200 rounded-xl p-3 bg-white">
						<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-2">
							{CATS.find((x) => x.key === activeCat)?.label} Entries
						</div>
						<div className="space-y-1">
							{(byCat[activeCat] || []).map((e) => (
								<button
									key={e.id}
									type="button"
									onClick={() => setSelectedId(e.id)}
									className={[
										"w-full text-left px-3 py-2 rounded-lg border text-sm",
										selectedId === e.id
											? "bg-yecny-primary-soft/50 border-yecny-primary-soft text-yecny-charcoal"
											: "bg-white border-slate-200 text-yecny-slate hover:bg-slate-50",
									].join(" ")}
								>
									{e.title}
								</button>
							))}
							{(byCat[activeCat] || []).length === 0 && (
								<div className="text-sm text-yecny-slate">
									No entries yet. Click "New SOP".
								</div>
							)}
						</div>
					</div>
					<div className="border border-slate-200 rounded-xl p-3 bg-white">
						{!selected ? (
							<div className="text-sm text-yecny-slate">
								Select an entry to edit it.
							</div>
						) : (
							<div className="space-y-3">
								<label className="text-sm text-yecny-slate block">
									Title
									<input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
									/>
								</label>

								<label className="text-sm text-yecny-slate block">
									SOP / Notes
									<textarea
										value={body}
										onChange={(e) => setBody(e.target.value)}
										className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[220px]"
									/>
								</label>

								<div className="flex items-center justify-between">
									<button
										type="button"
										onClick={del}
										disabled={saving}
										className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
									>
										Delete
									</button>

									<button
										type="button"
										onClick={save}
										disabled={saving}
										className="px-4 py-2 rounded-lg bg-yecny-primary text-white text-sm disabled:opacity-50"
									>
										Save
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
