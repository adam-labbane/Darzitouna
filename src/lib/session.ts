export function getHuilerieId(): string | null {
  return localStorage.getItem("huilerie_id")
}

export function setHuilerieId(id: string): void {
  localStorage.setItem("huilerie_id", id)
}

export function getCurrentUser(): { id: string; nom: string; role: string } | null {
  const raw = localStorage.getItem("current_user")
  return raw ? JSON.parse(raw) : null
}

export function setCurrentUser(user: { id: string; nom: string; role: string }): void {
  localStorage.setItem("current_user", JSON.stringify(user))
}

export function logout(): void {
  localStorage.removeItem("current_user")
}
