// src/pages/ClientDetail.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import ClientDangerZone from "../components/clients/ClientDangerZone";

const TABS = [
	"Profile",
	"Accounts",
	"Documents",
	"Recurring",
	"Notes",
	"Danger Zone",
];

export default function ClientDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();

	const [client, setClient] = useState(null);
	const [users, setUsers] = useState([]);
	const [contacts, setContacts] = useState([]);
	const [activeTab, setActiveTab] = useState("Profile");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const loadClient = async () => {
		setLoading(true);
		setError("");
		try {
			const [clientRes, usersRes, contactsRes] = await Promise.all([
				api.get(`/clients/${id}`),
				api.get("/users"),
				api.get("/contacts"),
			]);
			setClient(clientRes.data);
			setUsers(usersRes.data);
			setContacts(contactsRes.data);
		} catch (err) {
			console.error(err);
			setError("Failed to load client");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadClient();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const manager = client ? users.find((u) => u.id === client.manager_id) : null;
	const bookkeeper = client
		? users.find((u) => u.id === client.bookkeeper_id)
		: null;

	// ---- role-based tabs (Danger Zone only for Admin/Owner) ----
	const isAdminOrOwner = user?.role === "Admin" || user?.role === "Owner";

	const visibleTabs = TABS.filter((tab) => {
		if (tab === "Danger Zone") {
			return isAdminOrOwner;
		}
		return true;
	});

	// Make sure activeTab is always one of the visible ones
	useEffect(() => {
		if (!visibleTabs.includes(activeTab)) {
			setActiveTab("Profile");
		}
	}, [visibleTabs, activeTab]);

	if (loading) {
		return (
			<div className="text-sm text-yecny-slate">Loading client details...</div>
		);
	}

	if (error || !client) {
		return (
			<div className="space-y-3">
				<div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 inline-block">
					{error || "Client not found"}
				</div>
				<button
					onClick={() => navigate("/clients")}
					className="text-sm text-yecny-primary hover:underline"
				>
					X Back to Clients
				</button>
			</div>
		);
	}
	const handlePrimaryContactChange = async (newContactId) => {
		if (!client) return;

		try {
			const res = await api.put(`/clients/${client.id}`, {
				primary_contact_id: newContactId,
			});

			setClient(res.data);
		} catch (err) {
			console.error("Failed to update primary contact", err);
			// optional: setError("Failed to update primary contact");
		}
	};
	return (
		<div className="space-y-5">
			{/* Breadcrumb / header row */}
			<div className="flex flex-col gap-2">
				<div className="text-xs text-yecny-slate">
					<Link to="/clients" className="text-yecny-primary hover:underline">
						Clients
					</Link>{" "}
					/ <span className="text-yecny-charcoal">{client.legal_name}</span>
				</div>
				{/* Header card */}
				<div className="bg-yecny-primary-soft/40 border border-yecny-primary-soft rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
					<div>
						<div className="text-xl font-semibold text-yecny-charcoal">
							{client.legal_name}
						</div>
						{client.dba_name && (
							<div className="text-xs text-yecny-slate mt-1">
								DBA {client.dba_name}
							</div>
						)}
						{/* badges, same as before */}
					</div>

					<div className="flex flex-col items-start lg:items-end gap-2 text-xs text-yecny-slate">
						<div>
							Created:{" "}
							<span className="font-medium">
								{new Date(client.created_at).toLocaleDateString()}
							</span>
						</div>
						<div>
							Last updated:{" "}
							<span className="font-medium">
								{new Date(client.updated_at).toLocaleDateString()}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="border-b border-slate-200 flex gap-4 text-sm">
				{visibleTabs.map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className={[
							"pb-2 -mb-px border-b-2 transition-colors",
							activeTab === tab
								? "border-yecny-primary text-yecny-primary font-medium"
								: "border-transparent text-yecny-slate hover:text-yecny-primary",
						].join(" ")}
					>
						{tab}
					</button>
				))}
			</div>

			{/* Tab content */}
			{activeTab === "Profile" && (
				<ProfileTab
					client={client}
					manager={manager}
					bookkeeper={bookkeeper}
					contacts={contacts}
					onPrimaryContactChange={handlePrimaryContactChange}
				/>
			)}

			{activeTab === "Accounts" && <AccountsTab clientId={client.id} />}

			{activeTab === "Documents" && <DocumentsTab client={client} />}

			{activeTab === "Recurring" && (
				<RecurringTab client={client} users={users} />
			)}

			{activeTab === "Notes" && (
				<PlaceholderTab title="Notes & Activity">
					We&apos;ll track internal notes and activity logs for this client
					here.
				</PlaceholderTab>
			)}

			{activeTab === "Danger Zone" && (
				<ClientDangerZone clientId={client.id} clientName={client.legal_name} />
			)}

			{/* ...rest of file: Badge, ProfileTab, AccountsTab, DocumentsTab, etc. */}
		</div>
	);
}

