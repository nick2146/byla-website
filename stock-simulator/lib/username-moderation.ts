const blockedUsernameTerms = [
  // Common slurs and hate terms; keep this list maintained as abuse patterns evolve.
  "nigger", "nigga", "faggot", "fag", "kike", "chink", "spic", "wetback",
  "tranny", "retard", "coon", "raghead", " naz i ".replace(/\s/g, ""),
  "hitler", "heilhitler", "whitepower", "killjews", "gasjews"
];

export function usernameModerationError(value: string): string | null {
  const username = value.trim();
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    return "Use 3–24 letters, numbers, or underscores.";
  }
  const normalized = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (blockedUsernameTerms.some((term) => normalized.includes(term.replace(/[^a-z0-9]/g, "")))) {
    return "That username isn't allowed. Please choose a respectful username.";
  }
  return null;
}
