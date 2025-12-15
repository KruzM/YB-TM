// src/components/clients/ClientNotesPanel.jsx
import { useEffect, useState } from "react";
import api from "../../api/client";

export default function ClientNotesPanel({ clientId }) {
	const [notes, setNotes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [newNote, setNewNote] = useState("");
	const [saving, setSaving] = useState(false);

	const formatDateTime = (value) => {
		if (!value) return "";
		// If the string has no timezone info, assume it's UTC
		const hasZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(value);
		const date = new Date(hasZone ? value : value + "Z");
		return date.toLocaleString();
	};
	const loadNotes = async () => {
		if (!clientId) return;
		setLoading(true);
		setError("");
		try {
			const res = await api.get(`/clients/${clientId}/notes`);
			setNotes(res.data || []);
		} catch (err) {
			console.error(err);
			setError("Failed to load notes.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadNotes();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const handleAddNote = async (e) => {
		e.preventDefault();
		if (!newNote.trim()) return;

		setSaving(true);
		setError("");
		try {
			await api.post(`/clients/${clientId}/notes`, {
				body: newNote.trim(),
				pinned: false,
			});
			setNewNote("");
			await loadNotes();
		} catch (err) {
			console.error(err);
			setError("Failed to save note.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (noteId) => {
		if (!window.confirm("Delete this note?")) return;
		try {
			await api.delete(`/clients/${clientId}/notes/${noteId}`);
			setNotes((prev) => prev.filter((n) => n.id !== noteId));
		} catch (err) {
			console.error(err);
			alert("Failed to delete note.");
		}
	};
	const togglePinned = async (note) => {
		try {
			const res = await api.put(`/clients/${clientId}/notes/${note.id}`, {
				pinned: !note.pinned,
			});
			const updated = res.data;
			setNotes((prev) =>
				prev
					.map((n) => (n.id === updated.id ? updated : n))
					.sort((a, b) => {
						// re-sort pinned + date
						if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
						return new Date(b.created_at) - new Date(a.created_at);
					})
			);
		} catch (err) {
			console.error(err);
			alert("Failed to update note.");
		}
	};

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-yecny-charcoal">Notes</h2>
					<p className="text-xs text-yecny-slate mt-0.5">
						Internal notes about this client. Not visible to clients.
					</p>
				</div>
			</div>

			{/* Add note */}
			<form
				onSubmit={handleAddNote}
				className="border border-slate-200 rounded-md p-3 bg-slate-50/60 space-y-2"
			>
				<textarea
					rows={3}
					value={newNote}
					onChange={(e) => setNewNote(e.target.value)}
					placeholder="Log a quick note about a call, email, or decision..."
					className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary bg-white"
				/>
				<div className="flex justify-between items-center">
					{error && <div className="text-[11px] text-red-600">{error}</div>}
					<button
						type="submit"
						disabled={saving || !newNote.trim()}
						className="ml-auto px-3 py-1.5 rounded-md bg-yecny-primary text-white text-xs font-medium hover:bg-yecny-primary-dark disabled:opacity-60"
					>
						{saving ? "Saving..." : "Add note"}
					</button>
				</div>
			</form>

			{/* Notes list */}
			<div className="border border-slate-200 rounded-md bg-white max-h-80 overflow-y-auto">
				{loading ? (
					<div className="px-3 py-3 text-xs text-yecny-slate">
						Loading notes...
					</div>
				) : notes.length === 0 ? (
					<div className="px-3 py-3 text-xs text-yecny-slate">
						No notes yet. Use the box above to add your first note.
					</div>
				) : (
					<ul className="divide-y divide-slate-100">
						{notes.map((note) => (
							<li key={note.id} className="px-3 py-2 text-xs">
								<div className="flex justify-between items-start gap-2">
									<div className="flex-1 whitespace-pre-wrap text-yecny-charcoal">
										{note.body}
									</div>
									<div className="flex flex-col items-end gap-1">
										<button
											type="button"
											onClick={() => togglePinned(note)}
											className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100"
										>
											{note.pinned ? "Pinned" : "Pin"}
										</button>
										<button
											type="button"
											onClick={() => handleDelete(note.id)}
											className="text-[10px] text-red-600 hover:underline"
										>
											Delete
										</button>
									</div>
								</div>
								<div className="mt-1 text-[10px] text-slate-400">
									{formatDateTime(note.created_at)}{" "}
									{note.created_by_name && (
										<>
											<span className="mx-1 text-slate-300">-</span>
											<span>{note.created_by_name}</span>
										</>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
