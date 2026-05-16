import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

/**
 * Minimal placeholder: admins are created manually in the DB, not via signup.
 * Expand this into a real console when you need staff tools.
 */
function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            Admin · {user?.email || "account"}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
          >
            Log out
          </button>
        </div>

        <div className="rounded-2xl border border-amber-900/50 bg-slate-800 p-8">
          <h1 className="text-2xl font-semibold">Admin workspace</h1>
          <p className="mt-3 text-gray-300">
            This area is reserved for staff accounts that are created internally
            or inserted directly in the database — not through public
            registration.
          </p>
          <p className="mt-4 text-gray-400">
            A full admin dashboard (doctor verification, audits, etc.) can be
            added here as the next milestone.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Admin;
