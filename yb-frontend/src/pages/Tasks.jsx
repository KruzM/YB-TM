// src/pages/Tasks.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = [
	{ value: "new", label: "New" },
	{ value: "in_progress", label: "In progress" },
	{ value: "waiting_on_client", label: "Waiting on client" },
	{ value: "completed", label: "Completed" },
];

export default function Tasks() {
	const { user } = useAuth();

	const [tasks, setTasks] = useState([]);
	const [clients, setClients] = useState([]);
	const [clientsById, setClientsById] = useState({});

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// New task controls
	const [newTitle, setNewTitle] = useState("");
	const [newClientId, setNewClientId] = useState("");
	const [newDueDate, setNewDueDate] = useState("");

	// Filters
	const [search, setSearch] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");
	const [filterClientId, setFilterClientId] = useState("");

	const [filtering, setFiltering] = useState(false);
	const [adding, setAdding] = useState(false);
	const [updatingId, setUpdatingId] = useState(null);
	const [deletingId, setDeletingId] = useState(null);

	// Task detail drawer
	const [selectedTask, setSelectedTask] = useState(null);
	const [detailOpen, setDetailOpen] = useState(false);

	// -------- Loaders --------

	const loadClients = async () => {
		try {
			const res = await api.get("/clients");
			const list = res.data || [];
			setClients(list);

			const map = {};
			list.forEach((c) => {
				const displayName =
					c.legal_name || c.dba_name || (c.id ? `Client #${c.id}` : "Client");
				map[c.id] = displayName;
			});
			setClientsById(map);
		} catch (err) {
			console.error("Failed to load clients:", err);
		}
	};
	const loadTasks = async (filters = {}) => {
		setError("");

		// Only include params that actually have a value
		const params = {};
		if (filters.q && filters.q.trim() !== "") {
			params.q = filters.q.trim();
		}
		if (filters.status && filters.status !== "all") {
			params.status = filters.status;
		}
		if (filters.client_id) {
			params.client_id = filters.client_id; // a real id string, not ""
		}

		try {
			const res = await api.get("/tasks", { params });
			setTasks(res.data || []);
		} catch (err) {
			console.error("Failed to load tasks:", err);
			setError("Failed to load tasks.");
		}
	};

	const initialLoad = async () => {
		setLoading(true);
		await Promise.all([
			loadClients(),
			loadTasks({}), // no filters, let backend return all
		]);
		setLoading(false);
	};

	useEffect(() => {
		initialLoad();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// -------- Handlers --------

	const handleApplyFilters = async () => {
		setFiltering(true);
		await loadTasks({
			q: search || undefined,
			status: filterStatus || "all",
			client_id: filterClientId || undefined, // DON'T send "" as client_id
		});
		setFiltering(false);
	};

	const handleClearFilters = async () => {
		setSearch("");
		setFilterStatus("all");
		setFilterClientId("");
		setFiltering(true);
		await loadTasks({}); // no params at all
		setFiltering(false);
	};

	const handleAddTask = async () => {
		const title = newTitle.trim();
		if (!title) return;

		setAdding(true);
		try {
			const payload = {
				title,
				client_id: newClientId ? Number(newClientId) : null,
				due_date: newDueDate || null,
			};
			await api.post("/tasks", payload);

			// Clear inputs
			setNewTitle("");
			setNewClientId("");
			setNewDueDate("");

			// Refresh with current filters
			await handleApplyFilters();
		} catch (err) {
			console.error("Failed to add task:", err);
			alert("Failed to add task.");
		} finally {
			setAdding(false);
		}
	};
	const handleStatusChange = async (task, newStatus) => {
		if (task.status === newStatus) return;
		setUpdatingId(task.id);
		try {
			await api.put(`/tasks/${task.id}`, { status: newStatus });
			// Update local state for smooth UX
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
			// Also refresh dashboard buckets indirectly (Dashboard page will refetch when opened)
		} catch (err) {
			console.error("Failed to update task:", err);
			alert("Failed to update task status.");
		} finally {
			setUpdatingId(null);
		}
	};

	const handleDeleteTask = async (taskId) => {
		if (!window.confirm("Are you sure you want to delete this task?")) return;
		setDeletingId(taskId);
		try {
			await api.delete(`/tasks/${taskId}`);
			setTasks((prev) => prev.filter((t) => t.id !== taskId));
		} catch (err) {
			console.error("Failed to delete task:", err);
			alert("Failed to delete task.");
		} finally {
			setDeletingId(null);
		}
	};

	const handleOpenTask = (task) => {
		setSelectedTask(task);
		setDetailOpen(true);
	};

	const handleCloseDetail = () => {
		setDetailOpen(false);
		setSelectedTask(null);
	};

	const clientOptions = [
		{ value: "", label: "All clients" },
		...clients.map((c) => ({
			value: String(c.id),
			label:
				c.legal_name || c.dba_name || (c.id ? `Client #${c.id}` : "Client"),
		})),
	];

	const clientOptionsForNewTask = [
		{ value: "", label: "No client" },
		...clients.map((c) => ({
			value: String(c.id),
			label:
				c.legal_name || c.dba_name || (c.id ? `Client #${c.id}` : "Client"),
		})),
	];
	return (
		<div className="space-y-6 relative">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-semibold text-yecny-charcoal">Tasks</h1>
				<p className="text-xs text-yecny-slate mt-1">
					Central list of your bookkeeping work. Use filters to focus by client,
					status, or search.
				</p>
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}

			{/* New task row
			<section className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 space-y-2">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-1">
					New task
				</div>
				<div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,auto] gap-2 items-center">
					<input
						type="text"
						placeholder="New task title..."
						className="border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
					/>

					<select
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={newClientId}
						onChange={(e) => setNewClientId(e.target.value)}
					>
						{clientOptionsForNewTask.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>

					<input
						type="date"
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={newDueDate}
						onChange={(e) => setNewDueDate(e.target.value)}
					/>

					<button
						type="button"
						onClick={handleAddTask}
						disabled={adding || !newTitle.trim()}
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
					>
						{adding ? "Adding..." : "Add Task"}
					</button>
				</div>
			</section> */}

			{/* Filters */}
			<section className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 space-y-2">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-1">
					Search
				</div>
				<div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,auto,auto] gap-2 items-center">
					<input
						type="text"
						placeholder="Search by task title..."
						className="border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<select
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
					>
						<option value="all">All statuses</option>
						{STATUS_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>

					<select
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={filterClientId}
						onChange={(e) => setFilterClientId(e.target.value)}
					>
						{clientOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>

					<button
						type="button"
						onClick={handleApplyFilters}
						disabled={filtering}
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
					>
						{filtering ? "Filtering..." : "Apply"}
					</button>

					<button
						type="button"
						onClick={handleClearFilters}
						disabled={filtering}
						className="px-4 py-2 rounded-md border border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
					>
						Clear
					</button>
				</div>
			</section>

			{/* Table */}
			<section className="rounded-xl border border-slate-200 bg-white/80 overflow-hidden">
				<div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 text-[11px] text-slate-500">
					<div>
						{tasks.length} {tasks.length === 1 ? "task" : "tasks"}
					</div>
					<div>Status updates here will also reflect on your dashboard.</div>
				</div>

				{loading ? (
					<div className="px-4 py-4 text-xs text-slate-400">Loading...</div>
				) : tasks.length === 0 ? (
					<div className="px-4 py-6 text-xs text-slate-400 text-center">
						No tasks found. Adjust filters or add a new task above.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-xs">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Task
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Client
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Due
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Status
									</th>
									<th className="text-right px-4 py-2 font-semibold text-slate-600">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{tasks.map((task) => {
									const clientName =
										task.client_id && clientsById
											? clientsById[task.client_id] ||
											  `Client #${task.client_id}`
											: null;
									const dueLabel = task.due_date
										? new Date(task.due_date).toLocaleDateString()
										: "";

									const statusOption = STATUS_OPTIONS.find(
										(s) => s.value === task.status
									);

									return (
										<tr
											key={task.id}
											className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
										>
											<td className="px-4 py-3 align-top">
												<div className="flex flex-col gap-0.5">
													<button
														type="button"
														onClick={() => handleOpenTask(task)}
														className="text-[13px] font-semibold text-yecny-primary hover:underline text-left"
													>
														{task.title}
													</button>
													{task.recurring_task_name && (
														<div className="inline-flex items-center gap-1">
															<span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 text-[10px] px-2 py-0.5 text-amber-700 uppercase tracking-[0.12em]">
																Recurring
															</span>
														</div>
													)}
													{task.description && (
														<div className="text-[11px] text-slate-500">
															{task.description}
														</div>
													)}
												</div>
											</td>

											<td className="px-4 py-3 align-top">
												{clientName ? (
													<Link
														to={`/clients/${task.client_id}`}
														className="text-[11px] text-yecny-primary hover:underline"
													>
														{clientName}
													</Link>
												) : (
													<span className="text-[11px] text-slate-400">
														No client
													</span>
												)}
											</td>

											<td className="px-4 py-3 align-top text-[11px] text-slate-600">
												{dueLabel || (
													<span className="text-slate-400">No due date</span>
												)}
											</td>
											<td className="px-4 py-3 align-top">
												<div className="flex items-center gap-2">
													<div className="inline-flex items-center text-[11px] text-slate-500">
														<span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
														{statusOption?.label || "Unknown"}
													</div>
													<select
														className="border border-slate-300 rounded-md px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary disabled:opacity-60"
														value={task.status}
														disabled={updatingId === task.id}
														onChange={(e) =>
															handleStatusChange(task, e.target.value)
														}
													>
														{STATUS_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>
												</div>
											</td>

											<td className="px-4 py-3 align-top text-right">
												<button
													type="button"
													onClick={() => handleOpenTask(task)}
													className="text-[11px] text-yecny-primary hover:underline mr-3"
												>
													Details
												</button>
												<button
													type="button"
													onClick={() => handleDeleteTask(task.id)}
													disabled={deletingId === task.id}
													className="text-[11px] text-red-500 hover:underline disabled:opacity-60"
												>
													{deletingId === task.id ? "Deleting..." : "Delete"}
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Task detail drawer */}
			{detailOpen && selectedTask && (
				<TaskDetailDrawer
					task={selectedTask}
					clientsById={clientsById}
					onClose={handleCloseDetail}
					onStatusChange={handleStatusChange}
				/>
			)}
		</div>
	);
}
// ----------------------
// Task detail drawer
// ----------------------
function TaskDetailDrawer({ task, clientsById, onClose, onStatusChange }) {
	const [subtasks, setSubtasks] = useState([]);
	const [notes, setNotes] = useState([]);
	const [loadingSubs, setLoadingSubs] = useState(true);
	const [loadingNotes, setLoadingNotes] = useState(true);
	const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
	const [newNoteBody, setNewNoteBody] = useState("");
	const [savingSubtask, setSavingSubtask] = useState(false);
	const [savingNote, setSavingNote] = useState(false);

	const clientName =
		task.client_id && clientsById
			? clientsById[task.client_id] || `Client #${task.client_id}`
			: null;

	useEffect(() => {
		if (!task?.id) return;

		const fetchSubtasks = async () => {
			setLoadingSubs(true);
			try {
				const res = await api.get(`/tasks/${task.id}/subtasks`);
				setSubtasks(res.data || []);
			} catch (err) {
				console.error("Failed to load subtasks:", err);
				setSubtasks([]);
			} finally {
				setLoadingSubs(false);
			}
		};

		const fetchNotes = async () => {
			setLoadingNotes(true);
			try {
				const res = await api.get(`/tasks/${task.id}/notes`);
				setNotes(res.data || []);
			} catch (err) {
				console.error("Failed to load task notes:", err);
				setNotes([]);
			} finally {
				setLoadingNotes(false);
			}
		};

		fetchSubtasks();
		fetchNotes();
	}, [task?.id]);

	const handleAddSubtask = async (e) => {
		e.preventDefault();
		const title = newSubtaskTitle.trim();
		if (!title) return;
		setSavingSubtask(true);
		try {
			const res = await api.post(`/tasks/${task.id}/subtasks`, { title });
			setSubtasks((prev) => [...prev, res.data]);
			setNewSubtaskTitle("");
		} catch (err) {
			console.error("Failed to add subtask:", err);
			alert("Could not add subtask.");
		} finally {
			setSavingSubtask(false);
		}
	};

	const handleToggleSubtask = async (subtask) => {
		try {
			const res = await api.put(`/tasks/${task.id}/subtasks/${subtask.id}`, {
				title: subtask.title,
				is_completed: !subtask.is_completed,
			});
			setSubtasks((prev) =>
				prev.map((s) => (s.id === subtask.id ? res.data : s))
			);
		} catch (err) {
			console.error("Failed to update subtask:", err);
			alert("Could not update subtask.");
		}
	};
	const handleAddNote = async (e) => {
		e.preventDefault();
		const body = newNoteBody.trim();
		if (!body) return;
		setSavingNote(true);
		try {
			const res = await api.post(`/tasks/${task.id}/notes`, { body });
			setNotes((prev) => [res.data, ...prev]);
			setNewNoteBody("");
		} catch (err) {
			console.error("Failed to add note:", err);
			alert("Could not add note.");
		} finally {
			setSavingNote(false);
		}
	};

	const dueLabel = task.due_date
		? new Date(task.due_date).toLocaleDateString()
		: "No due date";

	const statusOption = STATUS_OPTIONS.find((s) => s.value === task.status);

	const handleStatusSelect = (e) => {
		const newStatus = e.target.value;
		onStatusChange?.(task, newStatus);
	};

	return (
		<div className="fixed inset-0 z-40 flex">
			{/* Backdrop */}
			<div
				className="flex-1 bg-black/20"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Drawer */}
			<div className="w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
				{/* Header */}
				<div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
					<div className="flex-1">
						<div className="text-[11px] uppercase tracking-[0.16em] text-yecny-slate mb-1">
							Task details
						</div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							{task.title}
						</h2>
						{clientName && (
							<div className="text-[11px] text-slate-500 mt-1">
								Client:{" "}
								<Link
									to={`/clients/${task.client_id}`}
									className="text-yecny-primary hover:underline"
								>
									{clientName}
								</Link>
							</div>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-xs text-slate-400 hover:text-slate-600"
					>
						X
					</button>
				</div>
				{/* Meta */}
				<div className="px-5 py-3 border-b border-slate-100 text-[11px] flex items-center justify-between gap-3">
					<div className="space-y-0.5">
						<div className="text-slate-500">
							Due date: <span className="text-slate-800">{dueLabel}</span>
						</div>
						{task.recurring_task_name && (
							<div className="text-slate-500">
								From recurring rule:{" "}
								<span className="text-slate-800">
									{task.recurring_task_name}
								</span>
							</div>
						)}
					</div>
					<div className="flex flex-col items-end gap-1">
						<span className="text-slate-500">
							Status:{" "}
							<span className="text-slate-800">
								{statusOption?.label || "Unknown"}
							</span>
						</span>
						<select
							value={task.status}
							onChange={handleStatusSelect}
							className="border border-slate-300 rounded-md px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						>
							{STATUS_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs">
					{/* Description */}
					<section className="space-y-2">
						<div className="font-semibold text-yecny-charcoal">Description</div>
						<div className="text-slate-600 whitespace-pre-wrap">
							{task.description || (
								<span className="text-slate-400">No description set.</span>
							)}
						</div>
					</section>

					{/* Subtasks */}
					<section className="space-y-2">
						<div className="flex items-center justify-between">
							<div className="font-semibold text-yecny-charcoal">Subtasks</div>
						</div>
						{loadingSubs ? (
							<div className="text-slate-400">Loading subtasks...</div>
						) : subtasks.length === 0 ? (
							<div className="text-slate-400">
								No subtasks yet. Add the steps for this task below.
							</div>
						) : (
							<ul className="space-y-1.5">
								{subtasks.map((s) => (
									<li key={s.id} className="flex items-start gap-2">
										<input
											type="checkbox"
											checked={s.is_completed}
											onChange={() => handleToggleSubtask(s)}
											className="mt-0.5 h-3 w-3 border-slate-300 rounded"
										/>
										<span
											className={
												"flex-1 " +
												(s.is_completed
													? "line-through text-slate-400"
													: "text-slate-700")
											}
										>
											{s.title}
										</span>
									</li>
								))}
							</ul>
						)}
						<form
							onSubmit={handleAddSubtask}
							className="mt-2 flex items-center gap-2"
						>
							<input
								type="text"
								placeholder="Add subtask-"
								value={newSubtaskTitle}
								onChange={(e) => setNewSubtaskTitle(e.target.value)}
								className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
							<button
								type="submit"
								disabled={savingSubtask}
								className="px-2 py-1 rounded-md bg-yecny-primary text-white text-[11px] hover:bg-yecny-primary-dark disabled:opacity-60"
							>
								{savingSubtask ? "Adding..." : "Add"}
							</button>
						</form>
					</section>

					{/* Notes */}
					<section className="space-y-2">
						<div className="font-semibold text-yecny-charcoal">
							Internal notes
						</div>

						<form
							onSubmit={handleAddNote}
							className="border border-slate-200 rounded-md p-2 space-y-2"
						>
							<textarea
								rows={3}
								placeholder="Add a note about this task-"
								value={newNoteBody}
								onChange={(e) => setNewNoteBody(e.target.value)}
								className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary resize-none"
							/>
							<div className="flex justify-end">
								<button
									type="submit"
									disabled={savingNote}
									className="px-3 py-1.5 rounded-md bg-yecny-primary text-white text-[11px] hover:bg-yecny-primary-dark disabled:opacity-60"
								>
									{savingNote ? "Saving..." : "Add note"}
								</button>
							</div>
						</form>

						{loadingNotes ? (
							<div className="text-slate-400">Loading notes...</div>
						) : notes.length === 0 ? (
							<div className="text-slate-400 text-[11px]">
								No notes yet. Use this space to track questions, context, or
								client interactions.
							</div>
						) : (
							<ul className="space-y-2">
								{notes.map((n) => (
									<li
										key={n.id}
										className="border border-slate-200 rounded-md p-2"
									>
										<div className="text-[11px] text-slate-500 mb-1 flex justify-between">
											<span>{n.author_name || "Team member"}</span>
											<span>
												{n.created_at
													? new Date(n.created_at).toLocaleString()
													: ""}
											</span>
										</div>
										<div className="text-[11px] text-slate-700 whitespace-pre-wrap">
											{n.body}
										</div>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
