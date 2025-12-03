// src/pages/Contacts.jsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const TYPE_OPTIONS = [
	{ value: "", label: "All types" },
	{ value: "individual", label: "Individuals" },
	{ value: "entity", label: "Entities" },
];

export default function Contacts() {
	const { user } = useAuth();

	const [contacts, setContacts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("");

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);

	const [formName, setFormName] = useState("");
	const [formEmail, setFormEmail] = useState("");
	const [formPhone, setFormPhone] = useState("");
	const [formType, setFormType] = useState("individual");
	const [formIsClient, setFormIsClient] = useState(false);
	const [formNotes, setFormNotes] = useState("");

	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState(null);
	const [filtering, setFiltering] = useState(false);

	const loadContacts = async (params = {}) => {
		setError("");
		try {
			const query = {};
			if (params.q) query.q = params.q;
			if (params.type) query.type = params.type;

			const res = await api.get("/contacts", { params: query });
			setContacts(res.data || []);
		} catch (err) {
			console.error("Failed to load contacts:", err);
			setError("Failed to load contacts.");
		}
	};

	const initialLoad = async () => {
		setLoading(true);
		await loadContacts({});
		setLoading(false);
	};

	useEffect(() => {
		initialLoad();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleApplyFilters = async () => {
		setFiltering(true);
		await loadContacts({
			q: search || undefined,
			type: typeFilter || undefined,
		});
		setFiltering(false);
	};

	const handleClearFilters = async () => {
		setSearch("");
		setTypeFilter("");
		setFiltering(true);
		await loadContacts({});
		setFiltering(false);
	};
	const openNewModal = () => {
		setEditing(null);
		setFormName("");
		setFormEmail("");
		setFormPhone("");
		setFormType("individual");
		setFormIsClient(false);
		setFormNotes("");
		setModalOpen(true);
	};

	const openEditModal = (contact) => {
		setEditing(contact);
		setFormName(contact.name || "");
		setFormEmail(contact.email || "");
		setFormPhone(contact.phone || "");
		setFormType(contact.type || "individual");
		setFormIsClient(Boolean(contact.is_client));
		setFormNotes(contact.notes || "");
		setModalOpen(true);
	};

	const closeModal = () => {
		if (saving) return;
		setModalOpen(false);
		setEditing(null);
	};

	const handleSaveContact = async (e) => {
		e.preventDefault();
		const name = formName.trim();
		if (!name) return;

		setSaving(true);
		try {
			const payload = {
				name,
				email: formEmail || null,
				phone: formPhone || null,
				type: formType || "individual",
				is_client: formIsClient,
				notes: formNotes || null,
			};

			if (editing) {
				await api.put(`/contacts/${editing.id}`, payload);
			} else {
				await api.post("/contacts", payload);
			}

			setModalOpen(false);
			setEditing(null);
			await loadContacts({
				q: search || undefined,
				type: typeFilter || undefined,
			});
		} catch (err) {
			console.error("Failed to save contact:", err);
			alert("Failed to save contact.");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteContact = async (contactId) => {
		if (!window.confirm("Are you sure you want to delete this contact?"))
			return;
		setDeletingId(contactId);
		try {
			await api.delete(`/contacts/${contactId}`);
			setContacts((prev) => prev.filter((c) => c.id !== contactId));
		} catch (err) {
			console.error("Failed to delete contact:", err);
			alert("Failed to delete contact.");
		} finally {
			setDeletingId(null);
		}
	};
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold text-yecny-charcoal">
						Contacts
					</h1>
					<p className="text-xs text-yecny-slate mt-1">
						Central address book for clients, owners, CPAs, and other key
						people.
					</p>
				</div>
				<button
					type="button"
					onClick={openNewModal}
					className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark"
				>
					+ New Contact
				</button>
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}

			{/* Filters */}
			<section className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 space-y-2">
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-1">
					Search
				</div>
				<div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto,auto] gap-2 items-center">
					<input
						type="text"
						placeholder="Search by name, email, or phone..."
						className="border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>

					<select
						className="border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						value={typeFilter}
						onChange={(e) => setTypeFilter(e.target.value)}
					>
						{TYPE_OPTIONS.map((opt) => (
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
						{contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
					</div>
					<div>Use contacts for client owners, primary contacts, and CPAs.</div>
				</div>

				{loading ? (
					<div className="px-4 py-4 text-xs text-slate-400">Loading...</div>
				) : contacts.length === 0 ? (
					<div className="px-4 py-6 text-xs text-slate-400 text-center">
						No contacts found. Add a new contact above.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-xs">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Name
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Type
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Email
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Phone
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Flags
									</th>
									<th className="text-right px-4 py-2 font-semibold text-slate-600">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{contacts.map((c) => (
									<tr
										key={c.id}
										className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
									>
										<td className="px-4 py-3 align-top">
											<button
												type="button"
												onClick={() => openEditModal(c)}
												className="text-[13px] font-semibold text-yecny-primary hover:underline text-left"
											>
												{c.name}
											</button>
											{c.notes && (
												<div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
													{c.notes}
												</div>
											)}
										</td>
										<td className="px-4 py-3 align-top text-[11px] text-slate-600 capitalize">
											{c.type || "individual"}
										</td>
										<td className="px-4 py-3 align-top text-[11px] text-slate-600">
											{c.email || <span className="text-slate-400">-</span>}
										</td>
										<td className="px-4 py-3 align-top text-[11px] text-slate-600">
											{c.phone || <span className="text-slate-400">-</span>}
										</td>
										<td className="px-4 py-3 align-top text-[11px] text-slate-600">
											{c.is_client ? (
												<span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 text-[10px] px-2 py-0.5 text-emerald-700 uppercase tracking-[0.12em]">
													Client
												</span>
											) : (
												<span className="text-[11px] text-slate-400">-</span>
											)}
										</td>
										<td className="px-4 py-3 align-top text-right">
											<button
												type="button"
												onClick={() => openEditModal(c)}
												className="text-[11px] text-yecny-primary hover:underline mr-3"
											>
												Edit
											</button>
											{user?.role === "admin" && (
												<button
													type="button"
													onClick={() => handleDeleteContact(c.id)}
													disabled={deletingId === c.id}
													className="text-[11px] text-red-500 hover:underline disabled:opacity-60"
												>
													{deletingId === c.id ? "Deleting..." : "Delete"}
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Modal */}
			{modalOpen && (
				<div className="fixed inset-0 z-40 flex">
					<div
						className="flex-1 bg-black/20"
						onClick={closeModal}
						aria-hidden="true"
					/>
					<div className="w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
						<div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
							<div>
								<div className="text-[11px] uppercase tracking-[0.16em] text-yecny-slate mb-1">
									{editing ? "Edit contact" : "New contact"}
								</div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									{editing ? editing.name : "Add a new person or entity"}
								</h2>
							</div>
							<button
								type="button"
								onClick={closeModal}
								className="text-xs text-slate-400 hover:text-slate-600"
							>
								X
							</button>
						</div>
						<form
							onSubmit={handleSaveContact}
							className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs"
						>
							<div className="space-y-1">
								<label className="block text-[11px] font-medium text-slate-700">
									Name
								</label>
								<input
									type="text"
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									value={formName}
									onChange={(e) => setFormName(e.target.value)}
									required
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div className="space-y-1">
									<label className="block text-[11px] font-medium text-slate-700">
										Email
									</label>
									<input
										type="email"
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										value={formEmail}
										onChange={(e) => setFormEmail(e.target.value)}
									/>
								</div>
								<div className="space-y-1">
									<label className="block text-[11px] font-medium text-slate-700">
										Phone
									</label>
									<input
										type="text"
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										value={formPhone}
										onChange={(e) => setFormPhone(e.target.value)}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
								<div className="space-y-1">
									<label className="block text-[11px] font-medium text-slate-700">
										Type
									</label>
									<select
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										value={formType}
										onChange={(e) => setFormType(e.target.value)}
									>
										<option value="individual">Individual</option>
										<option value="entity">Entity (business)</option>
									</select>
								</div>
								<label className="inline-flex items-center gap-2 mt-4 md:mt-6 text-[11px] text-slate-700">
									<input
										type="checkbox"
										checked={formIsClient}
										onChange={(e) => setFormIsClient(e.target.checked)}
										className="h-3 w-3 border-slate-300 rounded"
									/>
									<span>Represents a client in Yecny OS</span>
								</label>
							</div>
							<div className="space-y-1">
								<label className="block text-[11px] font-medium text-slate-700">
									Notes
								</label>
								<textarea
									rows={3}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary resize-none"
									value={formNotes}
									onChange={(e) => setFormNotes(e.target.value)}
								/>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={closeModal}
									disabled={saving}
									className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={saving}
									className="px-4 py-1.5 rounded-md bg-yecny-primary text-white text-[11px] hover:bg-yecny-primary-dark disabled:opacity-60"
								>
									{saving
										? editing
											? "Saving..."
											: "Creating..."
										: editing
										? "Save changes"
										: "Create contact"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
