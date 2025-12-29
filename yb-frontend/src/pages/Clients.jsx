// src/pages/Clients.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

const TIER_OPTIONS = [
	{ value: "", label: "All tiers" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "annual", label: "Annual" },
	{ value: "consulting", label: "Consulting" },
];

const FREQ_OPTIONS = [
	{ value: "", label: "Any frequency" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "annual", label: "Annual" },
];

export default function Clients() {
	const [clients, setClients] = useState([]);
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [filters, setFilters] = useState({
		q: "",
		tier: "",
		manager_id: "",
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [editingClient, setEditingClient] = useState(null);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState(emptyForm());

	function emptyForm() {
		return {
			legal_name: "",
			dba_name: "",
			tier: "",
			billing_frequency: "",
			bookkeeping_frequency: "",
			primary_contact: "",
			email: "",
			phone: "",
			cpa: "",
			manager_id: "",
			bookkeeper_id: "",
		};
	}

	const loadUsers = async () => {
		try {
			const res = await api.get("/users");
			setUsers(res.data);
		} catch (err) {
			console.error("Error loading users", err);
		}
	};

	const loadClients = async (overrideFilters) => {
		const params = overrideFilters ?? filters;
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/clients", { params });
			setClients(res.data);
		} catch (err) {
			console.error(err);
			setError("Failed to load clients");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadUsers();
		loadClients();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleFilterChange = (e) => {
		const { name, value } = e.target;
		setFilters((prev) => ({ ...prev, [name]: value }));
	};

	const applyFilters = (e) => {
		if (e) e.preventDefault();
		loadClients();
	};

	const clearFilters = () => {
		const cleared = { q: "", tier: "", manager_id: "" };
		setFilters(cleared);
		loadClients(cleared);
	};

	const openCreateModal = () => {
		setEditingClient(null);
		setForm(emptyForm());
		setModalOpen(true);
	};

	const openEditModal = (client) => {
		setEditingClient(client);
		setForm({
			legal_name: client.legal_name ?? "",
			dba_name: client.dba_name ?? "",
			tier: client.tier ?? "",
			billing_frequency: client.billing_frequency ?? "",
			bookkeeping_frequency: client.bookkeeping_frequency ?? "",
			primary_contact: client.primary_contact ?? "",
			email: client.email ?? "",
			phone: client.phone ?? "",
			cpa: client.cpa ?? "",
			manager_id: client.manager_id ?? "",
			bookkeeper_id: client.bookkeeper_id ?? "",
		});
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setEditingClient(null);
		setSaving(false);
		setError("");
	};

	const handleFormChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		// normalize ids (empty -> null, string -> number)
		const payload = {
			...form,
			manager_id: form.manager_id ? Number(form.manager_id) : null,
			bookkeeper_id: form.bookkeeper_id ? Number(form.bookkeeper_id) : null,
		};

		try {
			if (editingClient) {
				await api.put(`/clients/${editingClient.id}`, payload);
			} else {
				await api.post("/clients", payload);
			}
			await loadClients();
			closeModal();
		} catch (err) {
			console.error(err);
			setError("Failed to save client");
			setSaving(false);
		}
	};

	const handleDelete = async (client) => {
		if (!window.confirm(`Delete client "${client.legal_name}"?`)) return;
		try {
			await api.delete(`/clients/${client.id}`);
			setClients((prev) => prev.filter((c) => c.id !== client.id));
		} catch (err) {
			console.error(err);
			setError("Failed to delete client");
		}
	};

	return (
		<div className="space-y-5">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold text-yecny-charcoal">
						Clients
					</h1>
					<p className="text-sm text-yecny-slate mt-1">
						Central list of all bookkeeping clients. Use filters to focus by
						tier, manager, or frequency.
					</p>
				</div>
				<button
					onClick={openCreateModal}
					className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium shadow-sm hover:bg-yecny-primary-dark"
				>
					+ Add Client
				</button>
			</div>

			{/* Filters */}
			<form
				onSubmit={applyFilters}
				className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-end"
			>
				<div className="flex-1">
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Search
					</label>
					<input
						type="text"
						name="q"
						value={filters.q}
						onChange={handleFilterChange}
						placeholder="Search by company name"
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
					/>
				</div>
				<div>
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Tier
					</label>
					<select
						name="tier"
						value={filters.tier}
						onChange={handleFilterChange}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
					>
						{TIER_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-xs font-medium text-yecny-slate mb-1">
						Manager
					</label>
					<select
						name="manager_id"
						value={filters.manager_id}
						onChange={handleFilterChange}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
					>
						<option value="">Any manager</option>
						{users.map((u) => (
							<option key={u.id} value={u.id}>
								{u.name}
							</option>
						))}
					</select>
				</div>

				<div className="flex gap-2">
					<button
						type="submit"
						className="px-3 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark"
					>
						Apply
					</button>
					<button
						type="button"
						onClick={clearFilters}
						className="px-3 py-2 rounded-md border border-slate-300 text-sm text-yecny-slate bg-white hover:bg-slate-50"
					>
						Clear
					</button>
				</div>
			</form>

			{/* List */}
			<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
				<div className="border-b border-slate-200 px-4 py-2 text-xs text-yecny-slate flex justify-between">
					<span>
						{loading
							? "Loading clients..."
							: `${clients.length} client${clients.length === 1 ? "" : "s"}`}
					</span>
				</div>

				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
						{error}
					</div>
				)}

				{!loading && clients.length === 0 && !error && (
					<div className="px-4 py-6 text-sm text-yecny-slate">
						No clients yet. Click &quot;Add Client&quot; to create your first
						client record.
					</div>
				)}

				{!loading && clients.length > 0 && (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Company
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Primary Contact
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Email
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Phone
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Tier
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Manager
									</th>
									<th className="text-right px-4 py-2 font-medium text-yecny-slate">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{clients.map((client, idx) => {
									const manager = users.find((u) => u.id === client.manager_id);
									const isLast = idx === clients.length - 1;
									return (
										<tr
											key={client.id}
											className={
												"hover:bg-slate-50 transition-colors" +
												(isLast ? "" : " border-b border-slate-100")
											}
										>
											<td className="px-4 py-2">
												<div className="font-medium text-yecny-charcoal">
													<Link
														to={`/clients/${client.id}`}
														className="hover:underline hover:text-yecny-primary"
													>
														{client.legal_name}
													</Link>
												</div>
												{client.dba_name && (
													<div className="text-xs text-yecny-slate">
														DBA {client.dba_name}
													</div>
												)}
											</td>
											<td className="px-4 py-2">
												{client.primary_contact || (
													<span className="text-xs text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2">
												{client.email || (
													<span className="text-xs text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2">
												{client.phone || (
													<span className="text-xs text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2 capitalize">
												{client.tier || (
													<span className="text-xs text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2">
												{manager ? (
													manager.name
												) : (
													<span className="text-xs text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2 text-right">
												<button
													onClick={() => openEditModal(client)}
													className="text-xs text-yecny-primary hover:underline mr-3"
												>
													Edit
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

			{/* Modal */}
			{modalOpen && (
				<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
						<div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-yecny-charcoal">
								{editingClient ? "Edit Client" : "Add Client"}
							</h2>
							<button
								onClick={closeModal}
								className="text-slate-400 hover:text-slate-700 text-xl leading-none"
							>
								x
							</button>
						</div>
						<form
							onSubmit={handleSave}
							className="p-5 overflow-y-auto space-y-4"
						>
							{error && (
								<div className="mb-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
									{error}
								</div>
							)}

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Left column */}
								<div className="space-y-3">
									<Field
										label="Legal Name"
										name="legal_name"
										value={form.legal_name}
										onChange={handleFormChange}
										required
									/>
									<Field
										label="DBA Name"
										name="dba_name"
										value={form.dba_name}
										onChange={handleFormChange}
									/>
									<SelectField
										label="Tier"
										name="tier"
										value={form.tier}
										onChange={handleFormChange}
										options={TIER_OPTIONS}
									/>
									<SelectField
										label="Billing Frequency"
										name="billing_frequency"
										value={form.billing_frequency}
										onChange={handleFormChange}
										options={FREQ_OPTIONS}
									/>
									<SelectField
										label="Bookkeeping Frequency"
										name="bookkeeping_frequency"
										value={form.bookkeeping_frequency}
										onChange={handleFormChange}
										options={FREQ_OPTIONS}
									/>
								</div>
								{/* Right column */}
								<div className="space-y-3">
									<Field
										label="Primary Contact"
										name="primary_contact"
										value={form.primary_contact}
										onChange={handleFormChange}
									/>
									<Field
										label="Email"
										name="email"
										type="email"
										value={form.email}
										onChange={handleFormChange}
									/>
									<Field
										label="Phone"
										name="phone"
										value={form.phone}
										onChange={handleFormChange}
									/>
									<Field
										label="CPA"
										name="cpa"
										value={form.cpa}
										onChange={handleFormChange}
									/>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<SelectUserField
											label="Manager"
											name="manager_id"
											value={form.manager_id}
											onChange={handleFormChange}
											users={users}
										/>
										<SelectUserField
											label="Bookkeeper"
											name="bookkeeper_id"
											value={form.bookkeeper_id}
											onChange={handleFormChange}
											users={users}
										/>
									</div>
								</div>
							</div>
							<div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
								<button
									type="button"
									onClick={closeModal}
									className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-yecny-slate hover:bg-slate-50"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={saving}
									className="px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark disabled:opacity-60"
								>
									{saving
										? editingClient
											? "Saving-"
											: "Creating-"
										: editingClient
										? "Save Changes"
										: "Create Client"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
/* Small reusable field components */

function Field({ label, name, value, onChange, type = "text", required }) {
	return (
		<div>
			<label className="block text-xs font-medium text-yecny-slate mb-1">
				{label}
				{required && <span className="text-red-500 ml-0.5">*</span>}
			</label>
			<input
				type={type}
				name={name}
				value={value}
				onChange={onChange}
				required={required}
				className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
			/>
		</div>
	);
}

function SelectField({ label, name, value, onChange, options }) {
	return (
		<div>
			<label className="block text-xs font-medium text-yecny-slate mb-1">
				{label}
			</label>
			<select
				name={name}
				value={value}
				onChange={onChange}
				className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</div>
	);
}

function SelectUserField({ label, name, value, onChange, users }) {
	return (
		<div>
			<label className="block text-xs font-medium text-yecny-slate mb-1">
				{label}
			</label>
			<select
				name={name}
				value={value}
				onChange={onChange}
				className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
			>
				<option value="">Unassigned</option>
				{users.map((u) => (
					<option key={u.id} value={u.id}>
						{u.name}
					</option>
				))}
			</select>
		</div>
	);
}
