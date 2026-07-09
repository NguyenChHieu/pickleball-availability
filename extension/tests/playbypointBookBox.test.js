const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

class FakeClassList {
  constructor(element, values = []) {
    this.element = element;
    this.values = new Set(values);
  }

  contains(value) {
    if (value === "primary" && this.element.kind === "type") return true;
    if ((value === "selected" || value === "active") && this.element.isSelected?.()) return true;
    return this.values.has(value);
  }
}

class FakeElement {
  constructor({
    tag = "div",
    text = "",
    classes = [],
    attrs = {},
    kind = "",
    onClick = null,
    isSelected = null,
    disabled = false,
    children = [],
  } = {}) {
    this.tag = tag;
    this.text = text;
    this.attrs = attrs;
    this.kind = kind;
    this.onClick = onClick;
    this.isSelected = isSelected;
    this.disabledState = disabled;
    this.children = [];
    this.parentElement = null;
    this.classList = new FakeClassList(this, classes);
    for (const child of children) this.append(child);
  }

  get disabled() {
    return typeof this.disabledState === "function" ? this.disabledState() : this.disabledState;
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  get innerText() {
    return this.text || this.children.map((child) => child.innerText).filter(Boolean).join(" ");
  }

  get textContent() {
    return this.innerText;
  }

  get className() {
    const values = Array.from(this.classList.values);
    if (this.classList.contains("primary")) values.push("primary");
    if (this.classList.contains("selected")) values.push("selected");
    return values.join(" ");
  }

  getAttribute(name) {
    if (name === "data-react-class" && this.kind === "bookbox") return "BookBox";
    if (name === "aria-selected" && this.isSelected?.()) return "true";
    return this.attrs[name] ?? null;
  }

  click() {
    this.onClick?.();
  }

  getBoundingClientRect() {
    return { width: 100, height: 32 };
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (selector === ".mb20") return this.classList.contains("mb20");
    if (selector === ".StepperItem") return this.classList.contains("StepperItem");
    if (selector === "section") return this.tag === "section";
    if (selector === "button") return this.tag === "button";
    if (selector === "[role='button']") return this.attrs.role === "button";
    if (selector === ".ButtonOption") return this.classList.contains("ButtonOption");
    if (selector === ".ButtonOption.primary") {
      return this.classList.contains("ButtonOption") && this.classList.contains("primary");
    }
    if (selector === ".summary") return this.classList.contains("summary");
    if (selector === ".DaysRangeOptions") return this.classList.contains("DaysRangeOptions");
    if (selector === ".month") return this.classList.contains("month");
    if (selector === ".range-container") return this.classList.contains("range-container");
    if (selector === ".day_name") return this.classList.contains("day_name");
    if (selector === ".day_number") return this.classList.contains("day_number");
    if (selector === "h2") return this.tag === "h2";
    if (selector === ".day-container button") {
      return this.tag === "button" && this.parentElement?.classList.contains("day-container");
    }
    return false;
  }

  querySelector(selector) {
    if (selector === ".StepperItem .summary") {
      return this.querySelectorAll(".summary").find((element) => element.closest(".StepperItem")) || null;
    }
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((part) => part.trim());
    const results = [];
    const visit = (element) => {
      for (const current of selectors) {
        if (element.matches(current)) {
          results.push(element);
          break;
        }
      }
      for (const child of element.children) visit(child);
    };
    for (const child of this.children) visit(child);
    return results;
  }
}

function createBookBox({ clearCourtOnTime = true, selectInvalidCourt = false } = {}) {
  const state = { selectedDate: "Thursday, July 16", selectedTime: "", selectedCourt: "" };
  const availability = {
    "9pm-10pm": new Set(["Court 4"]),
    "10pm-11pm": new Set(["Court 1", "Court 2", "Court 3", "Court 5", "Court 6"]),
  };

  const root = new FakeElement({ kind: "bookbox" });
  const summary = new FakeElement({ classes: ["summary"] });
  Object.defineProperty(summary, "innerText", {
    get: () => `${state.selectedDate}, No time selected`,
  });
  root.append(new FakeElement({ classes: ["StepperItem"], children: [summary] }));

  root.append(
    new FakeElement({
      classes: ["DaysRangeOptions"],
      children: [
        new FakeElement({
          classes: ["range-container"],
          children: [
            new FakeElement({
              classes: ["day-container"],
              children: [
                new FakeElement({
                  tag: "button",
                  onClick: () => {
                    state.selectedDate = "Thursday, July 16";
                    state.selectedTime = "";
                    state.selectedCourt = "";
                  },
                  children: [
                    new FakeElement({ classes: ["day_name"], text: "Thu" }),
                    new FakeElement({ classes: ["day_number"], text: "16" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  root.append(
    new FakeElement({
      classes: ["mb20"],
      children: [
        new FakeElement({ tag: "h2", text: "Select Type" }),
        new FakeElement({ classes: ["ButtonOption"], kind: "type", text: "Court booking" }),
      ],
    })
  );

  root.append(
    new FakeElement({
      classes: ["mb20"],
      children: [
        new FakeElement({ tag: "h2", text: "Select Time" }),
        ...Object.keys(availability).map(
          (time) =>
            new FakeElement({
              classes: ["ButtonOption"],
              text: time,
              isSelected: () => state.selectedTime === time,
              onClick: () => {
                state.selectedTime = time;
                if (clearCourtOnTime) state.selectedCourt = "";
              },
            })
        ),
      ],
    })
  );

  root.append(
    new FakeElement({
      classes: ["mb20"],
      children: [
        new FakeElement({ tag: "h2", text: "Select Detail" }),
        ...["Court 1", "Court 2", "Court 3", "Court 4", "Court 5", "Court 6"].map(
          (court) =>
            new FakeElement({
              classes: ["ButtonOption"],
              text: court,
              isSelected: () => state.selectedCourt === court,
              onClick: () => {
                if (selectInvalidCourt || availability[state.selectedTime]?.has(court)) state.selectedCourt = court;
              },
            })
        ),
      ],
    })
  );

  root.append(
    new FakeElement({
      tag: "button",
      text: "Next",
      disabled: () => !state.selectedTime || !availability[state.selectedTime]?.has(state.selectedCourt),
    })
  );
  return root;
}

function installFakeBookBox(root) {
  global.window = {
    location: { href: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true" },
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto" }),
  };
  global.document = {
    body: root,
    querySelector: (selector) => (selector === '[data-react-class="BookBox"]' ? root : root.querySelector(selector)),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
  };
  global.AvailabilityProviders = {};

  const providerPath = path.resolve(__dirname, "../providers/playbypointBookBox.js");
  delete require.cache[providerPath];
  require(providerPath);

  return global.AvailabilityProviders["playbypoint-bookbox"].readAvailability({
    id: "propickle",
    name: "ProPickle",
    startUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
  });
}

test("Playbypoint reader probes accepted court details per time before assigning continuity", async () => {
  const root = createBookBox();
  assert.equal(root.querySelectorAll("h2").length, 3);
  assert.equal(root.querySelectorAll(".ButtonOption, button, [role='button']").length, 11);
  const payload = await installFakeBookBox(root);
  const day = payload.days[0];

  assert.deepEqual(day.open_intervals, [{ start_time: "9pm", end_time: "11pm" }]);
  assert.equal(day.continuity_status, "available");
  assert.equal(day.probe_debug.filter((probe) => probe.accepted).length, 6);
  assert.deepEqual(
    day.probe_debug
      .filter((probe) => probe.start_time === "9pm" && probe.end_time === "10pm" && !probe.accepted)
      .map((probe) => `${probe.court_name}:${probe.reason}`)
      .sort(),
    [
      "Court 1:not_selected",
      "Court 2:not_selected",
      "Court 3:not_selected",
      "Court 5:not_selected",
      "Court 6:not_selected",
    ]
  );
  const byCourt = day.same_court_intervals
    .map((group) => ({ court: group.court_name, intervals: group.intervals }))
    .sort((left, right) => left.court.localeCompare(right.court));
  assert.deepEqual(
    byCourt,
    [
      { court: "Court 1", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 2", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 3", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 4", intervals: [{ start_time: "9pm", end_time: "10pm" }] },
      { court: "Court 5", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 6", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
    ]
  );
});

test("Playbypoint reader does not reuse a stale selected court when the next time is clicked", async () => {
  const payload = await installFakeBookBox(createBookBox({ clearCourtOnTime: false }));
  const day = payload.days[0];
  const byCourt = day.same_court_intervals
    .map((group) => ({ court: group.court_name, intervals: group.intervals }))
    .sort((left, right) => left.court.localeCompare(right.court));

  assert.deepEqual(
    byCourt,
    [
      { court: "Court 1", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 2", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 3", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 4", intervals: [{ start_time: "9pm", end_time: "10pm" }] },
      { court: "Court 5", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 6", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
    ]
  );
});

test("Playbypoint reader ignores visually selected courts when the widget still blocks next step", async () => {
  const payload = await installFakeBookBox(createBookBox({ selectInvalidCourt: true }));
  const day = payload.days[0];
  assert.equal(
    day.probe_debug.find(
      (probe) => probe.start_time === "10pm" && probe.end_time === "11pm" && probe.court_name === "Court 4"
    )?.reason,
    "next_blocked"
  );
  const byCourt = day.same_court_intervals
    .map((group) => ({ court: group.court_name, intervals: group.intervals }))
    .sort((left, right) => left.court.localeCompare(right.court));

  assert.deepEqual(
    byCourt,
    [
      { court: "Court 1", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 2", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 3", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 4", intervals: [{ start_time: "9pm", end_time: "10pm" }] },
      { court: "Court 5", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court: "Court 6", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
    ]
  );
});
