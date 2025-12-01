// src/pages/ClientIntake.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const REPORT_FREQ_OPTIONS = [
	{ value: "", label: "Select frequency" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "annual", label: "Annual" },
];

const initialFormState = {
	// Business details
	legal_name: "",
	dba_name: "",
	business_address: "",
	tax_structure: "",
	owners: "",

	// Primary contact
	primary_contact_name: "",
	primary_contact_email: "",
	primary_contact_phone: "",

	// Bookkeeping start & access
	bookkeeping_start_date: "",
	qbo_exists: false,
	allow_login_access: true,

	// Banking & accounts
	num_checking: "",
	checking_banks: "",
	num_savings: "",
	savings_banks: "",
	num_credit_cards: "",
	credit_card_banks: "",
	loans: "",
	vehicles: "",
	assets: "",

	// Transaction behaviour / payments
	payment_methods: "",
	non_business_deposits: false,
	personal_expenses_in_business: false,
	business_expenses_in_personal: false,

	// Reporting / payroll
	report_frequency: "",
	income_tracking: "",
	payroll_provider: "",

	// Misc
	additional_notes: "",
};

function toIntOrNull(val) {
	if (val === "" || val === null || val === undefined) return null;
	const n = Number(val);
	return Number.isNaN(n) ? null : n;
}

