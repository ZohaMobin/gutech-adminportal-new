// What to tell a person when a request fails: the server's own plain-language message when it sent one (that is the reason
// they need), otherwise a clear sentence about what happened and what to do.
export const NETWORK_MESSAGE = "Couldn't reach the server. Check your internet connection and try again.";

// No answer at all from the server: no internet, the server is down, or the request timed out.
export const isNetworkError = (error) => Boolean(error) && !error.response && Boolean(error.request || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || error.message === "Network Error");

const serverMessage = (error) => {
  const data = error?.response?.data;
  return data?.message || (typeof data?.error === "string" ? data.error : "");
};

export const messageOf = (error, fallback = "That did not work. Please try again.") => {
  const message = serverMessage(error);
  if (message) return message;
  const status = error?.response?.status;
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don't have permission to do this.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  return fallback;
};

// For forms (sign in, reset password): the server's reason, or "couldn't reach the server" when there was no answer, or the form's own
// sentence. Never status-based wording: a 401 on sign in means a wrong password, not an ended session.
export const formMessageOf = (error, fallback) => serverMessage(error) || (isNetworkError(error) ? NETWORK_MESSAGE : fallback);
