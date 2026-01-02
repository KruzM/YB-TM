import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "yecny_quick_add_fab_v1";

const DEFAULT_SIZE = { w: 520, h: 420 };
const MINIMIZED_SIZE = { w: 360, h: 76 };
const DOCK_OFFSET = { right: 24, bottom: 24 };
const MARGIN = 12;

function clamp(n, min, max) {
	return Math.max(min, Math.min(n, max));
}

function safeParseJSON(str) {
	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
}

export default function QuickAddFab() {
	const { user } = useAuth();
	const role = (user?.role || "").toLowerCase();
	const isAdminOrOwner = role === "admin" || role === "owner";

	const location = useLocation();
	const currentClientId = useMemo(() => {
		const m = location.pathname.match(/^\/clients\/(\d+)/);
		return m ? Number(m[1]) : null;
	}, [location.pathname]);

	const panelRef = useRef(null);
	const boxRef = useRef(null);

	const [open, setOpen] = useState(false);
	const [minimized, setMinimized] = useState(false);
	const minimizedRef = useRef(false);

	const [mode, setMode] = useState("note"); // note | task

	// Drag state (pos == null => default bottom-right positioning)
	const [pos, setPos] = useState(null); // { x, y } | null
	const dragRef = useRef({
		dragging: false,
		offsetX: 0,
		offsetY: 0,
	});

	// IMPORTANT: size is ALWAYS the "expanded" size the user set
	const [size, setSize] = useState(DEFAULT_SIZE); // { w, h }

	// note
	const [noteBody, setNoteBody] = useState("");
	const [noteClientId, setNoteClientId] = useState("");

	// task
	const [title, setTitle] = useState("");
	const [desc, setDesc] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [taskClientId, setTaskClientId] = useState("");
	const [leaveUnassigned, setLeaveUnassigned] = useState(false);

	// intercompany
	const [isIntercompany, setIsIntercompany] = useState(false);
	const [linkedClientIds, setLinkedClientIds] = useState("");

	const [err, setErr] = useState("");
	const [saving, setSaving] = useState(false);

	// Keep ref synced so ResizeObserver callback never has stale minimized
	useEffect(() => {
		minimizedRef.current = minimized;
	}, [minimized]);

	// Load saved pos/size once
	useEffect(() => {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;

		const data = safeParseJSON(raw);
		if (!data || typeof data !== "object") return;

		const nextPos =
			data.pos &&
			typeof data.pos.x === "number" &&
			typeof data.pos.y === "number"
				? { x: data.pos.x, y: data.pos.y }
				: null;

		const nextSize =
			data.size &&
			typeof data.size.w === "number" &&
			typeof data.size.h === "number"
				? {
						w: clamp(data.size.w, 360, 1200),
						h: clamp(data.size.h, 220, 900),
				  }
				: null;

		if (nextPos) setPos(nextPos);
		if (nextSize) setSize(nextSize);
	}, []);
	// Persist expanded pos/size (debounced)
	const saveTimer = useRef(null);
	useEffect(() => {
		// Only store the user's expanded preferences (even if currently minimized)
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					pos,
					size,
				})
			);
		}, 150);

		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		};
	}, [pos, size]);

	// Auto-fill client ID when:
	// - panel is CLOSED, or
	// - field is blank (so we don't overwrite what the user is typing)
	useEffect(() => {
		if (!open) {
			setNoteClientId(currentClientId || "");
			setTaskClientId(currentClientId || "");
			return;
		}
		setNoteClientId((prev) => (prev ? prev : currentClientId || ""));
		setTaskClientId((prev) => (prev ? prev : currentClientId || ""));
	}, [currentClientId, open]);

	// ResizeObserver to keep React state in sync with CSS resize handle
	useEffect(() => {
		if (!open) return;

		const el = boxRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;

		const ro = new ResizeObserver((entries) => {
			if (minimizedRef.current) return; // don't let minimized affect expanded size
			const entry = entries[0];
			if (!entry) return;

			// Use borderBoxSize if available, else fallback to contentRect
			let nextW;
			let nextH;

			const bbs = entry.borderBoxSize;
			if (bbs && bbs.length) {
				nextW = bbs[0].inlineSize;
				nextH = bbs[0].blockSize;
			} else {
				nextW = entry.contentRect.width;
				nextH = entry.contentRect.height;
			}

			// Clamp to sensible bounds
			nextW = clamp(Math.round(nextW), 360, 1200);
			nextH = clamp(Math.round(nextH), 220, 900);

			setSize((prev) => {
				if (prev.w === nextW && prev.h === nextH) return prev;
				return { w: nextW, h: nextH };
			});
		});

		ro.observe(el);
		return () => ro.disconnect();
	}, [open]);

	// Global pointer listeners for dragging
	useEffect(() => {
		const onMove = (e) => {
			if (!dragRef.current.dragging) return;
			if (minimizedRef.current) return;

			const el = boxRef.current;
			if (!el) return;

			const rect = el.getBoundingClientRect();
			const width = rect.width;
			const height = rect.height;

			let nextX = e.clientX - dragRef.current.offsetX;
			let nextY = e.clientY - dragRef.current.offsetY;

			nextX = clamp(nextX, MARGIN, window.innerWidth - width - MARGIN);
			nextY = clamp(nextY, MARGIN, window.innerHeight - height - MARGIN);

			setPos({ x: nextX, y: nextY });
		};

		const onUp = () => {
			dragRef.current.dragging = false;
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, []);
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
		setMinimized(false);
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

	const openPanel = () => {
		setOpen(true);
		setMinimized(false);
	};

	const handleHeaderPointerDown = (e) => {
		if (minimizedRef.current) return;

		// Don't start dragging when clicking interactive controls
		const tag = (e.target?.tagName || "").toLowerCase();
		if (
			tag === "button" ||
			tag === "select" ||
			tag === "input" ||
			tag === "textarea"
		)
			return;

		const el = boxRef.current;
		if (!el) return;

		const rect = el.getBoundingClientRect();
		dragRef.current.dragging = true;
		dragRef.current.offsetX = e.clientX - rect.left;
		dragRef.current.offsetY = e.clientY - rect.top;

		// Convert from default bottom-right to absolute pos on first drag
		if (!pos) setPos({ x: rect.left, y: rect.top });
	};

	const appliedSize = minimized ? MINIMIZED_SIZE : size;

	const wrapperStyle = minimized
		? { right: DOCK_OFFSET.right, bottom: DOCK_OFFSET.bottom }
		: pos
		? { left: pos.x, top: pos.y }
		: { right: DOCK_OFFSET.right, bottom: DOCK_OFFSET.bottom };

	return (
		<>
			{/* Floating + button */}
			{!open && (
				<button
					type="button"
					onClick={openPanel}
					className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-yecny-primary text-white shadow-lg hover:opacity-95 flex items-center justify-center"
					title="Quick add"
				>
					<span className="text-3xl leading-none translate-y-[-1px]">+</span>
				</button>
			)}

			{/* Docked compose (draggable + resizable, NO backdrop) */}
			{open && (
				<div ref={panelRef} className="fixed z-50" style={wrapperStyle}>
					<div
						ref={boxRef}
						className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
						style={{
							width: appliedSize.w,
							height: appliedSize.h,
							minWidth: MINIMIZED_SIZE.w,
							minHeight: MINIMIZED_SIZE.h,
							resize: minimized ? "none" : "both",
							overflow: "hidden",
						}}
					>
						{/* Header bar */}
						<div
							className="px-4 py-3 border-b border-slate-200 flex items-center justify-between select-none"
							onPointerDown={handleHeaderPointerDown}
							onDoubleClick={() => setMinimized((v) => !v)}
							style={{ cursor: minimized ? "default" : "grab" }}
						>
							<div className="min-w-0">
								<div className="text-xs text-yecny-slate">Quick Add</div>
								<div className="text-sm font-semibold text-yecny-charcoal truncate">
									{mode === "note" ? "Quick Note" : "Quick Task"}
								</div>
							</div>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setMinimized((v) => !v)}
									className="text-xs text-yecny-slate hover:text-yecny-charcoal px-2 py-1 rounded-md hover:bg-slate-50"
									title={minimized ? "Expand" : "Minimize"}
								>
									{minimized ? "Expand" : "Minimize"}
								</button>

								<button
									type="button"
									onClick={close}
									className="text-xs text-yecny-slate hover:text-yecny-charcoal px-2 py-1 rounded-md hover:bg-slate-50"
									title="Close"
								>
									Close
								</button>
							</div>
						</div>

						{/* Body */}
						{minimized ? (
							<div
								className="px-4 py-2 text-xs text-slate-500 cursor-pointer"
								onClick={() => setMinimized(false)}
							>
								Minimized � click to expand.
							</div>
						) : (
							<div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
								{/* Mode toggle */}
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
														onChange={(e) =>
															setIsIntercompany(e.target.checked)
														}
													/>
													Intercompany task (multi-client)
												</label>

												{isIntercompany && (
													<label className="text-sm text-yecny-slate block">
														Linked client IDs (comma-separated)
														<input
															value={linkedClientIds}
															onChange={(e) =>
																setLinkedClientIds(e.target.value)
															}
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
						)}
					</div>
				</div>
			)}
		</>
	);
}
