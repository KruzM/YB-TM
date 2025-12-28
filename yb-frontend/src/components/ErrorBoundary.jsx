import React from "react";

export default class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, info) {
		console.error("UI crashed:", error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{ padding: 24, fontFamily: "system-ui" }}>
					<h2 style={{ marginBottom: 8 }}>Something crashed in the UI.</h2>
					<div style={{ marginBottom: 12, opacity: 0.8 }}>
						Open DevTools ? Console to see the exact error.
					</div>
					<pre
						style={{
							background: "#f6f6f6",
							padding: 12,
							borderRadius: 8,
							overflow: "auto",
						}}
					>
						{String(this.state.error)}
					</pre>
					<button
						onClick={() => window.location.reload()}
						style={{ marginTop: 12, padding: "8px 12px" }}
					>
						Reload
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
