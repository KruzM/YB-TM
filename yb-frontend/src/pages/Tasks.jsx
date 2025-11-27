import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

const STATUS_OPTIONS = [
	{ value: "all", label: "All statuses" },
	{ value: "new", label: "New" },
	{ value: "in_progress", label: "In progress" },
	{ value: "waiting_on_client", label: "Waiting on client" },
	{ value: "completed", label: "Completed" },
];

const STATUS_LABELS = {
	new: "New",
	in_progress: "In progress",
	waiting_on_client: "Waiting on client",
	completed: "Completed",
};

export default function Tasks() {
	const [tasks, setTasks] = useState([]);
	const [clients, setClients] = useState([]);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [clientFilter, setClientFilter] = useState("all");

	const [updatingId, setUpdatingId] = useState(null);

	// quick-create state
	const [newTitle, setNewTitle] = useState("");
	const [newClientId, setNewClientId] = useState("all");
	const [newDueDate, setNewDueDate] = useState("");
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");

	const loadData = async () => {
		setLoading(true);
		setError("");

		try {
			const [tasksRes, clientsRes] = await Promise.all([
				api.get("/tasks", {
					params: {
						q: search || undefined,
						status: statusFilter !== "all" ? statusFilter : undefined,
						client_id:
							clientFilter !== "all"
								? Number(clientFilter) || undefined
								: undefined,
					},
				}),
				api.get("/clients"),
			]);

			setTasks(tasksRes.data);
			setClients(clientsRes.data);
		} catch (err) {
			console.error(err);
			setError("Failed to load tasks");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleApplyFilters = async (e) => {
		if (e) e.preventDefault();
		await loadData();
	};

	const handleClearFilters = async () => {
		setSearch("");
		setStatusFilter("all");
		setClientFilter("all");
		await loadData();
	};

	const handleStatusChange = async (task, newStatus) => {
		if (task.status === newStatus) return;
		setUpdatingId(task.id);
		try {
			await api.put(`/tasks/${task.id}`, {
				status: newStatus,
			});

			setTasks((prev) =>
				prev.map((t) =>
					t.id === task.id
						? {
								...t,
								status: newStatus,
						  }
						: t
				)
			);
		} catch (err) {
			console.error(err);
			alert("Failed to update task status");
		} finally {
			setUpdatingId(null);
		}
	};

	const handleDelete = async (task) => {
		if (
			!window.confirm(
				`Delete task "${task.title}"? This will remove it from your task list.`
			)
		) {
			return;
		}

		try {
			await api.delete(`/tasks/${task.id}`);
			setTasks((prev) => prev.filter((t) => t.id !== task.id));
		} catch (err) {
			console.error(err);
			alert("Failed to delete task");
		}
	};

	const handleCreateTask = async (e) => {
		e.preventDefault();
		setCreateError("");

		const title = newTitle.trim();
		if (!title) {
			setCreateError("Please enter a task title.");
			return;
		}

		const payload = {
			title,
			status: "new",
		};

		if (newClientId !== "all" && newClientId !== "" && newClientId !== "none") {
			payload.client_id = Number(newClientId);
		}

		if (newDueDate) {
			payload.due_date = newDueDate;
		}

		try {
			setCreating(true);
			await api.post("/tasks", payload);
			setNewTitle("");
			setNewClientId("all");
			setNewDueDate("");
			await loadData();
		} catch (err) {
			console.error(err);
			setCreateError("Failed to create task");
		} finally {
			setCreating(false);
		}
	};

	const clientById = new Map(clients.map((c) => [c.id, c]));

	return (
		<div className="space-y-5">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-yecny-charcoal">Tasks</h1>
					<p className="text-sm text-yecny-slate mt-1">
						Central list of your bookkeeping work. Use filters to focus by
						client, status, or search.
					</p>
				</div>
			</div>

			{/* Quick create card */}
			<form
				onSubmit={handleCreateTask}
				className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-end gap-3"
			>
				<div className="flex-1">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						New task
					</label>
					<input
						type="text"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						placeholder="New task title..."
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
					/>
				</div>

				<div className="flex-1 md:max-w-xs">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Client (optional)
					</label>
					<select
						value={newClientId}
						onChange={(e) => setNewClientId(e.target.value)}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
					>
						<option value="all">No client</option>
						{clients.map((c) => (
							<option key={c.id} value={c.id}>
								{c.legal_name}
							</option>
						))}
					</select>
				</div>

				<div className="flex-1 md:max-w-xs">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Due date (optional)
					</label>
					<input
						type="date"
						value={newDueDate}
						onChange={(e) => setNewDueDate(e.target.value)}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
					/>
				</div>

				<div className="flex gap-2 md:ml-2">
					<button
						type="submit"
						disabled={creating}
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark disabled:opacity-60"
					>
						{creating ? "Adding..." : "Add Task"}
					</button>
				</div>
			</form>
			{createError && (
				<div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 inline-block">
					{createError}
				</div>
			)}

			{/* Filters card */}
			<form
				onSubmit={handleApplyFilters}
				className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-end gap-3"
			>
				<div className="flex-1">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Search
					</label>
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by task title..."
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
					/>
				</div>

				<div className="flex-1 md:max-w-xs">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Status
					</label>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
					>
						{STATUS_OPTIONS.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex-1 md:max-w-xs">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Client
					</label>
					<select
						value={clientFilter}
						onChange={(e) => setClientFilter(e.target.value)}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
					>
						<option value="all">All clients</option>
						{clients.map((c) => (
							<option key={c.id} value={c.id}>
								{c.legal_name}
							</option>
						))}
					</select>
				</div>
				<div className="flex gap-2 md:ml-2">
					<button
						type="submit"
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark"
					>
						Apply
					</button>
					<button
						type="button"
						onClick={handleClearFilters}
						className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-yecny-slate hover:bg-slate-50"
					>
						Clear
					</button>
				</div>
			</form>

			{/* Task list card */}
			<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
				<div className="px-4 py-2 border-b border-slate-200 text-xs text-yecny-slate flex justify-between">
					<span>
						{loading
							? "Loading tasks..."
							: `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
					</span>
					<span className="hidden sm:inline">
						Status updates here will also reflect on your dashboard.
					</span>
				</div>

				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
						{error}
					</div>
				)}

				{!loading && tasks.length === 0 && !error && (
					<div className="px-4 py-6 text-sm text-yecny-slate">
						No tasks match your filters. Try clearing filters or adjusting your
						search.
					</div>
				)}

				{!loading && tasks.length > 0 && (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Task
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Client
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Due
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Status
									</th>
									<th className="text-right px-4 py-2 font-medium text-yecny-slate">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{tasks.map((task, idx) => {
									const client = task.client_id
										? clientById.get(task.client_id)
										: null;
									const isLast = idx === tasks.length - 1;

									const dueLabel = task.due_date
										? new Date(task.due_date).toLocaleDateString()
										: "No due date";

									const isRecurring = !!task.recurring_task_id;

									return (
										<tr
											key={task.id}
											className={
												"hover:bg-slate-50 transition-colors" +
												(isLast ? "" : " border-b border-slate-100")
											}
										>
											<td className="px-4 py-2 align-top">
												<div className="flex flex-col gap-0.5">
													<div className="font-medium text-yecny-charcoal flex items-center gap-2">
														{task.title}
														{isRecurring && (
															<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] uppercase tracking-wide">
																Recurring
															</span>
														)}
													</div>
													{task.description && (
														<div className="text-xs text-yecny-slate line-clamp-2">
															{task.description}
														</div>
													)}
												</div>
											</td>

											<td className="px-4 py-2 align-top">
												{client ? (
													<Link
														to={`/clients/${client.id}`}
														className="text-xs text-yecny-primary hover:underline"
													>
														{client.legal_name}
													</Link>
												) : (
													<span className="text-xs text-slate-400">
														No client
													</span>
												)}
											</td>

											<td className="px-4 py-2 align-top">
												<div className="text-xs text-yecny-charcoal">
													{dueLabel}
												</div>
											</td>

											<td className="px-4 py-2 align-top">
												<div className="flex items-center gap-2">
													<StatusBadge status={task.status} />
													<select
														value={task.status}
														onChange={(e) =>
															handleStatusChange(task, e.target.value)
														}
														disabled={updatingId === task.id}
														className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
													>
														<option value="new">New</option>
														<option value="in_progress">In progress</option>
														<option value="waiting_on_client">
															Waiting on client
														</option>
														<option value="completed">Completed</option>
													</select>
												</div>
											</td>

											<td className="px-4 py-2 align-top text-right">
												<button
													onClick={() => handleDelete(task)}
													className="text-xs text-red-600 hover:underline"
												>
													Delete
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
function StatusBadge({ status }) {
	if (!status) return null;

	let text = STATUS_LABELS[status] || status;
	let base =
		"inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border";

	switch (status) {
		case "new":
			return (
				<span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>
					{text}
				</span>
			);
		case "in_progress":
			return (
				<span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>
					{text}
				</span>
			);
		case "waiting_on_client":
			return (
				<span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
					{text}
				</span>
			);
		case "completed":
			return (
				<span
					className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}
				>
					{text}
				</span>
			);
		default:
			return (
				<span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>
					{text}
				</span>
			);
	}
}
