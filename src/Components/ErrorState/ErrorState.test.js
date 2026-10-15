import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ErrorState, { InlineAlert } from "./ErrorState";
import { NETWORK_MESSAGE } from "../../utils/apiMessage";


globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const render = async (element) => { await act(async () => { root.render(element); }); };
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("a lost connection reads as 'Can't connect', in the softer network style, with a way to try again", async () => {
  const retry = jest.fn();
  await render(<ErrorState message={NETWORK_MESSAGE} onRetry={retry} />);
  expect(container.textContent).toContain("Can't connect");
  expect(container.textContent).toContain(NETWORK_MESSAGE);
  expect(container.querySelector(".es.is-network")).not.toBeNull();
  await act(async () => { container.querySelector(".es-btn").click(); });
  expect(retry).toHaveBeenCalledTimes(1);
});

test("any other failure says something went wrong, and shows the server's reason", async () => {
  await render(<ErrorState message="The marks service is down" />);
  expect(container.textContent).toContain("Something went wrong");
  expect(container.textContent).toContain("The marks service is down");
  expect(container.querySelector(".es.is-network")).toBeNull();
  expect(container.querySelector(".es-btn")).toBeNull();           // no button when there is nothing to retry
});

test("a page can name what failed", async () => {
  await render(<ErrorState message="boom" title="Your timetable could not be loaded" />);
  expect(container.textContent).toContain("Your timetable could not be loaded");
});

test("an inline alert is an alert, shows nothing without a message, and can be retried or dismissed", async () => {
  await render(<InlineAlert message="" />);
  expect(container.innerHTML).toBe("");
  const retry = jest.fn(); const dismiss = jest.fn();
  await render(<InlineAlert message={NETWORK_MESSAGE} onRetry={retry} onDismiss={dismiss} />);
  expect(container.querySelector('[role="alert"].is-network')).not.toBeNull();
  await act(async () => { container.querySelector(".ia-retry").click(); container.querySelector(".ia-dismiss").click(); });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(dismiss).toHaveBeenCalledTimes(1);
});
