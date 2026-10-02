export async function apiRequest(path, options = {}) {
  const response = await fetch(path, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("attendance:session-expired"));
  }
  if (!response.ok) {
    throw new Error(data.detail || "Request failed. Please try again.");
  }
  return data;
}

export function formRequest(path, event, options = {}) {
  event.preventDefault();
  const form = event.currentTarget;
  return apiRequest(path, { method: "POST", body: new FormData(form), ...options }).then((data) => {
    form.reset();
    return data;
  });
}
