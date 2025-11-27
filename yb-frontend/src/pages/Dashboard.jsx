// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

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
	const [loading, setLoading] = useState(true);
	const [updatingId, setUpdatingId] = useState(null);
	const [error, setError] = useState("");

	const loadDashboard = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/tasks/my-dashboard");
			setData(res.data || {});
		} catch (err) {
			console.error(err);
			setError("Failed to load your task dashboard.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDashboard();
	}, []);

	const handleStatusChange = async (task, newStatus) => {
		if (newStatus === task.status) return;
		setUpdatingId(task.id);
		try {
			await api.put(`/tasks/${task.id}`, { status: newStatus });
			await loadDashboard();
		} catch (err) {
			console.error(err);
			alert("Failed to update task status.");
		} finally {
			setUpdatingId(null);
		}
	};

	const today = new Date();
	const todayLabel = today.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
	return (
		<div className="space-y-6">
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
						{todayLabel} - All tasks assigned to you, grouped by urgency.
					</p>
				</div>

				<div className="flex items-center gap-2 text-xs">
					<button
						type="button"
						onClick={loadDashboard}
						className="px-3 py-1.5 rounded-md border border-yecny-primary-soft bg-white text-yecny-primary text-xs font-medium hover:bg-yecny-primary-soft/30"
					>
						Refresh
					</button>
				</div>
			</div>

			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{error}
				</div>
			)}

			{/* Columns */}
			{loading ? (
				<div className="text-sm text-yecny-slate">Loading your tasks...</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
					<TaskColumn
						title="Overdue"
						subtitle="Due before today"
						tone="danger"
						tasks={data.overdue || []}
						updatingId={updatingId}
						onStatusChange={handleStatusChange}
					/>
					<TaskColumn
						title="Today"
						subtitle="Due today"
						tone="primary"
						tasks={data.today || []}
						updatingId={updatingId}
						onStatusChange={handleStatusChange}
					/>
					<TaskColumn
						title="Upcoming"
						subtitle="Next 7 days"
						tone="neutral"
						tasks={data.upcoming || []}
						updatingId={updatingId}
						onStatusChange={handleStatusChange}
					/>
					<TaskColumn
						title="Waiting on Client"
						subtitle="Follow-ups required"
						tone="amber"
						tasks={data.waiting_on_client || []}
						updatingId={updatingId}
						onStatusChange={handleStatusChange}
					/>
				</div>
			)}
		</div>
	);
}
function TaskColumn({
	title,
	subtitle,
	tone,
	tasks,
	updatingId,
	onStatusChange,
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
	}[tone || "neutral"];

	return (
		<div
			className={`flex flex-col rounded-xl border bg-white overflow-hidden ${toneStyles.border}`}
		>
			<div
				className={`px-3 py-2 flex items-center justify-between ${toneStyles.headerBg}`}
			>
				<div>
					<div className={`text-xs font-semibold ${toneStyles.label}`}>
						{title}
					</div>
					<div className="text-[11px] text-yecny-slate">{subtitle}</div>
				</div>
				<div
					className={`px-2 py-0.5 rounded-full text-[11px] font-medium text-yecny-charcoal ${toneStyles.countBg}`}
				>
					{tasks.length}
				</div>
			</div>

			<div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[420px]">
				{!hasTasks && (
					<div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">
						No tasks in this bucket.
					</div>
				)}
				{tasks.map((task) => (
					<TaskCard
						key={task.id}
						task={task}
						updating={updatingId === task.id}
						onStatusChange={onStatusChange}
					/>
				))}
			</div>
		</div>
	);
}

function TaskCard({ task, updating, onStatusChange }) {
	const dueLabel = task.due_date
		? new Date(task.due_date).toLocaleDateString()
		: "No due date";

	const statusOption = STATUS_OPTIONS.find((s) => s.value === task.status);

	return (
		<div className="rounded-lg border border-slate-200 bg-white hover:border-yecny-primary-soft hover:shadow-[0_0_0_1px_rgba(0,0,0,0.02)] transition-colors px-3 py-2.5 space-y-1.5 text-xs">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1">
					<div className="font-semibold text-yecny-charcoal text-[13px]">
						{task.title}
					</div>
					{task.client_id && (
						<div className="text-[11px] text-slate-500 mt-0.5">
							Client ID: {task.client_id}
						</div>
					)}
				</div>
				<span className="text-[11px] text-slate-400 whitespace-nowrap">
					{dueLabel}
				</span>
			</div>

			{task.description && (
				<div className="text-[11px] text-slate-600 line-clamp-2">
					{task.description}
				</div>
			)}
			<div className="flex items-center justify-between gap-2 pt-1">
				<div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
					<span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
					<span>{statusOption?.label || task.status}</span>
				</div>

				<select
					className="border border-slate-200 rounded-md bg-white text-[11px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary disabled:opacity-60"
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
	);
}
