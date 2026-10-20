import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import Signup from "./Signup";

jest.mock("axios");
jest.mock("react-router-dom", () => ({ Link: ({ children }) => <a href="/">{children}</a>, useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../Components/AuthContext", () => ({ useAuth: () => ({ login: jest.fn() }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const type = async (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const signIn = async (failure) => {
  axios.post.mockRejectedValue(failure);
  await type(container.querySelector('input[type="email"]'), "someone@example.com");
  await type(container.querySelector('input[type="password"]'), "a-password-1");
  await act(async () => { container.querySelector('button[type="submit"]').click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
beforeEach(async () => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => { root.render(<Signup />); });
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });

test("with no internet, sign in says so instead of blaming the password", async () => {
  await signIn({ request: {}, message: "Network Error", code: "ERR_NETWORK" });
  expect(container.textContent).toContain("Couldn't reach the server. Check your internet connection and try again.");
  expect(container.textContent).not.toMatch(/check your credentials/);
});

test("a wrong password still says so, using the server's words", async () => {
  await signIn({ response: { status: 401, data: { message: "Invalid email or password" } } });
  expect(container.textContent).toContain("Invalid email or password");
});

test("a rejection with no reason falls back to the credentials message", async () => {
  await signIn({ response: { status: 401, data: {} } });
  expect(container.textContent).toContain("Login failed. Please check your credentials.");
});

test("sign in tells the server this is the admin portal, and shows its refusal for other roles", async () => {
  await signIn({ response: { status: 403, data: { message: "Access denied. This portal is for administrators only." } } });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/auth/login"), expect.objectContaining({ portal: "admin" }));
  expect(container.textContent).toContain("This portal is for administrators only.");
});

test("the password toggle is a labelled button that switches the field", async () => {
  const toggle = container.querySelector("button.password-toggle");
  expect(toggle.getAttribute("aria-label")).toBe("Show password");
  await act(async () => { toggle.click(); });
  expect(container.querySelector('input[name="password"]').type).toBe("text");
  expect(toggle.getAttribute("aria-label")).toBe("Hide password");
});
