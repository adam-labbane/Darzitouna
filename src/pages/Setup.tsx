import { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { setHuilerieId } from "../lib/session";

export default function Setup() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleActivate = async () => {
    setError("");
    setLoading(true);

    const { data, error } = await supabase.rpc("activate_tablet", {
      code: code.trim(),
    });

    setLoading(false);

    if (error || !data) {
      setError("Code invalide. Contactez l'administrateur.");
      return;
    }

    setHuilerieId(data);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-green-900">
          Bienvenue
        </h1>
        <p className="text-center text-gray-500 mt-2 mb-6">
          Configuration initiale de votre tablette
        </p>

        <label className="block text-sm font-medium text-gray-600 uppercase mb-2">
          Code d'activation
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ZTN-XXXX-XXXX-XXXX"
          className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl text-center text-lg font-mono tracking-widest focus:border-green-600 focus:outline-none"
        />

        {error && (
          <p className="text-red-600 text-sm mt-2 text-center">{error}</p>
        )}

        <button
          onClick={handleActivate}
          disabled={loading || code.length === 0}
          className="w-full h-14 bg-green-700 text-white font-bold rounded-xl mt-6 disabled:opacity-50 hover:bg-green-800 transition-all"
        >
          {loading ? "Vérification..." : "Activer cette tablette"}
        </button>
      </div>
    </div>
  );
}