export default function ClientIntake() {
	const navigate = useNavigate();

	const [form, setForm] = useState(initialFormState);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
		setError("");
		setSuccess("");
	};
	const buildPayload = () => ({
		legal_name: form.legal_name.trim(),
		dba_name: form.dba_name.trim() || null,
		business_address: form.business_address.trim() || null,
		tax_structure: form.tax_structure.trim() || null,
		owners: form.owners.trim() || null,

		primary_contact_name: form.primary_contact_name.trim() || null,
		primary_contact_email: form.primary_contact_email.trim() || null,
		primary_contact_phone: form.primary_contact_phone.trim() || null,

		bookkeeping_start_date: form.bookkeeping_start_date || null,
		qbo_exists: form.qbo_exists,
		allow_login_access: form.allow_login_access,

		num_checking: toIntOrNull(form.num_checking),
		checking_banks: form.checking_banks.trim() || null,
		num_savings: toIntOrNull(form.num_savings),
		savings_banks: form.savings_banks.trim() || null,
		num_credit_cards: toIntOrNull(form.num_credit_cards),
		credit_card_banks: form.credit_card_banks.trim() || null,
		loans: form.loans.trim() || null,
		vehicles: form.vehicles.trim() || null,
		assets: form.assets.trim() || null,

		payment_methods: form.payment_methods.trim() || null,
		non_business_deposits: form.non_business_deposits,
		personal_expenses_in_business: form.personal_expenses_in_business,
		business_expenses_in_personal: form.business_expenses_in_personal,

		report_frequency: form.report_frequency || null,
		income_tracking: form.income_tracking.trim() || null,
		payroll_provider: form.payroll_provider.trim() || null,

		additional_notes: form.additional_notes.trim() || null,
	});

	const saveIntake = async (exitAfter = false) => {
		setSaving(true);
		setError("");
		setSuccess("");

		if (!form.legal_name.trim()) {
			setSaving(false);
			setError("Legal business name is required.");
			return;
		}

		const payload = buildPayload();

		try {
			await api.post("/intake", payload);
			if (exitAfter) {
				navigate("/clients/intake");
			} else {
				setSuccess("Intake saved successfully.");
			}
		} catch (err) {
			console.error(err);
			setError("Failed to save intake. Please double-check the fields.");
		} finally {
			setSaving(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		await saveIntake(false);
	};

	const handleSaveAndExit = async () => {
		await saveIntake(true);
	};

	const handleClear = () => {
		setForm(initialFormState);
		setError("");
		setSuccess("");
	};

	const handleBackToList = () => {
		navigate("/clients/intake");
	};

	return (
		<div className="space-y-5">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div>
					<button
						type="button"
						onClick={handleBackToList}
						className="text-xs text-yecny-slate hover:text-yecny-charcoal mb-2"
					>
						Back to intake list
					</button>
					<div className="text-xs uppercase tracking-[0.18em] text-yecny-slate mb-1">
						Client intake
					</div>
					<h1 className="text-2xl font-semibold text-yecny-charcoal">
						New intake form
					</h1>
					<p className="text-xs text-yecny-slate mt-1 max-w-xl">
						Use this form during discovery calls to capture all the details you
						need before creating a client in Yecny OS.
					</p>
				</div>
			</div>

			{/* Alerts */}
			{(error || success) && (
				<div className="space-y-2">
					{error && (
						<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
							{error}
						</div>
					)}
					{success && (
						<div className="text-xs px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
							{success}
						</div>
					)}
				</div>
			)}

			{/* Form */}
			<form
				onSubmit={handleSubmit}
				className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8"
			>
				{/* Business details */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Business details
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							Core information about the business.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Legal business name <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								name="legal_name"
								value={form.legal_name}
								onChange={handleChange}
								placeholder="Example: Amazon LLC"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
								required
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								DBA name
							</label>
							<input
								type="text"
								name="dba_name"
								value={form.dba_name}
								onChange={handleChange}
								placeholder="Doing business as..."
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Tax structure / entity type
							</label>
							<input
								type="text"
								name="tax_structure"
								value={form.tax_structure}
								onChange={handleChange}
								placeholder="Single-member LLC, S-Corp, Partnership..."
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Owners & ownership %
							</label>
							<textarea
								name="owners"
								value={form.owners}
								onChange={handleChange}
								rows={3}
								placeholder="List owners and approximate ownership percentages."
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div className="md:col-span-2">
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Business address
							</label>
							<input
								type="text"
								name="business_address"
								value={form.business_address}
								onChange={handleChange}
								placeholder="Street, City, State, ZIP"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
					</div>
				</section>

				{/* Contact details */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Primary contact
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							Who should Yecny reach out to with questions?
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Contact name
							</label>
							<input
								type="text"
								name="primary_contact_name"
								value={form.primary_contact_name}
								onChange={handleChange}
								placeholder="Full name"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Email
							</label>
							<input
								type="email"
								name="primary_contact_email"
								value={form.primary_contact_email}
								onChange={handleChange}
								placeholder="name@example.com"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Phone
							</label>
							<input
								type="tel"
								name="primary_contact_phone"
								value={form.primary_contact_phone}
								onChange={handleChange}
								placeholder="Best contact number"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
					</div>
				</section>

				{/* Bookkeeping start & access */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Bookkeeping start & access
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							When should we start, and what systems are already in place?
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Bookkeeping start date
							</label>
							<input
								type="date"
								name="bookkeeping_start_date"
								value={form.bookkeeping_start_date}
								onChange={handleChange}
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div className="flex items-center gap-2 mt-6">
							<input
								id="qbo_exists"
								type="checkbox"
								name="qbo_exists"
								checked={form.qbo_exists}
								onChange={handleChange}
								className="h-4 w-4 border-slate-300 rounded"
							/>
							<label
								htmlFor="qbo_exists"
								className="text-xs text-yecny-slate select-none"
							>
								Client already has QuickBooks Online
							</label>
						</div>

						<div className="flex items-center gap-2 mt-6">
							<input
								id="allow_login_access"
								type="checkbox"
								name="allow_login_access"
								checked={form.allow_login_access}
								onChange={handleChange}
								className="h-4 w-4 border-slate-300 rounded"
							/>
							<label
								htmlFor="allow_login_access"
								className="text-xs text-yecny-slate select-none"
							>
								Client will grant us access to bank logins
							</label>
						</div>
					</div>
				</section>
				{/* Banking & accounts */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Banking & accounts
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							How many accounts are we tracking, and where are they held?
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								# of business checking accounts
							</label>
							<input
								type="number"
								name="num_checking"
								value={form.num_checking}
								onChange={handleChange}
								min="0"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div className="md:col-span-2">
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Checking banks
							</label>
							<input
								type="text"
								name="checking_banks"
								value={form.checking_banks}
								onChange={handleChange}
								placeholder="Example: Wells Fargo, Chase"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								# of business savings accounts
							</label>
							<input
								type="number"
								name="num_savings"
								value={form.num_savings}
								onChange={handleChange}
								min="0"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div className="md:col-span-2">
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Savings banks
							</label>
							<input
								type="text"
								name="savings_banks"
								value={form.savings_banks}
								onChange={handleChange}
								placeholder="Banks where savings accounts are held"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								# of business credit cards
							</label>
							<input
								type="number"
								name="num_credit_cards"
								value={form.num_credit_cards}
								onChange={handleChange}
								min="0"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
						<div className="md:col-span-2">
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Credit card banks
							</label>
							<input
								type="text"
								name="credit_card_banks"
								value={form.credit_card_banks}
								onChange={handleChange}
								placeholder="Example: AmEx, Chase, Citi"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>

						<div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Loans
								</label>
								<textarea
									name="loans"
									value={form.loans}
									onChange={handleChange}
									rows={3}
									placeholder="Any loans associated with the business."
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Vehicles
								</label>
								<textarea
									name="vehicles"
									value={form.vehicles}
									onChange={handleChange}
									rows={3}
									placeholder="Business vehicles, leases, etc."
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Other assets
								</label>
								<textarea
									name="assets"
									value={form.assets}
									onChange={handleChange}
									rows={3}
									placeholder="Any other significant business assets."
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Transaction behavior */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Transaction behavior & payments
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							How money flows in and out of the business.
						</p>
					</div>

					<div className="space-y-4">
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								How do they typically get paid?
							</label>
							<textarea
								name="payment_methods"
								value={form.payment_methods}
								onChange={handleChange}
								rows={3}
								placeholder="ACH, checks, cash deposits, merchant services (Square, Stripe, etc.)"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<label className="flex items-start gap-2 text-xs text-yecny-slate">
								<input
									type="checkbox"
									name="non_business_deposits"
									checked={form.non_business_deposits}
									onChange={handleChange}
									className="mt-0.5 h-4 w-4 border-slate-300 rounded"
								/>
								<span>
									They sometimes deposit non-business funds into business
									accounts.
								</span>
							</label>

							<label className="flex items-start gap-2 text-xs text-yecny-slate">
								<input
									type="checkbox"
									name="personal_expenses_in_business"
									checked={form.personal_expenses_in_business}
									onChange={handleChange}
									className="mt-0.5 h-4 w-4 border-slate-300 rounded"
								/>
								<span>
									They sometimes pay personal expenses from business accounts.
								</span>
							</label>

							<label className="flex items-start gap-2 text-xs text-yecny-slate">
								<input
									type="checkbox"
									name="business_expenses_in_personal"
									checked={form.business_expenses_in_personal}
									onChange={handleChange}
									className="mt-0.5 h-4 w-4 border-slate-300 rounded"
								/>
								<span>
									They sometimes pay business expenses from personal accounts.
								</span>
							</label>
						</div>
					</div>
				</section>

				{/* Reporting & payroll */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Reporting & payroll
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							How often they want reports and how payroll is handled.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Report frequency
							</label>
							<select
								name="report_frequency"
								value={form.report_frequency}
								onChange={handleChange}
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							>
								{REPORT_FREQ_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								How should income be tracked?
							</label>
							<textarea
								name="income_tracking"
								value={form.income_tracking}
								onChange={handleChange}
								rows={3}
								placeholder="Ex: Consulting income, product income, management income..."
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-yecny-slate mb-1">
								Payroll provider
							</label>
							<input
								type="text"
								name="payroll_provider"
								value={form.payroll_provider}
								onChange={handleChange}
								placeholder="If they have payroll, who runs it?"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>
						</div>
					</div>
				</section>

				{/* Additional notes */}
				<section className="space-y-4">
					<div>
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Additional notes
						</h2>
						<p className="text-xs text-yecny-slate mt-1">
							Any extra context that will help with onboarding or ongoing work.
						</p>
					</div>

					<textarea
						name="additional_notes"
						value={form.additional_notes}
						onChange={handleChange}
						rows={5}
						placeholder="Anything else we should know?"
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
					/>
				</section>

				{/* Actions */}
				<div className="pt-4 border-t border-slate-200 flex justify-between items-center gap-3">
					<button
						type="button"
						onClick={handleBackToList}
						className="text-xs text-yecny-slate hover:text-yecny-charcoal"
					>
						Back to Intake List
					</button>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleClear}
							className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-yecny-slate hover:bg-slate-50"
						>
							Clear form
						</button>
						<button
							type="button"
							onClick={handleSaveAndExit}
							disabled={saving}
							className="px-4 py-2 rounded-md bg-white border border-yecny-primary text-yecny-primary text-sm font-medium hover:bg-yecny-primary-soft/20 disabled:opacity-60"
						>
							{saving ? "Saving..." : "Save & exit"}
						</button>
						<button
							type="submit"
							disabled={saving}
							className="px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark disabled:opacity-60"
						>
							{saving ? "Saving..." : "Save intake"}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
}