function Badge({ children }) {
	return (
		<span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/70 text-yecny-slate border border-yecny-primary-soft">
			{children}
		</span>
	);
}

function ProfileTab({
	client,
	manager,
	bookkeeper,
	contacts = [],
	onPrimaryContactChange,
}) {
	const [editingPrimary, setEditingPrimary] = useState(false);
	const [selectedContactId, setSelectedContactId] = useState(
		client.primary_contact_id ?? ""
	);

	// Keep local selection in sync when client updates from server
	useEffect(() => {
		setSelectedContactId(client.primary_contact_id ?? "");
	}, [client.primary_contact_id]);

	const handleSavePrimary = () => {
		const idToSend =
			selectedContactId === "" || selectedContactId === null
				? null
				: Number(selectedContactId);

		if (onPrimaryContactChange) {
			onPrimaryContactChange(idToSend);
		}
		setEditingPrimary(false);
	};

	return (
		<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
			<div className="space-y-4">
				<FieldDisplay label="Legal Name" value={client.legal_name} />
				<FieldDisplay label="DBA Name" value={client.dba_name} />
				<FieldDisplay
					label="Bookkeeping Frequency"
					value={client.bookkeeping_frequency}
					transform={capitalize}
				/>
				<FieldDisplay
					label="Billing Frequency"
					value={client.billing_frequency}
					transform={capitalize}
				/>
				<FieldDisplay label="Tier" value={client.tier} transform={capitalize} />
			</div>
			<div className="space-y-4">
				{/* Primary Contact with inline editor */}
				<div>
					<div className="flex items-center justify-between gap-2">
						<div>
							<div className="text-xs font-medium text-yecny-slate mb-0.5">
								Primary Contact
							</div>
							{client.primary_contact ? (
								<div className="text-sm text-yecny-charcoal">
									{client.primary_contact}
								</div>
							) : (
								<div className="text-xs text-slate-400">Not set</div>
							)}
						</div>

						<button
							type="button"
							onClick={() => setEditingPrimary((v) => !v)}
							className="text-xs px-2 py-1 rounded border border-slate-200 text-yecny-primary hover:bg-slate-50"
						>
							{editingPrimary ? "Cancel" : "Change"}
						</button>
					</div>

					{editingPrimary && (
						<div className="mt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
							<select
								className="border border-slate-300 rounded px-2 py-1 text-sm min-w-[220px]"
								value={selectedContactId ?? ""}
								onChange={(e) => setSelectedContactId(e.target.value)}
							>
								<option value="">No contact</option>
								{contacts.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
										{c.email ? ` (${c.email})` : ""}
									</option>
								))}
							</select>

							<button
								type="button"
								onClick={handleSavePrimary}
								className="text-xs px-3 py-1 rounded bg-yecny-primary text-white hover:bg-teal-700"
							>
								Save
							</button>
						</div>
					)}
				</div>

				<FieldDisplay label="Email" value={client.email} />
				<FieldDisplay label="Phone" value={client.phone} />
				<FieldDisplay label="CPA" value={client.cpa} />
				<FieldDisplay label="Manager" value={manager?.name} />
				<FieldDisplay label="Bookkeeper" value={bookkeeper?.name} />
			</div>
		</div>
	);
}
const ACCOUNT_TYPES = [
	{ value: "checking", label: "Checking" },
	{ value: "savings", label: "Savings" },
	{ value: "credit_card", label: "Credit Card" },
	{ value: "loan", label: "Loan" },
	{ value: "line_of_credit", label: "Line of Credit" },
	{ value: "asset", label: "Asset" },
	{ value: "other", label: "Other" },
];

