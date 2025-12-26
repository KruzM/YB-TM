import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const ROLE_OPTIONS = [
	{ value: "", label: "Unassigned" },
	{ value: "bookkeeper", label: "Bookkeeper" },
	{ value: "manager", label: "Manager" },
	{ value: "admin", label: "Admin" },
];

function normalizeRole(v) {
	if (!v) return "";
	return String(v).toLowerCase().trim();
}

export default function AdminOnboardingTemplates() {
	const [loading, setLoading] = useState(true);
	const [savingId, setSavingId] = useState(null);
	const [error, setError] = useState("");
	const [successMsg, setSuccessMsg] = useState("");

	const [rows, setRows] = useState([]);
	const [newRow, setNewRow] = useState({
		name: "",
		description: "",
		phase: "",
		default_due_offset_days: "",
		default_assigned_role: "",
		order_index: 0,
		is_active: true,
	});

	const phases = useMemo(() => {
		const s = new Set();
		rows.forEach((r) => {
			if (r.phase) s.add(r.phase);
		});
		return Array.from(s).sort();
	}, [rows]);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/onboarding-templates");
			const data = res.data || [];
			setRows(
				data.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
			);
		} catch (e) {
			console.error(e);
			setError("Failed to load onboarding templates.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const patchRow = (id, patch) => {
		setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
	};

	const flashSaved = (msg = "Saved.") => {
		setSuccessMsg(msg);
		setTimeout(() => setSuccessMsg(""), 1500);
	};

	const handleSaveRow = async (row) => {
		setSavingId(row.id);
		setError("");
		try {
			const payload = {
				name: row.name?.trim() || "",
				description: row.description || "",
				phase: row.phase || null,
				default_due_offset_days:
					row.default_due_offset_days === "" ||
					row.default_due_offset_days === null
						? null
						: Number(row.default_due_offset_days),
				default_assigned_role: row.default_assigned_role || null,
				order_index: Number(row.order_index || 0),
				is_active: !!row.is_active,
			};

			const res = await api.put(`/onboarding-templates/${row.id}`, payload);
			patchRow(row.id, res.data);
			flashSaved();
		} catch (e) {
			console.error(e);
			setError("Failed to save template row.");
		} finally {
			setSavingId(null);
		}
	};
	const handleCreate = async () => {
		setError("");
		const name = newRow.name.trim();
		if (!name) {
			setError("Template name is required.");
			return;
		}

		setSavingId("new");
		try {
			const payload = {
				name,
				description: newRow.description || "",
				phase: newRow.phase || null,
				default_due_offset_days:
					newRow.default_due_offset_days === "" ||
					newRow.default_due_offset_days === null
						? null
						: Number(newRow.default_due_offset_days),
				default_assigned_role: newRow.default_assigned_role || null,
				order_index: Number(newRow.order_index || 0),
				is_active: !!newRow.is_active,
			};

			const res = await api.post("/onboarding-templates", payload);
			setRows((prev) =>
				[res.data, ...prev].sort(
					(a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
				)
			);

			setNewRow({
				name: "",
				description: "",
				phase: "",
				default_due_offset_days: "",
				default_assigned_role: "",
				order_index: 0,
				is_active: true,
			});
			flashSaved("Created.");
		} catch (e) {
			console.error(e);
			setError("Failed to create template.");
		} finally {
			setSavingId(null);
		}
	};

	const handleDisable = async (row) => {
		if (!window.confirm(`Disable template "${row.name}"?`)) return;
		setSavingId(row.id);
		setError("");
		try {
			// your backend DELETE is a soft delete (sets is_active=False)
			await api.delete(`/onboarding-templates/${row.id}`);
			patchRow(row.id, { is_active: false });
			flashSaved("Disabled.");
		} catch (e) {
			console.error(e);
			setError("Failed to disable template.");
		} finally {
			setSavingId(null);
		}
	};

	const handleEnable = async (row) => {
		setSavingId(row.id);
		setError("");
		try {
			const res = await api.put(`/onboarding-templates/${row.id}`, {
				is_active: true,
			});
			patchRow(row.id, res.data);
			flashSaved("Enabled.");
		} catch (e) {
			console.error(e);
			setError("Failed to enable template.");
		} finally {
			setSavingId(null);
		}
	};
	return (
		<div className="space-y-4">
			<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate">
				Onboarding Templates
			</div>

			<div className="text-sm text-slate-700">
				Edit what gets auto-created during client onboarding. (Backed by{" "}
				<code>onboarding_template_tasks</code>)
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}
			{successMsg && (
				<div className="text-xs px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
					{successMsg}
				</div>
			)}

			{/* Create new */}
			<section className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-3">
				<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
					Add template task
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-6 gap-2 items-start">
					<div className="lg:col-span-2">
						<div className="text-[11px] text-slate-500 mb-1">Name</div>
						<input
							value={newRow.name}
							onChange={(e) =>
								setNewRow((p) => ({ ...p, name: e.target.value }))
							}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
							placeholder="Create QBO company"
						/>
					</div>

					<div className="lg:col-span-2">
						<div className="text-[11px] text-slate-500 mb-1">Phase</div>
						<input
							list="phase-options"
							value={newRow.phase}
							onChange={(e) =>
								setNewRow((p) => ({ ...p, phase: e.target.value }))
							}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
							placeholder="Admin Setup"
						/>
						<datalist id="phase-options">
							{phases.map((p) => (
								<option key={p} value={p} />
							))}
						</datalist>
					</div>

					<div>
						<div className="text-[11px] text-slate-500 mb-1">
							Due offset (days)
						</div>
						<input
							type="number"
							value={newRow.default_due_offset_days}
							onChange={(e) =>
								setNewRow((p) => ({
									...p,
									default_due_offset_days: e.target.value,
								}))
							}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
							placeholder="7"
						/>
					</div>

					<div>
						<div className="text-[11px] text-slate-500 mb-1">Default role</div>
						<select
							value={newRow.default_assigned_role}
							onChange={(e) =>
								setNewRow((p) => ({
									...p,
									default_assigned_role: normalizeRole(e.target.value),
								}))
							}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
						>
							{ROLE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>
					<div className="flex gap-2 items-end">
						<button
							type="button"
							onClick={handleCreate}
							disabled={savingId === "new"}
							className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
						>
							{savingId === "new" ? "Creating..." : "Create"}
						</button>
					</div>
				</div>

				<div>
					<div className="text-[11px] text-slate-500 mb-1">Description</div>
					<textarea
						rows={2}
						value={newRow.description}
						onChange={(e) =>
							setNewRow((p) => ({ ...p, description: e.target.value }))
						}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs resize-none"
						placeholder="Optional notes / checklist text..."
					/>
				</div>
			</section>

			{/* List */}
			<section className="rounded-xl border border-slate-200 bg-white/80 overflow-hidden">
				<div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 text-[11px] text-slate-500">
					<div>{rows.length} templates</div>
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="text-yecny-primary hover:underline disabled:opacity-60"
					>
						Refresh
					</button>
				</div>

				{loading ? (
					<div className="px-4 py-4 text-xs text-slate-400">Loading...</div>
				) : rows.length === 0 ? (
					<div className="px-4 py-6 text-xs text-slate-400 text-center">
						No templates yet. Create one above.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-xs">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Name
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Phase
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Offset
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Role
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Order
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Active
									</th>
									<th className="text-right px-4 py-2 font-semibold text-slate-600">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((r) => (
									<tr
										key={r.id}
										className="border-b border-slate-100 last:border-b-0"
									>
										<td className="px-4 py-3 align-top min-w-[260px]">
											<input
												value={r.name || ""}
												onChange={(e) =>
													patchRow(r.id, { name: e.target.value })
												}
												className="w-full border border-slate-300 rounded-md px-2 py-1 text-[11px]"
											/>
											<textarea
												rows={2}
												value={r.description || ""}
												onChange={(e) =>
													patchRow(r.id, { description: e.target.value })
												}
												className="mt-1 w-full border border-slate-300 rounded-md px-2 py-1 text-[11px] resize-none"
												placeholder="Description..."
											/>
										</td>

										<td className="px-4 py-3 align-top">
											<input
												list="phase-options"
												value={r.phase || ""}
												onChange={(e) =>
													patchRow(r.id, { phase: e.target.value })
												}
												className="w-full border border-slate-300 rounded-md px-2 py-1 text-[11px]"
											/>
										</td>

										<td className="px-4 py-3 align-top">
											<input
												type="number"
												value={r.default_due_offset_days ?? ""}
												onChange={(e) =>
													patchRow(r.id, {
														default_due_offset_days: e.target.value,
													})
												}
												className="w-24 border border-slate-300 rounded-md px-2 py-1 text-[11px]"
											/>
										</td>

										<td className="px-4 py-3 align-top">
											<select
												value={normalizeRole(r.default_assigned_role)}
												onChange={(e) =>
													patchRow(r.id, {
														default_assigned_role: normalizeRole(
															e.target.value
														),
													})
												}
												className="border border-slate-300 rounded-md px-2 py-1 text-[11px] bg-white"
											>
												{ROLE_OPTIONS.map((opt) => (
													<option key={opt.value} value={opt.value}>
														{opt.label}
													</option>
												))}
											</select>
										</td>

										<td className="px-4 py-3 align-top">
											<input
												type="number"
												value={r.order_index ?? 0}
												onChange={(e) =>
													patchRow(r.id, { order_index: e.target.value })
												}
												className="w-20 border border-slate-300 rounded-md px-2 py-1 text-[11px]"
											/>
										</td>

										<td className="px-4 py-3 align-top">
											<span
												className={
													"inline-flex px-2 py-1 rounded-md text-[11px] border " +
													(r.is_active
														? "bg-emerald-50 text-emerald-700 border-emerald-100"
														: "bg-slate-50 text-slate-500 border-slate-200")
												}
											>
												{r.is_active ? "Active" : "Disabled"}
											</span>
										</td>
										<td className="px-4 py-3 align-top text-right whitespace-nowrap">
											<button
												type="button"
												onClick={() => handleSaveRow(r)}
												disabled={savingId === r.id}
												className="text-[11px] text-yecny-primary hover:underline disabled:opacity-60 mr-3"
											>
												{savingId === r.id ? "Saving..." : "Save"}
											</button>

											{r.is_active ? (
												<button
													type="button"
													onClick={() => handleDisable(r)}
													disabled={savingId === r.id}
													className="text-[11px] text-red-500 hover:underline disabled:opacity-60"
												>
													Disable
												</button>
											) : (
												<button
													type="button"
													onClick={() => handleEnable(r)}
													disabled={savingId === r.id}
													className="text-[11px] text-emerald-600 hover:underline disabled:opacity-60"
												>
													Enable
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
}
