// src/components/clients/ClientOnboardingTab.jsx
import { useEffect, useState } from "react";
import api from "../../api/client"; // same axios instance you use elsewhere

export default function ClientOnboardingTab({ client }) {
	const clientId = client.id;

	const [tasks, setTasks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const loadTasks = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.get(`/client-onboarding/clients/${clientId}/tasks`);
			setTasks(res.data || []);
		} catch (err) {
			console.error(err);
			setError("Failed to load onboarding tasks.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadTasks();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const toggleTaskStatus = async (task) => {
		const newStatus = task.status === "completed" ? "new" : "completed";

		// optimistic UI update
		const prev = tasks;
		setTasks((current) =>
			current.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
		);

		try {
			await api.patch(`/tasks/${task.id}`, { status: newStatus });
		} catch (err) {
			console.error("Failed to update task status", err);
			alert("Failed to update task status.");
			// roll back if it fails
			setTasks(prev);
		}
	};

	if (loading) {
		return <div className="client-tab">Loading onboarding tasks...</div>;
	}

	if (error) {
		return <div className="client-tab text-red-600">{error}</div>;
	}
	if (!tasks.length) {
		return (
			<div className="client-tab">
				<p>
					No onboarding tasks found for this client. Check your onboarding
					templates or task auto-creation.
				</p>
			</div>
		);
	}

	return (
		<div className="client-tab">
			<div className="tab-header mb-3 flex justify-between items-center">
				<div className="text-sm text-slate-500">
					Onboarding tasks created automatically from your templates. Completing
					these gets the client fully set up.
				</div>
				<div className="text-xs text-slate-400">
					{tasks.filter((t) => t.status === "completed").length} of{" "}
					{tasks.length} completed
				</div>
			</div>

			<div className="rounded-lg border border-slate-200 overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-slate-50 text-slate-500">
						<tr>
							<th className="w-10 p-2"></th>
							<th className="text-left p-2">Task</th>
							<th className="text-left p-2">Due</th>
							<th className="text-left p-2">Assigned</th>
							<th className="text-left p-2">Status</th>
						</tr>
					</thead>
					<tbody>
						{tasks.map((task) => (
							<tr
								key={task.id}
								className="border-t border-slate-100 hover:bg-slate-50"
							>
								<td className="p-2 text-center">
									<input
										type="checkbox"
										checked={task.status === "completed"}
										onChange={() => toggleTaskStatus(task)}
									/>
								</td>
								<td className="p-2 align-top">
									<div className="font-medium text-slate-800">{task.title}</div>
									{task.description && (
										<div className="text-xs text-slate-500">
											{task.description}
										</div>
									)}
								</td>
								<td className="p-2 text-slate-700 align-top">
									{task.due_date
										? new Date(task.due_date).toLocaleDateString()
										: "-"}
								</td>
								<td className="p-2 text-slate-500 align-top">
									{task.assigned_user_id ? "Assigned" : "Unassigned"}
								</td>
								<td className="p-2 align-top">
									<span className="inline-flex items-center px-2 py-1 rounded-full text-xs border border-slate-200 bg-slate-50 text-slate-700">
										{task.status || "new"}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
