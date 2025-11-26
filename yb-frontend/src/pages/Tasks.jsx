// src/pages/Tasks.jsx
import { useEffect, useState } from "react";
import api from "../api/client";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  const loadTasks = async (status) => {
    setLoading(true);
    try {
      const res = await api.get("/tasks", {
        params: status ? { status } : {},
      });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const res = await api.post("/tasks", {
        title,
        description: "",
        status: "new",
        client_id: null,
        due_date: null,
        assigned_user_id: null,
      });
      setTitle("");
      setTasks((prev) => [...prev, res.data]);
    } catch (err) {
      console.error(err);
      setError("Failed to create task");
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      const res = await api.put(`/tasks/${taskId}`, {
        title: task.title,
        description: task.description,
        status: newStatus,
        client_id: task.client_id,
        due_date: task.due_date,
        assigned_user_id: task.assigned_user_id,
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? res.data : t))
      );
    } catch (err) {
      console.error(err);
      setError("Failed to update task");
    }
  };
  const handleDelete = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error(err);
      setError("Failed to delete task");
    }
  };

  const filteredTasks =
    statusFilter === ""
      ? tasks
      : tasks.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
      </div>

      {/* Quick add */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col sm:flex-row gap-2 bg-white p-4 rounded-lg shadow"
      >
        <input
          type="text"
          className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium shadow-sm hover:bg-yecny-primary-dark"
        >
          Add Task
        </button>
      </form>

      {/* Filters + list */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="text-sm text-slate-600">
            {loading
              ? "Loading tasks..."
              : `${filteredTasks.length} task${filteredTasks.length !== 1 ? "s" : ""}`}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Status:</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on_client">Waiting on Client</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="text-sm text-slate-500">
            No tasks yet. Use the form above to add one.
          </div>
        )}

        {!loading && filteredTasks.length > 0 && (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2">Title</th>
                <th className="text-left py-2 pr-2">Status</th>
                <th className="text-left py-2 pr-2">Due</th>
                <th className="text-right py-2 pl-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">{task.title}</td>
                  <td className="py-2 pr-2">
                    <select
                      className="border border-slate-300 rounded px-2 py-1 text-xs"
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(task.id, e.target.value)
                      }
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_on_client">
                        Waiting on Client
                      </option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
