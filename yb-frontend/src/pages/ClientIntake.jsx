// src/pages/ClientIntake.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
const STEPS = [
	{ key: "biz", label: "Business & contacts" },
	{ key: "start", label: "Starting point" },
	{ key: "accounts", label: "Accounts" },
	{ key: "access", label: "Access & systems" },
	{ key: "scope", label: "Reporting & scope" },
	{ key: "wrap", label: "Recurring & notes" },
	{ key: "review", label: "Review" },
];

const REPORT_FREQ_OPTIONS = [
	{ value: "", label: "Select frequency" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "annual", label: "Annual" },
];

const MONTHLY_CLOSE_TIER_OPTIONS = [
	{ value: "", label: "Select due-by tier" },
	{ value: "5th", label: "Due by 5th" },
	{ value: "10th", label: "Due by 10th" },
	{ value: "15th", label: "Due by 15th" },
];

const PAYROLL_PROVIDER_OPTIONS = [
	{ value: "", label: "Select provider" },
	{ value: "gusto", label: "Gusto" },
	{ value: "quickbooks_payroll", label: "QuickBooks Payroll" },
	{ value: "adp", label: "ADP" },
	{ value: "paychex", label: "Paychex" },
	{ value: "other", label: "Other / Add new" },
];

const BANK_OPTIONS = [
	{ value: "", label: "Select bank" },
	{ value: "wells_fargo", label: "Wells Fargo" },
	{ value: "chase", label: "Chase" },
	{ value: "bank_of_america", label: "Bank of America" },
	{ value: "capital_one", label: "Capital One" },
	{ value: "american_express", label: "American Express" },
	{ value: "other", label: "Other / Add new" },
];

const getBankLabel = (value) => {
	const opt = BANK_OPTIONS.find((o) => o.value === value);
	return opt?.label || "";
};

const initialFormState = {
	// Business details
	legal_name: "",
	dba_name: "",
	business_address: "",
	tax_structure: "",
	owners: "",
	tax_id: "",
	cpa_contact_id: "",

	// Primary contact
	primary_contact_name: "",
	primary_contact_email: "",
	primary_contact_phone: "",
	primary_contact_id: "",

	// Bookkeeping start & access
	bookkeeping_start_date: "",
	qbo_status: "",
	qbo_num_users: "",
	qbo_needs_class_tracking: false,
	qbo_needs_location_tracking: false,
	qbo_num_classes: "",
	qbo_num_locations: "",
	allow_login_access: true,
	manager_id: "",
	bookkeeper_id: "",

	// Banking & accounts
	num_checking: "",
	checking_banks: "",
	checking_banks_other: "",

	num_savings: "",
	savings_banks: "",
	savings_banks_other: "",

	num_credit_cards: "",
	credit_card_banks: "",
	credit_card_banks_other: "",

	loans: "",
	vehicles: "",
	assets: "",
	monthly_close_tier: "",

	// Transaction behaviour / payments
	payment_methods: "",
	non_business_deposits: false,
	personal_expenses_in_business: false,
	business_expenses_in_personal: false,

	// Details for those checkboxes
	non_business_deposits_details: "",
	personal_expenses_in_business_details: "",
	business_expenses_in_personal_details: "",

	// Reporting / payroll
	report_frequency: "",
	income_tracking: "",
	payroll_provider: "",
	payroll_provider_other: "",

	// Payroll services
	payroll_needs_setup: false,
	payroll_process_regular: false,
	payroll_corrections_adjustments: false,
	payroll_quarterly_filings: false,
	payroll_state_local_payments: false,
	payroll_calculate_hours_commission: false,

	// Custom Recurring Rules
	custom_recurring_rules: [],
	// Misc
	additional_notes: "",
};

function toIntOrNull(val) {
	if (val === "" || val === null || val === undefined) return null;
	const n = Number(val);
	return Number.isNaN(n) ? null : n;
}

function computeQboRecommendation(form) {
	if (form.qbo_status !== "no") return null;

	const numUsers = toIntOrNull(form.qbo_num_users) || 1;
	const needsClass = !!form.qbo_needs_class_tracking;
	const needsLocation = !!form.qbo_needs_location_tracking;

	const numClasses = toIntOrNull(form.qbo_num_classes) || 0;
	const numLocations = toIntOrNull(form.qbo_num_locations) || 0;

	// Base recommendation by user count
	let subscription = "Simple Start";
	if (numUsers >= 2 && numUsers <= 3) subscription = "Essentials";
	if (numUsers >= 4 && numUsers <= 5) subscription = "Plus";
	if (numUsers > 5) subscription = "Advanced";

	// Force minimum Plus if class/location tracking needed
	if (
		(needsClass || needsLocation) &&
		(subscription === "Simple Start" || subscription === "Essentials")
	) {
		subscription = "Plus";
	}

	// Force Advanced if > 40 classes or locations
	if ((needsClass && numClasses > 40) || (needsLocation && numLocations > 40)) {
		subscription = "Advanced";
	}

	return subscription;
}

// Helper: map stored string -> {selectValue, otherText}F
function resolveStringToSelectAndOther(stored, options) {
	const trimmed = (stored || "").trim();
	if (!trimmed) return { value: "", otherText: "" };

	const match = options.find(
		(opt) => opt.label === trimmed || opt.value === trimmed
	);
	if (match) return { value: match.value, otherText: "" };

	return { value: "other", otherText: trimmed };
}

