import { describe, expect, it } from "vitest";
import { AnalysisScheduler, type AnalysisJobPriority } from "./analysis-scheduler";

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((accept) => { resolve = accept; });
  return { promise, resolve };
}

describe("AnalysisScheduler", () => {
  it("runs queued current-position work before variations and background work", async () => {
    const scheduler = new AnalysisScheduler(1);
    const gate = deferred();
    const order: string[] = [];
    const running = scheduler.run("background-game", async () => {
      order.push("active-background");
      await gate.promise;
    });
    const jobs: Array<[AnalysisJobPriority, string]> = [
      ["background-game", "queued-background"],
      ["interactive-variation", "variation"],
      ["interactive-position", "position"],
    ];
    const queued = jobs.map(([priority, label]) => scheduler.run(priority, async () => { order.push(label); }));

    expect(scheduler.activeCount).toBe(1);
    expect(scheduler.pendingCount).toBe(3);
    gate.resolve();
    await Promise.all([running, ...queued]);

    expect(order).toEqual(["active-background", "position", "variation", "queued-background"]);
  });

  it("never exceeds its configured capacity", async () => {
    const scheduler = new AnalysisScheduler(2);
    const gate = deferred();
    let active = 0;
    let maximum = 0;
    const tasks = Array.from({ length: 5 }, (_, index) => scheduler.run(
      index === 4 ? "interactive-position" : "background-game",
      async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await gate.promise;
        active -= 1;
      },
    ));
    expect(scheduler.activeCount).toBe(2);
    gate.resolve();
    await Promise.all(tasks);
    expect(maximum).toBe(2);
  });

  it("runs two background games in parallel when capacity allows it", async () => {
    const scheduler = new AnalysisScheduler(2);
    const first = deferred();
    const second = deferred();
    let activeBackground = 0;
    let maximumBackground = 0;
    const runBackground = (gate: ReturnType<typeof deferred>) => scheduler.run("background-game", async () => {
      activeBackground += 1;
      maximumBackground = Math.max(maximumBackground, activeBackground);
      await gate.promise;
      activeBackground -= 1;
    });
    const one = runBackground(first);
    const two = runBackground(second);

    expect(scheduler.activeCount).toBe(2);
    expect(scheduler.pendingCount).toBe(0);
    first.resolve();
    await one;
    second.resolve();
    await two;
    expect(maximumBackground).toBe(2);
  });

  it("can reserve a slot for interactive work when configured", async () => {
    const scheduler = new AnalysisScheduler(2, 1);
    const first = deferred();
    const second = deferred();
    const one = scheduler.run("background-game", () => first.promise);
    const two = scheduler.run("background-game", () => second.promise);

    expect(scheduler.activeCount).toBe(1);
    expect(scheduler.pendingCount).toBe(1);
    first.resolve();
    await one;
    second.resolve();
    await two;
  });

  it("removes an aborted queued job without running it", async () => {
    const scheduler = new AnalysisScheduler(1);
    const gate = deferred();
    const active = scheduler.run("background-game", () => gate.promise);
    const controller = new AbortController();
    let ran = false;
    const queued = scheduler.run("interactive-position", async () => { ran = true; }, controller.signal);
    controller.abort();

    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    expect(ran).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
    gate.resolve();
    await active;
  });
});
