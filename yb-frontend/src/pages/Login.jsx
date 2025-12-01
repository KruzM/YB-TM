// src/pages/Login.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import logo from "../YBLogo.png";

export default function LoginPage() {
	const { login } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const params = new URLSearchParams(window.location.search);
	const reason = params.get("reason");

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSubmitting(true);
		try {
			await login(email.trim(), password);
		} catch (err) {
			console.error(err);
			setError("Invalid email or password.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
			<div className="w-full max-w-md">
				{/* Card */}
				<div className="bg-white shadow-md rounded-2xl px-8 py-10 border border-slate-100">
					{/* Logo / Brand */}
					<div className="flex flex-col items-center mb-8">
						<img
							src={logo}
							alt="YECNY Bookkeeping"
							className="w-50 md:w-65 mb-2 drop-shadow-sm"
						/>

						<div className="text-slate-500 text-xs uppercase tracking-widest">
							Internal OS Login
						</div>
					</div>

					{/* Timeout / reason notice */}
					{reason === "timeout" && (
						<div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
							For security, you were signed out after a period of inactivity.
							Please log in again.
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="email"
								className="block text-xs font-medium text-slate-600 mb-1"
							>
								Email
							</label>
							<input
								id="email"
								type="email"
								autoComplete="email"
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-xs font-medium text-slate-600 mb-1"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								autoComplete="current-password"
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>

						<button
							type="submit"
							disabled={submitting}
							className="w-full mt-2 inline-flex justify-center items-center rounded-lg bg-teal-700 text-white text-sm font-medium py-2.5 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
						>
							{submitting ? "Signing in..." : "Sign in"}
						</button>
					</form>

					<p className="mt-6 text-[11px] text-slate-400 text-center">
						Accuracy - Efficiency - Organization
					</p>
				</div>
			</div>
		</div>
	);
}
