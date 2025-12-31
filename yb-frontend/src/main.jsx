// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRole from "./components/RequireRole";
import ErrorBoundary from "./components/ErrorBoundary";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Clients from "./pages/Clients";
import Contacts from "./pages/Contacts";
import ClientDetail from "./pages/ClientDetail";
import ClientIntake from "./pages/ClientIntake";
import ClientIntakeList from "./pages/ClientIntakeList";

import AppLayout from "./layout/AppLayout";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminOrg from "./pages/admin/AdminOrg";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOnboardingTemplates from "./pages/admin/AdminOnboardingTemplates";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminRecurringTemplates from "./pages/admin/AdminRecurringTemplates";

function SettingsPage() {
	return <div className="text-sm text-yecny-slate">Settings (coming soon)</div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<BrowserRouter>
			<ErrorBoundary>
				<AuthProvider>
					<Routes>
						{/* Public */}
						<Route path="/login" element={<Login />} />

						{/* Protected App Shell */}
						<Route
							path="/"
							element={
								<ProtectedRoute>
									<AppLayout />
								</ProtectedRoute>
							}
						>
							{/* Main app */}
							<Route index element={<Dashboard />} />
							<Route path="tasks" element={<Tasks />} />
							<Route path="clients" element={<Clients />} />
							<Route path="contacts" element={<Contacts />} />
							<Route path="clients/:id" element={<ClientDetail />} />
							<Route path="clients/intake" element={<ClientIntakeList />} />
							<Route path="clients/intake/new" element={<ClientIntake />} />
							<Route
								path="clients/intake/:intakeId/edit"
								element={<ClientIntake />}
							/>
							<Route path="settings" element={<SettingsPage />} />

							{/* Admin portal */}
							<Route
								path="admin"
								element={
									<RequireRole roles={["admin", "owner"]}>
										<AdminLayout />
									</RequireRole>
								}
							>
								<Route index element={<AdminOrg />} />
								<Route path="users" element={<AdminUsers />} />
								
								<Route
									path="onboarding-templates"
									element={<AdminOnboardingTemplates />}
								/>
								<Route path="audit" element={<AdminAudit />} />
								<Route
									path="recurring-templates"
									element={<AdminRecurringTemplates />}
								/>
							</Route>
						</Route>
					</Routes>
				</AuthProvider>
			</ErrorBoundary>
		</BrowserRouter>
	</React.StrictMode>
);