function AccountsTab({ clientId }) {
	const [accounts, setAccounts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState(emptyAccountForm());

	function emptyAccountForm() {
		return {
			name: "",
			type: "checking",
			last4: "",
			is_active: true,
		};
	}

	const loadAccounts = async () => {
		if (!clientId) return;
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/accounts", {
				params: { client_id: clientId },
			});
			setAccounts(res.data);
		} catch (err) {
			console.error(err);
			setError("Failed to load accounts");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadAccounts();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const openCreateModal = () => {
		setEditing(null);
		setForm(emptyAccountForm());
		setModalOpen(true);
	};
	const openEditModal = (account) => {
		setEditing(account);
		setForm({
			name: account.name ?? "",
			type: account.type ?? "checking",
			last4: account.last4 ?? "",
			is_active: account.is_active,
		});
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setEditing(null);
		setSaving(false);
		setError("");
	};

	const handleFormChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		const payload = {
			client_id: clientId,
			name: form.name,
			type: form.type || null,
			last4: form.last4 || null,
			is_active: form.is_active,
		};

		try {
			if (editing) {
				await api.put(`/accounts/${editing.id}`, {
					name: payload.name,
					type: payload.type,
					last4: payload.last4,
					is_active: payload.is_active,
				});
			} else {
				await api.post("/accounts", payload);
			}

			await loadAccounts();
			closeModal();
		} catch (err) {
			console.error(err);
			setError("Failed to save account");
			setSaving(false);
		}
	};

	const handleDelete = async (account) => {
		if (!window.confirm(`Delete account "${account.name}"?`)) return;
		try {
			await api.delete(`/accounts/${account.id}`);
			setAccounts((prev) => prev.filter((a) => a.id !== account.id));
		} catch (err) {
			console.error(err);
			setError("Failed to delete account");
		}
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<div className="text-sm text-yecny-slate">
					Linked bank, credit card, loan, and asset accounts for this client.
				</div>
				<button
					onClick={openCreateModal}
					className="px-3 py-1.5 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark"
				>
					+ Add Account
				</button>
			</div>

			{/* List */}
			<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
				<div className="px-4 py-2 border-b border-slate-200 text-xs text-yecny-slate flex justify-between">
					<span>
						{loading
							? "Loading accounts..."
							: `${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
					</span>
				</div>

				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
						{error}
					</div>
				)}

				{!loading && accounts.length === 0 && !error && (
					<div className="px-4 py-6 text-sm text-yecny-slate">
						No accounts yet. Use &quot;Add Account&quot; to link this
						client&apos;s bank, credit card, loan, or asset accounts.
					</div>
				)}
				{!loading && accounts.length > 0 && (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Name
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Type
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Last 4
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Active
									</th>
									<th className="text-right px-4 py-2 font-medium text-yecny-slate">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{accounts.map((account, idx) => {
									const isLast = idx === accounts.length - 1;
									const typeLabel =
										ACCOUNT_TYPES.find((t) => t.value === account.type)
											?.label ||
										account.type ||
										"-";

									return (
										<tr
											key={account.id}
											className={
												"hover:bg-slate-50 transition-colors" +
												(isLast ? "" : " border-b border-slate-100")
											}
										>
											<td className="px-4 py-2">
												<div className="font-medium text-yecny-charcoal">
													{account.name}
												</div>
											</td>
											<td className="px-4 py-2">{typeLabel}</td>
											<td className="px-4 py-2">
												{account.last4 || (
													<span className="text-xs text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-2">
												{account.is_active ? (
													<span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
														Active
													</span>
												) : (
													<span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
														Inactive
													</span>
												)}
											</td>
											<td className="px-4 py-2 text-right">
												<button
													onClick={() => openEditModal(account)}
													className="text-xs text-yecny-primary hover:underline mr-3"
												>
													Edit
												</button>
												<button
													onClick={() => handleDelete(account)}
													className="text-xs text-red-600 hover:underline"
												>
													Delete
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
					<div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
						<div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-yecny-charcoal">
								{editing ? "Edit Account" : "Add Account"}
							</h2>
							<button
								onClick={closeModal}
								className="text-slate-400 hover:text-slate-700 text-xl leading-none"
							>
								x
							</button>
						</div>

						<form onSubmit={handleSave} className="p-5 space-y-4">
							{error && (
								<div className="mb-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
									{error}
								</div>
							)}

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Account Name<span className="text-red-500 ml-0.5">*</span>
								</label>
								<input
									type="text"
									name="name"
									value={form.name}
									onChange={handleFormChange}
									required
									placeholder="WF Checking 2356"
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Type
								</label>
								<select
									name="type"
									value={form.type}
									onChange={handleFormChange}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
								>
									{ACCOUNT_TYPES.map((t) => (
										<option key={t.value} value={t.value}>
											{t.label}
										</option>
									))}
								</select>
							</div>
							<div className="flex items-center gap-3">
								<div className="flex-1">
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										Last 4 Digits
									</label>
									<input
										type="text"
										name="last4"
										maxLength={4}
										value={form.last4}
										onChange={handleFormChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									/>
								</div>
								<label className="inline-flex items-center text-xs text-yecny-slate mt-5">
									<input
										type="checkbox"
										name="is_active"
										checked={form.is_active}
										onChange={handleFormChange}
										className="mr-2"
									/>
									Active
								</label>
							</div>

							<div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
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
										? editing
											? "Saving..."
											: "Creating..."
										: editing
										? "Save Changes"
										: "Create Account"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
function DocumentsTab({ client }) {
	const { user } = useAuth();
	const [accounts, setAccounts] = useState([]);
	const [documents, setDocuments] = useState([]);
	const [year, setYear] = useState(new Date().getFullYear());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [modalOpen, setModalOpen] = useState(false);
	const [uploadMonth, setUploadMonth] = useState(1);
	const [uploadAccountId, setUploadAccountId] = useState(null);
	const [uploadFile, setUploadFile] = useState(null);
	const [uploading, setUploading] = useState(false);

	const clientId = client.id;

	const loadData = async (targetYear = year) => {
		if (!clientId) return;
		setLoading(true);
		setError("");

		try {
			const [accountsRes, docsRes] = await Promise.all([
				api.get("/accounts", { params: { client_id: clientId } }),
				api.get("/documents", {
					params: { client_id: clientId, year: targetYear },
				}),
			]);

			setAccounts(accountsRes.data);
			setDocuments(docsRes.data);
		} catch (err) {
			console.error(err);
			setError("Failed to load documents");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const handleYearChange = async (e) => {
		const newYear = Number(e.target.value);
		setYear(newYear);
		await loadData(newYear);
	};

	const openUploadModal = (accountId, month) => {
		setUploadAccountId(accountId);
		setUploadMonth(month);
		setUploadFile(null);
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setUploading(false);
	};

	const handleFileChange = (e) => {
		setUploadFile(e.target.files?.[0] ?? null);
	};

	const handleUpload = async (e) => {
		e.preventDefault();
		if (!uploadFile || !uploadAccountId) return;

		setUploading(true);
		try {
			const formData = new FormData();
			formData.append("client_id", String(clientId));
			formData.append("account_id", String(uploadAccountId));
			formData.append("year", String(year));
			formData.append("month", String(uploadMonth));
			// You can optionally let the user pick a specific day later
			formData.append("day", "1");
			formData.append("file", uploadFile);

			await api.post("/documents/upload", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			await loadData(year);
			closeModal();
		} catch (err) {
			console.error(err);
			alert("Failed to upload document");
			setUploading(false);
		}
	};
	const handleDeleteDoc = async (doc) => {
		if (
			!window.confirm(
				"Delete this document? This will remove the file from the server."
			)
		) {
			return;
		}

		try {
			await api.delete(`/documents/${doc.id}`);
			await loadData(year);
		} catch (err) {
			console.error(err);
			alert("Failed to delete document");
		}
	};
	// Build a quick lookup: account_id -> month -> document
	const docsByAccount = {};
	for (const doc of documents) {
		if (!docsByAccount[doc.account_id]) docsByAccount[doc.account_id] = {};
		docsByAccount[doc.account_id][doc.month] = doc;
	}

	const yearOptions = [year, year - 1];

	return (
		<div className="space-y-4">
			{/* Header row */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
				<div className="text-sm text-yecny-slate">
					Upload and track monthly statements per account. Files are stored as:
					<span className="font-mono text-xs ml-1">
						Customer / Statements / Account / Year / MMDDYY.ext
					</span>
				</div>
				<div className="flex items-center gap-2 text-sm">
					<span className="text-yecny-slate">Year:</span>
					<select
						value={year}
						onChange={handleYearChange}
						className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white"
					>
						{yearOptions.map((y) => (
							<option key={y} value={y}>
								{y}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Status + list */}
			<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
				<div className="px-4 py-2 border-b border-slate-200 text-xs text-yecny-slate flex justify-between">
					<span>
						{loading
							? "Loading documents..."
							: `${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
					</span>
				</div>

				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
						{error}
					</div>
				)}

				{!loading && accounts.length === 0 && !error && (
					<div className="px-4 py-6 text-sm text-yecny-slate">
						No accounts yet. Add accounts first in the Accounts tab.
					</div>
				)}
				{!loading && accounts.length > 0 && (
					<div className="divide-y divide-slate-100">
						{accounts.map((account) => {
							const monthDocs = docsByAccount[account.id] || {};
							return (
								<div key={account.id} className="px-4 py-3">
									<div className="flex items-center justify-between mb-2">
										<div>
											<div className="text-sm font-medium text-yecny-charcoal">
												{account.name}
											</div>
											<div className="text-xs text-yecny-slate">
												{account.type || "Account"}
											</div>
										</div>
									</div>

									{/* Month grid */}
									<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
										{Array.from({ length: 12 }, (_, i) => i + 1).map(
											(month) => {
												const doc = monthDocs[month];
												const monthName = new Date(
													year,
													month - 1,
													1
												).toLocaleString("default", { month: "short" });

												const isReceived = !!doc;

												const handleClick = () => {
													if (isReceived && doc) {
														const baseURL = api.defaults.baseURL || "";
														window.open(
															`${baseURL}/documents/${doc.id}/download`,
															"_blank"
														);
													} else {
														openUploadModal(account.id, month);
													}
												};

												return (
													<button
														key={month}
														type="button"
														onClick={handleClick}
														className={[
															"flex flex-col items-center justify-center rounded-md border px-2 py-2 text-xs transition",
															isReceived
																? "border-green-200 bg-green-50 text-green-700"
																: "border-slate-200 bg-slate-50 text-slate-500 hover:border-yecny-primary-soft hover:bg-yecny-primary-soft/40 hover:text-yecny-primary-dark",
														].join(" ")}
													>
														<span className="font-medium">{monthName}</span>
														<span className="mt-1 text-[11px]">
															{isReceived ? "Received" : "Upload"}
														</span>

														{/* Admin-only delete link */}
														{isReceived && user?.role === "Admin" && (
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation(); // don't trigger view on delete click
																	handleDeleteDoc(doc);
																}}
																className="mt-1 text-[10px] text-red-600 hover:underline"
															>
																Delete
															</button>
														)}
													</button>
												);
											}
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Upload modal */}
			{modalOpen && (
				<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
						<div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-yecny-charcoal">
								Upload Statement
							</h2>
							<button
								onClick={closeModal}
								className="text-slate-400 hover:text-slate-700 text-xl leading-none"
							>
								x
							</button>
						</div>
						<form onSubmit={handleUpload} className="p-5 space-y-4">
							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Account
								</label>
								<select
									value={uploadAccountId ?? ""}
									onChange={(e) =>
										setUploadAccountId(Number(e.target.value) || null)
									}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
									required
								>
									<option value="">Select account</option>
									{accounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Month
								</label>
								<select
									value={uploadMonth}
									onChange={(e) => setUploadMonth(Number(e.target.value))}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
								>
									{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
										<option key={m} value={m}>
											{new Date(year, m - 1, 1).toLocaleString("default", {
												month: "long",
											})}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									File
								</label>
								<input
									type="file"
									onChange={handleFileChange}
									className="w-full text-sm"
									required
								/>
							</div>

							<div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
								<button
									type="button"
									onClick={closeModal}
									className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-yecny-slate hover:bg-slate-50"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={uploading || !uploadFile}
									className="px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark disabled:opacity-60"
								>
									{uploading ? "Uploading..." : "Upload"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

const SCHEDULE_TYPES = [
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "annual", label: "Annual" },
];

const WEEK_OPTIONS = [
	{ value: 1, label: "First" },
	{ value: 2, label: "Second" },
	{ value: 3, label: "Third" },
	{ value: 4, label: "Fourth" },
	{ value: -1, label: "Last" },
];

const WEEKDAY_OPTIONS = [
	{ value: 0, label: "Monday" },
	{ value: 1, label: "Tuesday" },
	{ value: 2, label: "Wednesday" },
	{ value: 3, label: "Thursday" },
	{ value: 4, label: "Friday" },
	{ value: 5, label: "Saturday" },
	{ value: 6, label: "Sunday" },
];

function describeRule(rt) {
	if (rt.day_of_month) {
		return `${capitalize(rt.schedule_type)} on day ${rt.day_of_month}`;
	}
	if (rt.weekday !== null && rt.weekday !== undefined && rt.week_of_month) {
		const weekLabel =
			WEEK_OPTIONS.find((w) => w.value === rt.week_of_month)?.label ||
			`Week ${rt.week_of_month}`;
		const weekdayLabel =
			WEEKDAY_OPTIONS.find((w) => w.value === rt.weekday)?.label || "Day";
		return `${capitalize(
			rt.schedule_type
		)} on the ${weekLabel} ${weekdayLabel}`;
	}
	return capitalize(rt.schedule_type);
}

function RecurringTab({ client, users }) {
	const { user } = useAuth();
	const clientId = client.id;

	const [rules, setRules] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [saving, setSaving] = useState(false);

	const todayISO = new Date().toISOString().slice(0, 10);

	const emptyForm = () => ({
		name: "",
		description: "",
		schedule_type: "monthly",
		mode: "day_of_month", // 'day_of_month' or 'weekday'
		day_of_month: 1,
		week_of_month: 1,
		weekday: 0,
		assigned_user_id: user?.id || "",
		default_status: "new",
		next_run: todayISO,
	});

	const [form, setForm] = useState(emptyForm());

	const loadRules = async () => {
		if (!clientId) return;
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/recurring-tasks", {
				params: { client_id: clientId },
			});
			setRules(res.data);
		} catch (err) {
			console.error(err);
			setError("Failed to load recurring tasks");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadRules();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientId]);

	const openCreateModal = () => {
		setEditing(null);
		setForm(emptyForm());
		setModalOpen(true);
	};

	const openEditModal = (rt) => {
		setEditing(rt);
		const mode =
			rt.day_of_month != null && rt.day_of_month !== 0
				? "day_of_month"
				: "weekday";
		setForm({
			name: rt.name,
			description: rt.description || "",
			schedule_type: rt.schedule_type,
			mode,
			day_of_month: rt.day_of_month || 1,
			week_of_month: rt.week_of_month || 1,
			weekday: rt.weekday ?? 0,
			assigned_user_id: rt.assigned_user_id || "",
			default_status: rt.default_status || "new",
			next_run: rt.next_run, // ISO string
		});
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setEditing(null);
		setSaving(false);
		setError("");
	};

	const handleFormChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({
			...prev,
			[name]:
				name === "day_of_month" ||
				name === "week_of_month" ||
				name === "weekday"
					? Number(value)
					: value,
		}));
	};

	const handleModeChange = (e) => {
		const mode = e.target.value;
		setForm((prev) => ({ ...prev, mode }));
	};

	const handleToggleActive = async (rt) => {
		try {
			await api.put(`/recurring-tasks/${rt.id}`, {
				active: !rt.active,
			});
			await loadRules();
		} catch (err) {
			console.error(err);
			alert("Failed to update recurring task");
		}
	};
	const handleDelete = async (rt) => {
		if (!window.confirm(`Delete recurring rule "${rt.name}"?`)) return;
		try {
			await api.delete(`/recurring-tasks/${rt.id}`);
			setRules((prev) => prev.filter((r) => r.id !== rt.id));
		} catch (err) {
			console.error(err);
			alert("Failed to delete recurring rule");
		}
	};

	const handleSave = async (e) => {
		e.preventDefault();
		setSaving(true);

		const payload = {
			name: form.name,
			description: form.description || null,
			schedule_type: form.schedule_type,
			day_of_month:
				form.mode === "day_of_month" ? form.day_of_month : NoneToNull(null),
			weekday: form.mode === "weekday" ? form.weekday : NoneToNull(null),
			week_of_month:
				form.mode === "weekday" ? form.week_of_month : NoneToNull(null),
			client_id: clientId,
			assigned_user_id: form.assigned_user_id || null,
			default_status: form.default_status || "new",
			next_run: form.next_run,
		};

		try {
			if (editing) {
				await api.put(`/recurring-tasks/${editing.id}`, payload);
			} else {
				await api.post("/recurring-tasks", payload);
			}
			await loadRules();
			closeModal();
		} catch (err) {
			console.error(err);
			alert("Failed to save recurring rule");
			setSaving(false);
		}
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<div className="text-sm text-yecny-slate">
					Define default and custom recurring work for this client. When a
					recurring task is completed, the next period&apos;s task is created
					automatically.
				</div>
				<button
					onClick={openCreateModal}
					className="px-3 py-1.5 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark"
				>
					+ Add Recurring Rule
				</button>
			</div>

			{/* Rules list */}
			<div className="bg-white rounded-xl shadow-sm border border-slate-200">
				<div className="px-4 py-2 border-b border-slate-200 text-xs text-yecny-slate flex justify-between">
					<span>
						{loading
							? "Loading recurring tasks..."
							: `${rules.length} rule${rules.length === 1 ? "" : "s"}`}
					</span>
				</div>
				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
						{error}
					</div>
				)}

				{!loading && rules.length === 0 && !error && (
					<div className="px-4 py-6 text-sm text-yecny-slate">
						No recurring tasks yet. Add rules for bank feeds, reconciliations,
						reporting, or any custom recurring work for this client.
					</div>
				)}

				{!loading && rules.length > 0 && (
					<div className="divide-y divide-slate-100">
						{rules.map((rt) => {
							const assigned = users.find((u) => u.id === rt.assigned_user_id);
							const scheduleDesc = describeRule(rt);
							const nextRunLabel = rt.next_run
								? new Date(rt.next_run).toLocaleDateString()
								: "-";

							return (
								<div
									key={rt.id}
									className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
								>
									<div>
										<div className="text-sm font-medium text-yecny-charcoal">
											{rt.name}
										</div>
										<div className="text-xs text-yecny-slate mt-0.5">
											{scheduleDesc} - Next: {nextRunLabel}
										</div>
										{rt.description && (
											<div className="text-xs text-slate-500 mt-1">
												{rt.description}
											</div>
										)}
										{assigned && (
											<div className="mt-1 text-xs text-yecny-slate">
												Assigned to{" "}
												<span className="font-medium">{assigned.name}</span>
											</div>
										)}
									</div>

									<div className="flex items-center gap-3 text-xs">
										<label className="inline-flex items-center gap-1">
											<input
												type="checkbox"
												checked={rt.active}
												onChange={() => handleToggleActive(rt)}
											/>
											<span>{rt.active ? "Active" : "Paused"}</span>
										</label>

										<button
											onClick={() => openEditModal(rt)}
											className="text-yecny-primary hover:underline"
										>
											Edit
										</button>
										<button
											onClick={() => handleDelete(rt)}
											className="text-red-600 hover:underline"
										>
											Delete
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
			{/* Modal */}
			{modalOpen && (
				<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
						<div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-yecny-charcoal">
								{editing ? "Edit Recurring Rule" : "Add Recurring Rule"}
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
							className="p-5 space-y-4 overflow-y-auto"
						>
							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Name<span className="text-red-500 ml-0.5">*</span>
								</label>
								<input
									type="text"
									name="name"
									value={form.name}
									onChange={handleFormChange}
									required
									placeholder="Monthly Bank Feeds"
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Description
								</label>
								<textarea
									name="description"
									value={form.description}
									onChange={handleFormChange}
									rows={2}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									placeholder="Any extra context for this recurring work"
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										Frequency
									</label>
									<select
										name="schedule_type"
										value={form.schedule_type}
										onChange={handleFormChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
									>
										{SCHEDULE_TYPES.map((s) => (
											<option key={s.value} value={s.value}>
												{s.label}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										Rule Type
									</label>
									<select
										value={form.mode}
										onChange={handleModeChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
									>
										<option value="day_of_month">
											On a specific day of the month
										</option>
										<option value="weekday">On a weekday pattern</option>
									</select>
								</div>
							</div>
							{form.mode === "day_of_month" && (
								<div>
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										Day of month
									</label>
									<input
										type="number"
										name="day_of_month"
										min={1}
										max={28}
										value={form.day_of_month}
										onChange={handleFormChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
									/>
									<p className="mt-1 text-[11px] text-slate-500">
										Use 1-28 to avoid end-of-month issues (we handle month
										lengths automatically).
									</p>
								</div>
							)}

							{form.mode === "weekday" && (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-medium text-yecny-slate mb-1">
											Week of month
										</label>
										<select
											name="week_of_month"
											value={form.week_of_month}
											onChange={handleFormChange}
											className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
										>
											{WEEK_OPTIONS.map((w) => (
												<option key={w.value} value={w.value}>
													{w.label}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="block text-xs font-medium text-yecny-slate mb-1">
											Weekday
										</label>
										<select
											name="weekday"
											value={form.weekday}
											onChange={handleFormChange}
											className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
										>
											{WEEKDAY_OPTIONS.map((w) => (
												<option key={w.value} value={w.value}>
													{w.label}
												</option>
											))}
										</select>
									</div>
								</div>
							)}

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										First due date
									</label>
									<input
										type="date"
										name="next_run"
										value={form.next_run}
										onChange={handleFormChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
									/>
								</div>
								<div>
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										Assigned to
									</label>
									<select
										name="assigned_user_id"
										value={form.assigned_user_id}
										onChange={handleFormChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
									>
										<option value="">Use my user</option>
										{users.map((u) => (
											<option key={u.id} value={u.id}>
												{u.name}
											</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Default status
								</label>
								<select
									name="default_status"
									value={form.default_status}
									onChange={handleFormChange}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
								>
									<option value="new">New</option>
									<option value="in_progress">In progress</option>
									<option value="waiting_on_client">Waiting on client</option>
								</select>
							</div>

							<div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
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
										? editing
											? "Saving..."
											: "Creating..."
										: editing
										? "Save Changes"
										: "Create Rule"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

function NoneToNull(value) {
	return value === undefined ? null : value;
}

function PlaceholderTab({ title, children }) {
	return (
		<div className="bg-white rounded-xl shadow-sm border border-dashed border-slate-300 p-6 text-sm text-yecny-slate">
			<div className="font-semibold text-yecny-charcoal mb-2">{title}</div>
			<p>{children}</p>
		</div>
	);
}

function FieldDisplay({ label, value, transform }) {
	let display = value;
	if (value && transform) display = transform(value);

	return (
		<div>
			<div className="text-xs font-medium text-yecny-slate mb-0.5">{label}</div>
			{display ? (
				<div className="text-sm text-yecny-charcoal">{display}</div>
			) : (
				<div className="text-xs text-slate-400">Not set</div>
			)}
		</div>
	);
}

function capitalize(str) {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}
