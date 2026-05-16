import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

function Doctor() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /** Only staff-verified doctors may use patient lookup / records (MVP gate). */
  const isVerifiedDoctor = user?.is_verified === true;

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">

      <div className="flex max-w-3xl mx-auto mb-6 items-center justify-between gap-4">
        <p className="text-sm text-gray-400 truncate">
          Doctor · {user?.email ?? ""}
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
        >
          Log out
        </button>
      </div>

      <h1 className="text-4xl font-bold text-center mb-6">
        Doctor Dashboard
      </h1>

      {!isVerifiedDoctor ? (
        <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-amber-600/50 bg-amber-950/40 px-5 py-4 text-center">
          <p className="text-lg font-semibold text-amber-200">
            Verification pending
          </p>
          <p className="mt-2 text-sm text-amber-100/90">
            Your registration is being reviewed. Patient search and records are
            disabled until an administrator verifies your account.
          </p>
        </div>
      ) : null}

      {isVerifiedDoctor ? (
        <>
          <div className="max-w-3xl mx-auto bg-slate-800 p-6 rounded-2xl shadow-lg mb-8">

            <h2 className="text-2xl font-semibold mb-4">
              Search Patient
            </h2>

            <div className="flex gap-4">

              <input
                type="text"
                placeholder="Enter Patient ID"
                className="flex-1 p-3 rounded-lg bg-slate-700 text-white outline-none"
              />

              <button
                type="button"
                className="bg-green-500 hover:bg-green-600 px-6 rounded-lg"
              >
                Search
              </button>

            </div>

          </div>

          <div className="max-w-3xl mx-auto bg-slate-800 p-6 rounded-2xl shadow-lg mb-8">

            <h2 className="text-2xl font-semibold mb-4">
              Patient Details
            </h2>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <p className="text-gray-400">Name</p>
                <p className="font-semibold">Bhavana</p>
              </div>

              <div>
                <p className="text-gray-400">Age</p>
                <p className="font-semibold">19</p>
              </div>

              <div>
                <p className="text-gray-400">Blood Group</p>
                <p className="font-semibold">O+</p>
              </div>

              <div>
                <p className="text-gray-400">Height</p>
                <p className="font-semibold">160 cm</p>
              </div>

              <div>
                <p className="text-gray-400">Weight</p>
                <p className="font-semibold">52 kg</p>
              </div>

            </div>

          </div>

          <div className="max-w-3xl mx-auto bg-slate-800 p-6 rounded-2xl shadow-lg">

            <h2 className="text-2xl font-semibold mb-4">
              Patient Medical History
            </h2>

            <div className="bg-slate-700 p-4 rounded-xl mb-4">
              <p className="font-semibold">Diabetes Prescription</p>
              <p className="text-gray-300">March 2026</p>
            </div>

            <div className="bg-slate-700 p-4 rounded-xl">
              <p className="font-semibold">Blood Test Report</p>
              <p className="text-gray-300">April 2026</p>
            </div>

          </div>
        </>
      ) : (
        <div className="max-w-xl mx-auto text-center text-gray-400 text-sm">
          This space will unlock patient workflows after verification.
        </div>
      )}

    </div>
  );
}

export default Doctor;
