// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Clients from "./pages/Clients";
import AppLayout from "./layout/AppLayout";
import ClientDetail from "./pages/ClientDetail";
import ClientIntake from "./pages/ClientIntake";
import ClientIntakeList from "./pages/ClientIntakeList";
import Contacts from "./pages/Contacts";
function SettingsPage() {
	return <div className="text-sm text-yecny-slate">Settings (coming soon)</div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<BrowserRouter>
			<AuthProvider>
				<Routes>
					<Route
						path="/"
						element={
							<ProtectedRoute>
								<AppLayout />
							</ProtectedRoute>
						}
					>
						<Route index element={<Dashboard />} />
						<Route path="tasks" element={<Tasks />} />
						<Route path="clients" element={<Clients />} />
						<Route path="contacts" element={<Contacts />} />
						<Route path="clients/:id" element={<ClientDetail />} />
						<Route path="clients/intake" element={<ClientIntakeList />} />
						<Route path="clients/intake/new" element={<ClientIntake />} />
						<Route
							path="/clients/intake/:intakeId/edit"
							element={<ClientIntake />}
						/>
						<Route path="settings" element={<SettingsPage />} />
					</Route>

					<Route path="/login" element={<Login />} />
				</Routes>
			</AuthProvider>
		</BrowserRouter>
	</React.StrictMode>
);
