import { Component } from "@noflo/noflo";

/**
 * Throttles packets based on the current `load` versus a `max` load,
 * releasing one packet at a time and waiting while the load is at or
 * above the maximum.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description: "Throttle packets based on load and maximum accepted load",
    inPorts: {
      in: {
        datatype: "all",
        description: "IPs to forward",
        required: true,
      },
      load: {
        datatype: "int",
        description: "Current load",
        required: true,
      },
      max: {
        datatype: "int",
        control: true,
        description: "Maximum number to allow for load",
        required: true,
      },
    },
    outPorts: {
      out: { datatype: "all" },
    },
  });

  c.process((input, output) => {
    if (!input.hasData("in", "load", "max")) {
      return;
    }
    const [load, max] = input.getData("load", "max");
    if (!(load < max)) {
      // Waiting for load to decrease
      // FIXME: Workaround for https://github.com/noflo/noflo/issues/558
      setTimeout(() => output.done(), 1);
      return;
    }
    // Release one packet at a time
    const data = input.getData("in");
    // FIXME: Workaround for https://github.com/noflo/noflo/issues/558
    setTimeout(() => output.sendDone({ out: data }), 1);
  });

  return c;
}
