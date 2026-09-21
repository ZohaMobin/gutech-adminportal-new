// What to tell a person when a request fails: the server's own plain-language message when it sent one (that is the reason
// they need), otherwise a clear sentence about what happened and what to do.
export const messageOf = (error, fallback = "That did not work. Please try again.") => {
  const message = error?.response?.data?.message;
  if (message) return message;
  const status = error?.response?.status;
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don't have permission to do this.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  if (error?.request && !error?.response) return "Couldn't reach the server. Check your internet connection and try again.";
  return fallback;
};
