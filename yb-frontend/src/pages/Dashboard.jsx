// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import DashboardAssigneeFilter from "../components/DashboardAssigneeFilter";
const STATUS_OPTIONS = [
	{ value: "new", label: "New" },
	{ value: "in_progress", label: "In progress" },
	{ value: "waiting_on_client", label: "Waiting on client" },
	{ value: "completed", label: "Completed" },
];

export default function Dashboard() {
	const { user } = useAuth();

	const [data, setData] = useState({
		overdue: [],
		today: [],
		upcoming: [],
		waiting_on_client: [],
	});

	const [clientsById, setClientsById] = useState({});
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [updatingId, setUpdatingId] = useState(null);
	const [error, setError] = useState("");

	const [selectedTask, setSelectedTask] = useState(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const [assigneeFilter, setAssigneeFilter] = useState("me");

	// ---- Loaders ----

	const loadDashboardOnly = async () => {
		setError("");
		try {
			const params = {};
			if (assigneeFilter === "unassigned") {
				params.include_unassigned = true;
			} else if (assigneeFilter !== "me") {
				params.assignee_user_id = Number(assigneeFilter);
			}

			const res = await api.get("/tasks/my-dashboard", { params });
			setData(res.data || {});
		} catch (err) {
			console.error(err);
			setError("Failed to load your task dashboard.");
		}
	};

	const loadClients = async () => {
		try {
			const res = await api.get("/clients");
			const list = res.data || [];
			const map = {};
			list.forEach((c) => {
				const displayName =
					c.legal_name || c.dba_name || (c.id ? `Client #${c.id}` : "Client");
				map[c.id] = displayName;
			});
			setClientsById(map);
		} catch (err) {
			console.error("Failed to load clients for dashboard:", err);
		}
	};

	const loadAll = async () => {
		setLoading(true);
		setError("");
		try {
			const [tasksRes, clientsRes] = await Promise.all([
				api.get("/tasks/my-dashboard"),
				api.get("/clients"),
			]);

			setData(tasksRes.data || {});

			const list = clientsRes.data || [];
			const map = {};
			list.forEach((c) => {
				const displayName =
					c.legal_name || c.dba_name || (c.id ? `Client #${c.id}` : "Client");
				map[c.id] = displayName;
			});
			setClientsById(map);
		} catch (err) {
			console.error(err);
			setError("Failed to load your task dashboard.");
		} finally {
			setLoading(false);
		}
	};

	// Load clients once on first render
	useEffect(() => {
		loadClients();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Load dashboard tasks whenever the filter changes (also runs once on initial render)
	useEffect(() => {
		(async () => {
			setLoading(true);
			await loadDashboardOnly();
			setLoading(false);
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [assigneeFilter]);

	const handleRefresh = async () => {
		setRefreshing(true);
		await Promise.all([loadDashboardOnly(), loadClients()]);
		setRefreshing(false);
	};

	// ---- Status change ----

	const handleStatusChange = async (task, newStatus) => {
		if (task.status === newStatus) return;
		setUpdatingId(task.id);
		try {
			await api.put(`/tasks/${task.id}`, { status: newStatus });
			await loadDashboardOnly();
		} catch (err) {
			console.error(err);
			alert("Failed to update task status.");
		} finally {
			setUpdatingId(null);
		}
	};
	// ---- Task detail ----

	const handleOpenTask = (task) => {
		setSelectedTask(task);
		setDetailOpen(true);
	};

	const handleCloseDetail = () => {
		setDetailOpen(false);
		setSelectedTask(null);
	};

	const today = new Date();
	const todayLabel = today.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
	});

	return (
		<div className="space-y-6 relative">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div>
					<div className="text-xs uppercase tracking-[0.18em] text-yecny-slate mb-1">
						Today
					</div>
					<h1 className="text-2xl md:text-3xl font-semibold text-yecny-charcoal">
						{user?.name ? `Good day, ${user.name}` : "Your Daily Dashboard"}
					</h1>
					<p className="text-xs text-yecny-slate mt-1">
						{todayLabel} -{" "}
						{assigneeFilter === "me"
							? "Your tasks"
							: assigneeFilter === "unassigned"
							? "Unassigned tasks (assign queue)"
							: "Tasks for selected user"}{" "}
						grouped by urgency.
					</p>
				</div>

				<div className="flex items-center gap-2 text-xs">
					<DashboardAssigneeFilter
						value={assigneeFilter}
						onChange={setAssigneeFilter}
					/>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={loading || refreshing}
						className="px-3 py-2 rounded-md border border-slate-300 bg-white text-yecny-slate hover:bg-slate-50 disabled:opacity-60"
					>
						{refreshing ? "Refreshing..." : "Refresh"}
					</button>
				</div>
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}

			{/* Columns */}
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
				<TaskColumn
					title="Overdue"
					subtitle="Due before today"
					tone="danger"
					tasks={data.overdue || []}
					clientsById={clientsById}
					loading={loading}
					updatingId={updatingId}
					onStatusChange={handleStatusChange}
					onOpenTask={handleOpenTask}
				/>
				<TaskColumn
					title="Today"
					subtitle="Due today"
					tone="primary"
					tasks={data.today || []}
					clientsById={clientsById}
					loading={loading}
					updatingId={updatingId}
					onStatusChange={handleStatusChange}
					onOpenTask={handleOpenTask}
				/>
				<TaskColumn
					title="Upcoming"
					subtitle="Next 7 days"
					tone="neutral"
					tasks={data.upcoming || []}
					clientsById={clientsById}
					loading={loading}
					updatingId={updatingId}
					onStatusChange={handleStatusChange}
					onOpenTask={handleOpenTask}
				/>
				<TaskColumn
					title="Waiting on Client"
					subtitle="Follow-ups required"
					tone="amber"
					tasks={data.waiting_on_client || []}
					clientsById={clientsById}
					loading={loading}
					updatingId={updatingId}
					onStatusChange={handleStatusChange}
					onOpenTask={handleOpenTask}
				/>
			</div>

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
// Task column component
// ----------------------
function TaskColumn({
	title,
	subtitle,
	tone,
	tasks,
	clientsById,
	loading,
	updatingId,
	onStatusChange,
	onOpenTask,
}) {
	const hasTasks = tasks && tasks.length > 0;

	const toneStyles = {
		danger: {
			border: "border-red-100",
			headerBg: "bg-red-50",
			label: "text-red-800",
			countBg: "bg-red-100",
		},
		primary: {
			border: "border-yecny-primary-soft",
			headerBg: "bg-yecny-primary-soft/40",
			label: "text-yecny-primary",
			countBg: "bg-yecny-primary-soft",
		},
		neutral: {
			border: "border-slate-200",
			headerBg: "bg-slate-50",
			label: "text-slate-700",
			countBg: "bg-slate-200",
		},
		amber: {
			border: "border-amber-100",
			headerBg: "bg-amber-50",
			label: "text-amber-800",
			countBg: "bg-amber-100",
		},
	};

	const styles = toneStyles[tone] || toneStyles.neutral;

	return (
		<div
			className={`rounded-xl border ${styles.border} bg-white/60 flex flex-col min-h-[260px]`}
		>
			<div
				className={`px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs ${styles.headerBg}`}
			>
				<div>
					<div className={`font-semibold ${styles.label}`}>{title}</div>
					<div className="text-[11px] text-slate-500">{subtitle}</div>
				</div>
				<div
					className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-[11px] ${styles.countBg} text-slate-700`}
				>
					{tasks?.length || 0}
				</div>
			</div>

			<div className="flex-1 px-3 py-3">
				{loading ? (
					<div className="text-[11px] text-slate-400 italic px-2 py-2">
						Loading...
					</div>
				) : !hasTasks ? (
					<div className="border border-dashed border-slate-200 rounded-lg px-3 py-4 text-[11px] text-slate-400 text-center">
						No tasks in this bucket.
					</div>
				) : (
					<div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
						{tasks.map((task) => (
							<TaskCard
								key={task.id}
								task={task}
								clientsById={clientsById}
								updating={updatingId === task.id}
								onStatusChange={onStatusChange}
								onOpenTask={onOpenTask}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ----------------------
// Task card component
// ----------------------
function TaskCard({ task, clientsById, updating, onStatusChange, onOpenTask }) {
	const dueLabel = task.due_date
		? new Date(task.due_date).toLocaleDateString()
		: "No due date";

	const statusOption = STATUS_OPTIONS.find((s) => s.value === task.status);

	const clientName =
		task.client_id && clientsById
			? clientsById[task.client_id] || `Client #${task.client_id}`
			: null;

	const handleClickDetails = () => {
		onOpenTask?.(task);
	};

	return (
		<div className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors px-3 py-2.5 space-y-1.5 text-xs shadow-sm">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1">
					<div className="font-semibold text-yecny-charcoal text-[13px]">
						{task.title}
					</div>

					{clientName && (
						<div className="text-[11px] text-slate-500 mt-0.5">
							Client:{" "}
							<Link
								to={`/clients/${task.client_id}`}
								className="text-yecny-primary hover:underline"
							>
								{clientName}
							</Link>
						</div>
					)}

					{task.description && (
						<div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
							{task.description}
						</div>
					)}
				</div>

				<span className="text-[11px] text-slate-400 whitespace-nowrap">
					{dueLabel}
				</span>
			</div>

			<div className="flex items-center justify-between gap-3 pt-1">
				<button
					type="button"
					onClick={handleClickDetails}
					className="text-[11px] text-yecny-primary hover:underline"
				>
					Details
				</button>

				<div className="flex items-center gap-1">
					<div className="inline-flex items-center text-[11px] text-slate-500 mr-1">
						<span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
						{statusOption?.label || "Unknown status"}
					</div>
					<select
						className="border border-slate-300 rounded-md px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary disabled:opacity-60"
						value={task.status}
						disabled={updating}
						onChange={(e) => onStatusChange(task, e.target.value)}
					>
						{STATUS_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>
			</div>
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
						x
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
