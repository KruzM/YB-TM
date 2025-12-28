import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const SCHEDULE_OPTIONS = [
	{
		value: "client_frequency",
		label: "Client frequency (monthly/quarterly/annual)",
	},
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "annual", label: "Annual" },
];

const ROLE_OPTIONS = [
	{ value: "", label: "Unassigned" },
	{ value: "admin", label: "Admin" },
	{ value: "manager", label: "Manager" },
	{ value: "bookkeeper", label: "Bookkeeper" },
];

const newRow = () => ({
	id: -Math.floor(Math.random() * 1_000_000),
	name: "",
	description: "",
	schedule_type: "client_frequency",
	day_of_month: 25,
	weekday: null,
	week_of_month: null,
	initial_delay_days: 21,
	default_assigned_role: "bookkeeper",
	order_index: 0,
	is_active: true,
});

export default function AdminRecurringTemplates() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [savingId, setSavingId] = useState(null);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const sortedRows = useMemo(() => {
		return [...rows].sort(
			(a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
		);
	}, [rows]);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/recurring-templates");
			setRows(res.data || []);
		} catch (e) {
			console.error(e);
			setError("Failed to load recurring templates.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const update = (id, field, value) => {
		setRows((prev) =>
			prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
		);
		setError("");
		setSuccess("");
	};

	const addTemplate = () => {
		setRows((prev) => [...prev, newRow()]);
		setSuccess("");
		setError("");
	};

	const saveRow = async (row) => {
		setSavingId(row.id);
		setError("");
		setSuccess("");
		try {
			const payload = {
				name: (row.name || "").trim(),
				description: (row.description || "").trim() || null,
				schedule_type: row.schedule_type || "client_frequency",
				day_of_month: row.day_of_month ?? null,
				weekday: row.weekday ?? null,
				week_of_month: row.week_of_month ?? null,
				initial_delay_days: row.initial_delay_days ?? 21,
				default_assigned_role: row.default_assigned_role || null,
				order_index: row.order_index ?? 0,
				is_active: !!row.is_active,
			};
			if (!payload.name) {
				setError("Name is required.");
				return;
			}

			if (row.id < 0) {
				const res = await api.post("/recurring-templates", payload);
				const created = res.data;
				setRows((prev) => prev.map((r) => (r.id === row.id ? created : r)));
				setSuccess("Template created.");
			} else {
				const res = await api.put(`/recurring-templates/${row.id}`, payload);
				const updated = res.data;
				setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
				setSuccess("Template saved.");
			}
		} catch (e) {
			console.error(e);
			setError("Failed to save template.");
		} finally {
			setSavingId(null);
		}
	};

	if (loading) {
		return (
			<div className="text-xs text-yecny-slate">
				Loading recurring templates...
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<div className="text-xs uppercase tracking-[0.18em] text-yecny-slate mb-1">
					Admin settings
				</div>
				<h1 className="text-2xl font-semibold text-yecny-charcoal">
					Recurring task templates
				</h1>
				<p className="text-xs text-yecny-slate mt-1 max-w-2xl">
					These templates determine which recurring tasks get created when a
					client is converted from an intake. Use{" "}
					<span className="font-medium">Initial delay</span> to start recurring
					work 2-4 weeks after onboarding.
				</p>
			</div>

			{(error || success) && (
				<div className="space-y-2">
					{error && (
						<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
							{error}
						</div>
					)}
					{success && (
						<div className="text-xs px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
							{success}
						</div>
					)}
				</div>
			)}

			<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
				<div className="flex items-center justify-between">
					<div className="text-sm font-semibold text-yecny-charcoal">
						Templates
					</div>
					<button
						type="button"
						onClick={addTemplate}
						className="text-[11px] text-yecny-primary hover:underline"
					>
						+ Add template
					</button>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-[980px] w-full text-sm">
						<thead>
							<tr className="text-xs text-yecny-slate border-b">
								<th className="text-left py-2 pr-2 w-20">Order</th>
								<th className="text-left py-2 pr-2 w-64">Name</th>
								<th className="text-left py-2 pr-2">Description</th>
								<th className="text-left py-2 pr-2 w-56">Schedule</th>
								<th className="text-left py-2 pr-2 w-32">Day</th>
								<th className="text-left py-2 pr-2 w-40">Initial delay</th>
								<th className="text-left py-2 pr-2 w-40">Assigned role</th>
								<th className="text-left py-2 pr-2 w-24">Active</th>
								<th className="text-right py-2 w-28"></th>
							</tr>
						</thead>
						<tbody>
							{sortedRows.map((r) => (
								<tr key={r.id} className="border-b last:border-b-0">
									<td className="py-2 pr-2">
										<input
											type="number"
											value={r.order_index ?? 0}
											onChange={(e) =>
												update(r.id, "order_index", Number(e.target.value || 0))
											}
											className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm"
										/>
									</td>

									<td className="py-2 pr-2">
										<input
											value={r.name || ""}
											onChange={(e) => update(r.id, "name", e.target.value)}
											className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
											placeholder="Task name"
										/>
									</td>

									<td className="py-2 pr-2">
										<input
											value={r.description || ""}
											onChange={(e) =>
												update(r.id, "description", e.target.value)
											}
											className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
											placeholder="Optional"
										/>
									</td>

									<td className="py-2 pr-2">
										<select
											value={r.schedule_type || "client_frequency"}
											onChange={(e) =>
												update(r.id, "schedule_type", e.target.value)
											}
											className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
										>
											{SCHEDULE_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{opt.label}
												</option>
											))}
										</select>
									</td>

									<td className="py-2 pr-2">
										<input
											type="number"
											min="1"
											max="31"
											value={r.day_of_month ?? 25}
											onChange={(e) =>
												update(
													r.id,
													"day_of_month",
													Number(e.target.value || 25)
												)
											}
											className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
										/>
									</td>
									<td className="py-2 pr-2">
										<div className="flex items-center gap-2">
											<input
												type="number"
												min="0"
												value={r.initial_delay_days ?? 21}
												onChange={(e) =>
													update(
														r.id,
														"initial_delay_days",
														Number(e.target.value || 0)
													)
												}
												className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
											/>
											<span className="text-xs text-yecny-slate">days</span>
										</div>
									</td>

									<td className="py-2 pr-2">
										<select
											value={r.default_assigned_role || ""}
											onChange={(e) =>
												update(r.id, "default_assigned_role", e.target.value)
											}
											className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
										>
											{ROLE_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{opt.label}
												</option>
											))}
										</select>
									</td>

									<td className="py-2 pr-2">
										<input
											type="checkbox"
											checked={!!r.is_active}
											onChange={(e) =>
												update(r.id, "is_active", e.target.checked)
											}
											className="h-4 w-4"
										/>
									</td>

									<td className="py-2 text-right">
										<button
											type="button"
											onClick={() => saveRow(r)}
											disabled={savingId === r.id}
											className="px-3 py-1.5 rounded-md bg-yecny-primary text-white text-xs font-medium disabled:opacity-60"
										>
											{savingId === r.id ? "Saving..." : "Save"}
										</button>
									</td>
								</tr>
							))}

							{!sortedRows.length && (
								<tr>
									<td
										colSpan={9}
										className="py-6 text-center text-xs text-yecny-slate"
									>
										No templates yet. Click + Add template.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
				<div className="text-[11px] text-slate-500">
					Tip: Keep the four default tasks here and set{" "}
					<span className="font-medium">Initial delay</span> to 14-28 days.
				</div>
			</div>
		</div>
	);
}
