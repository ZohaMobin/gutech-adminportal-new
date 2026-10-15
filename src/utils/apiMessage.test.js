import { NETWORK_MESSAGE, formMessageOf, isNetworkError, messageOf } from "./apiMessage";

const noAnswer = { request: {}, message: "Network Error", code: "ERR_NETWORK" };
const answered = (status, data) => ({ response: { status, data } });

test("no answer from the server is a connection problem, however axios words it", () => {
  expect(isNetworkError(noAnswer)).toBe(true);
  expect(isNetworkError({ message: "Network Error" })).toBe(true);
  expect(isNetworkError({ code: "ECONNABORTED" })).toBe(true);        // timed out
  expect(isNetworkError(answered(500, {}))).toBe(false);              // the server did answer
  expect(isNetworkError(new Error("boom"))).toBe(false);
  expect(isNetworkError(null)).toBe(false);
});

test("pages say the same plain sentence for a lost connection", () => {
  expect(messageOf(noAnswer, "Failed to fetch students")).toBe(NETWORK_MESSAGE);
  expect(NETWORK_MESSAGE).toBe("Couldn't reach the server. Check your internet connection and try again.");
});

test("the server's own reason always wins, whether it says message or error", () => {
  expect(messageOf(answered(409, { message: "Section is locked" }))).toBe("Section is locked");
  expect(messageOf(answered(400, { error: "Name is taken" }))).toBe("Name is taken");
  expect(messageOf({ ...noAnswer, response: undefined })).toBe(NETWORK_MESSAGE);
});

test("status wording and the page's own fallback fill the gaps", () => {
  expect(messageOf(answered(401, {}))).toMatch(/session has ended/);
  expect(messageOf(answered(403, {}))).toMatch(/permission/);
  expect(messageOf(answered(500, {}))).toMatch(/our side/);
  expect(messageOf(new Error("odd"), "Failed to fetch teachers")).toBe("Failed to fetch teachers");
});

test("forms: a wrong password is never described as an ended session, and a lost connection is never described as a wrong password", () => {
  expect(formMessageOf(answered(401, {}), "Login failed. Please check your credentials.")).toBe("Login failed. Please check your credentials.");
  expect(formMessageOf(answered(401, { message: "Invalid email or password" }), "x")).toBe("Invalid email or password");
  expect(formMessageOf(noAnswer, "Login failed. Please check your credentials.")).toBe(NETWORK_MESSAGE);
});
