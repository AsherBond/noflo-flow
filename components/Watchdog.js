import { Component, IP } from "@noflo/noflo";

/**
 * Deadman switch: emits a bang every time `interval` elapses without any
 * IP arriving on `in`. Any input resets the timer. Use it to assert that
 * a stream stays silent for a bounded window, or to trigger fallbacks
 * when a heartbeat stops.
 *
 * The timer is instance-level, not scope-aware: with concurrent scopes
 * sharing one instance the window is shared. Run one instance per scope
 * when isolation is needed.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description: "Emit a bang when no input has arrived for the given interval",
    icon: "heartbeat",
    inPorts: {
      in: {
        datatype: "all",
        description: "Any IP counts as activity and resets the timer",
      },
      interval: {
        datatype: "number",
        description: "Silence window in milliseconds before emitting",
        default: 1000,
        control: true,
      },
    },
    outPorts: {
      out: {
        datatype: "bang",
        description: "Emitted when the window closes without activity",
      },
    },
  });

  /** @type {NodeJS.Timeout|null} */
  let timer = null;

  /**
   * Structural type for the output port collection — the full
   * ProcessOutput type isn't re-exported from the package root.
   * @typedef {{ send(map: Record<string, unknown>): void, done(): void }} OutputLike
   */

  /**
   * @param {OutputLike} output
   * @param {number} interval
   */
  const arm = (output, interval) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      output.send({ out: new IP("data", null) });
      output.done();
    }, interval);
  };

  c.tearDown = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  c.process((input, output) => {
    let interval = 1000;
    if (input.hasData("interval")) {
      interval = Number.parseInt(input.getData("interval"), 10);
    }
    if (input.has("in")) {
      // Activity: reset the window, consuming the IP
      input.get("in");
      arm(output, interval);
      output.done();
      return;
    }
    // Firing without activity (e.g. interval arrival): re-arm
    arm(output, interval);
    output.done();
  });

  return c;
}
