// src/pages/Login.tsx
//
// Écran de connexion par PIN. Voir src/lib/pin.ts (buffer PIN), src/lib/pinAuth.ts
// (blocage anti brute-force) et src/lib/auth.ts (appels Supabase) pour la
// logique testée unitairement — ce fichier ne fait que les orchestrer dans l'UI.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { getHuilerieId, setCurrentUser } from "../lib/session";
import { fetchLoginUsers, startSession, verifyUserPin, type LoginUser } from "../lib/auth";
import { isPinComplete } from "../lib/pin";
import {
  initialAttemptState,
  isLocked,
  registerFailedAttempt,
  remainingLockoutSeconds,
  type AttemptState,
} from "../lib/pinAuth";
import PinKeypad from "../components/PinKeypad";

export default function Login() {
  const navigate = useNavigate();

  // Liste des profils de l'huilerie
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");

  // Profil sélectionné + saisie du PIN
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  // Anti brute-force : un état de tentatives par utilisateur, conservé même
  // si l'opérateur clique sur un autre profil puis revient.
  const [attempts, setAttempts] = useState<Record<string, AttemptState>>({});
  const [now, setNow] = useState(() => Date.now());

  const attemptState = selectedUser ? attempts[selectedUser.id] : undefined;
  const locked = attemptState ? isLocked(attemptState, now) : false;
  const lockedSecondsLeft = attemptState ? remainingLockoutSeconds(attemptState, now) : 0;

  // Chargement des utilisateurs de l'huilerie configurée sur cette tablette.
  useEffect(() => {
    const huilerieId = getHuilerieId();

    // Filet de sécurité : AppGuard redirige déjà vers /setup si absent,
    // mais on ne suppose jamais qu'un state externe est garanti valide.
    if (!huilerieId) {
      navigate("/setup", { replace: true });
      return;
    }

    // Pas de setLoadingUsers(true) ici : l'état initial vaut déjà true, et cet
    // effet ne se rejoue pas (navigate est stable) — l'appeler serait un
    // setState synchrone superflu dans le corps de l'effet.
    let cancelled = false;
    fetchLoginUsers(supabase, huilerieId)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        if (!cancelled) {
          setUsersError("Impossible de charger les utilisateurs. Vérifiez la connexion.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Rafraîchit le compte à rebours pendant qu'un blocage est actif.
  useEffect(() => {
    if (!selectedUser) return;
    const state = attempts[selectedUser.id];
    if (!state || !isLocked(state, Date.now())) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [selectedUser, attempts]);

  const handleSelectUser = (user: LoginUser) => {
    setSelectedUser(user);
    setPin("");
    setError("");
  };

  const handleFailedAttempt = () => {
    if (!selectedUser) return;
    const current = attempts[selectedUser.id] ?? initialAttemptState();
    const next = registerFailedAttempt(current, Date.now());
    setAttempts((prev) => ({ ...prev, [selectedUser.id]: next }));

    setShake(true);
    setTimeout(() => setShake(false), 300);

    if (isLocked(next, Date.now())) {
      setError("Trop de tentatives. Compte bloqué temporairement.");
    } else {
      setError("Code incorrect. Réessayez.");
    }
  };

  const handleVerify = async (pinAttempt: string) => {
    if (!selectedUser) return;
    setVerifying(true);
    setError("");

    try {
      // Le hash du PIN ne quitte jamais PostgreSQL : on ne reçoit qu'un
      // booléen. `pinAttempt` n'est jamais loggé (console.log interdit ici).
      const ok = await verifyUserPin(supabase, selectedUser.id, pinAttempt);

      if (ok) {
        // Le PIN est validé métier — on ouvre maintenant une vraie session
        // Supabase Auth : c'est elle qui porte le JWT (huilerie_id via le
        // Custom Access Token Hook), sans quoi aucune policy RLS ne filtre
        // les données de l'huilerie sur le reste de l'app.
        await startSession(supabase, selectedUser.id, pinAttempt);

        setCurrentUser({
          id: selectedUser.id,
          nom: selectedUser.nom_complet,
          role: selectedUser.role,
        });
        navigate("/dashboard");
        return;
      }

      handleFailedAttempt();
    } catch {
      // Ne devrait survenir qu'en cas de panne réseau : le PIN vient
      // d'être validé par verifyUserPin, startSession ne devrait pas
      // échouer pour une question de PIN incorrect.
      setError("Connexion au serveur impossible. Réessayez.");
    } finally {
      setVerifying(false);
      setPin("");
    }
  };

  // Auto-submit dès que le 4e chiffre est saisi. Déclenché depuis le
  // gestionnaire d'événement (onChange du pavé), pas depuis un effect :
  // c'est une réaction à une interaction utilisateur, pas une synchronisation
  // avec un système externe — cf. "You Might Not Need an Effect" (react.dev).
  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    if (isPinComplete(newPin) && !verifying && !locked) {
      void handleVerify(newPin);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-[#1B4332] mb-6">Huilerie</h1>

        <p className="text-sm text-gray-500 text-center mb-4">Sélectionnez votre profil</p>

        {loadingUsers && (
          <p className="text-center text-gray-400 text-sm mb-6">Chargement…</p>
        )}

        {usersError && (
          <p role="alert" className="text-center text-[#E63946] text-sm mb-6">
            {usersError}
          </p>
        )}

        {!loadingUsers && !usersError && (
          <div className="flex gap-3 justify-center flex-wrap mb-6">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                aria-pressed={selectedUser?.id === user.id}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all min-w-[72px] ${
                  selectedUser?.id === user.id
                    ? "border-[#2D6A4F] bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-xl font-bold">
                  {user.nom_complet.charAt(0)}
                </div>
                <span className="text-sm mt-2 font-medium">
                  {user.nom_complet.split(" ")[0]}
                </span>
                <span className="text-xs text-gray-500">{user.role}</span>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="flex flex-col items-center border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-600 mb-4">
              Code PIN de <span className="font-semibold">{selectedUser.nom_complet}</span>
            </p>

            <PinKeypad
              value={pin}
              onChange={handlePinChange}
              disabled={verifying || locked}
              shake={shake}
              label="Pavé numérique de saisie du code PIN"
            />

            <div className="h-6 mt-4" aria-live="assertive" role="alert">
              {locked ? (
                <p className="text-[#E63946] text-sm text-center">
                  Trop de tentatives. Réessayez dans {lockedSecondsLeft}s.
                </p>
              ) : error ? (
                <p className="text-[#E63946] text-sm text-center">{error}</p>
              ) : verifying ? (
                <p className="text-gray-400 text-sm text-center">Vérification…</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
