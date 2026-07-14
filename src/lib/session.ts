// src/lib/session.ts

// Récupère l'ID de l'huilerie configurée sur cette tablette
export function getHuilerieId(): string | null {
  return localStorage.getItem("huilerie_id")
}

// Enregistre l'ID de l'huilerie (appelé après le Setup)
export function setHuilerieId(id: string): void {
  localStorage.setItem("huilerie_id", id)
}

// Récupère l'utilisateur actuellement connecté (stocké après login)
export function getCurrentUser(): { id: string; nom: string; role: string } | null {
  const raw = localStorage.getItem("current_user")
  return raw ? JSON.parse(raw) : null
}

// Enregistre l'utilisateur connecté (appelé après login réussi)
export function setCurrentUser(user: { id: string; nom: string; role: string }): void {
  localStorage.setItem("current_user", JSON.stringify(user))
}

// Déconnexion : on efface l'utilisateur mais PAS l'huilerie
export function logout(): void {
  localStorage.removeItem("current_user")
}