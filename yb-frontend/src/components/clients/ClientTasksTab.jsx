import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const STATUS_OPTIONS = [
	{ value: "new", label: "New" },
	{ value: "in_progress", label: "In progress" },
	{ value: "waiting_on_client", label: "Waiting on client" },
	{ value: "completed", label: "Completed" },
];

export default function ClientTasksTab({ clientId, users = [] }) {
	const { user } = useAuth();
	const role = (user?.role || "").toLowerCase();
	const isAdminOrOwner = role === "admin" || role === "owner";

	const [tasks, setTasks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// new task
	const [newTitle, setNewTitle] = useState("");
	const [newDueDate, setNewDueDate] = useState("");
	const [newAssignedUserId, setNewAssignedUserId] = useState("");
	const [adding, setAdding] = useState(false);

	// filters
	const [search, setSearch] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");
	const [filtering, setFiltering] = useState(false);

	// row actions
	const [updatingId, setUpdatingId] = useState(null);
	const [deletingId, setDeletingId] = useState(null);

	// details drawer
	const [detailOpen, setDetailOpen] = useState(false);
	const [selectedTask, setSelectedTask] = useState(null);

	const loadTasks = async (opts = {}) => {
		if (!clientId) return;
		setError("");

		const params = {};
		if (opts.q && opts.q.trim()) params.q = opts.q.trim();
		if (opts.status && opts.status !== "all") params.status = opts.status;

		try {
			const res = await api.get(`/tasks/client/${clientId}`, { params });
			setTasks(res.data || []);
		} catch (err) {
			console.error(err);
			setError("Failed to load client tasks.");
			setTasks([]);
		}
	};
	useEffect(() => {
		(async () => {
			setLoading(true);
			await loadTasks({});
			setLoading(false);
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const handleApplyFilters = async () => {
		setFiltering(true);
		await loadTasks({ q: search, status: filterStatus });
		setFiltering(false);
	};

	const handleClearFilters = async () => {
		setSearch("");
		setFilterStatus("all");
		setFiltering(true);
		await loadTasks({});
		setFiltering(false);
	};

	const handleAddTask = async () => {
		const title = newTitle.trim();
		if (!title) return;

		setAdding(true);
		try {
			const payload = {
				title,
				client_id: clientId,
				due_date: newDueDate || null,
				task_type: "ad_hoc",

				// NOTE: this only works if backend create_task allows admin/owner override
				assigned_user_id:
					isAdminOrOwner && newAssignedUserId
						? Number(newAssignedUserId)
						: null,
			};

			await api.post("/tasks", payload);

			setNewTitle("");
			setNewDueDate("");
			setNewAssignedUserId("");

			await handleApplyFilters();
		} catch (err) {
			console.error(err);
			alert("Failed to add task.");
		} finally {
			setAdding(false);
		}
	};

	const handleStatusChange = async (task, newStatus) => {
		if (task.status === newStatus) return;
		setUpdatingId(task.id);
		try {
			const res = await api.put(`/tasks/${task.id}`, { status: newStatus });
			const updated = res.data;

			setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
			if (selectedTask?.id === task.id) setSelectedTask(updated);
		} catch (err) {
			console.error(err);
			alert("Failed to update task status.");
		} finally {
			setUpdatingId(null);
		}
	};

	const handleDelete = async (task) => {
		if (!window.confirm(`Delete task "${task.title}"?`)) return;
		setDeletingId(task.id);
		try {
			await api.delete(`/tasks/${task.id}`);
			setTasks((prev) => prev.filter((t) => t.id !== task.id));
			if (selectedTask?.id === task.id) {
				setSelectedTask(null);
				setDetailOpen(false);
			}
		} catch (err) {
			console.error(err);
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

	const userById = {};
	users.forEach((u) => (userById[u.id] = u));

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<div className="text-sm text-yecny-slate">
					One-off client work (non-onboarding, non-recurring). For your personal
					task list, see{" "}
					<Link className="text-yecny-primary hover:underline" to="/tasks">
						Tasks
					</Link>
					.
				</div>
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}

			{/* New task */}
			<section className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 space-y-2">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-1">
					New client task
				</div>
				<div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,auto] gap-2 items-center">
					<input
						type="text"
						placeholder="New task title..."
						className="border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
					/>

					<input
						type="date"
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={newDueDate}
						onChange={(e) => setNewDueDate(e.target.value)}
					/>

					<select
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary disabled:opacity-60"
						value={newAssignedUserId}
						onChange={(e) => setNewAssignedUserId(e.target.value)}
						disabled={!isAdminOrOwner}
						title={
							!isAdminOrOwner
								? "Only Admin/Owner can assign tasks (currently)"
								: ""
						}
					>
						<option value="">
							{isAdminOrOwner ? "Assign to..." : "Assigned to me"}
						</option>
						{users.map((u) => (
							<option key={u.id} value={u.id}>
								{u.name}
							</option>
						))}
					</select>

					<button
						type="button"
						onClick={handleAddTask}
						disabled={adding || !newTitle.trim()}
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
					>
						{adding ? "Adding..." : "Add Task"}
					</button>
				</div>
				{!isAdminOrOwner && (
					<div className="text-[11px] text-slate-500">
						Tip: once backend allows manager assignment, we can enable this
						dropdown for Managers too.
					</div>
				)}
			</section>

			{/* Filters */}
			<section className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 space-y-2">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-1">
					Search
				</div>
				<div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto,auto] gap-2 items-center">
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
					<div>Client-scoped view (not just assigned-to-me).</div>
				</div>
				{loading ? (
					<div className="px-4 py-4 text-xs text-slate-400">Loading...</div>
				) : tasks.length === 0 ? (
					<div className="px-4 py-6 text-xs text-slate-400 text-center">
						No tasks found. Add one above or clear filters.
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
										Due
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Assigned
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
									const dueLabel = task.due_date
										? new Date(task.due_date).toLocaleDateString()
										: "";
									const assignedName =
										task.assigned_user_name ||
										(task.assigned_user_id
											? userById[task.assigned_user_id]?.name
											: "") ||
										"";

									const statusOption = STATUS_OPTIONS.find(
										(s) => s.value === task.status
									);

									return (
										<tr
											key={task.id}
											className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
										>
											<td className="px-4 py-3 align-top">
												<button
													type="button"
													onClick={() => handleOpenTask(task)}
													className="text-[13px] font-semibold text-yecny-primary hover:underline text-left"
												>
													{task.title}
												</button>
												{task.description && (
													<div className="text-[11px] text-slate-500 mt-0.5">
														{task.description}
													</div>
												)}
											</td>

											<td className="px-4 py-3 align-top text-[11px] text-slate-600">
												{dueLabel || (
													<span className="text-slate-400">No due date</span>
												)}
											</td>

											<td className="px-4 py-3 align-top text-[11px] text-slate-600">
												{assignedName || (
													<span className="text-slate-400">Unassigned</span>
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
													onClick={() => handleDelete(task)}
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

			{/* Detail drawer (subtasks/notes require backend visibility fix) */}
			{detailOpen && selectedTask && (
				<TaskDetailDrawer
					task={selectedTask}
					onClose={handleCloseDetail}
					onStatusChange={handleStatusChange}
				/>
			)}
		</div>
	);
}

function TaskDetailDrawer({ task, onClose, onStatusChange }) {
	const [subtasks, setSubtasks] = useState([]);
	const [notes, setNotes] = useState([]);
	const [loadingSubs, setLoadingSubs] = useState(true);
	const [loadingNotes, setLoadingNotes] = useState(true);
	const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
	const [newNoteBody, setNewNoteBody] = useState("");
	const [savingSubtask, setSavingSubtask] = useState(false);
	const [savingNote, setSavingNote] = useState(false);
	useEffect(() => {
		if (!task?.id) return;

		const fetchSubtasks = async () => {
			setLoadingSubs(true);
			try {
				const res = await api.get(`/tasks/${task.id}/subtasks`);
				setSubtasks(res.data || []);
			} catch (err) {
				console.error(err);
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
				console.error(err);
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
			console.error(err);
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
			console.error(err);
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
			console.error(err);
			alert("Could not add note.");
		} finally {
			setSavingNote(false);
		}
	};

	const dueLabel = task.due_date
		? new Date(task.due_date).toLocaleDateString()
		: "No due date";
	const statusOption = STATUS_OPTIONS.find((s) => s.value === task.status);

	return (
		<div className="fixed inset-0 z-40 flex">
			<div
				className="flex-1 bg-black/20"
				onClick={onClose}
				aria-hidden="true"
			/>

			<div className="w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
				<div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
					<div className="flex-1">
						<div className="text-[11px] uppercase tracking-[0.16em] text-yecny-slate mb-1">
							Task details
						</div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							{task.title}
						</h2>
						<div className="text-[11px] text-slate-500 mt-1">
							Due: {dueLabel}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-xs text-slate-400 hover:text-slate-600"
					>
						X
					</button>
				</div>

				<div className="px-5 py-3 border-b border-slate-100 text-[11px] flex items-center justify-between gap-3">
					<div className="text-slate-500">
						Status:{" "}
						<span className="text-slate-800">
							{statusOption?.label || "Unknown"}
						</span>
					</div>
					<select
						value={task.status}
						onChange={(e) => onStatusChange?.(task, e.target.value)}
						className="border border-slate-300 rounded-md px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
					>
						{STATUS_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs">
					<section className="space-y-2">
						<div className="font-semibold text-yecny-charcoal">Description</div>
						<div className="text-slate-600 whitespace-pre-wrap">
							{task.description || (
								<span className="text-slate-400">No description set.</span>
							)}
						</div>
					</section>

					<section className="space-y-2">
						<div className="font-semibold text-yecny-charcoal">Subtasks</div>
						{loadingSubs ? (
							<div className="text-slate-400">Loading subtasks...</div>
						) : subtasks.length === 0 ? (
							<div className="text-slate-400">No subtasks yet.</div>
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
								placeholder="Add subtask..."
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
								placeholder="Add a note..."
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
							<div className="text-slate-400 text-[11px]">No notes yet.</div>
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
