import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function QuickAddFab() {
	const { user } = useAuth();
	const role = (user?.role || "").toLowerCase();
	const isAdminOrOwner = role === "admin" || role === "owner";

	const location = useLocation();
	const currentClientId = useMemo(() => {
		const m = location.pathname.match(/^\/clients\/(\d+)/);
		return m ? Number(m[1]) : null;
	}, [location.pathname]);

	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState("note"); // note | task

	// note
	const [noteBody, setNoteBody] = useState("");
	const [noteClientId, setNoteClientId] = useState(currentClientId || "");

	// task
	const [title, setTitle] = useState("");
	const [desc, setDesc] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [taskClientId, setTaskClientId] = useState(currentClientId || "");
	const [leaveUnassigned, setLeaveUnassigned] = useState(false);

	// intercompany (simple input for now)
	const [isIntercompany, setIsIntercompany] = useState(false);
	const [linkedClientIds, setLinkedClientIds] = useState("");

	const [err, setErr] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		// keep client defaults in sync as you browse
		setNoteClientId(currentClientId || "");
		setTaskClientId(currentClientId || "");
	}, [currentClientId]);

	const reset = () => {
		setErr("");
		setSaving(false);
		setNoteBody("");
		setTitle("");
		setDesc("");
		setDueDate("");
		setLeaveUnassigned(false);
		setIsIntercompany(false);
		setLinkedClientIds("");
	};
	const close = () => {
		setOpen(false);
		reset();
	};

	const parseLinkedIds = () => {
		const raw = String(linkedClientIds || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
	};

	const saveNote = async () => {
		setSaving(true);
		setErr("");
		try {
			await api.post("/quick-notes", {
				client_id: noteClientId ? Number(noteClientId) : null,
				body: noteBody,
			});
			close();
		} catch (e) {
			console.error(e);
			setErr("Failed to save note.");
		} finally {
			setSaving(false);
		}
	};

	const saveTask = async () => {
		setSaving(true);
		setErr("");
		try {
			const payload = {
				title,
				description: desc || null,
				due_date: dueDate ? new Date(dueDate).toISOString() : null,
				client_id: taskClientId ? Number(taskClientId) : null,
				task_type: "ad_hoc",
				leave_unassigned: isAdminOrOwner ? !!leaveUnassigned : false,
				is_intercompany: isAdminOrOwner ? !!isIntercompany : false,
				linked_client_ids:
					isAdminOrOwner && isIntercompany ? parseLinkedIds() : null,
			};
			await api.post("/tasks", payload);
			close();
		} catch (e) {
			console.error(e);
			setErr("Failed to create task.");
		} finally {
			setSaving(false);
		}
	};
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-yecny-primary text-white shadow-lg hover:opacity-95 flex items-center justify-center text-2xl"
				title="Quick add"
			>
				+
			</button>

			{open && (
				<div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
					<div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xl">
						<div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
							<div>
								<div className="text-sm text-yecny-slate">Quick Add</div>
								<div className="text-lg font-semibold text-yecny-charcoal">
									{mode === "note" ? "Quick Note" : "Quick Task"}
								</div>
							</div>
							<button
								type="button"
								onClick={close}
								className="text-sm text-yecny-slate hover:text-yecny-charcoal"
							>
								Close
							</button>
						</div>

						<div className="px-5 pt-4">
							<div className="flex gap-2 text-sm">
								<button
									type="button"
									onClick={() => setMode("note")}
									className={[
										"px-3 py-2 rounded-lg border",
										mode === "note"
											? "bg-yecny-primary text-white border-yecny-primary"
											: "bg-white border-slate-200 text-yecny-slate hover:bg-slate-50",
									].join(" ")}
								>
									Note
								</button>
								<button
									type="button"
									onClick={() => setMode("task")}
									className={[
										"px-3 py-2 rounded-lg border",
										mode === "task"
											? "bg-yecny-primary text-white border-yecny-primary"
											: "bg-white border-slate-200 text-yecny-slate hover:bg-slate-50",
									].join(" ")}
								>
									Task
								</button>
							</div>
						</div>
						<div className="px-5 py-4 space-y-3">
							{err && (
								<div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
									{err}
								</div>
							)}

							{mode === "note" ? (
								<>
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
										<label className="text-sm text-yecny-slate sm:col-span-1">
											Client ID (optional)
											<input
												value={noteClientId}
												onChange={(e) => setNoteClientId(e.target.value)}
												className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
												placeholder="e.g. 12"
											/>
										</label>
										<label className="text-sm text-yecny-slate sm:col-span-2">
											Note
											<textarea
												value={noteBody}
												onChange={(e) => setNoteBody(e.target.value)}
												className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[120px]"
												placeholder="Type your note..."
											/>
										</label>
									</div>

									<div className="flex justify-end">
										<button
											type="button"
											disabled={saving || !noteBody.trim()}
											onClick={saveNote}
											className="px-4 py-2 rounded-lg bg-yecny-primary text-white disabled:opacity-50"
										>
											Save Note
										</button>
									</div>
								</>
							) : (
								<>
									<label className="text-sm text-yecny-slate">
										Title
										<input
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
											placeholder="Task title"
										/>
									</label>

									<label className="text-sm text-yecny-slate">
										Description (optional)
										<textarea
											value={desc}
											onChange={(e) => setDesc(e.target.value)}
											className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[90px]"
										/>
									</label>

									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
										<label className="text-sm text-yecny-slate">
											Client ID (optional)
											<input
												value={taskClientId}
												onChange={(e) => setTaskClientId(e.target.value)}
												className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
											/>
										</label>
										<label className="text-sm text-yecny-slate">
											Due date (optional)
											<input
												type="date"
												value={dueDate}
												onChange={(e) => setDueDate(e.target.value)}
												className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
											/>
										</label>
										<div className="flex items-end">
											{isAdminOrOwner && (
												<label className="flex items-center gap-2 text-sm text-yecny-slate">
													<input
														type="checkbox"
														checked={leaveUnassigned}
														onChange={(e) =>
															setLeaveUnassigned(e.target.checked)
														}
													/>
													Leave unassigned
												</label>
											)}
										</div>
									</div>
									{isAdminOrOwner && (
										<div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
											<label className="flex items-center gap-2 text-sm text-yecny-slate">
												<input
													type="checkbox"
													checked={isIntercompany}
													onChange={(e) => setIsIntercompany(e.target.checked)}
												/>
												Intercompany task (multi-client)
											</label>
											{isIntercompany && (
												<label className="text-sm text-yecny-slate block">
													Linked client IDs (comma-separated)
													<input
														value={linkedClientIds}
														onChange={(e) => setLinkedClientIds(e.target.value)}
														className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
														placeholder="e.g. 12, 18, 25"
													/>
												</label>
											)}
										</div>
									)}

									<div className="flex justify-end">
										<button
											type="button"
											disabled={saving || !title.trim()}
											onClick={saveTask}
											className="px-4 py-2 rounded-lg bg-yecny-primary text-white disabled:opacity-50"
										>
											Create Task
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