export default function ClientIntake() {
	const navigate = useNavigate();
	const { intakeId } = useParams();
	const isEditing = Boolean(intakeId);

	const [form, setForm] = useState(initialFormState);
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [stepIdx, setStepIdx] = useState(0);
	const step = STEPS[stepIdx];

	const goNext = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
	const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));
	const validateStep = (key) => {
		// return a string message if invalid, otherwise null
		if (key === "biz") {
			if (!form.legal_name.trim()) return "Legal business name is required.";
			return null;
		}

		if (key === "start") {
			if (!form.qbo_status)
				return "Please choose a QBO status (Yes / No / Unsure).";

			if (form.qbo_status === "no") {
				if (
					form.qbo_needs_class_tracking &&
					!String(form.qbo_num_classes || "").trim()
				) {
					return "Please enter an approximate # of classes (or uncheck class tracking).";
				}
				if (
					form.qbo_needs_location_tracking &&
					!String(form.qbo_num_locations || "").trim()
				) {
					return "Please enter an approximate # of locations (or uncheck location tracking).";
				}
			}

			return null;
		}

		if (key === "accounts") {
			const needsBankIfCount = (countStr, bankVal, label) => {
				const n = toIntOrNull(countStr) || 0;
				if (n > 0 && !bankVal)
					return `Please select a bank for ${label} (or set the count to 0).`;
				return null;
			};

			if (!checkingMulti) {
				const msg = needsBankIfCount(
					form.num_checking,
					form.checking_banks,
					"checking"
				);
				if (msg) return msg;
			}
			if (!savingsMulti) {
				const msg = needsBankIfCount(
					form.num_savings,
					form.savings_banks,
					"savings"
				);
				if (msg) return msg;
			}
			if (!creditMulti) {
				const msg = needsBankIfCount(
					form.num_credit_cards,
					form.credit_card_banks,
					"credit cards"
				);
				if (msg) return msg;
			}

			return null;
		}

		if (key === "scope") {
			if (form.report_frequency === "monthly" && !form.monthly_close_tier) {
				return "Monthly close tier is required when Report frequency is Monthly.";
			}
			if (
				form.payroll_provider === "other" &&
				!form.payroll_provider_other.trim()
			) {
				return "Please enter the payroll provider name (or pick one from the list).";
			}
			return null;
		}

		if (key === "wrap") {
			const rules = form.custom_recurring_rules || [];
			for (const r of rules) {
				if (!String(r.title || "").trim())
					return "Custom recurring tasks: Task name is required.";
				const dom = Number(r.day_of_month);
				if (!Number.isFinite(dom) || dom < 1 || dom > 31) {
					return "Custom recurring tasks: Day of month must be 1-31.";
				}
			}
			return null;
		}

		return null;
	};

	const jumpToStep = (targetIdx) => {
		// if jumping forward, validate current step first
		if (targetIdx > stepIdx) {
			const msg = validateStep(step.key);
			if (msg) {
				setError(msg);
				return;
			}
		}
		setError("");
		setSuccess("");
		setStepIdx(targetIdx);
	};

	const handleNextStep = () => {
		const msg = validateStep(step.key);
		if (msg) {
			setError(msg);
			return;
		}
		setError("");
		setSuccess("");
		goNext();
	};

	// Contacts for dropdown
	const [contacts, setContacts] = useState([]);
	const [contactsLoading, setContactsLoading] = useState(false);
	const [contactsError, setContactsError] = useState("");

	// Users for manager/bookkeeper dropdowns
	const [users, setUsers] = useState([]);
	const [usersLoading, setUsersLoading] = useState(false);
	const [usersError, setUsersError] = useState("");

	// Multiple-bank mode toggles + rows
	const [checkingMulti, setCheckingMulti] = useState(false);
	const [checkingRows, setCheckingRows] = useState([{ bank: "", count: 1 }]);

	const [savingsMulti, setSavingsMulti] = useState(false);
	const [savingsRows, setSavingsRows] = useState([{ bank: "", count: 1 }]);

	const [creditMulti, setCreditMulti] = useState(false);
	const [creditRows, setCreditRows] = useState([{ bank: "", count: 1 }]);

	const updateCheckingRow = (index, field, value) => {
		setCheckingRows((rows) =>
			rows.map((r, i) =>
				i === index
					? {
							...r,
							[field]: field === "count" ? Number(value) || 0 : value,
					  }
					: r
			)
		);
	};
	const addCheckingRow = () => {
		setCheckingRows((rows) => [...rows, { bank: "", count: 1 }]);
	};
	const removeCheckingRow = (index) => {
		setCheckingRows((rows) => {
			if (rows.length === 1) return rows;
			return rows.filter((_, i) => i !== index);
		});
	};

	const updateSavingsRow = (index, field, value) => {
		setSavingsRows((rows) =>
			rows.map((r, i) =>
				i === index
					? {
							...r,
							[field]: field === "count" ? Number(value) || 0 : value,
					  }
					: r
			)
		);
	};
	const addSavingsRow = () => {
		setSavingsRows((rows) => [...rows, { bank: "", count: 1 }]);
	};
	const removeSavingsRow = (index) => {
		setSavingsRows((rows) => {
			if (rows.length === 1) return rows;
			return rows.filter((_, i) => i !== index);
		});
	};
	const updateCreditRow = (index, field, value) => {
		setCreditRows((rows) =>
			rows.map((r, i) =>
				i === index
					? {
							...r,
							[field]: field === "count" ? Number(value) || 0 : value,
					  }
					: r
			)
		);
	};
	const addCreditRow = () => {
		setCreditRows((rows) => [...rows, { bank: "", count: 1 }]);
	};
	const removeCreditRow = (index) => {
		setCreditRows((rows) => {
			if (rows.length === 1) return rows;
			return rows.filter((_, i) => i !== index);
		});
	};

	useEffect(() => {
		const loadContacts = async () => {
			setContactsLoading(true);
			setContactsError("");
			try {
				const res = await api.get("/contacts");
				setContacts(res.data || []);
			} catch (err) {
				console.error(err);
				setContactsError("Failed to load contacts list.");
			} finally {
				setContactsLoading(false);
			}
		};

		const loadUsers = async () => {
			setUsersLoading(true);
			setUsersError("");
			try {
				const res = await api.get("/users");
				setUsers(res.data || []);
			} catch (err) {
				console.error(err);
				setUsersError("Failed to load users list.");
			} finally {
				setUsersLoading(false);
			}
		};

		const loadIntake = async () => {
			if (!isEditing) return;
			setLoading(true);
			setError("");
			try {
				const res = await api.get(`/intake/${intakeId}`);
				const intake = res.data;

				const {
					legal_name,
					dba_name,
					business_address,
					tax_structure,
					tax_id,
					owners,
					primary_contact_name,
					primary_contact_email,
					primary_contact_phone,
					bookkeeping_start_date,
					qbo_exists,
					qbo_status,
					qbo_num_users,
					qbo_needs_class_tracking,
					qbo_needs_location_tracking,
					qbo_num_classes,
					qbo_num_locations,

					allow_login_access,
					num_checking,
					checking_banks,
					num_savings,
					savings_banks,
					num_credit_cards,
					credit_card_banks,
					loans,
					vehicles,
					assets,
					payment_methods,
					non_business_deposits,
					personal_expenses_in_business,
					business_expenses_in_personal,
					report_frequency,
					monthly_close_tier,
					income_tracking,
					payroll_provider,
					payroll_needs_setup,
					payroll_process_regular,
					payroll_corrections_adjustments,
					payroll_quarterly_filings,
					payroll_state_local_payments,
					payroll_calculate_hours_commission,
					custom_recurring_rules,
					additional_notes,
				} = intake;

				const checkingResolved = resolveStringToSelectAndOther(
					checking_banks,
					BANK_OPTIONS
				);
				const savingsResolved = resolveStringToSelectAndOther(
					savings_banks,
					BANK_OPTIONS
				);
				const creditResolved = resolveStringToSelectAndOther(
					credit_card_banks,
					BANK_OPTIONS
				);
				const payrollResolved = resolveStringToSelectAndOther(
					payroll_provider,
					PAYROLL_PROVIDER_OPTIONS
				);

				setForm((prev) => ({
					...prev,
					legal_name: legal_name || "",
					dba_name: dba_name || "",
					tax_id: tax_id || "",
					business_address: business_address || "",
					tax_structure: tax_structure || "",
					owners: owners || "",
					primary_contact_name: primary_contact_name || "",
					primary_contact_email: primary_contact_email || "",
					primary_contact_phone: primary_contact_phone || "",
					bookkeeping_start_date: bookkeeping_start_date || "",
					qbo_status: intake.qbo_status
						? intake.qbo_status
						: qbo_exists === true
						? "yes"
						: qbo_exists === false
						? "no"
						: "",

					qbo_num_users:
						qbo_num_users === null || qbo_num_users === undefined
							? ""
							: String(qbo_num_users),
					qbo_needs_class_tracking: !!qbo_needs_class_tracking,
					qbo_needs_location_tracking: !!qbo_needs_location_tracking,
					qbo_num_classes:
						qbo_num_classes === null || qbo_num_classes === undefined
							? ""
							: String(qbo_num_classes),
					qbo_num_locations:
						qbo_num_locations === null || qbo_num_locations === undefined
							? ""
							: String(qbo_num_locations),
					allow_login_access:
						allow_login_access === null || allow_login_access === undefined
							? true
							: allow_login_access,

					// IMPORTANT: intake -> form assignment fields
					manager_id: intake.manager_id ? String(intake.manager_id) : "",
					bookkeeper_id: intake.bookkeeper_id
						? String(intake.bookkeeper_id)
						: "",

					num_checking:
						num_checking === null || num_checking === undefined
							? ""
							: String(num_checking),
					checking_banks: checkingResolved.value,
					checking_banks_other: checkingResolved.otherText,

					num_savings:
						num_savings === null || num_savings === undefined
							? ""
							: String(num_savings),
					savings_banks: savingsResolved.value,
					savings_banks_other: savingsResolved.otherText,
					num_credit_cards:
						num_credit_cards === null || num_credit_cards === undefined
							? ""
							: String(num_credit_cards),
					credit_card_banks: creditResolved.value,
					credit_card_banks_other: creditResolved.otherText,

					loans: loans || "",
					vehicles: vehicles || "",
					assets: assets || "",

					payment_methods: payment_methods || "",
					non_business_deposits: !!non_business_deposits,
					personal_expenses_in_business: !!personal_expenses_in_business,
					business_expenses_in_personal: !!business_expenses_in_personal,

					report_frequency: report_frequency || "",
					monthly_close_tier: monthly_close_tier || "",
					income_tracking: income_tracking || "",

					payroll_provider: payrollResolved.value,
					payroll_provider_other: payrollResolved.otherText,

					payroll_needs_setup: !!payroll_needs_setup,
					payroll_process_regular: !!payroll_process_regular,
					payroll_corrections_adjustments: !!payroll_corrections_adjustments,
					payroll_quarterly_filings: !!payroll_quarterly_filings,
					payroll_state_local_payments: !!payroll_state_local_payments,
					payroll_calculate_hours_commission:
						!!payroll_calculate_hours_commission,
					custom_recurring_rules: Array.isArray(custom_recurring_rules)
						? custom_recurring_rules
						: [],
					additional_notes: additional_notes || "",
				}));

				setCheckingMulti(false);
				setSavingsMulti(false);
				setCreditMulti(false);
				setCheckingRows([{ bank: "", count: 1 }]);
				setSavingsRows([{ bank: "", count: 1 }]);
				setCreditRows([{ bank: "", count: 1 }]);
			} catch (err) {
				console.error(err);
				setError("Failed to load intake.");
			} finally {
				setLoading(false);
			}
		};

		loadContacts();
		loadUsers();
		loadIntake();
	}, [isEditing, intakeId]);

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;

		if (name === "primary_contact_id") {
			const selected = contacts.find((c) => String(c.id) === value);

			setForm((prev) => ({
				...prev,
				primary_contact_id: value,
				primary_contact_name: selected?.name ?? prev.primary_contact_name,
				primary_contact_email: selected?.email ?? prev.primary_contact_email,
				primary_contact_phone: selected?.phone ?? prev.primary_contact_phone,
			}));
		} else if (name === "report_frequency") {
			setForm((prev) => ({
				...prev,
				report_frequency: value,
				monthly_close_tier: value === "monthly" ? prev.monthly_close_tier : "",
			}));
		} else if (name === "qbo_needs_class_tracking") {
			setForm((prev) => ({
				...prev,
				qbo_needs_class_tracking: checked,
				qbo_num_classes: checked ? prev.qbo_num_classes : "",
			}));
		} else if (name === "qbo_needs_location_tracking") {
			setForm((prev) => ({
				...prev,
				qbo_needs_location_tracking: checked,
				qbo_num_locations: checked ? prev.qbo_num_locations : "",
			}));
		} else {
			setForm((prev) => ({
				...prev,
				[name]: type === "checkbox" ? checked : value,
			}));
		}

		setError("");
		setSuccess("");
	};
	const buildPayload = () => {
		const resolveBankField = (choiceValue, otherText) => {
			const trimmedOther = (otherText || "").trim();

			if (!choiceValue) {
				return trimmedOther || null;
			}
			if (choiceValue === "other") {
				return trimmedOther || null;
			}
			const label = getBankLabel(choiceValue);
			return label || trimmedOther || null;
		};

		const payrollProviderFinal =
			form.payroll_provider === "other"
				? form.payroll_provider_other.trim() || null
				: form.payroll_provider.trim() || null;

		let additional = form.additional_notes.trim();

		const appendDetail = (label, enabled, text) => {
			const t = (text || "").trim();
			if (!enabled || !t) return;
			if (additional) additional += "\n\n";
			additional += `[${label}] ${t}`;
		};

		appendDetail(
			"Non-business deposits into business accounts",
			form.non_business_deposits,
			form.non_business_deposits_details
		);
		appendDetail(
			"Personal expenses paid from business accounts",
			form.personal_expenses_in_business,
			form.personal_expenses_in_business_details
		);
		appendDetail(
			"Business expenses paid from personal accounts",
			form.business_expenses_in_personal,
			form.business_expenses_in_personal_details
		);

		const expandBankRows = (rows) => {
			const expanded = [];
			let total = 0;

			for (const row of rows) {
				const cnt = Math.max(0, Number(row.count) || 0);
				if (!cnt) continue;

				let label = "";
				if (row.bank === "other") {
					label = "Other Bank";
				} else {
					const opt = BANK_OPTIONS.find((o) => o.value === row.bank);
					label = opt?.label || "";
				}
				if (!label) continue;

				for (let i = 0; i < cnt; i++) {
					expanded.push(label);
				}
				total += cnt;
			}

			return { expanded, total };
		};
		const qboRecommendation = computeQboRecommendation(form);
		const qboExists =
			form.qbo_status === "yes"
				? true
				: form.qbo_status === "no"
				? false
				: null;

		return {
			legal_name: form.legal_name.trim(),
			dba_name: form.dba_name.trim() || null,
			business_address: form.business_address.trim() || null,
			tax_id: form.tax_id.trim() || null,
			tax_structure: form.tax_structure.trim() || null,
			owners: form.owners.trim() || null,

			primary_contact_name: form.primary_contact_name.trim() || null,
			primary_contact_email: form.primary_contact_email.trim() || null,
			primary_contact_phone: form.primary_contact_phone.trim() || null,
			primary_contact_id: form.primary_contact_id
				? Number(form.primary_contact_id)
				: null,
			cpa_contact_id: form.cpa_contact_id ? Number(form.cpa_contact_id) : null,

			bookkeeping_start_date: form.bookkeeping_start_date || null,
			qbo_exists: qboExists,
			allow_login_access: form.allow_login_access,
			manager_id: form.manager_id ? Number(form.manager_id) : null,
			bookkeeper_id: form.bookkeeper_id ? Number(form.bookkeeper_id) : null,

			monthly_close_tier:
				form.report_frequency === "monthly"
					? form.monthly_close_tier || null
					: null,
			qbo_status: form.qbo_status || null,
			qbo_num_users: toIntOrNull(form.qbo_num_users),
			qbo_needs_class_tracking: form.qbo_needs_class_tracking,
			qbo_needs_location_tracking: form.qbo_needs_location_tracking,
			qbo_recommended_subscription: qboRecommendation,
			qbo_num_classes: toIntOrNull(form.qbo_num_classes),
			qbo_num_locations: toIntOrNull(form.qbo_num_locations),
			// Checking
			...(checkingMulti
				? (() => {
						const { expanded, total } = expandBankRows(checkingRows);
						return {
							num_checking: total || null,
							checking_banks: expanded.length ? expanded.join(", ") : null,
						};
				  })()
				: {
						num_checking: toIntOrNull(form.num_checking),
						checking_banks: resolveBankField(
							form.checking_banks,
							form.checking_banks_other
						),
				  }),

			// Savings
			...(savingsMulti
				? (() => {
						const { expanded, total } = expandBankRows(savingsRows);
						return {
							num_savings: total || null,
							savings_banks: expanded.length ? expanded.join(", ") : null,
						};
				  })()
				: {
						num_savings: toIntOrNull(form.num_savings),
						savings_banks: resolveBankField(
							form.savings_banks,
							form.savings_banks_other
						),
				  }),
			// Credit cards
			...(creditMulti
				? (() => {
						const { expanded, total } = expandBankRows(creditRows);
						return {
							num_credit_cards: total || null,
							credit_card_banks: expanded.length ? expanded.join(", ") : null,
						};
				  })()
				: {
						num_credit_cards: toIntOrNull(form.num_credit_cards),
						credit_card_banks: resolveBankField(
							form.credit_card_banks,
							form.credit_card_banks_other
						),
				  }),

			loans: form.loans.trim() || null,
			vehicles: form.vehicles.trim() || null,
			assets: form.assets.trim() || null,

			payment_methods: form.payment_methods.trim() || null,
			non_business_deposits: form.non_business_deposits,
			personal_expenses_in_business: form.personal_expenses_in_business,
			business_expenses_in_personal: form.business_expenses_in_personal,

			report_frequency: form.report_frequency || null,
			income_tracking: form.income_tracking.trim() || null,
			payroll_provider: payrollProviderFinal,

			payroll_needs_setup: form.payroll_needs_setup,
			payroll_process_regular: form.payroll_process_regular,
			payroll_corrections_adjustments: form.payroll_corrections_adjustments,
			payroll_quarterly_filings: form.payroll_quarterly_filings,
			payroll_state_local_payments: form.payroll_state_local_payments,
			payroll_calculate_hours_commission:
				form.payroll_calculate_hours_commission,
			custom_recurring_rules: form.custom_recurring_rules || [],
			additional_notes: additional || null,
		};
	};

	const saveIntake = async ({
		exitAfter = false,
		convertAfter = false,
	} = {}) => {
		setSaving(true);
		setError("");
		setSuccess("");

		if (!form.legal_name.trim()) {
			setSaving(false);
			setError("Legal business name is required.");
			return;
		}
		if (form.report_frequency === "monthly" && !form.monthly_close_tier) {
			setSaving(false);
			setError(
				"Monthly close tier is required when Report frequency is Monthly."
			);
			return;
		}

		if (convertAfter && (!form.manager_id || !form.bookkeeper_id)) {
			setSaving(false);
			setError(
				"Manager and Bookkeeper must be assigned before converting to a client."
			);
			return;
		}
		try {
			const payload = buildPayload(); // ? build first

			let res;
			if (isEditing) {
				// Update existing intake
				res = await api.put(`/intake/${intakeId}`, payload);
			} else {
				// Create new intake
				res = await api.post("/intake", payload);
			}

			const intake = res.data;

			if (convertAfter) {
				const targetIntakeId = isEditing ? Number(intakeId) : intake.id;
				try {
					const convertRes = await api.post(
						`/intake/${targetIntakeId}/convert-to-client`,
						{
							manager_id: form.manager_id ? Number(form.manager_id) : null,
							bookkeeper_id: form.bookkeeper_id
								? Number(form.bookkeeper_id)
								: null,
						}
					);
					const client = convertRes.data;
					navigate(`/clients/${client.id}`);
					return;
				} catch (err) {
					console.error(err);
					setError(
						"Intake saved, but converting to a client failed. You can try again from the intake list."
					);
					setSuccess("Intake saved successfully.");
					return;
				}
			}

			if (exitAfter) {
				navigate("/clients/intake");
			} else {
				setSuccess(
					isEditing
						? "Intake updated successfully."
						: "Intake saved successfully."
				);
			}
		} catch (err) {
			console.error("Failed to save intake:", err);
			setError("Failed to save intake. Please double-check the fields.");
		} finally {
			setSaving(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		await saveIntake({ exitAfter: false, convertAfter: false });
	};

	const handleSaveAndExit = async () => {
		await saveIntake({ exitAfter: true, convertAfter: false });
	};

	const handleSaveAndConvert = async () => {
		await saveIntake({ convertAfter: true });
	};

	const handleClear = () => {
		setForm(initialFormState);
		setError("");
		setSuccess("");
	};

	const handleBackToList = () => {
		navigate("/clients/intake");
	};

	if (loading) {
		return <div className="text-xs text-yecny-slate">Loading intake...</div>;
	}
	const addCustomRecurringRule = () => {
		setForm((prev) => ({
			...prev,
			custom_recurring_rules: [
				...(prev.custom_recurring_rules || []),
				{
					title: "",
					description: "",
					schedule_type: "monthly",
					day_of_month: 25,
					assigned_user_id: "",
				},
			],
		}));
	};

	const updateCustomRecurringRule = (idx, field, value) => {
		setForm((prev) => {
			const copy = [...(prev.custom_recurring_rules || [])];
			copy[idx] = { ...copy[idx], [field]: value };
			return { ...prev, custom_recurring_rules: copy };
		});
	};

	const removeCustomRecurringRule = (idx) => {
		setForm((prev) => {
			const copy = [...(prev.custom_recurring_rules || [])];
			copy.splice(idx, 1);
			return { ...prev, custom_recurring_rules: copy };
		});
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
						{isEditing ? "Edit intake" : "New intake form"}
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

			{/* Step pills */}
			<div className="flex flex-wrap gap-2">
				{STEPS.map((s, i) => (
					<button
						key={s.key}
						type="button"
						onClick={() => jumpToStep(i)}
						className={`text-[11px] px-3 py-1.5 rounded-full border ${
							i === stepIdx
								? "bg-yecny-primary text-white border-yecny-primary"
								: "bg-white text-yecny-slate border-slate-200 hover:bg-slate-50"
						}`}
					>
						{i + 1}. {s.label}
					</button>
				))}
			</div>

			{/* Form */}
			<form
				onSubmit={handleSubmit}
				className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8"
			>
				{/* STEP: Business & contacts */}
				{step.key === "biz" && (
					<>
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
										Tax ID (EIN, SSN, etc.)
									</label>
									<input
										type="text"
										name="tax_id"
										value={form.tax_id}
										onChange={handleChange}
										placeholder="Employer Identification Number or SSN"
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-yecny-slate mb-1">
										Owners &amp; ownership %
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

						{/* Primary contact */}
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Primary contact
								</h2>
								<p className="text-xs text-yecny-slate mt-1">
									Who should Yecny reach out to with questions?
								</p>
							</div>
							<div className="space-y-3">
								{/* Link to existing contact */}
								<div className="flex flex-col sm:flex-row sm:items-end sm:gap-3">
									<div className="flex-1">
										<label className="block text-xs font-medium text-yecny-slate mb-1">
											Link to existing contact (optional)
										</label>
										<select
											name="primary_contact_id"
											value={form.primary_contact_id}
											onChange={handleChange}
											className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										>
											<option value="">
												{contactsLoading
													? "Loading contacts..."
													: "No linked contact"}
											</option>
											{contacts.map((c) => (
												<option key={c.id} value={c.id}>
													{c.name}
													{c.email ? ` (${c.email})` : ""}
												</option>
											))}
										</select>
									</div>
									{contactsError && (
										<div className="text-[11px] text-red-600 mt-1 sm:mb-1">
											{contactsError}
										</div>
									)}
								</div>

								<div className="flex flex-col sm:flex-row sm:items-end sm:gap-3">
									<div className="flex-1">
										<label className="block text-xs font-medium text-yecny-slate mb-1">
											CPA contact (optional)
										</label>
										<select
											name="cpa_contact_id"
											value={form.cpa_contact_id}
											onChange={handleChange}
											className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
										>
											<option value="">
												{contactsLoading
													? "Loading contacts..."
													: "No CPA linked"}
											</option>
											{contacts.map((c) => (
												<option key={c.id} value={c.id}>
													{c.name}
													{c.email ? ` (${c.email})` : ""}
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Manual contact details */}
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
							</div>
						</section>
					</>
				)}

				{/* STEP: Starting point */}
				{step.key === "start" && (
					<>
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Bookkeeping start &amp; access
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
							</div>

							{/* QBO status */}
							<div>
								<label className="block text-xs font-medium text-yecny-slate mb-1">
									Do they already have QuickBooks Online?
								</label>
								<div className="flex flex-col gap-1 text-xs">
									<label className="inline-flex items-center gap-2">
										<input
											type="radio"
											name="qbo_status"
											value="yes"
											checked={form.qbo_status === "yes"}
											onChange={handleChange}
										/>
										<span>Yes, they already have QBO</span>
									</label>

									<label className="inline-flex items-center gap-2">
										<input
											type="radio"
											name="qbo_status"
											value="no"
											checked={form.qbo_status === "no"}
											onChange={handleChange}
										/>
										<span>No, they will need a new subscription</span>
									</label>
									<label className="inline-flex items-center gap-2">
										<input
											type="radio"
											name="qbo_status"
											value="unsure"
											checked={form.qbo_status === "unsure"}
											onChange={handleChange}
										/>
										<span>Unsure / to be confirmed</span>
									</label>
								</div>
							</div>

							{/* QBO subscription planning */}
							{form.qbo_status === "no" && (
								<div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/60 space-y-3">
									<div className="text-xs font-medium text-yecny-charcoal">
										QBO subscription planning
									</div>

									<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
										<div>
											<label className="block font-medium text-yecny-slate mb-1">
												How many QBO users will they need?
											</label>
											<input
												type="number"
												name="qbo_num_users"
												min="1"
												value={form.qbo_num_users}
												onChange={handleChange}
												className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
												placeholder="1"
											/>
											<p className="mt-1 text-[11px] text-slate-500">
												If more than 1 user, they&apos;ll need at least
												Essentials.
											</p>
										</div>

										<div className="space-y-2 md:col-span-1">
											<div className="font-medium text-yecny-slate mb-1">
												Advanced features needed?
											</div>

											<div className="space-y-2">
												<label className="flex items-start gap-2">
													<input
														type="checkbox"
														name="qbo_needs_class_tracking"
														checked={form.qbo_needs_class_tracking}
														onChange={handleChange}
														className="mt-0.5 h-4 w-4 border-slate-300 rounded"
													/>
													<span>They need class tracking</span>
												</label>

												{form.qbo_needs_class_tracking && (
													<div className="ml-6">
														<label className="block text-[11px] font-medium text-yecny-slate mb-1">
															Approx # of classes
														</label>
														<input
															type="number"
															name="qbo_num_classes"
															value={form.qbo_num_classes}
															onChange={handleChange}
															className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
														/>
													</div>
												)}
												<label className="flex items-start gap-2">
													<input
														type="checkbox"
														name="qbo_needs_location_tracking"
														checked={form.qbo_needs_location_tracking}
														onChange={handleChange}
														className="mt-0.5 h-4 w-4 border-slate-300 rounded"
													/>
													<span>They need location tracking</span>
												</label>

												{form.qbo_needs_location_tracking && (
													<div className="ml-6">
														<label className="block text-[11px] font-medium text-yecny-slate mb-1">
															Approx # of locations
														</label>
														<input
															type="number"
															name="qbo_num_locations"
															value={form.qbo_num_locations}
															onChange={handleChange}
															className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
														/>
													</div>
												)}
											</div>
										</div>

										<div className="space-y-1">
											<div className="font-medium text-yecny-slate mb-1">
												Recommended subscription
											</div>
											<div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] text-yecny-charcoal">
												{computeQboRecommendation(form) || "Will confirm later"}
											</div>
											<p className="mt-1 text-[11px] text-slate-500">
												This will be saved on the intake so you can confirm with
												the client and Jason when scoping.
											</p>
										</div>
									</div>
								</div>
							)}

							{/* Assignment */}
							<div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50 space-y-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-xs font-medium text-yecny-charcoal">
											Internal assignment (optional)
										</div>
										<p className="text-[11px] text-slate-500 mt-0.5">
											You can leave these blank during the discovery call and
											set them later before converting.
										</p>
									</div>
									{usersError && (
										<div className="text-[11px] text-red-600">{usersError}</div>
									)}
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-medium text-yecny-slate mb-1">
											Manager
										</label>
										<select
											name="manager_id"
											value={form.manager_id}
											onChange={handleChange}
											className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										>
											<option value="">
												{usersLoading ? "Loading users..." : "Unassigned"}
											</option>
											{users.map((u) => (
												<option key={u.id} value={u.id}>
													{u.name} ({u.role})
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="block text-xs font-medium text-yecny-slate mb-1">
											Bookkeeper
										</label>
										<select
											name="bookkeeper_id"
											value={form.bookkeeper_id}
											onChange={handleChange}
											className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										>
											<option value="">
												{usersLoading ? "Loading users..." : "Unassigned"}
											</option>
											{users.map((u) => (
												<option key={u.id} value={u.id}>
													{u.name} ({u.role})
												</option>
											))}
										</select>
									</div>
								</div>
							</div>
						</section>
					</>
				)}

				{/* STEP: Accounts */}
				{step.key === "accounts" && (
					<>
						{/* Banking & accounts */}
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Banking &amp; accounts
								</h2>
								<p className="text-xs text-yecny-slate mt-1">
									How many accounts are we tracking, and where are they held?
								</p>
							</div>

							<div className="space-y-4">
								{/* Checking accounts */}
								<div className="border border-slate-100 rounded-md p-3 space-y-3">
									<div className="flex items-center justify-between">
										<div className="text-xs font-medium text-yecny-slate">
											Checking accounts
										</div>
										<label className="flex items-center gap-1 text-[11px] text-yecny-slate">
											<input
												type="checkbox"
												checked={checkingMulti}
												onChange={(e) => setCheckingMulti(e.target.checked)}
												className="h-3 w-3"
											/>
											<span>Multiple banks?</span>
										</label>
									</div>

									{!checkingMulti ? (
										<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
												<div className="flex flex-col sm:flex-row gap-2">
													<select
														name="checking_banks"
														value={form.checking_banks}
														onChange={handleChange}
														className="sm:w-56 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
													>
														{BANK_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>

													{form.checking_banks === "other" && (
														<input
															type="text"
															name="checking_banks_other"
															value={form.checking_banks_other}
															onChange={handleChange}
															placeholder="Example: Wells Fargo, Chase"
															className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
														/>
													)}
												</div>
												<p className="mt-1 text-[11px] text-slate-500">
													Use &quot;Other / Add new&quot; if their bank
													isn&apos;t listed, or switch on &quot;Multiple
													banks?&quot; to specify counts by bank.
												</p>
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<div className="text-[11px] text-slate-500">
												Add a row per bank and indicate how many checking
												accounts they have at each.
											</div>
											<div className="space-y-2">
												{checkingRows.map((row, index) => (
													<div
														key={index}
														className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
													>
														<select
															value={row.bank}
															onChange={(e) =>
																updateCheckingRow(index, "bank", e.target.value)
															}
															className="sm:w-56 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
														>
															{BANK_OPTIONS.map((opt) => (
																<option key={opt.value} value={opt.value}>
																	{opt.label}
																</option>
															))}
														</select>
														<input
															type="number"
															min="0"
															value={row.count}
															onChange={(e) =>
																updateCheckingRow(
																	index,
																	"count",
																	e.target.value
																)
															}
															className="w-24 border border-slate-300 rounded-md px-3 py-2 text-sm"
															placeholder="#"
														/>
														{checkingRows.length > 1 && (
															<button
																type="button"
																onClick={() => removeCheckingRow(index)}
																className="text-[11px] text-red-600 hover:underline"
															>
																Remove
															</button>
														)}
													</div>
												))}
											</div>
											<button
												type="button"
												onClick={addCheckingRow}
												className="text-[11px] text-yecny-primary hover:underline"
											>
												+ Add bank
											</button>
										</div>
									)}
								</div>

								{/* Savings accounts */}
								<div className="border border-slate-100 rounded-md p-3 space-y-3">
									<div className="flex items-center justify-between">
										<div className="text-xs font-medium text-yecny-slate">
											Savings accounts
										</div>
										<label className="flex items-center gap-1 text-[11px] text-yecny-slate">
											<input
												type="checkbox"
												checked={savingsMulti}
												onChange={(e) => setSavingsMulti(e.target.checked)}
												className="h-3 w-3"
											/>
											<span>Multiple banks?</span>
										</label>
									</div>

									{!savingsMulti ? (
										<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
												<div className="flex flex-col sm:flex-row gap-2">
													<select
														name="savings_banks"
														value={form.savings_banks}
														onChange={handleChange}
														className="sm:w-56 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
													>
														{BANK_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>

													{form.savings_banks === "other" && (
														<input
															type="text"
															name="savings_banks_other"
															value={form.savings_banks_other}
															onChange={handleChange}
															placeholder="Banks where savings accounts are held"
															className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
														/>
													)}
												</div>
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<div className="text-[11px] text-slate-500">
												Add a row per bank and indicate how many savings
												accounts they have at each.
											</div>
											<div className="space-y-2">
												{savingsRows.map((row, index) => (
													<div
														key={index}
														className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
													>
														<select
															value={row.bank}
															onChange={(e) =>
																updateSavingsRow(index, "bank", e.target.value)
															}
															className="sm:w-56 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
														>
															{BANK_OPTIONS.map((opt) => (
																<option key={opt.value} value={opt.value}>
																	{opt.label}
																</option>
															))}
														</select>
														<input
															type="number"
															min="0"
															value={row.count}
															onChange={(e) =>
																updateSavingsRow(index, "count", e.target.value)
															}
															className="w-24 border border-slate-300 rounded-md px-3 py-2 text-sm"
															placeholder="#"
														/>
														{savingsRows.length > 1 && (
															<button
																type="button"
																onClick={() => removeSavingsRow(index)}
																className="text-[11px] text-red-600 hover:underline"
															>
																Remove
															</button>
														)}
													</div>
												))}
											</div>

											<button
												type="button"
												onClick={addSavingsRow}
												className="text-[11px] text-yecny-primary hover:underline"
											>
												+ Add bank
											</button>
										</div>
									)}
								</div>

								{/* Credit card accounts */}
								<div className="border border-slate-100 rounded-md p-3 space-y-3">
									<div className="flex items-center justify-between">
										<div className="text-xs font-medium text-yecny-slate">
											Credit card accounts
										</div>
										<label className="flex items-center gap-1 text-[11px] text-yecny-slate">
											<input
												type="checkbox"
												checked={creditMulti}
												onChange={(e) => setCreditMulti(e.target.checked)}
												className="h-3 w-3"
											/>
											<span>Multiple banks?</span>
										</label>
									</div>

									{!creditMulti ? (
										<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
												<div className="flex flex-col sm:flex-row gap-2">
													<select
														name="credit_card_banks"
														value={form.credit_card_banks}
														onChange={handleChange}
														className="sm:w-56 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
													>
														{BANK_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>

													{form.credit_card_banks === "other" && (
														<input
															type="text"
															name="credit_card_banks_other"
															value={form.credit_card_banks_other}
															onChange={handleChange}
															placeholder="Example: AmEx, Chase, Citi"
															className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
														/>
													)}
												</div>
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<div className="text-[11px] text-slate-500">
												Add a row per bank and indicate how many credit cards
												they have at each.
											</div>
											<div className="space-y-2">
												{creditRows.map((row, index) => (
													<div
														key={index}
														className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
													>
														<select
															value={row.bank}
															onChange={(e) =>
																updateCreditRow(index, "bank", e.target.value)
															}
															className="sm:w-56 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
														>
															{BANK_OPTIONS.map((opt) => (
																<option key={opt.value} value={opt.value}>
																	{opt.label}
																</option>
															))}
														</select>
														<input
															type="number"
															min="0"
															value={row.count}
															onChange={(e) =>
																updateCreditRow(index, "count", e.target.value)
															}
															className="w-24 border border-slate-300 rounded-md px-3 py-2 text-sm"
															placeholder="#"
														/>
														{creditRows.length > 1 && (
															<button
																type="button"
																onClick={() => removeCreditRow(index)}
																className="text-[11px] text-red-600 hover:underline"
															>
																Remove
															</button>
														)}
													</div>
												))}
											</div>

											<button
												type="button"
												onClick={addCreditRow}
												className="text-[11px] text-yecny-primary hover:underline"
											>
												+ Add bank
											</button>
										</div>
									)}
								</div>

								{/* Loans / vehicles / assets */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
					</>
				)}

				{/* STEP: Access & systems */}
				{step.key === "access" && (
					<>
						{/* Bank login access */}
						<div className="flex items-center gap-2">
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

						{/* Transaction behavior */}
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Transaction behavior &amp; payments
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
										<div className="flex-1">
											<div>
												They sometimes deposit non-business funds into business
												accounts.
											</div>
											{form.non_business_deposits && (
												<input
													type="text"
													name="non_business_deposits_details"
													value={form.non_business_deposits_details}
													onChange={handleChange}
													placeholder="Optional details (how often, typical amounts, etc.)"
													className="mt-1 w-full border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
												/>
											)}
										</div>
									</label>
									<label className="flex items-start gap-2 text-xs text-yecny-slate">
										<input
											type="checkbox"
											name="personal_expenses_in_business"
											checked={form.personal_expenses_in_business}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<div className="flex-1">
											<div>
												They sometimes pay personal expenses from business
												accounts.
											</div>
											{form.personal_expenses_in_business && (
												<input
													type="text"
													name="personal_expenses_in_business_details"
													value={form.personal_expenses_in_business_details}
													onChange={handleChange}
													placeholder="Optional details (card used, how they track, etc.)"
													className="mt-1 w-full border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
												/>
											)}
										</div>
									</label>

									<label className="flex items-start gap-2 text-xs text-yecny-slate">
										<input
											type="checkbox"
											name="business_expenses_in_personal"
											checked={form.business_expenses_in_personal}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<div className="flex-1">
											<div>
												They sometimes pay business expenses from personal
												accounts.
											</div>
											{form.business_expenses_in_personal && (
												<input
													type="text"
													name="business_expenses_in_personal_details"
													value={form.business_expenses_in_personal_details}
													onChange={handleChange}
													placeholder="Optional details (which cards/accounts, how often, etc.)"
													className="mt-1 w-full border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
												/>
											)}
										</div>
									</label>
								</div>
							</div>
						</section>
					</>
				)}

				{/* STEP: Reporting & scope */}
				{step.key === "scope" && (
					<>
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Reporting &amp; payroll
								</h2>
								<p className="text-xs text-yecny-slate mt-1">
									How often they want reports, how income is tracked, and what
									payroll services they need.
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

									{form.report_frequency === "monthly" && (
										<div className="mt-2">
											<label className="block text-xs font-medium text-yecny-slate mb-1">
												Monthly close tier{" "}
												<span className="text-red-500">*</span>
											</label>
											<select
												name="monthly_close_tier"
												value={form.monthly_close_tier}
												onChange={handleChange}
												className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
											>
												{MONTHLY_CLOSE_TIER_OPTIONS.map((opt) => (
													<option key={opt.value} value={opt.value}>
														{opt.label}
													</option>
												))}
											</select>
										</div>
									)}
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
									<select
										name="payroll_provider"
										value={form.payroll_provider}
										onChange={handleChange}
										className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									>
										{PAYROLL_PROVIDER_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>

									{form.payroll_provider === "other" && (
										<input
											type="text"
											name="payroll_provider_other"
											value={form.payroll_provider_other}
											onChange={handleChange}
											placeholder="Add a different payroll provider"
											className="mt-2 w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
										/>
									)}
								</div>
							</div>

							{/* Payroll services checklist */}
							<div className="mt-3 border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/60">
								<div className="text-xs font-medium text-yecny-charcoal mb-2">
									Payroll services requested
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-yecny-slate">
									<label className="inline-flex items-start gap-2">
										<input
											type="checkbox"
											name="payroll_needs_setup"
											checked={form.payroll_needs_setup}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<span>Initial payroll setup</span>
									</label>
									<label className="inline-flex items-start gap-2">
										<input
											type="checkbox"
											name="payroll_process_regular"
											checked={form.payroll_process_regular}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<span>Process regular payroll</span>
									</label>

									<label className="inline-flex items-start gap-2">
										<input
											type="checkbox"
											name="payroll_corrections_adjustments"
											checked={form.payroll_corrections_adjustments}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<span>Make payroll corrections / adjustments</span>
									</label>

									<label className="inline-flex items-start gap-2">
										<input
											type="checkbox"
											name="payroll_quarterly_filings"
											checked={form.payroll_quarterly_filings}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<span>Prepare quarterly payroll tax filings</span>
									</label>

									<label className="inline-flex items-start gap-2">
										<input
											type="checkbox"
											name="payroll_state_local_payments"
											checked={form.payroll_state_local_payments}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<span>Make all state &amp; local payroll tax payments</span>
									</label>

									<label className="inline-flex items-start gap-2">
										<input
											type="checkbox"
											name="payroll_calculate_hours_commission"
											checked={form.payroll_calculate_hours_commission}
											onChange={handleChange}
											className="mt-0.5 h-4 w-4 border-slate-300 rounded"
										/>
										<span>Calculate hours / commission per payroll</span>
									</label>
								</div>
							</div>
						</section>
					</>
				)}

				{/* STEP: Recurring & notes */}
				{step.key === "wrap" && (
					<>
						{/* Custom recurring rules */}
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Custom recurring tasks
								</h2>
								<p className="text-xs text-yecny-slate mt-1">
									Add any client-specific recurring work that should start after
									onboarding.
								</p>
							</div>
							<div className="space-y-3">
								{(form.custom_recurring_rules || []).map((r, idx) => (
									<div
										key={idx}
										className="border border-slate-200 rounded-lg p-3 bg-slate-50/40 space-y-2"
									>
										<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
											<div className="md:col-span-1">
												<label className="block text-xs font-medium text-yecny-slate mb-1">
													Task name
												</label>
												<input
													value={r.title || ""}
													onChange={(e) =>
														updateCustomRecurringRule(
															idx,
															"title",
															e.target.value
														)
													}
													className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
													placeholder="Example: Send sales tax summary"
												/>
											</div>

											<div>
												<label className="block text-xs font-medium text-yecny-slate mb-1">
													Schedule
												</label>
												<select
													value={r.schedule_type || "monthly"}
													onChange={(e) =>
														updateCustomRecurringRule(
															idx,
															"schedule_type",
															e.target.value
														)
													}
													className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
												>
													<option value="monthly">Monthly</option>
													<option value="quarterly">Quarterly</option>
													<option value="annual">Annual</option>
												</select>
											</div>

											<div>
												<label className="block text-xs font-medium text-yecny-slate mb-1">
													Day of month
												</label>
												<input
													type="number"
													min="1"
													max="31"
													value={r.day_of_month ?? 25}
													onChange={(e) =>
														updateCustomRecurringRule(
															idx,
															"day_of_month",
															Number(e.target.value || 25)
														)
													}
													className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
												/>
											</div>
											<div className="md:col-span-2">
												<label className="block text-xs font-medium text-yecny-slate mb-1">
													Description (optional)
												</label>
												<input
													value={r.description || ""}
													onChange={(e) =>
														updateCustomRecurringRule(
															idx,
															"description",
															e.target.value
														)
													}
													className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
													placeholder="Notes for the assigned person"
												/>
											</div>

											<div>
												<label className="block text-xs font-medium text-yecny-slate mb-1">
													Assign to
												</label>
												<select
													value={r.assigned_user_id || ""}
													onChange={(e) =>
														updateCustomRecurringRule(
															idx,
															"assigned_user_id",
															e.target.value ? Number(e.target.value) : ""
														)
													}
													className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
												>
													<option value="">Unassigned</option>
													{users.map((u) => (
														<option key={u.id} value={u.id}>
															{u.name} ({u.role})
														</option>
													))}
												</select>
											</div>
										</div>

										<div className="flex justify-end">
											<button
												type="button"
												onClick={() => removeCustomRecurringRule(idx)}
												className="text-[11px] text-red-600 hover:underline"
											>
												Remove
											</button>
										</div>
									</div>
								))}

								<button
									type="button"
									onClick={addCustomRecurringRule}
									className="text-[11px] text-yecny-primary hover:underline"
								>
									+ Add recurring task
								</button>
							</div>
						</section>
						{/* Additional notes */}
						<section className="space-y-4">
							<div>
								<h2 className="text-sm font-semibold text-yecny-charcoal">
									Additional notes
								</h2>
								<p className="text-xs text-yecny-slate mt-1">
									Any extra context that will help with onboarding or ongoing
									work.
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
					</>
				)}

				{/* STEP: Review */}
				{step.key === "review" && (
					<section className="space-y-3">
						<h2 className="text-sm font-semibold text-yecny-charcoal">
							Review
						</h2>

						<div className="border border-slate-200 rounded-lg p-4 text-xs space-y-2">
							<div>
								<span className="font-medium">Legal name:</span>{" "}
								{form.legal_name || "-"}
							</div>
							<div>
								<span className="font-medium">Primary contact:</span>{" "}
								{form.primary_contact_name || "-"}
							</div>
							<div>
								<span className="font-medium">Start date:</span>{" "}
								{form.bookkeeping_start_date || "-"}
							</div>
							<div>
								<span className="font-medium">QBO status:</span>{" "}
								{form.qbo_status || "-"}
							</div>
							{form.qbo_status === "no" && (
								<div>
									<span className="font-medium">QBO recommended:</span>{" "}
									{computeQboRecommendation(form) || "-"}
								</div>
							)}
							<div>
								<span className="font-medium">Report frequency:</span>{" "}
								{form.report_frequency || "-"}
							</div>
							{form.report_frequency === "monthly" && (
								<div>
									<span className="font-medium">Monthly close tier:</span>{" "}
									{form.monthly_close_tier || "-"}
								</div>
							)}
							<div>
								<span className="font-medium">Custom recurring rules:</span>{" "}
								{(form.custom_recurring_rules || []).length}
							</div>
							<div>
								<span className="font-medium">Manager / Bookkeeper:</span>{" "}
								{form.manager_id && form.bookkeeper_id
									? "Assigned"
									: "Not assigned"}
							</div>
						</div>
						<p className="text-[11px] text-slate-500">
							To convert, you must assign Manager and Bookkeeper (Starting point
							step).
						</p>
					</section>
				)}

				{/* Actions */}
				<div className="pt-4 border-t border-slate-200 flex justify-between items-center gap-3">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleBackToList}
							className="text-xs text-yecny-slate hover:text-yecny-charcoal"
						>
							Back to Intake List
						</button>

						<span className="text-slate-300">|</span>

						<button
							type="button"
							onClick={goBack}
							disabled={stepIdx === 0}
							className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-yecny-slate hover:bg-slate-50 disabled:opacity-50"
						>
							Back
						</button>

						<button
							type="button"
							onClick={handleNextStep}
							disabled={stepIdx >= STEPS.length - 1}
							className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
						>
							Next
						</button>
					</div>

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
						{step.key === "review" && (
							<button
								type="button"
								onClick={handleSaveAndConvert}
								disabled={saving}
								className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
							>
								{saving ? "Converting..." : "Save & convert to client"}
							</button>
						)}

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
